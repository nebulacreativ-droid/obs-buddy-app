<?php
/**
 * Journalise les échanges avec O'Buddy, pour alimenter le tableau de bord.
 *
 * Les conversations restent SUR la boutique : elles ne transitent par aucun
 * service tiers et ne sont conservées que le temps réglé dans le module
 * (30 jours par défaut). Une conversation est identifiée par un jeton
 * aléatoire propre à l'onglet, jamais par le client lui-même.
 *
 * Appel : POST /index.php?fc=module&module=obsbuddy&controller=journal
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

class ObsbuddyJournalModuleFrontController extends ModuleFrontController
{
    public $ssl = true;
    public $ajax = true;

    const MAX_MESSAGE = 1200;
    /** Garde-fou : un onglet ne peut pas inonder la table. */
    const MAX_PAR_SESSION = 60;

    public function initContent()
    {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');

        if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !Configuration::get(Obsbuddy::CLE_JOURNAL)) {
            $this->repondre(['ok' => false]);
        }

        $session = preg_replace('/[^a-z0-9]/i', '', (string) Tools::getValue('session', ''));
        $role = Tools::getValue('role') === 'bot' ? 'bot' : 'client';
        $message = mb_substr(trim((string) Tools::getValue('message', '')), 0, self::MAX_MESSAGE);
        $page = mb_substr(trim((string) Tools::getValue('page', '')), 0, 60);

        if (strlen($session) < 8 || $message === '') {
            $this->repondre(['ok' => false]);
        }

        $table = _DB_PREFIX_ . 'obsbuddy_message';

        try {
            $deja = (int) Db::getInstance()->getValue(
                'SELECT COUNT(*) FROM `' . $table . '` WHERE `session` = "' . pSQL($session) . '"'
            );
            if ($deja >= self::MAX_PAR_SESSION) {
                $this->repondre(['ok' => false]);
            }

            Db::getInstance()->insert('obsbuddy_message', [
                'session' => pSQL($session),
                'role' => pSQL($role),
                'message' => pSQL($message),
                'page' => pSQL($page),
                'date_add' => date('Y-m-d H:i:s'),
            ]);

            $this->purger();
        } catch (Exception $e) {
            // Journaliser ne doit jamais casser une conversation en cours.
            $this->repondre(['ok' => false]);
        }

        $this->repondre(['ok' => true]);
    }

    /** Supprime au-delà de la durée de conservation réglée dans le module. */
    protected function purger()
    {
        $jours = (int) Configuration::get(Obsbuddy::CLE_RETENTION);
        if ($jours < 1) {
            $jours = 30;
        }

        // Une purge à chaque message serait inutilement coûteuse.
        if (mt_rand(1, 40) !== 1) {
            return;
        }

        Db::getInstance()->execute(
            'DELETE FROM `' . _DB_PREFIX_ . 'obsbuddy_message`'
            . ' WHERE `date_add` < DATE_SUB(NOW(), INTERVAL ' . $jours . ' DAY)'
        );
    }

    protected function repondre(array $donnees)
    {
        echo json_encode($donnees);
        exit;
    }
}
