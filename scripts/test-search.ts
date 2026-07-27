// Test manuel du moteur de recherche : npx tsx scripts/test-search.ts
import { readFileSync } from "node:fs";
import { creerMoteur, normalize, type Produit, type SearchParams } from "../src/lib/product-search";

const catalogue: Produit[] = JSON.parse(
  readFileSync(new URL("../src/data/produits.json", import.meta.url), "utf8"),
);
const moteur = creerMoteur(catalogue);

console.log("normalize('Crème à Raser') =", normalize("Crème à Raser"));

const tax = moteur.taxonomie();
console.log(`\nCatalogue: ${tax.total} produits (${tax.en_stock} en stock)`);
console.log(
  `types: ${tax.type.length} | marques: ${tax.marque.length} | styles: ${tax.styles.join(", ")}`,
);

const cas: Array<[string, SearchParams]> = [
  ["cire mate cheveux", { texte: "cire mate", type: ["coiffant_cheveux"] }],
  ["creme sans accent", { texte: "creme raser" }],
  ["tondeuse pro < 200e", { type: ["tondeuse_coupe"], prix_max: 200 }],
  ["huile barbe premium", { type: ["huile_barbe"], segment: ["premium"] }],
  ["marque Andis", { marque: ["Andis"] }],
  ["style old school", { styles: ["old_school"], super_cat: ["materiel_coupe"] }],
  ["requete absurde", { texte: "xyzzy quantique" }],
];

for (const [label, params] of cas) {
  const r = moteur.rechercher({ ...params, limite: 3 });
  console.log(`\n── ${label} → ${r.length} résultat(s)`);
  r.forEach((p) => console.log(`   ${p.nom} | ${p.marque} | ${p.prix_aff}€ | ${p.dispo}`));
}

const echantillons = moteur.produits.filter((p) => /^echantillon/i.test(p.nom));
console.log(`\nÉchantillons encore présents : ${echantillons.length} (attendu 0)`);
