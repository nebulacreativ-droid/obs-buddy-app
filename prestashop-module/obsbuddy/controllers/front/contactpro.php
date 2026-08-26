<?php
/**
 * Reçoit une demande de contact professionnel et l'enregistre dans le
 * Service client de PrestaShop (Clients > SAV).
 *
 * Pourquoi ici plutôt que via l'API Webservice : la clé API de l'assistant est
 * volontairement en LECTURE SEULE. Écrire dans la boutique depuis un service
 * externe supposerait de lui donner des droits d'écriture, ce qu'un chatbot
 * n'a aucune raison d'avoir. Le module, lui, tourne déjà sur la boutique.
 *
 * Appel : POST /index.php?fc=module&module=obsbuddy&controller=contactpro
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

class ObsbuddyContactproModuleFrontController extends ModuleFrontController
{
    public $ssl = true;
    public $ajax = true;

    const MAX_CHAMP = 200;
    const MAX_MESSAGE = 1500;

    /** Quotas par visiteur : une vraie demande de compte pro est un acte rare. */
    const MAX_PAR_HEURE = 3;
    const MAX_PAR_JOUR = 8;

    /** Fenêtre pendant laquelle une demande identique est vue comme un doublon. */
    const MINUTES_DOUBLON = 30;

    /** Au-delà, les traces de limitation ne servent plus à rien. */
    const RETENTION_JOURS = 7;

    public function initContent()
    {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store, no-cache, must-revalidate');

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->repondre(['ok' => false, 'erreur' => 'Méthode non autorisée.']);
        }

        $champs = $this->champsValides();
        if (isset($champs['erreur'])) {
            $this->repondre(['ok' => false, 'erreur' => $champs['erreur']]);
        }

        $empreinteIp = $this->empreinteIp();
        $empreinteContenu = $this->empreinteContenu($champs);

        $this->purgerAnciennesTraces();

        // Un doublon exact est traité comme un succès : renvoyer une erreur
        // pousserait un client légitime ayant double-cliqué à tout recommencer.
        if ($this->estUnDoublon($empreinteContenu)) {
            $this->repondre(['ok' => true, 'doublon' => true]);
        }

        $refus = $this->quotaDepasse($empreinteIp);
        if ($refus !== null) {
            $this->repondre(['ok' => false, 'erreur' => $refus]);
        }

        $idContact = $this->contactParDefaut();
        if (!$idContact) {
            $this->repondre(['ok' => false, 'erreur' => 'Boutique mal configurée : aucun contact SAV.']);
        }

        $fil = new CustomerThread();
        $fil->id_shop = (int) $this->context->shop->id;
        $fil->id_lang = (int) $this->context->language->id;
        $fil->id_contact = $idContact;
        $fil->email = $champs['email'];
        $fil->status = 'open';
        $fil->token = Tools::passwdGen(12);

        // Rattache la demande au compte existant si l'email en a un.
        $client = new Customer();
        $existant = $client->getByEmail($champs['email']);
        if (Validate::isLoadedObject($existant)) {
            $fil->id_customer = (int) $existant->id;
        }

        if (!$fil->add()) {
            $this->repondre(['ok' => false, 'erreur' => "Impossible d'enregistrer la demande."]);
        }

        $message = new CustomerMessage();
        $message->id_customer_thread = (int) $fil->id;
        $message->message = $this->corpsDuMessage($champs);
        $message->private = 0;

        if (!$message->add()) {
            $this->repondre(['ok' => false, 'erreur' => "Impossible d'enregistrer la demande."]);
        }

        $this->enregistrerTrace($empreinteIp, $empreinteContenu);

        $this->repondre(['ok' => true, 'reference' => $fil->token]);
    }

    // ── Limitation d'abus ──────────────────────────────────────────────────

    /**
     * L'adresse IP n'est jamais stockée en clair : seul son condensé l'est, et
     * il suffit à compter les envois. Le sel est la clé secrète de la boutique,
     * donc l'empreinte n'est ni réversible ni comparable hors de cette
     * installation.
     */
    protected function empreinteIp()
    {
        return hash('sha256', _COOKIE_KEY_ . '|ip|' . Tools::getRemoteAddr());
    }

    protected function empreinteContenu(array $c)
    {
        return hash(
            'sha256',
            _COOKIE_KEY_ . '|contenu|' . Tools::strtolower($c['email']) . '|' . $c['message']
        );
    }

    protected function table()
    {
        return _DB_PREFIX_ . 'obsbuddy_demande';
    }

    protected function compter($condition)
    {
        try {
            return (int) Db::getInstance()->getValue(
                'SELECT COUNT(*) FROM `' . $this->table() . '` WHERE ' . $condition
            );
        } catch (Exception $e) {
            // Table absente (module installé avant cette version) : on ne
            // bloque pas les demandes légitimes pour autant.
            return 0;
        }
    }

    protected function estUnDoublon($empreinteContenu)
    {
        return $this->compter(
            '`empreinte_contenu` = "' . pSQL($empreinteContenu) . '"'
            . ' AND `date_add` > DATE_SUB(NOW(), INTERVAL ' . (int) self::MINUTES_DOUBLON . ' MINUTE)'
        ) > 0;
    }

    /** Renvoie le message de refus, ou null si la demande peut passer. */
    protected function quotaDepasse($empreinteIp)
    {
        $ip = pSQL($empreinteIp);

        $parHeure = $this->compter(
            '`empreinte_ip` = "' . $ip . '" AND `date_add` > DATE_SUB(NOW(), INTERVAL 1 HOUR)'
        );
        if ($parHeure >= self::MAX_PAR_HEURE) {
            return 'Tu as déjà envoyé plusieurs demandes. Laisse-nous le temps d\'y répondre, '
                . 'notre équipe revient vers toi très vite.';
        }

        $parJour = $this->compter(
            '`empreinte_ip` = "' . $ip . '" AND `date_add` > DATE_SUB(NOW(), INTERVAL 1 DAY)'
        );
        if ($parJour >= self::MAX_PAR_JOUR) {
            return 'Trop de demandes envoyées aujourd\'hui. Contacte directement le service client.';
        }

        return null;
    }

    protected function enregistrerTrace($empreinteIp, $empreinteContenu)
    {
        try {
            Db::getInstance()->insert('obsbuddy_demande', [
                'empreinte_ip' => pSQL($empreinteIp),
                'empreinte_contenu' => pSQL($empreinteContenu),
                'date_add' => date('Y-m-d H:i:s'),
            ]);
        } catch (Exception $e) {
            // La demande est déjà enregistrée en SAV : ne pas la faire échouer
            // pour un simple souci de journalisation.
        }
    }

    protected function purgerAnciennesTraces()
    {
        try {
            Db::getInstance()->execute(
                'DELETE FROM `' . $this->table() . '`'
                . ' WHERE `date_add` < DATE_SUB(NOW(), INTERVAL ' . (int) self::RETENTION_JOURS . ' DAY)'
            );
        } catch (Exception $e) {
            /* sans conséquence */
        }
    }

    // ── Validation ─────────────────────────────────────────────────────────

    /** Récupère et valide les champs. Rien n'est inséré sans contrôle de format. */
    protected function champsValides()
    {
        $lire = function ($nom, $max) {
            return mb_substr(trim((string) Tools::getValue($nom, '')), 0, $max);
        };

        $email = $lire('email', self::MAX_CHAMP);
        $nom = $lire('nom', self::MAX_CHAMP);
        $telephone = $lire('telephone', 40);
        $message = $lire('message', self::MAX_MESSAGE);
        $siret = preg_replace('/\s+/', '', $lire('siret', 40));

        if (!Validate::isEmail($email)) {
            return ['erreur' => "L'adresse email n'est pas valide."];
        }
        if ($nom === '') {
            return ['erreur' => 'Le nom est obligatoire.'];
        }
        if (strlen(preg_replace('/\D/', '', $telephone)) < 9) {
            return ['erreur' => "Le numéro de téléphone n'est pas valide."];
        }
        if ($message === '') {
            return ['erreur' => 'Merci de préciser votre demande.'];
        }
        // Société et SIRET sont facultatifs : un projet en création n'est pas
        // encore immatriculé. Mais un SIRET fourni doit être bien formé.
        if ($siret !== '' && !preg_match('/^\d{14}$/', $siret)) {
            return ['erreur' => 'Le SIRET doit comporter 14 chiffres.'];
        }

        return [
            'email' => $email,
            'nom' => $nom,
            'telephone' => $telephone,
            'message' => $message,
            'rappel' => $lire('rappel', 10) !== '',
            'siret' => $siret,
            'societe' => $lire('societe', self::MAX_CHAMP),
            'activite' => $lire('activite', self::MAX_CHAMP),
            'ville' => $lire('ville', self::MAX_CHAMP),
        ];
    }

    /**
     * Le corps est reconstruit à partir des champs validés : rien de ce qui
     * arrive n'est réinjecté tel quel dans un format interprétable.
     */
    protected function corpsDuMessage(array $c)
    {
        $lignes = [
            'Demande de contact professionnel (via O\'Buddy)',
            '',
            'Contact : ' . $c['nom'],
            'Email : ' . $c['email'],
            'Téléphone : ' . $c['telephone'],
            'Rappel souhaité : ' . ($c['rappel'] ? 'OUI' : 'non'),
        ];

        // Les champs facultatifs ne figurent que s'ils ont été renseignés :
        // une ligne "non précisée" n'apporte rien à l'équipe.
        $facultatifs = [
            'Raison sociale' => $c['societe'],
            'SIRET' => $c['siret'],
            'Activité' => $c['activite'],
            'Ville' => $c['ville'],
        ];
        foreach ($facultatifs as $libelle => $valeur) {
            if ($valeur !== '') {
                $lignes[] = $libelle . ' : ' . $valeur;
            }
        }

        $lignes[] = '';
        $lignes[] = 'Demande :';
        $lignes[] = $c['message'];

        return implode("\n", $lignes);
    }

    protected function contactParDefaut()
    {
        $contacts = Contact::getContacts((int) $this->context->language->id);
        return !empty($contacts) ? (int) $contacts[0]['id_contact'] : 0;
    }

    protected function repondre(array $donnees)
    {
        echo json_encode($donnees);
        exit;
    }
}
