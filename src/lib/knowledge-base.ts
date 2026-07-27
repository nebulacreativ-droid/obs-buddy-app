// Base de connaissances boutique interrogée par O'Buddy via l'outil `infos_boutique`.
//
// ⚠️ Ne contient QUE des informations vérifiées (reprises de la landing O'Buddy).
// Les sujets sans réponse fiable sont marqués `verifie: false` : le bot doit alors
// renvoyer vers le service client au lieu d'inventer une réponse.

export type FicheInfo = {
  sujet: string;
  motsCles: string[];
  reponse: string;
  verifie: boolean;
};

export const SITE_URL = "https://www.obarbershop.com";

export const KNOWLEDGE_BASE: FicheInfo[] = [
  {
    sujet: "livraison",
    motsCles: ["livraison", "expedition", "delai", "frais de port", "colis", "envoi", "port offert"],
    reponse:
      "On livre partout en France métropolitaine et dans la plupart des pays d'Europe. " +
      "La livraison est offerte dès 45 € d'achat.",
    verifie: true,
  },
  {
    sujet: "compte_pro",
    motsCles: ["compte pro", "tarif pro", "professionnel", "siret", "grossiste", "revendeur", "remise pro"],
    reponse:
      `Pour bénéficier du tarif pro, fais une demande de création de compte pro sur ${SITE_URL} ` +
      "avec ton SIRET et les infos de ton activité. L'équipe étudie la demande et te répond rapidement " +
      "pour activer ton tarif.",
    verifie: true,
  },
  {
    sujet: "a_propos",
    motsCles: ["obarbershop", "qui etes vous", "entreprise", "boutique", "histoire", "expertise"],
    reponse:
      "O'Barbershop, c'est plus de 10 ans dans la culture barber : 1100+ produits en stock, 50+ marques pro, " +
      "et plus de 1200 barbershops équipés. Aucune marque ne paie pour être mise en avant dans les " +
      "recommandations — on conseille ce qui correspond au projet, point.",
    verifie: true,
  },
  {
    sujet: "assistant",
    motsCles: ["obuddy", "assistant", "comment ca marche", "gratuit", "inscription", "compte"],
    reponse:
      "O'Buddy est l'assistant barber d'O'Barbershop : 100 % gratuit, sans inscription ni engagement. " +
      "Il conseille sur la routine perso, le matériel pro et l'ouverture de barbershop. " +
      `Les commandes se passent ensuite sur ${SITE_URL}.`,
    verifie: true,
  },
  {
    sujet: "catalogue",
    motsCles: ["catalogue", "produits", "marques", "stock", "reference", "gamme"],
    reponse:
      `Le catalogue compte plus de 1100 produits et 50 marques pro, consultables sur ${SITE_URL}/catalogue-2. ` +
      "Soins et revente, matériel de coupe, mobilier, accessoires pro et consommables d'hygiène.",
    verifie: true,
  },

  // ── Sujets à compléter par O'Barbershop ────────────────────────────────
  // Tant que `verifie` est false, le bot n'affirme rien et renvoie au service client.
  {
    sujet: "retours",
    motsCles: ["retour", "rembours", "echange", "sav", "garantie", "retracta", "defectueux"],
    reponse: "",
    verifie: false,
  },
  {
    sujet: "paiement",
    motsCles: ["paiement", "payer", "carte", "virement", "plusieurs fois", "facture", "tva"],
    reponse: "",
    verifie: false,
  },
  {
    sujet: "contact",
    motsCles: ["contact", "telephone", "email", "joindre", "horaires", "conseiller", "sav"],
    reponse: "",
    verifie: false,
  },
];

/** Recherche par mots-clés, insensible aux accents et à la casse. */
export function chercherInfo(question: string): FicheInfo[] {
  const q = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  const scored = KNOWLEDGE_BASE.map((fiche) => {
    const hits = fiche.motsCles.filter((mot) => q.includes(mot)).length;
    return { fiche, hits };
  })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  return scored.map((x) => x.fiche);
}
