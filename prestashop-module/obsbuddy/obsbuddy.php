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
    const URL_DEFAUT = 'https://obs-obuddy.vercel.app/widget.js';

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
            && Configuration::updateValue(self::CLE_URL, self::URL_DEFAUT);
    }

    public function uninstall()
    {
        return $this->supprimerTableDemandes()
            && Configuration::deleteByName(self::CLE_ACTIF)
            && Configuration::deleteByName(self::CLE_URL)
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

        return Db::getInstance()->execute($sql);
    }

    protected function supprimerTableDemandes()
    {
        return Db::getInstance()->execute(
            'DROP TABLE IF EXISTS `' . _DB_PREFIX_ . 'obsbuddy_demande`'
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
                $sortie .= $this->displayConfirmation($this->l('Réglages enregistrés.'));
            }
        }

        return $sortie . $this->renderFormulaire();
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
            ],
            'languages' => $this->context->controller->getLanguages(),
            'id_language' => $this->context->language->id,
        ];

        return $helper->generateForm([$champs]);
    }
}
