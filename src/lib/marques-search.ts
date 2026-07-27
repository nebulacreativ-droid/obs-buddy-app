// Sélection de marques pour le parcours "ouverture de shop".
// Même principe que product-search : fabrique sans dépendance aux données,
// pour rester utilisable côté navigateur comme côté fonction serverless.

export type Marque = {
  id: string;
  nom: string;
  pays: string;
  desc: string;
  style: string;
  styles: string[];
  segment: string;
  cats: string;
  logo: string;
  lien: string;
};

/** Cartographie métier : best-seller, Made in France, et pertinence par parcours. */
export type FicheCartographie = {
  nom: string;
  bs: boolean;
  styles: string[];
  mif: boolean;
  f1: boolean;
  f2: boolean;
  f3: boolean;
};

export type MarqueProposee = {
  id: string;
  nom: string;
  pays: string;
  segment: string;
  styles: string[];
  argument: string;
  logo: string;
  bestSeller: boolean;
  madeInFrance: boolean;
};

const normaliser = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

export function creerCatalogueMarques(
  marques: Marque[],
  cartographie: FicheCartographie[],
) {
  const parNom = new Map<string, FicheCartographie>();
  for (const f of cartographie) parNom.set(normaliser(f.nom), f);

  const fiche = (m: Marque) => parNom.get(normaliser(m.nom));

  function proposer(params: {
    styles?: string[];
    segment?: string[];
    seulementBestSellers?: boolean;
    madeInFrance?: boolean;
    limite?: number;
  }): MarqueProposee[] {
    const { styles, segment, seulementBestSellers, madeInFrance, limite = 12 } = params;

    const notes: Array<{ m: Marque; f?: FicheCartographie; score: number }> = [];

    for (const m of marques) {
      const f = fiche(m);

      // f3 = marque pertinente pour un mur de revente en ouverture de shop.
      // Une marque absente de la cartographie reste éligible : on ne l'écarte
      // pas sur une donnée manquante.
      if (f && !f.f3) continue;
      if (segment?.length && !segment.includes(m.segment)) continue;
      if (seulementBestSellers && !f?.bs) continue;
      if (madeInFrance && !f?.mif) continue;

      let score = 0;
      if (styles?.length) {
        const communs = m.styles.filter((s) => styles.includes(s)).length;
        if (!communs) continue;
        score += communs * 5;
      }
      if (f?.bs) score += 4;
      if (f?.mif) score += 1;
      if (m.desc) score += 1;

      notes.push({ m, f, score });
    }

    notes.sort((a, b) => b.score - a.score || a.m.nom.localeCompare(b.m.nom));

    return notes.slice(0, Math.min(limite, 16)).map(({ m, f }) => ({
      id: m.id,
      nom: m.nom,
      pays: m.pays,
      segment: m.segment,
      styles: m.styles,
      argument: m.desc ? m.desc.slice(0, 150) : "",
      logo: m.logo,
      bestSeller: !!f?.bs,
      madeInFrance: !!f?.mif,
    }));
  }

  return { proposer, total: marques.length };
}
