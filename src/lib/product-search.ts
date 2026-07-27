// Moteur de recherche produits.
//
// Ce module ne charge JAMAIS les données lui-même : il expose une fabrique qui
// reçoit le catalogue. Raison : le navigateur l'obtient via l'import JSON de
// Vite, la fonction serverless le lit sur disque (Node ESM refuse un import
// JSON sans attribut d'import). La logique reste partagée, le chargement diffère.

export type Produit = {
  id: string;
  ref: string;
  nom: string;
  marque: string;
  id_marque: string;
  pays: string;
  segment: string;
  categorie: string;
  super_cat: string;
  type: string;
  prix: number;
  prix_aff: string;
  stock: number;
  dispo: string;
  image: string;
  lien: string;
  recap: string;
  styles: string[];
  mif: boolean;
};

export type SearchParams = {
  texte?: string;
  type?: string[];
  super_cat?: string[];
  marque?: string[];
  segment?: string[];
  styles?: string[];
  prix_min?: number;
  prix_max?: number;
  inclure_ruptures?: boolean;
  limite?: number;
  tri?: "pertinence" | "prix_croissant" | "prix_decroissant";
};

/** Résultat compact : ni le recap complet ni les champs inutiles au modèle. */
export type ProduitCompact = {
  id: string;
  nom: string;
  marque: string;
  prix: number;
  prix_aff: string;
  categorie: string;
  super_cat: string;
  segment: string;
  dispo: string;
  lien: string;
  image: string;
  argument: string;
  /** Le produit a plusieurs variantes (taille, parfum, gamme) : l'ajout direct
   *  au panier mettrait un article au hasard, il faut passer par la fiche. */
  declinaisons: boolean;
};

export type Taxonomie = {
  total: number;
  en_stock: number;
  super_cat: string[];
  type: string[];
  categorie: string[];
  marque: string[];
  segment: string[];
  styles: string[];
};

/** Minuscules sans accents — indispensable pour matcher "creme" sur "crème". */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marques diacritiques combinantes
    .trim();
}

/** Échantillons et mini-formats : exclus des recommandations. */
export const estEchantillon = (p: Produit) =>
  /^\s*echantillon\b|\bsample\b/i.test(p.nom);

const uniq = (arr: string[]) => [...new Set(arr)].filter(Boolean).sort();

/** Un prix affiché sous forme de plage ("9,00 - 25,00") signale un produit
 *  décliné : l'export PrestaShop rend l'intervalle des variantes. */
const aDesDeclinaisons = (p: Produit) => /\s-\s/.test(p.prix_aff);

function toCompact(p: Produit): ProduitCompact {
  return {
    id: p.id,
    nom: p.nom,
    marque: p.marque,
    prix: p.prix,
    prix_aff: p.prix_aff,
    categorie: p.categorie,
    super_cat: p.super_cat,
    segment: p.segment,
    dispo: p.dispo,
    lien: p.lien,
    image: p.image,
    argument: p.recap ? p.recap.slice(0, 220) : "",
    declinaisons: aDesDeclinaisons(p),
  };
}

const matchAny = (valeur: string, filtres: string[]) =>
  filtres.some((f) => normalize(f) === normalize(valeur));

export type MoteurRecherche = ReturnType<typeof creerMoteur>;

/**
 * Construit le moteur : l'index est calculé une seule fois, au démarrage du
 * processus, puis réutilisé à chaque requête.
 */
export function creerMoteur(catalogue: Produit[]) {
  const produits = catalogue.filter((p) => !estEchantillon(p));

  const index = produits.map((p) => ({
    p,
    nom: normalize(p.nom),
    marque: normalize(p.marque),
    categorie: normalize(p.categorie),
    type: normalize(p.type),
    recap: normalize(p.recap),
  }));

  function rechercher(params: SearchParams): ProduitCompact[] {
    const {
      texte,
      type,
      super_cat,
      marque,
      segment,
      styles,
      prix_min,
      prix_max,
      inclure_ruptures = false,
      limite = 8,
      tri = "pertinence",
    } = params;

    const mots = texte
      ? normalize(texte).split(/\s+/).filter((m) => m.length > 2)
      : [];

    const notes: Array<{ p: Produit; score: number }> = [];

    for (const entree of index) {
      const { p } = entree;

      if (!inclure_ruptures && p.dispo === "rupture") continue;
      if (type?.length && !matchAny(p.type, type)) continue;
      if (super_cat?.length && !matchAny(p.super_cat, super_cat)) continue;
      if (marque?.length && !matchAny(p.marque, marque)) continue;
      if (segment?.length && !matchAny(p.segment, segment)) continue;
      if (styles?.length && !p.styles.some((s) => matchAny(s, styles))) continue;
      if (prix_min != null && p.prix < prix_min) continue;
      if (prix_max != null && p.prix > prix_max) continue;

      let score = 0;

      if (mots.length) {
        let trouves = 0;
        for (const mot of mots) {
          // Pondération par champ : le nom vaut plus que le descriptif.
          if (entree.nom.includes(mot)) {
            score += 10;
            trouves++;
          } else if (entree.marque.includes(mot)) {
            score += 6;
            trouves++;
          } else if (entree.categorie.includes(mot) || entree.type.includes(mot)) {
            score += 4;
            trouves++;
          } else if (entree.recap.includes(mot)) {
            score += 1;
            trouves++;
          }
        }
        // Tous les mots doivent correspondre, sinon le résultat est hors sujet.
        if (trouves < mots.length) continue;
      }

      // Une fiche fournie signale un produit phare plutôt qu'une pièce détachée
      // (grille de rechange, batterie…), qui sinon polluent les résultats.
      if (p.recap.length > 150) score += 8;
      else if (p.recap.length > 0) score += 2;
      if (p.dispo !== "rupture") score += 3;
      if (p.image && !p.image.includes("no-image")) score += 2;

      notes.push({ p, score });
    }

    if (tri === "prix_croissant") notes.sort((a, b) => a.p.prix - b.p.prix);
    else if (tri === "prix_decroissant") notes.sort((a, b) => b.p.prix - a.p.prix);
    else
      notes.sort(
        (a, b) =>
          b.score - a.score ||
          b.p.recap.length - a.p.recap.length ||
          a.p.prix - b.p.prix,
      );

    return notes.slice(0, Math.min(limite, 12)).map(({ p }) => toCompact(p));
  }

  function parId(id: string): ProduitCompact | null {
    const p = produits.find((x) => x.id === id || x.ref === id);
    return p ? toCompact(p) : null;
  }

  /**
   * Taxonomie réelle du catalogue, injectée dans le prompt système pour que le
   * modèle n'invente jamais une valeur de filtre inexistante.
   */
  function taxonomie(): Taxonomie {
    return {
      total: produits.length,
      en_stock: produits.filter((p) => p.dispo !== "rupture").length,
      super_cat: uniq(produits.map((p) => p.super_cat)),
      type: uniq(produits.map((p) => p.type)),
      categorie: uniq(produits.map((p) => p.categorie)),
      marque: uniq(produits.map((p) => p.marque)),
      segment: uniq(produits.map((p) => p.segment)),
      styles: uniq(produits.flatMap((p) => p.styles)),
    };
  }

  return { produits, rechercher, parId, taxonomie };
}
