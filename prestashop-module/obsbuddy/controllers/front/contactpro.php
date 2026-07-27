<?php
/**
 * Reçoit une demande de compte professionnel et l'enregistre dans le
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

        $this->repondre(['ok' => true, 'reference' => $fil->token]);
    }

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
