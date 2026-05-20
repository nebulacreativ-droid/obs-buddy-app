import type { Produit } from "./catalogue";
import { PRODUITS } from "./catalogue";
import { isBestSeller, bestSellerTagline, isRecommendedForForm } from "./brands-cartographie";

// ============================================================
// Dérivations sémantiques (les champs manquent dans le JSON,
// on les infère depuis `type` + `recap` + `styles`).
// ============================================================

export type Utilisation =
  | "Hydrater barbe"
  | "Réaliser coupes"
  | "Ajouter texture"
  | "Nettoyer cheveux"
  | "Structurer coiffure"
  | "Effet naturel mat"
  | "Polyvalent";

export type TypeCheveux =
  | "Tous types"
  | "Fins à normaux"
  | "Bouclés ondulés texturés"
  | "Selon besoin";

export type PointsForts =
  | "Puissance précision autonomie"
  | "Finition ultra close"
  | "Séchage contrôle frisottis"
  | "Contours détails"
  | "Polyvalent";

const lc = (p: Produit) => `${p.nom} ${p.recap || ""}`.toLowerCase();

const containsAny = (s: string, kws: string[]) => kws.some((k) => s.includes(k));

export function inferUtilisation(p: Produit): Utilisation {
  const t = p.type;
  const txt = lc(p);
  if (t === "huile_barbe" || t === "baume_barbe" || t === "shampoing_barbe" || t === "soin_barbe") return "Hydrater barbe";
  if (t === "tondeuse_coupe" || t === "tondeuse_finition" || t === "rasoir_electrique" || t === "shavette_coupe_chou") return "Réaliser coupes";
  if (t === "shampoing") return "Nettoyer cheveux";
  if (containsAny(txt, ["texturisant", "sea salt", "salt spray", "texture", "messy"])) return "Ajouter texture";
  if (containsAny(txt, ["pommade", "wax", "fixation forte", "fixation puissante", "tenue forte", "gel"])) return "Structurer coiffure";
  if (containsAny(txt, ["mat ", "matte", "effet naturel", "no-product", "naturel"])) return "Effet naturel mat";
  return "Polyvalent";
}

export function inferTypeCheveux(p: Produit): TypeCheveux {
  const txt = lc(p);
  if (containsAny(txt, ["bouclé", "boucle", "frisé", "frise", "crépu", "crepu", "afro", "ondulé", "ondule"])) return "Bouclés ondulés texturés";
  if (containsAny(txt, ["fins", "fin ", "volume", "densif", "épais", "epais"])) return "Fins à normaux";
  if (containsAny(txt, ["tous types", "tout type", "tous les types"])) return "Tous types";
  // Coiffants génériques sans indication → passe-partout
  if (p.type === "coiffant_cheveux" || p.type === "shampoing") return "Tous types";
  return "Selon besoin";
}

export function inferPointsForts(p: Produit): PointsForts {
  if (p.type === "tondeuse_coupe") return "Puissance précision autonomie";
  if (p.type === "tondeuse_finition") return "Contours détails";
  if (p.type === "rasoir_electrique") return "Finition ultra close";
  if (p.type === "seche_cheveux") return "Séchage contrôle frisottis";
  return "Polyvalent";
}

// ============================================================
// FORM 1 — Routine perso
// ============================================================

export type RoutineContext = {
  besoins: string[];          // ['cheveux','barbe','peau','rasage','parfum']
  barbe: string;              // courte | moyenne | longue | rase_3j
  cheveuxType: string;        // fins_raides | normaux | epais_raides | boucles | degarnis
  peau: string;               // sensible | grasse | seche | normale
  styleVibe: string;          // old_school | rock | urbain | premium | naturel | hipster | moderne
  engagement: string;         // express | regulier | complet
  budget: string;             // eco | standard | premium
  mifPriority: boolean;
};

const TYPE_CHEVEUX_FROM_ANSWER: Record<string, TypeCheveux> = {
  fins_raides: "Fins à normaux",
  normaux: "Tous types",
  epais_raides: "Tous types",
  boucles: "Bouclés ondulés texturés",
  degarnis: "Fins à normaux",
};

const UTILISATION_FROM_BESOIN: Record<string, Utilisation[]> = {
  cheveux: ["Nettoyer cheveux", "Structurer coiffure", "Ajouter texture", "Effet naturel mat"],
  barbe: ["Hydrater barbe"],
  peau: ["Polyvalent"],
  rasage: ["Polyvalent"],
  parfum: ["Polyvalent"],
};

const TYPES_FOR_BESOIN: Record<string, string[]> = {
  cheveux: ["shampoing", "coiffant_cheveux"],
  barbe: ["huile_barbe", "baume_barbe", "shampoing_barbe", "soin_barbe", "brosse", "peigne", "cire_moustache"],
  peau: ["soin_visage", "soin_corps", "baume_apres_rasage"],
  rasage: ["creme_savon_raser", "apres_rasage", "baume_apres_rasage", "pre_shave", "huile_gel_rasage", "blaireau"],
  parfum: ["parfum"],
};

const BUDGET_MAX_PERSO: Record<string, number> = {
  eco: 35,
  standard: 60,
  premium: 9999,
};

const SEGMENT_FROM_BUDGET_PERSO: Record<string, string> = {
  eco: "entree",
  standard: "milieu",
  premium: "premium",
};

const ENGAGEMENT_LIMIT: Record<string, number> = {
  express: 3,
  regulier: 5,
  complet: 8,
};

export function scoreRoutine(p: Produit, ctx: RoutineContext): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // 1. Style match (40 / 50)
  if (ctx.styleVibe && p.styles && p.styles.includes(ctx.styleVibe)) {
    if (p.styles.length >= 2 && p.styles.filter((s) => s === ctx.styleVibe || ctx.styleVibe).length >= 2) {
      score += 50;
      reasons.push(`Style ${ctx.styleVibe} en plein cœur`);
    } else {
      score += 40;
      reasons.push(`Aligne avec ton style ${ctx.styleVibe}`);
    }
  }

  // 2. Type cheveux (25 / 15 / 10)
  const expectedHair = TYPE_CHEVEUX_FROM_ANSWER[ctx.cheveuxType];
  const productHair = inferTypeCheveux(p);
  if (expectedHair && productHair === expectedHair) {
    score += 25;
    reasons.push("Adapté à ton type de cheveux");
  } else if (productHair === "Tous types") {
    score += 15;
  } else if (productHair === "Selon besoin") {
    score += 10;
  }

  // 3. Utilisation (20)
  const productUtil = inferUtilisation(p);
  for (const b of ctx.besoins) {
    const wanted = UTILISATION_FROM_BESOIN[b] || [];
    if (wanted.includes(productUtil)) {
      score += 20;
      break;
    }
  }

  // 4. Pertinence catégorie (15)
  for (const b of ctx.besoins) {
    const types = TYPES_FOR_BESOIN[b] || [];
    if (types.includes(p.type)) {
      score += 15;
      break;
    }
  }

  // Bonus secondaires
  if (ctx.mifPriority && p.mif) {
    score += 8;
    reasons.push("Made in France");
  }
  if (p.segment === SEGMENT_FROM_BUDGET_PERSO[ctx.budget]) {
    score += 4;
  }

  // Peau sensible : pénaliser produits contenant "alcool"
  if (ctx.peau === "sensible" && lc(p).includes("alcool")) {
    score -= 15;
  }

  // Cartographie marques : éligibilité Form 1 + bonus best-seller
  if (!isRecommendedForForm(p, 1)) {
    score -= 20;
  }
  if (isBestSeller(p)) {
    score += 15;
    const tag = bestSellerTagline(p);
    if (tag) reasons.push(tag);
  }

  return { score: Math.min(100, Math.round(score)), reasons };
}

export type ScoredProduit = {
  produit: Produit;
  score: number;
  reasons: string[];
  bucket: string;
  qty: number;
};

function bucketForRoutine(p: Produit): string {
  if (p.type === "shampoing" || p.type === "coiffant_cheveux") return "Cheveux";
  if (["huile_barbe", "baume_barbe", "shampoing_barbe", "soin_barbe", "cire_moustache"].includes(p.type)) return "Barbe";
  if (["soin_visage", "soin_corps"].includes(p.type)) return "Peau";
  if (["creme_savon_raser", "apres_rasage", "baume_apres_rasage", "pre_shave", "huile_gel_rasage", "blaireau"].includes(p.type)) return "Rasage";
  if (p.type === "parfum") return "Parfum";
  if (["peigne", "brosse"].includes(p.type)) return "Accessoires";
  return "Routine";
}

export function pickRoutine(ctx: RoutineContext): ScoredProduit[] {
  const limit = ENGAGEMENT_LIMIT[ctx.engagement] || 5;
  const budgetMax = BUDGET_MAX_PERSO[ctx.budget] || 9999;

  // 1. Filtre dur : besoins + type pertinent + prix max + dispo
  const wantedTypes = new Set<string>();
  for (const b of ctx.besoins) {
    (TYPES_FOR_BESOIN[b] || []).forEach((t) => wantedTypes.add(t));
  }

  const pool = PRODUITS.filter((p) => {
    if (p.dispo === "rupture") return false;
    if (p.super_cat !== "soin_revente") return false;
    if (wantedTypes.size > 0 && !wantedTypes.has(p.type)) return false;
    // Permettre dépasser le budget unitaire jusqu'à 1.6x (sinon premium injouable)
    if (p.prix > budgetMax * 1.6) return false;
    return true;
  });

  // 2. Scoring
  const scored = pool
    .map((p) => {
      const { score, reasons } = scoreRoutine(p, ctx);
      return {
        produit: p,
        score,
        reasons,
        bucket: bucketForRoutine(p),
        qty: 1,
      } as ScoredProduit;
    })
    .filter((s) => s.score >= 40);

  scored.sort((a, b) => b.score - a.score);

  // 3. Diversification : 1 produit max par `type`, équilibrage buckets
  const seenType = new Set<string>();
  const out: ScoredProduit[] = [];
  for (const s of scored) {
    if (seenType.has(s.produit.type)) continue;
    out.push(s);
    seenType.add(s.produit.type);
    if (out.length >= limit) break;
  }
  return out;
}

// ============================================================
// FORM 2 — Matériel pro
// ============================================================

export type MaterielContext = {
  categorie: string;     // tondeuse_coupe | tondeuse_finition | rasoir_electrique | ciseaux | seche_cheveux | shavette | accessoires | equipement_salon
  usage: string;         // dépend de categorie
  volume: string;        // petit (1-5) | moyen (5-15) | intensif (15+)
  styleShop: string;     // old_school | moderne | premium
  budget: string;        // moins_80 | 80_150 | 150_250 | plus_250
  complements: string[]; // lames | socle | mallette | hygiene
};

const BUDGET_MAX_PRO: Record<string, number> = {
  moins_80: 80,
  "80_150": 150,
  "150_250": 250,
  plus_250: 9999,
};

const SEGMENT_FROM_BUDGET_PRO: Record<string, string> = {
  moins_80: "entree",
  "80_150": "entree",
  "150_250": "milieu",
  plus_250: "premium",
};

const TYPE_FROM_CATEGORIE: Record<string, string[]> = {
  tondeuse_coupe: ["tondeuse_coupe"],
  tondeuse_finition: ["tondeuse_finition"],
  rasoir_electrique: ["rasoir_electrique"],
  ciseaux: ["ciseaux"],
  seche_cheveux: ["seche_cheveux"],
  shavette: ["shavette_coupe_chou", "rasoir_surete"],
  accessoires: ["peigne", "brosse", "cape_tour_cou"],
  equipement_salon: ["equipement_salon", "hygiene"],
};

const PRO_TRUSTED_BRANDS = ["andis", "babyliss", "wahl", "gamma", "jrl", "stylecraft"];
const PRO_ALT_BRANDS = ["l3vel3", "kyone", "mashiro", "osaka"];

const POINTS_FORTS_FROM_USAGE: Record<string, PointsForts> = {
  // tondeuse coupe
  sabot: "Puissance précision autonomie",
  fade: "Puissance précision autonomie",
  polyvalent_coupe: "Puissance précision autonomie",
  // tondeuse finition
  contours: "Contours détails",
  designs: "Contours détails",
  transition_zero: "Contours détails",
  // rasoir
  finition_blanc: "Finition ultra close",
  rasage_complet: "Finition ultra close",
  compact: "Finition ultra close",
  // séchage
  brushing: "Séchage contrôle frisottis",
  sechage_rapide: "Séchage contrôle frisottis",
  precision: "Séchage contrôle frisottis",
};

export function scoreMateriel(p: Produit, ctx: MaterielContext): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // 1. Points forts (35)
  const expectedPF = POINTS_FORTS_FROM_USAGE[ctx.usage];
  const productPF = inferPointsForts(p);
  if (expectedPF && productPF === expectedPF) {
    score += 35;
    reasons.push(expectedPF);
  }

  // 2. Type produit (30)
  const expectedTypes = TYPE_FROM_CATEGORIE[ctx.categorie] || [];
  if (expectedTypes.includes(p.type)) {
    score += 30;
  }

  // 3. Style / segment marque (20)
  if (ctx.styleShop && p.styles && p.styles.includes(ctx.styleShop)) {
    score += 12;
    reasons.push(`Esthétique ${ctx.styleShop}`);
  }
  const expectedSeg = SEGMENT_FROM_BUDGET_PRO[ctx.budget];
  if (expectedSeg && p.segment === expectedSeg) {
    score += 8;
  }

  // 4. Volume / marques pro éprouvées (15)
  const brand = p.marque.toLowerCase();
  if (ctx.volume === "intensif") {
    if (PRO_TRUSTED_BRANDS.some((b) => brand.includes(b))) {
      score += 15;
      reasons.push("Marque pro éprouvée, taillée pour le volume");
    }
  } else if (ctx.volume === "moyen") {
    if (PRO_TRUSTED_BRANDS.some((b) => brand.includes(b))) score += 12;
    else if (PRO_ALT_BRANDS.some((b) => brand.includes(b))) score += 8;
  } else {
    // petit volume : on accepte plus d'alternatives
    if (PRO_TRUSTED_BRANDS.some((b) => brand.includes(b))) score += 10;
    else if (PRO_ALT_BRANDS.some((b) => brand.includes(b))) score += 12;
  }

  if (p.mif) {
    score += 5;
    reasons.push("Made in France");
  }

  // Cartographie marques : éligibilité Form 2 + bonus best-seller
  if (!isRecommendedForForm(p, 2)) {
    score -= 20;
  }
  if (isBestSeller(p)) {
    score += 15;
    const tag = bestSellerTagline(p);
    if (tag) reasons.push(tag);
  }

  return { score: Math.min(100, Math.round(score)), reasons };
}

function bucketForMateriel(p: Produit, ctx: MaterielContext): string {
  if ((TYPE_FROM_CATEGORIE[ctx.categorie] || []).includes(p.type)) return "Top sélection";
  if (p.type === "lames_rasoir" || p.type === "tete_coupe") return "Lames & têtes";
  if (p.type === "socle_charge") return "Socle & alimentation";
  if (p.type === "hygiene") return "Hygiène & entretien";
  if (p.type === "equipement_salon") return "Mallette & rangement";
  return "Accessoires";
}

export function pickMateriel(ctx: MaterielContext): {
  tops: ScoredProduit[];
  accessoires: ScoredProduit[];
} {
  const budgetMax = BUDGET_MAX_PRO[ctx.budget] || 9999;
  const expectedTypes = new Set(TYPE_FROM_CATEGORIE[ctx.categorie] || []);

  // --- TOPS (catégorie principale) ---
  const topPool = PRODUITS.filter((p) => {
    if (p.dispo === "rupture") return false;
    if (!expectedTypes.has(p.type)) return false;
    if (p.prix > budgetMax * 1.3) return false;
    return true;
  });

  const topsScored = topPool
    .map((p) => {
      const { score, reasons } = scoreMateriel(p, ctx);
      return {
        produit: p,
        score,
        reasons,
        bucket: "Top sélection",
        qty: 1,
      } as ScoredProduit;
    })
    .filter((s) => s.score >= 40)
    .sort((a, b) => b.score - a.score);

  // Diversification marques sur le top
  const seenBrand = new Set<string>();
  const tops: ScoredProduit[] = [];
  for (const s of topsScored) {
    if (seenBrand.has(s.produit.id_marque)) continue;
    tops.push(s);
    seenBrand.add(s.produit.id_marque);
    if (tops.length >= 3) break;
  }

  // --- ACCESSOIRES selon complements ---
  const accTypes = new Set<string>();
  if (ctx.complements.includes("lames")) {
    accTypes.add("lames_rasoir");
    accTypes.add("tete_coupe");
  }
  if (ctx.complements.includes("socle")) accTypes.add("socle_charge");
  if (ctx.complements.includes("mallette")) accTypes.add("equipement_salon");
  if (ctx.complements.includes("hygiene")) accTypes.add("hygiene");

  const accessoires: ScoredProduit[] = [];
  if (accTypes.size > 0) {
    const accPool = PRODUITS.filter((p) => {
      if (p.dispo === "rupture") return false;
      if (!accTypes.has(p.type)) return false;
      return true;
    });
    const accScored = accPool
      .map((p) => {
        // Mini-scoring : segment + marque pro + style
        let score = 50;
        if (p.segment === SEGMENT_FROM_BUDGET_PRO[ctx.budget]) score += 15;
        const brand = p.marque.toLowerCase();
        if (PRO_TRUSTED_BRANDS.some((b) => brand.includes(b))) score += 10;
        if (p.styles && p.styles.includes(ctx.styleShop)) score += 5;
        if (p.mif) score += 3;
        return {
          produit: p,
          score,
          reasons: [],
          bucket: bucketForMateriel(p, ctx),
          qty: 1,
        } as ScoredProduit;
      })
      .sort((a, b) => b.score - a.score);

    const seenTypeAcc = new Set<string>();
    for (const s of accScored) {
      if (seenTypeAcc.has(s.produit.type)) continue;
      accessoires.push(s);
      seenTypeAcc.add(s.produit.type);
      if (accessoires.length >= 4) break;
    }
  }

  return { tops, accessoires };
}

// ============================================================
// Badge selon score
// ============================================================

export type BadgeTier = "match" | "good" | "alt" | "none";

export function badgeForScore(score: number): BadgeTier {
  if (score >= 80) return "match";
  if (score >= 60) return "good";
  if (score >= 40) return "alt";
  return "none";
}

export function badgeLabel(tier: BadgeTier): string {
  if (tier === "match") return "Match parfait";
  if (tier === "good") return "Très bon choix";
  if (tier === "alt") return "Alternative";
  return "";
}