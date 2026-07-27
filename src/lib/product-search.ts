// Moteur de recherche produits — partagé entre le navigateur (UI) et la fonction
// serverless /api/chat. Imports RELATIFS uniquement : l'alias "@/" n'est pas
// résolu par le build Vercel des fonctions.
import produitsData from "../data/produits.json";

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

// Exclut les échantillons / samples (tailles 10g, mini formats…).
const isSample = (p: Produit) => /^\s*echantillon\b|\bsample\b/i.test(p.nom);

export const PRODUITS = (produitsData as Produit[]).filter((p) => !isSample(p));

/** Minuscules sans accents — indispensable pour matcher "creme" sur "crème". */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marques diacritiques combinantes
    .trim();
}

// Index de recherche pré-calculé une fois au chargement du module.
const INDEX = PRODUITS.map((p) => ({
  p,
  nom: normalize(p.nom),
  marque: normalize(p.marque),
  categorie: normalize(p.categorie),
  type: normalize(p.type),
  recap: normalize(p.recap),
}));

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

/** Résultat compact envoyé au LLM — on évite d'y mettre le recap complet. */
export type ProduitCompact = {
  id: string;
  nom: string;
  marque: string;
  prix: number;
  prix_aff: string;
  categorie: string;
  segment: string;
  dispo: string;
  lien: string;
  image: string;
  argument: string;
};

const matchAny = (value: string, filters: string[]) =>
  filters.some((f) => normalize(f) === normalize(value));

export function searchProducts(params: SearchParams): ProduitCompact[] {
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

  // Mots-clés de la recherche libre : chaque mot doit apparaître quelque part.
  const mots = texte ? normalize(texte).split(/\s+/).filter((m) => m.length > 2) : [];

  const scored: Array<{ p: Produit; score: number }> = [];

  for (const entry of INDEX) {
    const { p } = entry;

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
      let matched = 0;
      for (const mot of mots) {
        // Pondération par champ : le nom vaut plus que le descriptif.
        if (entry.nom.includes(mot)) {
          score += 10;
          matched++;
        } else if (entry.marque.includes(mot)) {
          score += 6;
          matched++;
        } else if (entry.categorie.includes(mot) || entry.type.includes(mot)) {
          score += 4;
          matched++;
        } else if (entry.recap.includes(mot)) {
          score += 1;
          matched++;
        }
      }
      // Tous les mots doivent matcher, sinon le résultat est hors sujet.
      if (matched < mots.length) continue;
    }

    // Une fiche bien remplie signale un vrai produit phare plutôt qu'une pièce
    // détachée ou un accessoire (grille de rechange, batterie…), qui polluent
    // sinon les résultats quand la recherche ne porte que sur des filtres.
    if (p.recap.length > 150) score += 8;
    else if (p.recap.length > 0) score += 2;
    if (p.dispo !== "rupture") score += 3;
    if (p.image && !p.image.includes("no-image")) score += 2;

    scored.push({ p, score });
  }

  if (tri === "prix_croissant") scored.sort((a, b) => a.p.prix - b.p.prix);
  else if (tri === "prix_decroissant") scored.sort((a, b) => b.p.prix - a.p.prix);
  // À score égal, la fiche la mieux documentée passe devant : c'est le meilleur
  // signal disponible pour distinguer un produit phare d'une pièce détachée.
  else
    scored.sort(
      (a, b) =>
        b.score - a.score ||
        b.p.recap.length - a.p.recap.length ||
        a.p.prix - b.p.prix,
    );

  return scored.slice(0, Math.min(limite, 12)).map(({ p }) => toCompact(p));
}

export function getProductById(id: string): ProduitCompact | null {
  const p = PRODUITS.find((x) => x.id === id || x.ref === id);
  return p ? toCompact(p) : null;
}

function toCompact(p: Produit): ProduitCompact {
  return {
    id: p.id,
    nom: p.nom,
    marque: p.marque,
    prix: p.prix,
    prix_aff: p.prix_aff,
    categorie: p.categorie,
    segment: p.segment,
    dispo: p.dispo,
    lien: p.lien,
    image: p.image,
    argument: p.recap ? p.recap.slice(0, 220) : "",
  };
}

const uniq = (arr: string[]) => [...new Set(arr)].filter(Boolean).sort();

/**
 * Taxonomie réelle du catalogue, calculée depuis les données.
 * Injectée dans le prompt système pour que le modèle n'invente jamais
 * une valeur de filtre inexistante.
 */
export function getTaxonomy() {
  const enStock = PRODUITS.filter((p) => p.dispo !== "rupture");
  return {
    total: PRODUITS.length,
    en_stock: enStock.length,
    super_cat: uniq(PRODUITS.map((p) => p.super_cat)),
    type: uniq(PRODUITS.map((p) => p.type)),
    categorie: uniq(PRODUITS.map((p) => p.categorie)),
    marque: uniq(PRODUITS.map((p) => p.marque)),
    segment: uniq(PRODUITS.map((p) => p.segment)),
    styles: uniq(PRODUITS.flatMap((p) => p.styles)),
  };
}
