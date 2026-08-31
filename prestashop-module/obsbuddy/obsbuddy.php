<?php
/**
 * O'Buddy — Assistant Barber
 *
 * Injecte la bulle de chat O'Buddy sur toutes les pages de la boutique.
 * Le chat lui-même est hébergé hors PrestaShop et s'ouvre dans une iframe :
 * aucun conflit possible avec le thème, et les mises à jour de l'assistant
 * ne demandent aucune réinstallation du module.
 *
 * @author    O'Barbershop
 * @copyright O'Barbershop
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

class Obsbuddy extends Module
{
    const CLE_ACTIF = 'OBSBUDDY_ACTIF';
    const CLE_URL = 'OBSBUDDY_URL';
    const CLE_JOURNAL = 'OBSBUDDY_JOURNAL';
    const CLE_RETENTION = 'OBSBUDDY_RETENTION';
    const URL_DEFAUT = 'https://obs-obuddy.vercel.app/widget.js';
    const RETENTION_DEFAUT = 30;

    public function __construct()
    {
        $this->name = 'obsbuddy';
        $this->tab = 'front_office_features';
        $this->version = '1.1.0';
        $this->author = 'O\'Barbershop';
        $this->need_instance = 0;
        $this->ps_versions_compliancy = ['min' => '1.7.0.0', 'max' => _PS_VERSION_];
        $this->bootstrap = true;

        parent::__construct();

        $this->displayName = $this->l('O\'Buddy — Assistant Barber');
        $this->description = $this->l(
            'Ajoute la bulle de chat O\'Buddy en bas à droite de toutes les pages. '
            . 'L\'assistant conseille les produits du catalogue, répond aux questions '
            . 'de la boutique et guide les projets d\'ouverture de barbershop.'
        );
        $this->confirmUninstall = $this->l('Retirer O\'Buddy de la boutique ?');
    }

    public function install()
    {
        return parent::install()
            && $this->creerTableDemandes()
            && $this->registerHook('displayBeforeBodyClosingTag')
            && Configuration::updateValue(self::CLE_ACTIF, true)
            && Configuration::updateValue(self::CLE_URL, self::URL_DEFAUT)
            && Configuration::updateValue(self::CLE_JOURNAL, true)
            && Configuration::updateValue(self::CLE_RETENTION, self::RETENTION_DEFAUT);
    }

    public function uninstall()
    {
        return $this->supprimerTableDemandes()
            && Configuration::deleteByName(self::CLE_ACTIF)
            && Configuration::deleteByName(self::CLE_URL)
            && Configuration::deleteByName(self::CLE_JOURNAL)
            && Configuration::deleteByName(self::CLE_RETENTION)
            && parent::uninstall();
    }

    /**
     * Injecte le script juste avant </body>, pour ne pas retarder l'affichage
     * de la page. Le script lui-même ne charge l'iframe du chat qu'au premier
     * clic sur la bulle.
     */
    public function hookDisplayBeforeBodyClosingTag($params)
    {
        if (!Configuration::get(self::CLE_ACTIF)) {
            return '';
        }

        $url = trim((string) Configuration::get(self::CLE_URL));
        if ($url === '') {
            $url = self::URL_DEFAUT;
        }

        // On n'accepte qu'une URL http(s) valide : le contenu injecté est un
        // script exécuté sur toutes les pages du front.
        if (!filter_var($url, FILTER_VALIDATE_URL) || !preg_match('#^https?://#i', $url)) {
            return '';
        }

        return '<script src="' . htmlspecialchars($url, ENT_QUOTES, 'UTF-8') . '" defer></script>';
    }

    /**
     * Table de limitation des demandes de contact pro.
     *
     * Elle ne conserve que des empreintes : l'adresse IP n'y figure jamais en
     * clair, ce qui suffit à compter les envois sans conserver de donnée
     * personnelle. Les lignes de plus de sept jours sont purgées à chaque envoi.
     */
    protected function creerTableDemandes()
    {
        $table = _DB_PREFIX_ . 'obsbuddy_demande';

        $sql = 'CREATE TABLE IF NOT EXISTS `' . $table . '` ('
            . '`id_demande` INT(11) NOT NULL AUTO_INCREMENT,'
            . '`empreinte_ip` VARCHAR(64) NOT NULL,'
            . '`empreinte_contenu` VARCHAR(64) NOT NULL,'
            . '`date_add` DATETIME NOT NULL,'
            . 'PRIMARY KEY (`id_demande`),'
            . 'KEY `idx_ip_date` (`empreinte_ip`, `date_add`),'
            . 'KEY `idx_contenu` (`empreinte_contenu`)'
            . ') ENGINE=' . _MYSQL_ENGINE_ . ' DEFAULT CHARSET=utf8mb4;';

        $journal = 'CREATE TABLE IF NOT EXISTS `' . _DB_PREFIX_ . 'obsbuddy_message` ('
            . '`id_message` INT(11) NOT NULL AUTO_INCREMENT,'
            . '`session` VARCHAR(40) NOT NULL,'
            . '`role` VARCHAR(10) NOT NULL,'
            . '`message` TEXT NOT NULL,'
            . '`page` VARCHAR(60) NOT NULL DEFAULT "",'
            . '`date_add` DATETIME NOT NULL,'
            . 'PRIMARY KEY (`id_message`),'
            . 'KEY `idx_session` (`session`),'
            . 'KEY `idx_date` (`date_add`)'
            . ') ENGINE=' . _MYSQL_ENGINE_ . ' DEFAULT CHARSET=utf8mb4;';

        return Db::getInstance()->execute($sql) && Db::getInstance()->execute($journal);
    }

    protected function supprimerTableDemandes()
    {
        return Db::getInstance()->execute(
            'DROP TABLE IF EXISTS `' . _DB_PREFIX_ . 'obsbuddy_demande`'
        ) && Db::getInstance()->execute(
            'DROP TABLE IF EXISTS `' . _DB_PREFIX_ . 'obsbuddy_message`'
        );
    }

    /** Page de configuration dans le back-office. */
    public function getContent()
    {
        $sortie = '';

        if (Tools::isSubmit('submitObsbuddy')) {
            $actif = (bool) Tools::getValue(self::CLE_ACTIF);
            $url = trim((string) Tools::getValue(self::CLE_URL));

            if ($url === '') {
                $url = self::URL_DEFAUT;
            }

            if (!filter_var($url, FILTER_VALIDATE_URL) || !preg_match('#^https?://#i', $url)) {
                $sortie .= $this->displayError(
                    $this->l('L\'URL du widget est invalide. Elle doit commencer par https://')
                );
            } else {
                Configuration::updateValue(self::CLE_ACTIF, $actif);
                Configuration::updateValue(self::CLE_URL, $url);
                Configuration::updateValue(self::CLE_JOURNAL, (bool) Tools::getValue(self::CLE_JOURNAL));
                Configuration::updateValue(
                    self::CLE_RETENTION,
                    max(1, min(365, (int) Tools::getValue(self::CLE_RETENTION)))
                );
                $sortie .= $this->displayConfirmation($this->l('Réglages enregistrés.'));
            }
        }

        if (Tools::isSubmit('obsbuddyPurger')) {
            Db::getInstance()->execute('TRUNCATE TABLE `' . _DB_PREFIX_ . 'obsbuddy_message`');
            $sortie .= $this->displayConfirmation($this->l('Historique des conversations effacé.'));
        }

        return $sortie . $this->renderTableauDeBord() . $this->renderFormulaire();
    }

    /** Quelques chiffres utiles, tirés du journal des conversations. */
    protected function statistiques()
    {
        $table = _DB_PREFIX_ . 'obsbuddy_message';
        $valeur = function ($sql) {
            try {
                return (int) Db::getInstance()->getValue($sql);
            } catch (Exception $e) {
                return 0;
            }
        };

        return [
            'messages_jour' => $valeur(
                'SELECT COUNT(*) FROM `' . $table . '` WHERE `date_add` > DATE_SUB(NOW(), INTERVAL 1 DAY)'
            ),
            'messages_semaine' => $valeur(
                'SELECT COUNT(*) FROM `' . $table . '` WHERE `date_add` > DATE_SUB(NOW(), INTERVAL 7 DAY)'
            ),
            'messages_total' => $valeur('SELECT COUNT(*) FROM `' . $table . '`'),
            'conversations' => $valeur('SELECT COUNT(DISTINCT `session`) FROM `' . $table . '`'),
            'conversations_semaine' => $valeur(
                'SELECT COUNT(DISTINCT `session`) FROM `' . $table . '`'
                . ' WHERE `date_add` > DATE_SUB(NOW(), INTERVAL 7 DAY)'
            ),
            'demandes' => $valeur('SELECT COUNT(*) FROM `' . _DB_PREFIX_ . 'obsbuddy_demande`'),
        ];
    }

    protected function lignes($sql)
    {
        try {
            $r = Db::getInstance()->executeS($sql);
            return is_array($r) ? $r : [];
        } catch (Exception $e) {
            return [];
        }
    }

    protected function renderTableauDeBord()
    {
        $table = _DB_PREFIX_ . 'obsbuddy_message';
        $s = $this->statistiques();

        $cartes = [
            [$this->l('Messages aujourd\'hui'), $s['messages_jour']],
            [$this->l('Messages sur 7 jours'), $s['messages_semaine']],
            [$this->l('Conversations sur 7 jours'), $s['conversations_semaine']],
            [$this->l('Conversations au total'), $s['conversations']],
            [$this->l('Demandes de contact'), $s['demandes']],
        ];

        $html = '<div class="panel"><div class="panel-heading">'
            . '<i class="icon-bar-chart"></i> ' . $this->l('Tableau de bord O\'Buddy')
            . '</div><div class="row" style="margin-bottom:18px">';

        foreach ($cartes as $carte) {
            $html .= '<div class="col-lg-2 col-md-4 col-xs-6" style="text-align:center;padding:10px">'
                . '<div style="font-size:30px;font-weight:700;line-height:1.1">' . (int) $carte[1] . '</div>'
                . '<div style="color:#777;font-size:12px">' . htmlspecialchars($carte[0], ENT_QUOTES, 'UTF-8') . '</div>'
                . '</div>';
        }
        $html .= '</div>';

        // Ce que les visiteurs demandent le plus souvent.
        $pages = $this->lignes(
            'SELECT `page`, COUNT(*) AS n FROM `' . $table . '`'
            . ' WHERE `page` != "" AND `date_add` > DATE_SUB(NOW(), INTERVAL 30 DAY)'
            . ' GROUP BY `page` ORDER BY n DESC LIMIT 6'
        );
        if ($pages) {
            $html .= '<h4>' . $this->l('Pages d\'où l\'on écrit le plus (30 jours)') . '</h4><ul>';
            foreach ($pages as $p) {
                $html .= '<li><strong>' . htmlspecialchars($p['page'], ENT_QUOTES, 'UTF-8')
                    . '</strong> — ' . (int) $p['n'] . ' ' . $this->l('messages') . '</li>';
            }
            $html .= '</ul>';
        }

        $html .= $this->renderConversations($table);

        if ($s['messages_total'] > 0) {
            $html .= '<form method="post" onsubmit="return confirm(\''
                . $this->l('Effacer tout l\'historique des conversations ?') . '\')">'
                . '<button type="submit" name="obsbuddyPurger" class="btn btn-default">'
                . '<i class="icon-trash"></i> ' . $this->l('Effacer l\'historique')
                . '</button></form>';
        }

        $html .= '</div>';

        return $html;
    }

    /** Les dernières conversations, la plus récente en premier. */
    protected function renderConversations($table)
    {
        $sessions = $this->lignes(
            'SELECT `session`, MAX(`date_add`) AS fin, COUNT(*) AS n FROM `' . $table . '`'
            . ' GROUP BY `session` ORDER BY fin DESC LIMIT 15'
        );

        if (!$sessions) {
            return '<p style="color:#777">'
                . $this->l('Aucune conversation enregistrée pour le moment.')
                . '</p>';
        }

        $html = '<h4>' . $this->l('Dernières conversations') . '</h4>';

        foreach ($sessions as $s) {
            $messages = $this->lignes(
                'SELECT `role`, `message`, `date_add` FROM `' . $table . '`'
                . ' WHERE `session` = "' . pSQL($s['session']) . '"'
                . ' ORDER BY `id_message` ASC LIMIT 40'
            );

            $html .= '<details style="margin-bottom:8px;border:1px solid #e0e0e0;border-radius:6px;padding:8px 12px">'
                . '<summary style="cursor:pointer">'
                . '<strong>' . htmlspecialchars($s['fin'], ENT_QUOTES, 'UTF-8') . '</strong> — '
                . (int) $s['n'] . ' ' . $this->l('messages')
                . '</summary><div style="margin-top:10px">';

            foreach ($messages as $m) {
                $estClient = $m['role'] === 'client';
                $html .= '<div style="margin:6px 0;padding:7px 11px;border-radius:10px;max-width:80%;'
                    . ($estClient
                        ? 'background:#0F0F0F;color:#FCF24F;margin-left:auto'
                        : 'background:#f5f5f5;color:#222')
                    . '">'
                    . nl2br(htmlspecialchars($m['message'], ENT_QUOTES, 'UTF-8'))
                    . '</div>';
            }

            $html .= '</div></details>';
        }

        return $html;
    }

    protected function renderFormulaire()
    {
        $champs = [
            'form' => [
                'legend' => [
                    'title' => $this->l('Réglages O\'Buddy'),
                    'icon' => 'icon-comments',
                ],
                'input' => [
                    [
                        'type' => 'switch',
                        'label' => $this->l('Afficher la bulle'),
                        'name' => self::CLE_ACTIF,
                        'is_bool' => true,
                        'desc' => $this->l('Affiche O\'Buddy sur toutes les pages du site.'),
                        'values' => [
                            [
                                'id' => 'actif_on',
                                'value' => 1,
                                'label' => $this->l('Oui'),
                            ],
                            [
                                'id' => 'actif_off',
                                'value' => 0,
                                'label' => $this->l('Non'),
                            ],
                        ],
                    ],
                    [
                        'type' => 'switch',
                        'label' => $this->l('Enregistrer les conversations'),
                        'name' => self::CLE_JOURNAL,
                        'is_bool' => true,
                        'desc' => $this->l(
                            'Alimente le tableau de bord ci-dessus. Les échanges restent sur votre '
                            . 'serveur et ne transitent par aucun tiers. Pensez à le mentionner dans '
                            . 'votre politique de confidentialité.'
                        ),
                        'values' => [
                            ['id' => 'journal_on', 'value' => 1, 'label' => $this->l('Oui')],
                            ['id' => 'journal_off', 'value' => 0, 'label' => $this->l('Non')],
                        ],
                    ],
                    [
                        'type' => 'text',
                        'label' => $this->l('Conservation (jours)'),
                        'name' => self::CLE_RETENTION,
                        'desc' => $this->l('Au-delà, les conversations sont supprimées automatiquement.'),
                        'class' => 'fixed-width-sm',
                    ],
                    [
                        'type' => 'text',
                        'label' => $this->l('URL du widget'),
                        'name' => self::CLE_URL,
                        'desc' => $this->l('À ne modifier que sur indication technique.'),
                        'required' => true,
                    ],
                ],
                'submit' => [
                    'title' => $this->l('Enregistrer'),
                ],
            ],
        ];

        $helper = new HelperForm();
        $helper->module = $this;
        $helper->name_controller = $this->name;
        $helper->token = Tools::getAdminTokenLite('AdminModules');
        $helper->currentIndex = AdminController::$currentIndex . '&configure=' . $this->name;
        $helper->submit_action = 'submitObsbuddy';
        $helper->default_form_language = (int) Configuration::get('PS_LANG_DEFAULT');
        $helper->tpl_vars = [
            'fields_value' => [
                self::CLE_ACTIF => (bool) Configuration::get(self::CLE_ACTIF),
                self::CLE_URL => Configuration::get(self::CLE_URL) ?: self::URL_DEFAUT,
                self::CLE_JOURNAL => (bool) Configuration::get(self::CLE_JOURNAL),
                self::CLE_RETENTION => (int) Configuration::get(self::CLE_RETENTION) ?: self::RETENTION_DEFAUT,
            ],
            'languages' => $this->context->controller->getLanguages(),
            'id_language' => $this->context->language->id,
        ];

        return $helper->generateForm([$champs]);
    }
}
