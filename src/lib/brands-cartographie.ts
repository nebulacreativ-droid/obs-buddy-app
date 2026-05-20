import data from "@/data/brands-cartographie.json";
import type { Produit } from "./catalogue";

export type BrandInfo = {
  nom: string;
  bs: boolean;
  styles: string[];
  mif: boolean;
  f1: boolean;
  f2: boolean;
  f3: boolean;
};

const RAW = data as BrandInfo[];

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const MAP = new Map<string, BrandInfo>();
for (const b of RAW) MAP.set(norm(b.nom), b);

export function getBrandInfo(p: Produit): BrandInfo | undefined {
  return MAP.get(norm(p.marque)) || MAP.get(norm(p.id_marque));
}

export function isBestSeller(p: Produit): boolean {
  return !!getBrandInfo(p)?.bs;
}

// Phrase contextuelle best-seller (cf onglet Best-Sellers du doc)
const BS_TAGLINES: Record<string, string> = {
  reuzel: "Marque iconique du barbershop",
  uppercutdeluxe: "Référence rock urbaine",
  captainfawcett: "Excellence gentleman anglais",
  bullfrog: "Premium italien design",
  l3vel3: "Star des barbers urbains",
  fxb: "Signature française barbier",
};

export function bestSellerTagline(p: Produit): string | undefined {
  if (!isBestSeller(p)) return undefined;
  return BS_TAGLINES[norm(p.marque)] || "Marque best-seller du catalogue";
}

export function isRecommendedForForm(p: Produit, form: 1 | 2 | 3): boolean {
  const b = getBrandInfo(p);
  if (!b) return true; // marque inconnue → neutre
  if (form === 1) return b.f1;
  if (form === 2) return b.f2;
  return b.f3;
}