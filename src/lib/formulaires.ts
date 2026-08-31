/**
 * Formulaires posés directement dans la conversation.
 *
 * Demander la référence de commande, puis l'email au tour suivant, c'est deux
 * occasions d'abandonner — et deux fois le clavier sur mobile. Le modèle pose
 * un marqueur, l'interface affiche les cases, le visiteur remplit et envoie
 * une seule fois.
 *
 * Le formulaire ne parle jamais directement à la boutique : il compose une
 * phrase, l'envoie comme un message ordinaire, et c'est O'Buddy qui décide
 * quel outil appeler. Les règles de confidentialité du serveur restent donc
 * les seules à trancher.
 */

export type TypeChamp = "texte" | "email" | "tel" | "zone" | "choix";

export type ChampFormulaire = {
  cle: string;
  libelle: string;
  type: TypeChamp;
  obligatoire: boolean;
  exemple?: string;
  /** Uniquement pour le type "choix" : rendu en pastilles, un doigt suffit. */
  options?: string[];
  /**
   * Laisse le navigateur proposer ce qu'il connaît déjà. Sur mobile, c'est la
   * différence entre une frappe et un appui.
   */
  autoComplete?: string;
  /** Les références de commande sont en majuscules : autant éviter la reprise. */
  majuscules?: boolean;
};

export type ModeleFormulaire = {
  titre: string;
  intro: string;
  champs: ChampFormulaire[];
  bouton: string;
  note?: string;
  /** Ce qui remplace les cases une fois la réponse partie. */
  confirmation: string;
  /** Phrase renvoyée à O'Buddy une fois le formulaire validé. */
  resume: (valeurs: Record<string, string>) => string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const FORMULAIRES: Record<string, ModeleFormulaire> = {
  COMMANDE: {
    titre: "SUIVI DE COMMANDE",
    intro: "Donne-moi les deux et je regarde tout de suite.",
    champs: [
      {
        cle: "reference",
        libelle: "Référence de commande",
        type: "texte",
        obligatoire: true,
        exemple: "XKBKNABJK",
        majuscules: true,
      },
      {
        cle: "email",
        libelle: "Email de la commande",
        type: "email",
        obligatoire: true,
        exemple: "ton@email.com",
      },
    ],
    bouton: "VOIR MA COMMANDE",
    note: "La référence figure sur ton email de confirmation.",
    confirmation: "Référence et email transmis.",
    resume: (v) =>
      `Suivi de commande — référence : ${v.reference}, email : ${v.email}`,
  },

  COMPTE_PRO: {
    titre: "DEMANDE DE COMPTE PRO",
    intro: "Trois infos et ce que tu cherches. L'équipe te recontacte.",
    champs: [
      {
        cle: "nom",
        libelle: "Nom et prénom",
        type: "texte",
        obligatoire: true,
        exemple: "Prénom Nom",
        autoComplete: "name",
      },
      {
        cle: "email",
        libelle: "Email",
        type: "email",
        obligatoire: true,
        exemple: "ton@email.com",
      },
      {
        cle: "telephone",
        libelle: "Téléphone",
        type: "tel",
        obligatoire: true,
        exemple: "06 12 34 56 78",
      },
      {
        // Un clic, pas une frappe : c'est la seule raison de le demander ici.
        // Le SIRET et la raison sociale restent hors du formulaire — beaucoup
        // de projets ne sont pas encore immatriculés.
        cle: "activite",
        libelle: "Ton activité (facultatif)",
        type: "choix",
        obligatoire: false,
        options: ["Salon / barbershop", "À domicile", "Je me lance", "Autre"],
      },
      {
        cle: "besoin",
        libelle: "Ce que tu recherches",
        type: "zone",
        obligatoire: true,
        exemple: "Matériel de coupe et produits de revente",
      },
    ],
    bouton: "PRÉPARER MA DEMANDE",
    note: "Tu valides le récapitulatif avant le moindre envoi.",
    confirmation: "Infos transmises.",
    resume: (v) =>
      [
        `Demande de compte pro — nom : ${v.nom}`,
        `email : ${v.email}`,
        `téléphone : ${v.telephone}`,
        ...(v.activite ? [`activité : ${v.activite}`] : []),
        `besoin : ${v.besoin}`,
      ].join(" ; "),
  },
};

/**
 * Contrôle de surface : on refuse ce qui est manifestement incomplet, sans
 * jouer au douanier. Un email mal formé fait échouer la recherche de commande
 * en silence côté boutique — autant le dire ici.
 */
export function erreursFormulaire(
  modele: ModeleFormulaire,
  valeurs: Record<string, string>,
): Record<string, string> {
  const erreurs: Record<string, string> = {};

  for (const champ of modele.champs) {
    const valeur = (valeurs[champ.cle] ?? "").trim();

    if (!valeur) {
      if (champ.obligatoire) erreurs[champ.cle] = "Il me faut cette info.";
      continue;
    }
    if (champ.type === "email" && !EMAIL.test(valeur)) {
      erreurs[champ.cle] = "Cet email a l'air incomplet.";
    }
    if (champ.type === "tel" && valeur.replace(/\D/g, "").length < 9) {
      erreurs[champ.cle] = "Ce numéro a l'air incomplet.";
    }
    if (champ.cle === "reference" && valeur.length < 4) {
      erreurs[champ.cle] = "Une référence fait au moins 4 caractères.";
    }
  }

  return erreurs;
}
