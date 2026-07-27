import produits from "@/data/produits.json";
import marques from "@/data/marques.json";
import { estEchantillon, type Produit } from "@/lib/product-search";

export type { Produit };

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

// L'exclusion des échantillons vit dans product-search : une seule définition
// partagée entre l'assistant, le chatbot et la fonction serverless.
export const PRODUITS = (produits as Produit[]).filter((p) => !estEchantillon(p));
export const MARQUES = marques as Marque[];

export const produitsByType = (types: string[]) =>
  PRODUITS.filter((p) => types.includes(p.type) && p.dispo !== "rupture");

export const produitsBySuperCat = (cats: string[]) =>
  PRODUITS.filter((p) => cats.includes(p.super_cat) && p.dispo !== "rupture");

export const formatPrix = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export const formatPrixDecimal = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);