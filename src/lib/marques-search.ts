// Sélection de marques.
//
// Même principe que product-search : fabrique sans dépendance aux données,
// pour rester utilisable côté navigateur comme côté fonction serverless.
//
// Une marque n'est proposée que si elle a réellement des produits disponibles
// au catalogue. C'est ce qui écarte automatiquement les entrées mortes
// (marques arrêtées, académies, lieux) sans liste noire à maintenir.
import type { Produit } from "./product-search";

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

/**
 * Une marque de matériel (Wahl, Panasonic, StyleCraft) ne se met pas en rayon
 * comme une marque de soin (Reuzel, Uppercut). La distinction est déduite du
 * catalogue, pas déclarée à la main.
 */
export type FamilleMarque = "materiel" | "produit" | "mixte";

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
  famille: FamilleMarque;
  nbProduits: number;
};

const normaliser = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

const FAMILLES_MATERIEL = new Set([
  "materiel_coupe",
  "accessoires_pro",
  "mobilier_equipement",
  "hygiene_consommables",
]);

export function creerCatalogueMarques(
  marques: Marque[],
  cartographie: FicheCartographie[],
  produits: Produit[],
) {
  const fiches = new Map<string, FicheCartographie>();
  for (const f of cartographie) fiches.set(normaliser(f.nom), f);

  // Ce que chaque marque pèse réellement au catalogue.
  type Stats = { dispo: number; revente: number; materiel: number };
  const stats = new Map<string, Stats>();
  const marqueDuProduit = new Map<string, string>();

  for (const p of produits) {
    const cle = normaliser(p.marque);
    marqueDuProduit.set(p.id, cle);

    if (p.dispo === "rupture") continue;
    const s = stats.get(cle) ?? { dispo: 0, revente: 0, materiel: 0 };
    s.dispo++;
    if (FAMILLES_MATERIEL.has(p.super_cat)) s.materiel++;
    else s.revente++;
    stats.set(cle, s);
  }

  function famille(s: Stats): FamilleMarque {
    const partRevente = s.revente / s.dispo;
    if (partRevente >= 0.8) return "produit";
    if (partRevente <= 0.2) return "materiel";
    return "mixte";
  }

  // Marques réellement vendables, enrichies de leur famille.
  const vendables = marques
    .map((m) => ({ m, cle: normaliser(m.nom), s: stats.get(normaliser(m.nom)) }))
    .filter((x): x is { m: Marque; cle: string; s: Stats } => !!x.s && x.s.dispo > 0);

  // Classement par ventes réelles, alimenté par la boutique.
  let rangVentes = new Map<string, number>();

  /** Reçoit les identifiants produits les plus vendus, du meilleur au moins bon. */
  function definirMeilleuresVentes(idsProduits: string[]) {
    const cumul = new Map<string, number>();
    idsProduits.forEach((id, position) => {
      const cle = marqueDuProduit.get(id);
      if (!cle) return;
      // Un produit bien classé pèse plus qu'un produit en fin de liste.
      const poids = Math.max(1, idsProduits.length - position);
      cumul.set(cle, (cumul.get(cle) ?? 0) + poids);
    });

    rangVentes = new Map(
      [...cumul.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([cle], rang) => [cle, rang]),
    );
  }

  function proposer(params: {
    famille?: FamilleMarque | "toutes";
    styles?: string[];
    segment?: string[];
    seulementBestSellers?: boolean;
    madeInFrance?: boolean;
    limite?: number;
  }): MarqueProposee[] {
    const {
      famille: familleVoulue = "produit",
      styles,
      segment,
      seulementBestSellers,
      madeInFrance,
      limite = 12,
    } = params;

    const notes: Array<{
      m: Marque;
      f?: FicheCartographie;
      s: Stats;
      score: number;
      profondeur: number;
    }> = [];

    for (const { m, cle, s } of vendables) {
      const f = fiches.get(cle);
      const fam = famille(s);

      // "mixte" répond aux deux demandes : ces marques font les deux.
      if (familleVoulue !== "toutes" && fam !== "mixte" && fam !== familleVoulue) continue;
      if (segment?.length && !segment.includes(m.segment)) continue;
      if (seulementBestSellers && !f?.bs) continue;
      if (madeInFrance && !f?.mif) continue;

      let score = 0;

      if (styles?.length) {
        const communs = m.styles.filter((st) => styles.includes(st)).length;
        if (!communs) continue;
        score += communs * 5;
      }

      // Les ventes réelles pèsent plus que l'étiquette best-seller, qui est
      // une appréciation figée : bonus dégressif de +14 à +2.
      const rang = rangVentes.get(cle);
      if (rang !== undefined) score += Math.max(2, 14 - Math.floor(rang / 2));
      else if (f?.bs) score += 4;

      if (f?.mif) score += 1;

      // La profondeur qui compte est celle de la famille demandée : une marque
      // mixte avec 60 soins et 3 tondeuses n'est pas une référence matériel.
      const profondeur =
        familleVoulue === "materiel"
          ? s.materiel
          : familleVoulue === "produit"
            ? s.revente
            : s.dispo;
      score += Math.min(6, Math.floor(profondeur / 6));

      // Une marque dédiée à la famille demandée passe devant une marque mixte
      // à profondeur comparable.
      if (fam === familleVoulue) score += 3;

      notes.push({ m, f, s, score, profondeur });
    }

    notes.sort((a, b) => b.score - a.score || b.profondeur - a.profondeur);

    return notes.slice(0, Math.min(limite, 16)).map(({ m, f, s }) => ({
      id: m.id,
      nom: m.nom,
      pays: m.pays,
      segment: m.segment,
      styles: m.styles,
      argument: m.desc ? m.desc.slice(0, 150) : "",
      logo: m.logo,
      bestSeller: !!f?.bs,
      madeInFrance: !!f?.mif,
      famille: famille(s),
      nbProduits: s.dispo,
    }));
  }

  return {
    proposer,
    definirMeilleuresVentes,
    total: vendables.length,
    /** Marques déclarées mais sans aucun produit vendable — utile au diagnostic. */
    ecartees: marques.length - vendables.length,
  };
}
