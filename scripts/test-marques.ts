// Vérifie le catalogue de marques : exclusions, familles, classement.
//   npx tsx scripts/test-marques.ts
import { readFileSync } from "node:fs";
import { creerCatalogueMarques, type Marque, type FicheCartographie } from "../src/lib/marques-search";
import { creerMoteur, type Produit } from "../src/lib/product-search";

const lire = <T,>(nom: string): T =>
  JSON.parse(readFileSync(new URL(`../src/data/${nom}`, import.meta.url), "utf8"));

const produits = lire<Produit[]>("produits.json");
const moteur = creerMoteur(produits);
const catalogue = creerCatalogueMarques(
  lire<Marque[]>("marques.json"),
  lire<FicheCartographie[]>("brands-cartographie.json"),
  moteur.produits,
);

console.log(`Marques vendables : ${catalogue.total}`);
console.log(`Marques écartées  : ${catalogue.ecartees} (aucun produit disponible)\n`);

const MORTES = ["Coucot", "Beardilizer", "Le StudiO'", "Schorem", "Scapicchio", "Takara Belmont", "Mizutani"];
const toutes = catalogue.proposer({ famille: "toutes", limite: 16 });
const proposees = new Set(catalogue.proposer({ famille: "toutes", limite: 16 }).map((m) => m.nom));

console.log("── Marques mortes proposées ? ──");
let fuite = 0;
for (const nom of MORTES) {
  if (proposees.has(nom)) {
    console.log(`   ❌ ${nom} est encore proposée`);
    fuite++;
  }
}
console.log(fuite ? `   ${fuite} fuite(s)` : "   ✅ aucune");

console.log("\n── Mur de revente (famille produit) ──");
catalogue
  .proposer({ famille: "produit", limite: 8 })
  .forEach((m) => console.log(`   ${m.nom.padEnd(20)} ${m.famille.padEnd(8)} ${m.nbProduits} réf.`));

console.log("\n── Équipement du salon (famille materiel) ──");
catalogue
  .proposer({ famille: "materiel", limite: 8 })
  .forEach((m) => console.log(`   ${m.nom.padEnd(20)} ${m.famille.padEnd(8)} ${m.nbProduits} réf.`));

console.log("\n── Effet du classement par ventes ──");
const avant = catalogue.proposer({ famille: "produit", limite: 5 }).map((m) => m.nom);
// Simule des ventes qui placent Layrite en tête
const idsLayrite = moteur.produits.filter((p) => p.marque === "Layrite").map((p) => p.id);
catalogue.definirMeilleuresVentes(idsLayrite);
const apres = catalogue.proposer({ famille: "produit", limite: 5 }).map((m) => m.nom);
console.log("   sans ventes :", avant.join(", "));
console.log("   avec ventes :", apres.join(", "));
console.log(
  apres[0] === "Layrite"
    ? "   ✅ le classement suit bien les ventes"
    : "   ⚠️  les ventes ne remontent pas la marque attendue",
);

// Une marque de matériel ne doit jamais sortir en pur "produit"
const enRevente = catalogue.proposer({ famille: "produit", limite: 16 });
const intrus = enRevente.filter((m) => m.famille === "materiel");
console.log(
  `\n── Marques de matériel dans le mur de revente : ${intrus.length ? "❌ " + intrus.map((m) => m.nom).join(", ") : "✅ aucune"}`,
);

process.exit(fuite || intrus.length ? 1 : 0);
