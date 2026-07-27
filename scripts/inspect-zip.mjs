// Vérifie les séparateurs de chemin dans une archive ZIP.
// Le format ZIP impose "/" ; Compress-Archive de PowerShell écrit parfois "\",
// ce que PHP (donc PrestaShop) ne sait pas décompresser correctement.
import { readFileSync } from "node:fs";

const chemin = process.argv[2];
if (!chemin) {
  console.error("usage: node scripts/inspect-zip.mjs <archive.zip>");
  process.exit(1);
}

const buffer = readFileSync(chemin);
const SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

const noms = [];
let i = 0;
while ((i = buffer.indexOf(SIGNATURE, i)) !== -1) {
  const longueur = buffer.readUInt16LE(i + 26);
  noms.push(buffer.slice(i + 30, i + 30 + longueur).toString("utf8"));
  i += 4;
}

const ANTISLASH = String.fromCharCode(92);
let invalides = 0;

console.log(`${noms.length} entrée(s) dans ${chemin}\n`);
for (const nom of noms) {
  const mauvais = nom.includes(ANTISLASH);
  if (mauvais) invalides++;
  console.log(`  ${mauvais ? "✗" : "✓"} ${nom}`);
}

console.log(
  invalides
    ? `\n${invalides} entrée(s) avec antislash — PrestaShop refusera l'archive.`
    : "\nSéparateurs conformes.",
);
process.exit(invalides ? 1 : 0);
