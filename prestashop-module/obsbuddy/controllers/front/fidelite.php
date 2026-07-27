<?php
/**
 * Renvoie le palier de fidélité du client CONNECTÉ, au format JSON.
 *
 * Sécurité : aucun paramètre n'est accepté. Le client est identifié par la
 * session PrestaShop et rien d'autre — impossible de consulter le palier de
 * quelqu'un d'autre en manipulant une URL. Les données ne transitent jamais
 * par le serveur de l'assistant : la boutique répond, le widget affiche.
 *
 * Appel : /index.php?fc=module&module=obsbuddy&controller=fidelite
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

class ObsbuddyFideliteModuleFrontController extends ModuleFrontController
{
    public $ssl = true;
    public $ajax = true;

    public function initContent()
    {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store, no-cache, must-revalidate');

        $client = $this->context->customer;

        if (!Validate::isLoadedObject($client) || !$client->isLogged()) {
            $this->repondre(['connecte' => false]);
        }

        $this->repondre([
            'connecte' => true,
            'prenom' => (string) $client->firstname,
            'paliers' => $this->paliersDuClient((int) $client->id),
        ]);
    }

    /**
     * Groupes du client, débarrassés des trois groupes techniques de
     * PrestaShop (visiteur, invité, client) qui ne sont pas des paliers.
     */
    protected function paliersDuClient($idClient)
    {
        $techniques = [
            (int) Configuration::get('PS_UNIDENTIFIED_GROUP'),
            (int) Configuration::get('PS_GUEST_GROUP'),
            (int) Configuration::get('PS_CUSTOMER_GROUP'),
        ];

        $paliers = [];
        foreach (Customer::getGroupsStatic($idClient) as $idGroupe) {
            $idGroupe = (int) $idGroupe;
            if (in_array($idGroupe, $techniques, true)) {
                continue;
            }

            $groupe = new Group($idGroupe, (int) $this->context->language->id);
            if (!Validate::isLoadedObject($groupe)) {
                continue;
            }

            $nom = is_array($groupe->name) ? reset($groupe->name) : $groupe->name;
            if ($nom !== '' && $nom !== false) {
                $paliers[] = (string) $nom;
            }
        }

        return $paliers;
    }

    protected function repondre(array $donnees)
    {
        echo json_encode($donnees);
        exit;
    }
}
