import type { Produit } from "./catalogue";
import { PRODUITS, MARQUES } from "./catalogue";
import {
  pickRoutine,
  pickMateriel,
  type RoutineContext,
  type MaterielContext,
} from "./scoring";

export type Mode = "ouverture" | "particulier" | "materiel-pro" | "revente";

export type QuestionOption = {
  value: string;
  label: string;
  desc?: string;
  emoji?: string;
  logo?: string;
};

export type Question = {
  id: string;
  prompt: string;
  helper?: string;
  type: "single" | "multi" | "scale";
  options: QuestionOption[];
  /** Si défini, la question ne s'affiche que si l'utilisateur a coché un de ces besoins (mode particulier). */
  needs?: string[];
  /** Conditionnel généralisé : ne s'affiche que si answers[needsFrom] est dans needsValues. */
  needsFrom?: string;
  needsValues?: string[];
};

export type ModeConfig = {
  eyebrow: string;
  title: string;
  intro: string;
  questions: Question[];
  dashboardTitle: string;
  dashboardSubtitle: string;
};

export const MODE_CONFIG: Record<Mode, ModeConfig> = {
  ouverture: {
    eyebrow: "Ouverture de shop",
    title: "On positionne ton barbershop",
    intro: "Style, ambiance, ton, clientèle cible : on dessine ton positionnement de marque. Pas de produits ici — juste de la stratégie.",
    dashboardTitle: "Ton shop guide",
    dashboardSubtitle: "Positionnement · Ambiance · Ton",
    questions: [
      {
        id: "style",
        prompt: "L'ambiance que tu veux ?",
        helper: "C'est la colonne vertébrale de ton positionnement.",
        type: "single",
        options: [
          { value: "old_school", label: "Old school", desc: "Cuir, brass, Reuzel, codes vintage", emoji: "🎩" },
          { value: "moderne", label: "Moderne / clean", desc: "Bois clair, lignes épurées", emoji: "✨" },
          { value: "urbain", label: "Urbain / street", desc: "Hip-hop, néons, L3vel3", emoji: "🔥" },
          { value: "premium", label: "Gentleman premium", desc: "Captain Fawcett, Bullfrog", emoji: "👑" },
        ],
      },
      {
        id: "fauteuils",
        prompt: "Combien de postes de coupe ?",
        helper: "Ça calibre l'échelle de ton concept.",
        type: "single",
        options: [
          { value: "1", label: "1 poste", desc: "Solo / studio", emoji: "🪑" },
          { value: "2", label: "2 postes", desc: "Duo classique", emoji: "🪑🪑" },
          { value: "3", label: "3 postes", desc: "Shop établi", emoji: "🪑🪑🪑" },
          { value: "4", label: "4+ postes", desc: "Format atelier", emoji: "🏛️" },
        ],
      },
      {
        id: "clientele",
        prompt: "Ta clientèle cible ?",
        helper: "Le client qu'on veut faire revenir 1× par mois.",
        type: "single",
        options: [
          { value: "jeune_urbain", label: "Jeune urbain 18-30", desc: "Fade strict, street culture", emoji: "🧢" },
          { value: "actif_30_45", label: "Actif 30-45", desc: "Coupe nette, barbe entretenue", emoji: "💼" },
          { value: "premium_cadre", label: "Cadre / dirigeant", desc: "Expérience VIP, rasage tradi", emoji: "👔" },
          { value: "mixte", label: "Mixte / familial", desc: "Tous âges, quartier", emoji: "🏘️" },
        ],
      },
      {
        id: "positionnement",
        prompt: "Ton positionnement prix ?",
        helper: "Définit ta grille de tarifs coupe.",
        type: "single",
        options: [
          { value: "accessible", label: "Accessible", desc: "Coupe ~20-28 €" },
          { value: "milieu", label: "Milieu de gamme", desc: "Coupe ~28-38 €" },
          { value: "premium", label: "Premium", desc: "Coupe ~38-55 €" },
          { value: "ultra_premium", label: "Ultra premium", desc: "Coupe 55 €+" },
        ],
      },
      {
        id: "zone",
        prompt: "Ta zone d'implantation ?",
        type: "single",
        options: [
          { value: "hyper_centre", label: "Hyper-centre", desc: "Vitrine, flux piéton" },
          { value: "quartier", label: "Quartier vivant", desc: "Habitué local" },
          { value: "banlieue", label: "Périphérie / centre commercial" },
          { value: "village", label: "Village / petite ville" },
        ],
      },
      {
        id: "services",
        prompt: "Les services que tu veux mettre en avant ?",
        helper: "Choisis tout ce qui s'applique.",
        type: "multi",
        options: [
          { value: "coupe", label: "Coupe homme", emoji: "✂️" },
          { value: "barbe", label: "Taille de barbe", emoji: "🧔" },
          { value: "rasage", label: "Rasage à l'ancienne", emoji: "🪒" },
          { value: "soin", label: "Soin visage / SPA", emoji: "🧴" },
        ],
      },
      {
        id: "valeurs",
        prompt: "Tes valeurs de marque ?",
        helper: "3-4 max, c'est ce qui te différencie.",
        type: "multi",
        options: [
          { value: "artisanat", label: "Artisanat / savoir-faire", emoji: "🛠️" },
          { value: "experience", label: "Expérience client", emoji: "🎩" },
          { value: "communaute", label: "Communauté / quartier", emoji: "🤝" },
          { value: "performance", label: "Performance technique", emoji: "📐" },
          { value: "lifestyle", label: "Lifestyle / culture", emoji: "🎧" },
          { value: "naturalite", label: "Naturalité / clean", emoji: "🌿" },
        ],
      },
      {
        id: "ambiance_sonore",
        prompt: "L'ambiance sonore du shop ?",
        type: "single",
        options: [
          { value: "hiphop", label: "Hip-hop / RnB", emoji: "🎤" },
          { value: "rock", label: "Rock / blues", emoji: "🎸" },
          { value: "jazz", label: "Jazz / soul / lounge", emoji: "🎷" },
          { value: "electro", label: "Électro / house", emoji: "🎛️" },
        ],
      },
      {
        id: "signature",
        prompt: "Ton détail signature ?",
        helper: "Le truc qu'on remarque dès l'entrée.",
        type: "single",
        options: [
          { value: "neon", label: "Néon / enseigne forte", emoji: "💡" },
          { value: "vintage", label: "Mobilier vintage chiné", emoji: "🪑" },
          { value: "coffee", label: "Coffee / bar à boissons", emoji: "☕" },
          { value: "vinyl", label: "Mur de vinyles / collection", emoji: "💿" },
          { value: "art", label: "Mur d'artistes locaux / tatoo", emoji: "🎨" },
        ],
      },
    ],
  },
  particulier: {
    eyebrow: "Routine perso",
    title: "On compose ta routine",
    intro: "Quelques questions ciblées sur tes besoins — ta routine se monte en direct.",
    dashboardTitle: "Ta routine",
    dashboardSubtitle: "Sur-mesure selon tes besoins",
    questions: [
      {
        id: "besoins",
        prompt: "Pour quoi cherches-tu des produits ?",
        helper: "Coche tout ce qui s'applique — on ne te proposera que ces familles.",
        type: "multi",
        options: [
          { value: "cheveux", label: "Cheveux / coiffage", emoji: "💇" },
          { value: "barbe", label: "Barbe", emoji: "🧔" },
          { value: "peau", label: "Peau / visage", emoji: "🧴" },
          { value: "rasage", label: "Rasage", emoji: "🪒" },
          { value: "parfum", label: "Parfum", emoji: "🌬️" },
        ],
      },
      {
        id: "barbe",
        prompt: "Ta barbe ?",
        type: "single",
        needs: ["barbe", "rasage"],
        options: [
          { value: "rase_3j", label: "Rasée / 3 jours", desc: "Pré-rasage + soin visage", emoji: "🪒" },
          { value: "courte", label: "Courte (0-2 cm)", desc: "Huile légère + soin visage", emoji: "🧔" },
          { value: "moyenne", label: "Moyenne (2-5 cm)", desc: "Huile + baume + peigne", emoji: "🧔‍♂️" },
          { value: "longue", label: "Longue (5 cm+)", desc: "Routine complète barbe", emoji: "🦁" },
        ],
      },
      {
        id: "cheveux_type",
        prompt: "Tes cheveux, ils sont comment ?",
        type: "single",
        needs: ["cheveux"],
        options: [
          { value: "fins_raides", label: "Fins / raides", desc: "Cherchent texture & volume", emoji: "📏" },
          { value: "normaux", label: "Normaux", desc: "Tous coiffants OK", emoji: "✨" },
          { value: "epais_raides", label: "Épais / raides", desc: "Pommades fortes, eau", emoji: "💪" },
          { value: "boucles", label: "Bouclés / frisés / crépus", desc: "Soins définition boucles", emoji: "🌀" },
          { value: "degarnis", label: "Dégarnis / clairsemés", desc: "Stimulants + pommades légères", emoji: "🌱" },
        ],
      },
      {
        id: "peau",
        prompt: "Ta peau, plutôt ?",
        type: "single",
        needs: ["peau", "rasage"],
        options: [
          { value: "sensible", label: "Sensible / réactive", desc: "Sans alcool, apaisant", emoji: "🌿" },
          { value: "grasse", label: "Grasse", desc: "Purifiant, matifiant", emoji: "💧" },
          { value: "seche", label: "Sèche", desc: "Riche, nourrissant", emoji: "🏜️" },
          { value: "normale", label: "Normale", desc: "Polyvalent", emoji: "✅" },
        ],
      },
      {
        id: "style_vibe",
        prompt: "Ton style préféré ?",
        helper: "C'est ce qui pilote le choix des marques et des produits.",
        type: "single",
        options: [
          { value: "old_school", label: "Old School", desc: "Pompadour, slick back", emoji: "🎩" },
          { value: "rock", label: "Rock", desc: "Mèches, mid-length texturé", emoji: "🎸" },
          { value: "urbain", label: "Urbain", desc: "Fade, taper, street", emoji: "🔥" },
          { value: "premium", label: "Premium", desc: "Executive, soigné", emoji: "👑" },
          { value: "naturel", label: "Naturel", desc: "Low-key, no-product look", emoji: "🌿" },
          { value: "hipster", label: "Hipster", desc: "Barbe + crop, workwear", emoji: "🧔‍♂️" },
          { value: "moderne", label: "Moderne", desc: "Techwear, minimaliste", emoji: "✨" },
        ],
      },
      {
        id: "engagement",
        prompt: "Niveau d'engagement routine ?",
        helper: "On calibre la taille de la sélection.",
        type: "single",
        options: [
          { value: "express", label: "Express", desc: "2-3 produits, gain de temps", emoji: "⚡" },
          { value: "regulier", label: "Régulier", desc: "4-5 produits, quotidien", emoji: "📅" },
          { value: "complet", label: "Complet", desc: "6-8 produits, rituel pro", emoji: "🏆" },
        ],
      },
      {
        id: "budget",
        prompt: "Ton budget ?",
        type: "single",
        options: [
          { value: "eco", label: "Économique", desc: "< 50 € total · marques entry" },
          { value: "standard", label: "Standard", desc: "50-100 € · milieu de gamme" },
          { value: "premium", label: "Premium", desc: "100 €+ · haut de gamme" },
        ],
      },
      {
        id: "mif",
        prompt: "Made in France important ?",
        type: "single",
        options: [
          { value: "oui", label: "Oui, prioritaire", desc: "Marques FR boostées", emoji: "🇫🇷" },
          { value: "indif", label: "Indifférent", emoji: "🌍" },
        ],
      },
    ],
  },
  "materiel-pro": {
    eyebrow: "Matériel pro",
    title: "On sélectionne ton matos",
    intro: "Quelques questions de barbier à barbier. La sélection apparaît en face.",
    dashboardTitle: "Ta sélection matos",
    dashboardSubtitle: "Compatible avec ta technique",
    questions: [
      {
        id: "categorie_matos",
        prompt: "Quel matos tu cherches ?",
        helper: "On filtre la sélection sur ce type d'outil.",
        type: "single",
        options: [
          { value: "tondeuse_coupe", label: "Tondeuse de coupe", emoji: "📏" },
          { value: "tondeuse_finition", label: "Tondeuse de finition", desc: "Contours, dégradés", emoji: "🔪" },
          { value: "rasoir_electrique", label: "Rasoir électrique", emoji: "⚡" },
          { value: "ciseaux", label: "Ciseaux", emoji: "✂️" },
          { value: "seche_cheveux", label: "Sèche-cheveux", emoji: "💨" },
          { value: "shavette", label: "Shavette / coupe-chou", emoji: "🪒" },
          { value: "accessoires", label: "Accessoires", desc: "Peignes, brosses, capes" },
          { value: "equipement_salon", label: "Équipement salon", desc: "Mobilier, hygiène" },
        ],
      },
      // ---- Usage adapté à la catégorie ----
      {
        id: "usage",
        prompt: "Pour quel usage principal ?",
        type: "single",
        needsFrom: "categorie_matos",
        needsValues: ["tondeuse_coupe"],
        options: [
          { value: "sabot", label: "Coupes au sabot", desc: "Longueurs, dégagement", emoji: "📏" },
          { value: "fade", label: "Dégradés / fade précis", desc: "Lame ajustable", emoji: "📐" },
          { value: "polyvalent_coupe", label: "Polyvalent coupe + dégradé", emoji: "🔄" },
        ],
      },
      {
        id: "usage",
        prompt: "Pour quel usage principal ?",
        type: "single",
        needsFrom: "categorie_matos",
        needsValues: ["tondeuse_finition"],
        options: [
          { value: "contours", label: "Contours nets, lignes", emoji: "✏️" },
          { value: "designs", label: "Designs / motifs", emoji: "🎨" },
          { value: "transition_zero", label: "Fade transition zéro", emoji: "📐" },
        ],
      },
      {
        id: "usage",
        prompt: "Pour quel usage principal ?",
        type: "single",
        needsFrom: "categorie_matos",
        needsValues: ["rasoir_electrique"],
        options: [
          { value: "finition_blanc", label: "Finition rasage à blanc", emoji: "✨" },
          { value: "rasage_complet", label: "Rasage complet visage", emoji: "🧔" },
          { value: "compact", label: "Compact / déplacements", emoji: "🎒" },
        ],
      },
      {
        id: "usage",
        prompt: "Pour quel usage principal ?",
        type: "single",
        needsFrom: "categorie_matos",
        needsValues: ["seche_cheveux"],
        options: [
          { value: "brushing", label: "Brushing salon, volume", emoji: "💨" },
          { value: "sechage_rapide", label: "Séchage rapide pro", emoji: "⚡" },
          { value: "precision", label: "Précision détail barbe", emoji: "🎯" },
        ],
      },
      {
        id: "usage",
        prompt: "Niveau ciseaux ?",
        type: "single",
        needsFrom: "categorie_matos",
        needsValues: ["ciseaux"],
        options: [
          { value: "initiation", label: "Initiation / budget", desc: "Kyone / Mashiro entry" },
          { value: "pro", label: "Pro confirmé", desc: "Mashiro / Osaka" },
          { value: "sculpteur", label: "Sculpteur / effilage", desc: "Ciseaux dentés" },
        ],
      },
      {
        id: "volume",
        prompt: "Volume d'utilisation ?",
        helper: "On calibre la robustesse et la marque.",
        type: "single",
        options: [
          { value: "petit", label: "1-5 clients/jour", desc: "Occasionnel" },
          { value: "moyen", label: "5-15 clients/jour", desc: "Régulier" },
          { value: "intensif", label: "15+ clients/jour", desc: "Intensif, top niveau requis" },
        ],
      },
      {
        id: "style_shop",
        prompt: "Style de ton shop ?",
        type: "single",
        options: [
          { value: "old_school", label: "Old School / Vintage", desc: "Andis MLC, Wahl classic", emoji: "🎩" },
          { value: "moderne", label: "Moderne / Tech", desc: "Babyliss PRO, Gamma+", emoji: "✨" },
          { value: "premium", label: "Premium / Hôtellerie", desc: "Finitions Gold", emoji: "👑" },
        ],
      },
      {
        id: "budget_outil",
        prompt: "Budget par outil ?",
        type: "single",
        options: [
          { value: "moins_80", label: "< 80 €", desc: "Entry pro" },
          { value: "80_150", label: "80 – 150 €", desc: "Standard pro" },
          { value: "150_250", label: "150 – 250 €", desc: "Premium" },
          { value: "plus_250", label: "250 €+", desc: "Collector / exclusif" },
        ],
      },
      {
        id: "complements",
        prompt: "Besoins complémentaires ?",
        helper: "On ajoute les accessoires pertinents à la sélection.",
        type: "multi",
        options: [
          { value: "lames", label: "Lames de rechange", emoji: "🔧" },
          { value: "socle", label: "Socle de charge", emoji: "🔌" },
          { value: "mallette", label: "Mallette / rangement", emoji: "🧳" },
          { value: "hygiene", label: "Hygiène & désinfection", emoji: "💧" },
        ],
      },
    ],
  },
  revente: {
    eyebrow: "Pro revente shop",
    title: "On compose ton mur de revente",
    intro: "Quelques questions sur ton shop et ta clientèle — la sélection produits revente se monte en face.",
    dashboardTitle: "Ton mur revente",
    dashboardSubtitle: "Produits à vendre à tes clients",
    questions: [
      {
        id: "style_shop",
        prompt: "Le style de ton shop ?",
        helper: "Pilote les marques qu'on va te pousser.",
        type: "single",
        options: [
          { value: "old_school", label: "Old school", emoji: "🎩" },
          { value: "moderne", label: "Moderne / clean", emoji: "✨" },
          { value: "urbain", label: "Urbain / street", emoji: "🔥" },
          { value: "premium", label: "Gentleman premium", emoji: "👑" },
        ],
      },
      {
        id: "clientele",
        prompt: "Ta clientèle dominante ?",
        type: "single",
        options: [
          { value: "jeune_urbain", label: "Jeune urbain 18-30", emoji: "🧢" },
          { value: "actif_30_45", label: "Actif 30-45", emoji: "💼" },
          { value: "premium_cadre", label: "Cadre / dirigeant", emoji: "👔" },
          { value: "mixte", label: "Mixte / familial", emoji: "🏘️" },
        ],
      },
      {
        id: "ticket_revente",
        prompt: "Ton ticket moyen revente visé ?",
        helper: "Détermine la gamme de prix qu'on sélectionne.",
        type: "single",
        options: [
          { value: "15", label: "≤ 15 €", desc: "Accessible / impulsion" },
          { value: "30", label: "15 – 30 €", desc: "Standard barbershop" },
          { value: "50", label: "30 – 50 €", desc: "Milieu / premium" },
          { value: "999", label: "50 €+", desc: "Premium / luxe" },
        ],
      },
      {
        id: "categories",
        prompt: "Quelles catégories en rayon ?",
        helper: "Coche tout ce que tu veux mettre en vente.",
        type: "multi",
        options: [
          { value: "coiffant", label: "Cires & pommades", emoji: "💎" },
          { value: "soin_barbe", label: "Soins barbe", emoji: "🧔" },
          { value: "rasage", label: "Rasage tradi", emoji: "🪒" },
          { value: "soin_visage", label: "Skincare visage", emoji: "🧴" },
          { value: "parfum", label: "Parfums", emoji: "🌬️" },
          { value: "shampoing", label: "Shampoings", emoji: "🚿" },
        ],
      },
      {
        id: "volume_revente",
        prompt: "Ton volume revente actuel ?",
        type: "single",
        options: [
          { value: "demarrage", label: "Je démarre", desc: "1 facing par produit" },
          { value: "regulier", label: "Régulier", desc: "2-3 facings, gamme posée" },
          { value: "fort", label: "Fort", desc: "Mur complet, profondeur de gamme" },
        ],
      },
      {
        id: "marques_distribuees",
        prompt: "Marques que tu distribues déjà ?",
        helper: "On les exclut pour t'éviter le doublon.",
        type: "multi",
        options: [
          { value: "reuzel", label: "Reuzel", logo: "https://www.obarbershop.com/img/m/10.jpg" },
          { value: "suavecito", label: "Suavecito", logo: "https://www.obarbershop.com/img/m/3.jpg" },
          { value: "proraso", label: "Proraso", logo: "https://www.obarbershop.com/img/m/75.jpg" },
          { value: "l3vel3", label: "L3vel3", logo: "https://www.obarbershop.com/img/m/62.jpg" },
          { value: "uppercut", label: "Uppercut Deluxe", logo: "https://www.obarbershop.com/img/m/2.jpg" },
          { value: "bullfrog", label: "Bullfrog", logo: "https://www.obarbershop.com/img/m/49.jpg" },
          { value: "captain_fawcett", label: "Captain Fawcett", logo: "https://www.obarbershop.com/img/m/30.jpg" },
          { value: "noberu", label: "Noberu", logo: "https://www.obarbershop.com/img/m/15.jpg" },
        ],
      },
      {
        id: "marques_interet",
        prompt: "Marques qui t'intéressent ?",
        helper: "On boost ces marques dans la sélection.",
        type: "multi",
        options: [
          { value: "reuzel", label: "Reuzel", logo: "https://www.obarbershop.com/img/m/10.jpg" },
          { value: "suavecito", label: "Suavecito", logo: "https://www.obarbershop.com/img/m/3.jpg" },
          { value: "proraso", label: "Proraso", logo: "https://www.obarbershop.com/img/m/75.jpg" },
          { value: "l3vel3", label: "L3vel3", logo: "https://www.obarbershop.com/img/m/62.jpg" },
          { value: "uppercut", label: "Uppercut Deluxe", logo: "https://www.obarbershop.com/img/m/2.jpg" },
          { value: "bullfrog", label: "Bullfrog", logo: "https://www.obarbershop.com/img/m/49.jpg" },
          { value: "captain_fawcett", label: "Captain Fawcett", logo: "https://www.obarbershop.com/img/m/30.jpg" },
          { value: "noberu", label: "Noberu", logo: "https://www.obarbershop.com/img/m/15.jpg" },
          { value: "dapper_dan", label: "Dapper Dan", logo: "https://www.obarbershop.com/img/m/26.jpg" },
          { value: "apothecary", label: "Apothecary 87", logo: "https://www.obarbershop.com/img/m/78.jpg" },
          { value: "clubman", label: "Clubman Pinaud", logo: "https://www.obarbershop.com/img/m/46.jpg" },
          { value: "daimon", label: "Daimon Barber", logo: "https://www.obarbershop.com/img/m/12.jpg" },
        ],
      },
      {
        id: "mif",
        prompt: "Made in France important ?",
        type: "single",
        options: [
          { value: "oui", label: "Oui, à mettre en avant", emoji: "🇫🇷" },
          { value: "indif", label: "Indifférent", emoji: "🌍" },
        ],
      },
    ],
  },
};

// ---------- Recommandation logic ----------

export type Recommendation = {
  produit: Produit;
  qty: number;
  reason: string;
  bucket: string;
  score?: number;
};

type Answers = Record<string, string | string[]>;

// ---------- Stratégie marques ----------

const CLIPPER_BESTSELLERS = ["jrl", "gamma", "stylecraft", "wahl"];
const MATERIEL_BLACKLIST = ["sapiens", "captain fawcett"];

const brandKey = (p: Produit) => p.marque.toLowerCase();

const isBestSellerClipper = (p: Produit) =>
  CLIPPER_BESTSELLERS.some((b) => brandKey(p).includes(b));

const isBlacklistedMateriel = (p: Produit) =>
  MATERIEL_BLACKLIST.some((b) => brandKey(p).includes(b));

const matchKeywords = (p: Produit, kws: string[]) => {
  const hay = `${p.nom} ${p.recap || ""}`.toLowerCase();
  return kws.some((k) => hay.includes(k.toLowerCase()));
};

const scissorPoolFromBudget = (budget: number): { brand: string; label: string } => {
  if (budget > 0 && budget <= 100) return { brand: "kyone", label: "Kyone — qualité japonaise accessible" };
  if (budget <= 250) return { brand: "mashiro", label: "Mashiro — finition Damas, design signature" };
  return { brand: "osaka", label: "Osaka — référence des pros confirmés" };
};

const pickBest = (
  pool: Produit[],
  opts: { style?: string; segment?: string; limit?: number } = {},
) => {
  const { style, segment, limit = 1 } = opts;
  const scored = pool.map((p) => {
    let score = 0;
    if (style && p.styles.includes(style)) score += 5;
    if (segment && p.segment === segment) score += 3;
    if (p.mif) score += 0.5;
    if (p.stock > 5) score += 0.3;
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.p);
};

const segmentFromBudget = (b: number, scale: "shop" | "perso") => {
  if (scale === "shop") {
    if (b <= 5000) return "entree";
    if (b <= 10000) return "milieu";
    return "premium";
  }
  if (b <= 50) return "entree";
  if (b <= 100) return "milieu";
  return "premium";
};

export function recommend(mode: Mode, answers: Answers): Recommendation[] {
  if (mode === "ouverture") return [];
  if (mode === "particulier") return recoRoutine(answers);
  if (mode === "revente") return recoRevente(answers);
  return recoMateriel(answers);
}

// ---------- Ouverture : guide de positionnement (pas de produits) ----------

export type OuvertureInsight = {
  bucket: string;
  title: string;
  body: string;
  tags?: string[];
  swatches?: { hex: string; name: string }[];
  brands?: BrandCard[];
  brandRecos?: BrandReco[];
  comboGaps?: ComboGap[];
};

export type BrandReco = {
  brand: BrandCard;
  alignedWithStyle: boolean;
  topProducts: Array<{ produit: Produit; prixIndicatif: number }>;
  categories: string[];
};

export type ComboGap = {
  famille: string;
  label: string;
  suggestion?: BrandCard;
  reason: string;
};

// ---------- Brand swipe pool (ouverture) ----------

export type BrandCard = {
  id: string;          // canonical key, ex: "reuzel"
  marqueId: string;    // id used in MARQUES / products id_marque
  label: string;
  pays: string;
  desc: string;
  logo: string;
  styleTag: string;    // short positioning tag
  sampleImages: string[]; // jusqu'à 3 visuels produits pour le swipe
  segment?: string;    // entree / milieu / premium
  styles?: string[];   // tags style depuis MARQUES
  categories?: string[]; // catégories couvertes (depuis produits revente)
};

const BRAND_SEED: Array<{ id: string; marqueId: string; label: string; styleTag: string }> = [
  { id: "reuzel",          marqueId: "10", label: "Reuzel",          styleTag: "Old school iconique" },
  { id: "suavecito",       marqueId: "3",  label: "Suavecito",       styleTag: "Rockabilly californien" },
  { id: "proraso",         marqueId: "75", label: "Proraso",         styleTag: "Rasage italien" },
  { id: "l3vel3",          marqueId: "62", label: "L3vel3",          styleTag: "Street / urbain" },
  { id: "uppercut",        marqueId: "2",  label: "Uppercut Deluxe", styleTag: "Rock australien" },
  { id: "bullfrog",        marqueId: "49", label: "Bullfrog",        styleTag: "Premium italien" },
  { id: "captain_fawcett", marqueId: "30", label: "Captain Fawcett", styleTag: "Gentleman UK" },
  { id: "noberu",          marqueId: "15", label: "Noberu",          styleTag: "Moderne espagnol" },
  { id: "dapper_dan",      marqueId: "26", label: "Dapper Dan",      styleTag: "Vintage UK" },
  { id: "apothecary",      marqueId: "78", label: "Apothecary 87",   styleTag: "Premium UK" },
  { id: "clubman",         marqueId: "46", label: "Clubman Pinaud",  styleTag: "Old school US" },
  { id: "daimon",          marqueId: "12", label: "Daimon Barber",   styleTag: "Gentleman moderne" },
];

const brandProducts = (marqueId: string): Produit[] =>
  PRODUITS.filter(
    (p) =>
      p.id_marque === marqueId &&
      p.image &&
      p.dispo !== "rupture" &&
      p.super_cat === "soin_revente",
  );

const pickBrandSamples = (marqueId: string, n = 3): string[] => {
  const pool = brandProducts(marqueId);
  if (pool.length === 0) return [];
  // Diversifier par catégorie, prioriser stock élevé
  const sorted = [...pool].sort((a, b) => (b.stock || 0) - (a.stock || 0));
  const out: string[] = [];
  const seenCat = new Set<string>();
  for (const p of sorted) {
    if (seenCat.has(p.categorie) && out.length >= 1) continue;
    out.push(p.image);
    seenCat.add(p.categorie);
    if (out.length >= n) break;
  }
  // Si pas assez de catégories distinctes, compléter avec les meilleurs restants
  if (out.length < n) {
    for (const p of sorted) {
      if (out.includes(p.image)) continue;
      out.push(p.image);
      if (out.length >= n) break;
    }
  }
  return out;
};

const brandCategories = (marqueId: string): string[] => {
  const cats = new Set<string>();
  brandProducts(marqueId).forEach((p) => cats.add(p.categorie));
  return Array.from(cats);
};

export const OUVERTURE_BRAND_POOL: BrandCard[] = BRAND_SEED.map((seed) => {
  const m = MARQUES.find((x) => x.id === seed.marqueId);
  return {
    ...seed,
    logo: m?.logo || `https://www.obarbershop.com/img/m/${seed.marqueId}.jpg`,
    pays: m?.pays || "",
    desc: m?.desc || seed.styleTag,
    sampleImages: pickBrandSamples(seed.marqueId, 3),
    segment: m?.segment,
    styles: m?.styles || (m?.style ? [m.style] : []),
    categories: brandCategories(seed.marqueId),
  };
});

// Filtre le pool selon le style choisi. Fallback : complète avec transverses si <6.
export function filterBrandPoolByStyle(style: string): BrandCard[] {
  if (!style) return OUVERTURE_BRAND_POOL;
  const matching = OUVERTURE_BRAND_POOL.filter((b) =>
    (b.styles || []).includes(style),
  );
  if (matching.length >= 6) return matching;
  // Compléter avec les marques transverses (qui couvrent ≥2 styles)
  const transverses = OUVERTURE_BRAND_POOL.filter(
    (b) =>
      !matching.includes(b) &&
      (b.styles || []).length >= 2,
  );
  return [...matching, ...transverses].slice(0, Math.max(8, matching.length));
}

// Tarif pro indicatif : prix public * 0.55 arrondi à l'euro
const prixPro = (prixPublic: number) => Math.max(1, Math.round(prixPublic * 0.55));

export function recoBrandDetails(brand: BrandCard, style: string): BrandReco {
  const products = brandProducts(brand.marqueId);
  // 3 meilleurs : diversité catégorie + stock
  const sorted = [...products].sort((a, b) => (b.stock || 0) - (a.stock || 0));
  const top: Produit[] = [];
  const seenCat = new Set<string>();
  for (const p of sorted) {
    if (seenCat.has(p.categorie) && top.length >= 1) continue;
    top.push(p);
    seenCat.add(p.categorie);
    if (top.length >= 3) break;
  }
  if (top.length < 3) {
    for (const p of sorted) {
      if (top.includes(p)) continue;
      top.push(p);
      if (top.length >= 3) break;
    }
  }
  const deck = STYLE_DECK[style];
  const alignedWithStyle =
    !!deck && deck.brands.some((d) => d.toLowerCase() === brand.label.toLowerCase());

  return {
    brand,
    alignedWithStyle,
    topProducts: top.map((p) => ({ produit: p, prixIndicatif: prixPro(p.prix) })),
    categories: brand.categories || [],
  };
}

// Familles cibles d'un mur revente. On mappe sur les `categorie` réelles via mots-clés.
const FAMILLE_KEYWORDS: Record<string, string[]> = {
  coiffage: ["pommade", "cire", "wax", "gel", "pâte", "pate", "spray coiffant", "coiffage"],
  barbe: ["barbe", "huile barbe", "baume barbe", "shampoing barbe"],
  rasage: ["rasage", "rasoir", "blaireau", "savon rasage", "crème rasage", "creme rasage", "after shave", "after-shave"],
  parfum: ["parfum", "eau de cologne", "edt", "edp", "cologne"],
  peau: ["soin visage", "skincare", "hydrat", "crème visage", "creme visage", "sérum", "serum"],
};

const FAMILLE_LABELS: Record<string, string> = {
  coiffage: "Coiffage",
  barbe: "Soin barbe",
  rasage: "Rasage",
  parfum: "Parfum",
  peau: "Soin peau",
};

const brandCoversFamille = (brand: BrandCard, famille: string): boolean => {
  const kws = FAMILLE_KEYWORDS[famille] || [];
  const cats = (brand.categories || []).join(" ").toLowerCase();
  return kws.some((k) => cats.includes(k));
};

export function comboMarquesGaps(likedBrands: BrandCard[], style: string): ComboGap[] {
  const familles = Object.keys(FAMILLE_KEYWORDS);
  const pool = filterBrandPoolByStyle(style).filter(
    (b) => !likedBrands.some((lb) => lb.id === b.id),
  );
  return familles
    .map<ComboGap | null>((famille) => {
      const covered = likedBrands.some((b) => brandCoversFamille(b, famille));
      if (covered) return null;
      const suggestion = pool.find((b) => brandCoversFamille(b, famille));
      const label = FAMILLE_LABELS[famille] || famille;
      const styleName = STYLE_DECK[style]?.name || "ton univers";
      return {
        famille,
        label,
        suggestion,
        reason: suggestion
          ? `Complète ton rayon ${label.toLowerCase()} avec ${suggestion.label}, dans ${styleName}.`
          : `Aucune marque ${label.toLowerCase()} dans ta short-list — pense à en ajouter une.`,
      };
    })
    .filter((g): g is ComboGap => g !== null);
}

const STYLE_DECK: Record<string, { name: string; palette: string; materials: string; pitch: string; brands: string[]; swatches: { hex: string; name: string }[] }> = {
  old_school: {
    name: "Old School Barbershop",
    palette: "Vert sapin, brass doré, cuir cognac, damier noir & blanc",
    materials: "Bois massif teinté, laiton vieilli, cuir, miroirs Art Déco",
    pitch: "Un repaire de gentlemen : barbershop à l'ancienne, codes vintage assumés, savoir-faire au centre.",
    brands: ["Reuzel", "Suavecito", "Layrite", "Proraso"],
    swatches: [
      { hex: "#1f3a2e", name: "Vert sapin" },
      { hex: "#b8893a", name: "Brass doré" },
      { hex: "#7a4a2b", name: "Cuir cognac" },
      { hex: "#f4ead5", name: "Crème" },
      { hex: "#111111", name: "Noir damier" },
    ],
  },
  moderne: {
    name: "Modern Grooming Studio",
    palette: "Blanc cassé, bois clair, noir mat, touches sauge ou terracotta",
    materials: "Béton ciré, chêne clair, métal noir, marbre, plantes",
    pitch: "Un studio grooming clean & minimaliste : geste précis, expérience apaisée, esthétique soignée.",
    brands: ["Hanz de Fuko", "Triumph & Disaster", "Esquire Grooming"],
    swatches: [
      { hex: "#f5f1ea", name: "Blanc cassé" },
      { hex: "#d8c7a8", name: "Chêne clair" },
      { hex: "#1a1a1a", name: "Noir mat" },
      { hex: "#9aa78a", name: "Sauge" },
      { hex: "#c4734a", name: "Terracotta" },
    ],
  },
  urbain: {
    name: "Street Cuts Lab",
    palette: "Noir, néon rose / cyan, béton brut, graffiti",
    materials: "Métal noir, plexi, néons LED, mobilier industriel, brick wall",
    pitch: "Le barbershop qui parle la langue de la rue : fade strict, drops, collab artistes, culture street.",
    brands: ["L3vel3", "Uppercut Deluxe", "BluMaan", "By Vilain"],
    swatches: [
      { hex: "#0a0a0a", name: "Noir profond" },
      { hex: "#ff2d87", name: "Néon rose" },
      { hex: "#00e7ff", name: "Néon cyan" },
      { hex: "#7d7d7d", name: "Béton brut" },
      { hex: "#c9a227", name: "Tag jaune" },
    ],
  },
  premium: {
    name: "Gentleman's Grooming House",
    palette: "Vert anglais, acajou, laiton poli, velours bordeaux",
    materials: "Bois noble, marbre, velours, laiton massif, cuir Chesterfield",
    pitch: "Une maison de grooming d'exception : rituels longs, produits d'orfèvre, service à l'anglaise.",
    brands: ["Acca Kappa", "Floïd", "D.R. Harris", "Truefitt & Hill"],
    swatches: [
      { hex: "#102a1f", name: "Vert anglais" },
      { hex: "#4a1f1a", name: "Acajou" },
      { hex: "#caa45a", name: "Laiton poli" },
      { hex: "#5e1622", name: "Velours bordeaux" },
      { hex: "#ece4d2", name: "Ivoire" },
    ],
  },
};

const CLIENT_TONE: Record<string, { tone: string; channels: string }> = {
  jeune_urbain: {
    tone: "Direct, culture sneakers / rap, vannes assumées. Tu parles à un crew, pas à un client.",
    channels: "Instagram Reels, TikTok, collabs avec rappeurs / streetwear locaux. Drops & contenus de coupe.",
  },
  actif_30_45: {
    tone: "Efficace, conseil expert, peu de jargon. Le mec n'a pas 2h à perdre.",
    channels: "Google Business hyper soigné, Instagram propre, partenariats salles de sport / costumiers.",
  },
  premium_cadre: {
    tone: "Posé, vocabulaire artisan, storytelling produit. Tu vends une expérience, pas une coupe.",
    channels: "Site éditorial, presse lifestyle (GQ, L'Officiel Hommes), cartes de fidélité physiques.",
  },
  mixte: {
    tone: "Chaleureux, familial, accessible. Tu crées un lieu où l'on revient avec son fils.",
    channels: "Facebook + Instagram quartier, partenariats commerçants voisins, événement enfants.",
  },
};

const PRICE_GRID: Record<string, string> = {
  accessible: "Coupe 22-26 € · Barbe 15-18 € · Combo 35-42 €",
  milieu: "Coupe 30-36 € · Barbe 20-25 € · Combo 48-55 €",
  premium: "Coupe 40-50 € · Barbe 28-35 € · Combo 65-78 € · Rasage tradi 45-55 €",
  ultra_premium: "Coupe 60-80 € · Barbe 40-55 € · Rituel complet 120-180 €",
};

export function ouvertureInsights(a: Answers): OuvertureInsight[] {
  const out: OuvertureInsight[] = [];
  const style = (a.style as string) || "";
  const deck = STYLE_DECK[style];
  const clientele = (a.clientele as string) || "";
  const positionnement = (a.positionnement as string) || "";
  const zone = (a.zone as string) || "";
  const services = (a.services as string[]) || [];
  const valeurs = (a.valeurs as string[]) || [];
  const son = (a.ambiance_sonore as string) || "";
  const signature = (a.signature as string) || "";
  const nb = parseInt((a.fauteuils as string) || "0");

  if (deck) {
    out.push({
      bucket: "Concept",
      title: deck.name,
      body: deck.pitch,
      tags: [style, nb ? `${nb} poste${nb > 1 ? "s" : ""}` : ""].filter(Boolean),
    });
    out.push({
      bucket: "Univers visuel",
      title: "Palette & matériaux",
      body: `Palette : ${deck.palette}. Matériaux : ${deck.materials}.`,
      swatches: deck.swatches,
    });
    out.push({
      bucket: "Linéaire & revente",
      title: "Marques à mettre en avant en façade",
      body: `Aligne ton mur de revente avec ton ambiance. Pour ce style, on pense d'abord à ${deck.brands.join(", ")}. (On chiffrera la sélection produit dans l'assistant dédié.)`,
      tags: deck.brands,
    });
  }

  if (clientele) {
    const ct = CLIENT_TONE[clientele];
    if (ct) {
      out.push({
        bucket: "Ton de marque",
        title: "Comment tu parles à ton client",
        body: ct.tone,
      });
      out.push({
        bucket: "Acquisition",
        title: "Tes canaux prioritaires",
        body: ct.channels,
      });
    }
  }

  if (positionnement && PRICE_GRID[positionnement]) {
    out.push({
      bucket: "Pricing",
      title: "Grille de tarifs cohérente",
      body: PRICE_GRID[positionnement],
    });
  }

  if (zone) {
    const z: Record<string, string> = {
      hyper_centre: "Vitrine ultra travaillée + flux piéton à capter. Investis dans l'enseigne et le storefront, sois irréprochable côté Google reviews dès J+1.",
      quartier: "Joue la carte du local : nom évoquant le quartier, partenariats commerçants voisins, programme de fidélité physique.",
      banlieue: "Lisibilité forte (panneau visible de la route), parking, créneaux soirée + samedi. Réseaux sociaux essentiels pour exister hors du flux piéton.",
      village: "Tu deviens LA référence locale : storytelling fort, événement d'ouverture, présence sur les pages communautaires Facebook / WhatsApp.",
    };
    out.push({ bucket: "Implantation", title: "Stratégie de zone", body: z[zone] || "" });
  }

  if (services.length) {
    const labels: Record<string, string> = {
      coupe: "Coupe homme",
      barbe: "Barbe",
      rasage: "Rasage à l'ancienne",
      soin: "Soin visage",
    };
    out.push({
      bucket: "Offre",
      title: "Pilier de services",
      body:
        services.includes("rasage") || services.includes("soin")
          ? "Mets en avant les rituels longs (rasage tradi, soin visage) sur la carte — c'est ton ticket moyen et ton signal de positionnement."
          : "Capitalise sur la coupe + barbe combo. Crée un combo signature avec un nom propre à la maison.",
      tags: services.map((s) => labels[s]).filter(Boolean),
    });
  }

  if (valeurs.length) {
    out.push({
      bucket: "Marque",
      title: "Tes piliers de valeurs",
      body: "Ces 3-4 mots doivent apparaître partout : site, vitrine, briefing équipe, posts. C'est ce qui te rend reconnaissable.",
      tags: valeurs,
    });
  }

  if (son) {
    const playlist: Record<string, string> = {
      hiphop: "Playlist hip-hop / RnB qui glisse — Kendrick, Anderson .Paak, NxWorries, J Dilla. Volume tenu, jamais agressif.",
      rock: "Rock & blues — Black Keys, Arctic Monkeys, Gary Clark Jr. Parfait pour un univers old school / cuir.",
      jazz: "Jazz / soul / lounge — Bill Withers, Curtis Mayfield, Nu jazz contemporain. Code premium.",
      electro: "Électro / house chill — Bonobo, Folamour, Caribou. Tient l'énergie sans casser la conversation.",
    };
    out.push({ bucket: "Ambiance", title: "Direction sonore", body: playlist[son] || "" });
  }

  if (signature) {
    const sig: Record<string, string> = {
      neon: "Un néon signature (logo ou citation) visible de la rue + en story background. Identitaire et photo-friendly.",
      vintage: "Une pièce de mobilier vintage chinée (fauteuil Belmont, miroir Art Déco). Storytelling immédiat, valeur perçue x2.",
      coffee: "Coffee corner pro (machine espresso, sélection sodas). Tu vends une expérience, pas une attente.",
      vinyl: "Mur de vinyles ou collection sneakers / casquettes. Le client revient pour le lieu autant que pour la coupe.",
      art: "Mur dédié aux artistes locaux (tatoueurs, illustrateurs). Communauté forte + contenu social naturel.",
    };
    out.push({ bucket: "Signature", title: "Le détail qu'on retient", body: sig[signature] || "" });
  }

  // Marques validées au swipe → recommandations détaillées
  const likedBrands = ((a.marques_revente as string[]) || [])
    .map((id) => OUVERTURE_BRAND_POOL.find((b) => b.id === id))
    .filter((b): b is BrandCard => Boolean(b));
  if (likedBrands.length > 0) {
    const recos = likedBrands.map((b) => recoBrandDetails(b, style));
    const aligned = recos.filter((r) => r.alignedWithStyle);
    out.push({
      bucket: "Marques validées (swipe)",
      title: `${likedBrands.length} marque${likedBrands.length > 1 ? "s" : ""} dans ta short-list`,
      body:
        aligned.length > 0
          ? `${aligned.length} sur ${likedBrands.length} colle${aligned.length > 1 ? "nt" : ""} déjà à ton ambiance ${deck?.name ?? ""}. Mets-les en façade, on cale la profondeur de gamme dans l'assistant revente.`
          : `Ta short-list est posée. On la croisera avec ton style ${deck?.name ?? ""} et ton positionnement pour la sélection produit revente.`,
      brandRecos: recos,
    });

    const gaps = comboMarquesGaps(likedBrands, style);
    if (gaps.length > 0) {
      out.push({
        bucket: "Combo marques complémentaires",
        title: "Pour couvrir tout ton rayon",
        body: `Il te manque ${gaps.length} famille${gaps.length > 1 ? "s" : ""} pour un mur de revente complet. Voici nos suggestions dans ton univers.`,
        comboGaps: gaps,
      });
    }
  }

  return out;
}

function recoRoutine(a: Answers): Recommendation[] {
  const ctx: RoutineContext = {
    besoins: ((a.besoins as string[]) || []).slice(),
    barbe: (a.barbe as string) || "",
    cheveuxType: (a.cheveux_type as string) || "",
    peau: (a.peau as string) || "",
    styleVibe: (a.style_vibe as string) || "",
    engagement: (a.engagement as string) || "regulier",
    budget: (a.budget as string) || "standard",
    mifPriority: (a.mif as string) === "oui",
  };
  const picks = pickRoutine(ctx);
  return picks.map((s) => ({
    produit: s.produit,
    qty: s.qty,
    reason: s.reasons[0] || "Sélectionné par notre moteur de matching",
    bucket: s.bucket,
    score: s.score,
  }));
}


// ---------- Reco revente shop ----------

const REVENTE_CAT_TO_TYPES: Record<string, string[]> = {
  coiffant: ["coiffant_cheveux"],
  soin_barbe: ["huile_barbe", "baume_barbe", "shampoing_barbe", "soin_barbe", "cire_moustache"],
  rasage: ["creme_savon_raser", "apres_rasage", "baume_apres_rasage", "pre_shave", "huile_gel_rasage"],
  soin_visage: ["soin_visage", "soin_corps"],
  parfum: ["parfum"],
  shampoing: ["shampoing"],
};

const REVENTE_BUCKET_LABEL: Record<string, string> = {
  coiffant: "Cires & pommades",
  soin_barbe: "Soins barbe",
  rasage: "Rasage tradi",
  soin_visage: "Skincare visage",
  parfum: "Parfums",
  shampoing: "Shampoings",
};

function recoRevente(a: Answers): Recommendation[] {
  const out: Recommendation[] = [];
  const style = (a.style_shop as string) || "";
  const ticket = parseInt((a.ticket_revente as string) || "0");
  const segment =
    ticket <= 15 ? "entree" : ticket <= 30 ? "milieu" : "premium";
  const cats = (a.categories as string[]) || [
    "coiffant",
    "soin_barbe",
    "rasage",
  ];
  const volume = (a.volume_revente as string) || "regulier";
  const perBucket = volume === "demarrage" ? 2 : volume === "fort" ? 4 : 3;
  const distribuees = new Set((a.marques_distribuees as string[]) || []);
  const interets = new Set((a.marques_interet as string[]) || []);
  const mifPriority = (a.mif as string) === "oui";

  const matchBrand = (p: Produit, key: string) =>
    brandKey(p).includes(key.replace("_", " ")) ||
    brandKey(p).includes(key);

  for (const cat of cats) {
    const types = REVENTE_CAT_TO_TYPES[cat];
    if (!types) continue;
    const pool = PRODUITS.filter((p) => {
      if (p.super_cat !== "soin_revente") return false;
      if (p.dispo === "rupture") return false;
      if (!types.includes(p.type)) return false;
      // exclure marques déjà distribuées
      for (const m of distribuees) if (matchBrand(p, m)) return false;
      // garde une fourchette de prix cohérente avec le ticket
      if (ticket > 0 && p.prix > ticket * 1.5 + 10) return false;
      return true;
    });

    const scored = pool.map((p) => {
      let score = 0;
      if (style && p.styles.includes(style)) score += 6;
      if (p.segment === segment) score += 4;
      if (mifPriority && p.mif) score += 3;
      for (const m of interets) if (matchBrand(p, m)) score += 5;
      if (p.stock > 5) score += 0.5;
      score += Math.random() * 0.5;
      return { p, score };
    });
    scored.sort((a, b) => b.score - a.score);

    // diversifier par marque
    const seenMarque = new Set<string>();
    const picks: Produit[] = [];
    for (const s of scored) {
      if (seenMarque.has(s.p.id_marque)) continue;
      picks.push(s.p);
      seenMarque.add(s.p.id_marque);
      if (picks.length >= perBucket) break;
    }

    picks.forEach((p) =>
      out.push({
        produit: p,
        qty: volume === "fort" ? 2 : 1,
        reason: interets.has(p.id_marque)
          ? `Marque ciblée · ${p.marque}`
          : mifPriority && p.mif
            ? "Made in France"
            : p.styles.includes(style)
              ? `Cohérent ${style.replace("_", " ")}`
              : `${p.marque} — best-seller revente`,
        bucket: REVENTE_BUCKET_LABEL[cat] || cat,
      }),
    );
  }

  return out;
}

function recoMateriel(a: Answers): Recommendation[] {
  const ctx: MaterielContext = {
    categorie: (a.categorie_matos as string) || "tondeuse_coupe",
    usage: (a.usage as string) || "",
    volume: (a.volume as string) || "moyen",
    styleShop: (a.style_shop as string) || "moderne",
    budget: (a.budget_outil as string) || "80_150",
    complements: (a.complements as string[]) || [],
  };
  const { tops, accessoires } = pickMateriel(ctx);
  const out: Recommendation[] = [];
  tops.forEach((s) =>
    out.push({
      produit: s.produit,
      qty: s.qty,
      reason: s.reasons[0] || `${s.produit.marque} — match technique`,
      bucket: s.bucket,
      score: s.score,
    }),
  );
  accessoires.forEach((s) =>
    out.push({
      produit: s.produit,
      qty: s.qty,
      reason: s.reasons[0] || "Complément sélectionné",
      bucket: s.bucket,
      score: s.score,
    }),
  );
  return out;
}