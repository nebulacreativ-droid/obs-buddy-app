// Génère le logo.png 32×32 du module PrestaShop : le visage d'O'Buddy.
//
// Le dessin de référence est src/components/LogoObuddy.tsx. On ne rasterise pas
// le SVG (aucun moteur de rendu en Node ici) : les mêmes formes sont décrites
// en géométrie, dans le même repère 48×48, puis échantillonnées. Toute retouche
// du SVG doit donc être reportée ici — les constantes portent les mêmes valeurs
// que les chemins, ce qui rend la correspondance vérifiable à l'œil.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const T = 32; // taille de sortie
const REPERE = 48; // repère du dessin
const SS = 4; // sur-échantillonnage : 16 mesures par pixel, donc des bords lissés

const JAUNE = [0xfc, 0xf2, 0x4f];
const NOIR = [0x0f, 0x0f, 0x0f];

const dansEllipse = (x, y, cx, cy, rx, ry) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/** Coin arrondi du badge, dans le repère 48. */
const dansBadge = (x, y) => {
  const r = 13;
  const cx = x < r ? r : x > REPERE - r ? REPERE - r : x;
  const cy = y < r ? r : y > REPERE - r ? REPERE - r : y;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

/**
 * La coupe : calotte prise dans l'ellipse du crâne, évidée par le front. Ce qui
 * dépasse de part et d'autre du front forme les pattes — le dégradé court sur
 * les côtés se lit là.
 */
const dansCoupe = (x, y) =>
  dansEllipse(x, y, 24, 17.7, 11.5, 10.7) &&
  y <= 22.4 &&
  !(Math.abs(x - 24) <= 7.3 && y >= 14.2);

const dansYeux = (x, y) =>
  dansEllipse(x, y, 20.1, 25.6, 1.95, 1.95) ||
  dansEllipse(x, y, 27.9, 25.6, 1.95, 1.95);

/** La moustache, avec l'encoche sous le nez qui lui donne ses deux ailes. */
const dansMoustache = (x, y) => {
  if (!dansEllipse(x, y, 24, 32.8, 7.5, 3.0)) return false;
  const encoche = y < 32 && Math.abs(x - 24) < (32 - y) * 2.6;
  return !encoche;
};

/** L'éclat : étoile à quatre branches, en écho au lanceur sur la boutique. */
const dansEclat = (x, y) => {
  const a = 3.3;
  const dx = Math.abs(x - 39.4) / a;
  const dy = Math.abs(y - 12.7) / a;
  return Math.sqrt(dx) + Math.sqrt(dy) <= 1;
};

const encre = (x, y) =>
  dansCoupe(x, y) || dansYeux(x, y) || dansMoustache(x, y) || dansEclat(x, y);

const lignes = [];
for (let py = 0; py < T; py++) {
  const ligne = [0]; // filtre "none"
  for (let px = 0; px < T; px++) {
    // Part d'encre et part de badge sur la surface du pixel : c'est ce qui
    // évite l'escalier sur les courbes à cette taille.
    let partEncre = 0;
    let partBadge = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const x = ((px + (sx + 0.5) / SS) / T) * REPERE;
        const y = ((py + (sy + 0.5) / SS) / T) * REPERE;
        if (!dansBadge(x, y)) continue;
        partBadge++;
        if (encre(x, y)) partEncre++;
      }
    }
    const total = SS * SS;
    // Hors badge : blanc, comme le fond des listes du back-office.
    const fond = [0xff, 0xff, 0xff];
    for (let c = 0; c < 3; c++) {
      const dansCadre = (JAUNE[c] * (partBadge - partEncre) + NOIR[c] * partEncre) / (partBadge || 1);
      ligne.push(Math.round((dansCadre * partBadge + fond[c] * (total - partBadge)) / total));
    }
  }
  lignes.push(Buffer.from(ligne));
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const o of buf) c = crcTable[(c ^ o) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const bloc = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const corps = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corps));
  return Buffer.concat([len, corps, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(T, 0);
ihdr.writeUInt32BE(T, 4);
ihdr[8] = 8; // profondeur
ihdr[9] = 2; // couleur RGB

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  bloc("IHDR", ihdr),
  bloc("IDAT", deflateSync(Buffer.concat(lignes), { level: 9 })),
  bloc("IEND", Buffer.alloc(0)),
]);

const sortie = new URL("../prestashop-module/obsbuddy/logo.png", import.meta.url);
writeFileSync(sortie, png);
console.log(`logo.png écrit (${png.length} octets)`);
