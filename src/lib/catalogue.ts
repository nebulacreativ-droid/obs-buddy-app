import produits from "@/data/produits.json";
import marques from "@/data/marques.json";

export type Produit = {
  id: string;
  ref: string;
  nom: string;
  marque: string;
  id_marque: string;
  pays: string;
  segment: "entree" | "milieu" | "premium" | string;
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

// Exclut les échantillons / samples des recommandations (tailles 10g, mini formats…).
// Détection par nom : "Echantillon X" ou "X Sample" — robuste aux variations de casse.
const isSample = (p: Produit) => /^\s*echantillon\b|\bsample\b/i.test(p.nom);

export const PRODUITS = (produits as Produit[]).filter((p) => !isSample(p));
export const MARQUES = marques as Marque[];

export const produitsByType = (types: string[]) =>
  PRODUITS.filter((p) => types.includes(p.type) && p.dispo !== "rupture");

export const produitsBySuperCat = (cats: string[]) =>
  PRODUITS.filter((p) => cats.includes(p.super_cat) && p.dispo !== "rupture");

export const formatPrix = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export const formatPrixDecimal = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);