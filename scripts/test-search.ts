// Test manuel du moteur de recherche : npx tsx scripts/test-search.ts
import { searchProducts, getTaxonomy, normalize } from "../src/lib/product-search";

console.log("normalize('Crème à Raser') =", normalize("Crème à Raser"));

const tax = getTaxonomy();
console.log(`\nCatalogue: ${tax.total} produits (${tax.en_stock} en stock)`);
console.log(`types: ${tax.type.length} | marques: ${tax.marque.length} | styles: ${tax.styles.join(", ")}`);

const cas: Array<[string, Parameters<typeof searchProducts>[0]]> = [
  ["cire mate cheveux", { texte: "cire mate", type: ["coiffant_cheveux"] }],
  ["creme sans accent", { texte: "creme raser" }],
  ["tondeuse pro < 200e", { type: ["tondeuse_coupe"], prix_max: 200 }],
  ["huile barbe premium", { type: ["huile_barbe"], segment: ["premium"] }],
  ["marque Andis", { marque: ["Andis"] }],
  ["style old school", { styles: ["old_school"], super_cat: ["materiel_coupe"] }],
  ["requete absurde", { texte: "xyzzy quantique" }],
];

for (const [label, params] of cas) {
  const r = searchProducts({ ...params, limite: 3 });
  console.log(`\n── ${label} → ${r.length} résultat(s)`);
  r.forEach((p) => console.log(`   ${p.nom} | ${p.marque} | ${p.prix_aff}€ | ${p.dispo}`));
}
