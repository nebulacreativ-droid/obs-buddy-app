// Construit l'archive installable du module PrestaShop.
//
// On n'utilise PAS Compress-Archive de PowerShell : il écrit les chemins
// internes avec des antislashs, alors que le format ZIP impose "/". PHP ne
// reconstruit alors pas l'arborescence et PrestaShop refuse le module.
import { deflateRawSync } from "node:zlib";
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, "..", "prestashop-module");
const MODULE = "obsbuddy";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const octet of buf) c = crcTable[(c ^ octet) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** Liste récursive des fichiers, chemins relatifs en slashs. */
function lister(base, prefixe = "") {
  const sortie = [];
  for (const nom of readdirSync(join(base, prefixe))) {
    const relatif = prefixe ? `${prefixe}/${nom}` : nom;
    if (statSync(join(base, relatif)).isDirectory()) {
      sortie.push(...lister(base, relatif));
    } else {
      sortie.push(relatif);
    }
  }
  return sortie;
}

// Horodatage MS-DOS fixe : une archive identique à contenu identique.
const HEURE_DOS = 0;
const DATE_DOS = ((2025 - 1980) << 9) | (1 << 5) | 1;

const fichiers = lister(RACINE, MODULE).sort();
const morceaux = [];
const central = [];
let position = 0;

for (const relatif of fichiers) {
  const contenu = readFileSync(join(RACINE, relatif));
  const compresse = deflateRawSync(contenu, { level: 9 });
  const nom = Buffer.from(relatif, "utf8"); // déjà en slashs
  const somme = crc32(contenu);

  const entete = Buffer.alloc(30);
  entete.writeUInt32LE(0x04034b50, 0);
  entete.writeUInt16LE(20, 4); // version minimale
  entete.writeUInt16LE(0, 6); // drapeaux
  entete.writeUInt16LE(8, 8); // méthode deflate
  entete.writeUInt16LE(HEURE_DOS, 10);
  entete.writeUInt16LE(DATE_DOS, 12);
  entete.writeUInt32LE(somme, 14);
  entete.writeUInt32LE(compresse.length, 18);
  entete.writeUInt32LE(contenu.length, 22);
  entete.writeUInt16LE(nom.length, 26);
  entete.writeUInt16LE(0, 28);

  morceaux.push(entete, nom, compresse);

  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(20, 4);
  cd.writeUInt16LE(20, 6);
  cd.writeUInt16LE(0, 8);
  cd.writeUInt16LE(8, 10);
  cd.writeUInt16LE(HEURE_DOS, 12);
  cd.writeUInt16LE(DATE_DOS, 14);
  cd.writeUInt32LE(somme, 16);
  cd.writeUInt32LE(compresse.length, 20);
  cd.writeUInt32LE(contenu.length, 24);
  cd.writeUInt16LE(nom.length, 28);
  cd.writeUInt32LE(0o644 << 16, 38); // droits POSIX lisibles
  cd.writeUInt32LE(position, 42);
  central.push(cd, nom);

  position += entete.length + nom.length + compresse.length;
}

const corpsCentral = Buffer.concat(central);
const fin = Buffer.alloc(22);
fin.writeUInt32LE(0x06054b50, 0);
fin.writeUInt16LE(fichiers.length, 8);
fin.writeUInt16LE(fichiers.length, 10);
fin.writeUInt32LE(corpsCentral.length, 12);
fin.writeUInt32LE(position, 16);

const archive = Buffer.concat([...morceaux, corpsCentral, fin]);

// Toutes les copies connues sont réécrites d'office : une archive périmée
// oubliée dans un dossier finit toujours par être celle qu'on installe.
const COPIES = [
  "C:/Users/Younes OBS/OneDrive - OBARBERSHOP/Bureau/obsbuddy.zip",
  "C:/Users/Younes OBS/Downloads/obsbuddy.zip",
  "C:/Users/Younes OBS/Desktop/obsbuddy.zip",
];

const destinations = process.argv.slice(2);
if (!destinations.length) destinations.push(...COPIES);

for (const dest of destinations) {
  if (!existsSync(dirname(dest))) {
    console.log(`ignoré (dossier absent) : ${dest}`);
    continue;
  }
  writeFileSync(dest, archive);
  console.log(`écrit : ${dest} (${archive.length} octets)`);
}

console.log(`\n${fichiers.length} fichiers :`);
fichiers.forEach((f) => console.log(`   ${f}`));
