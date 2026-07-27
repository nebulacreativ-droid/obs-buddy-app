// Génère le logo.png 32x32 du module PrestaShop (bulle noire sur fond jaune OBS).
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const T = 32;
const JAUNE = [0xfc, 0xf2, 0x4f];
const NOIR = [0x0f, 0x0f, 0x0f];

// Bulle de chat : rectangle arrondi + petite pointe en bas à gauche.
const dansBulle = (x, y) => {
  const [x0, y0, x1, y1, r] = [5, 6, 26, 21, 4];
  const dansRect = x >= x0 && x <= x1 && y >= y0 && y <= y1;
  if (dansRect) {
    const coins = [
      [x0 + r, y0 + r],
      [x1 - r, y0 + r],
      [x0 + r, y1 - r],
      [x1 - r, y1 - r],
    ];
    for (const [cx, cy] of coins) {
      const horsX = x < x0 + r || x > x1 - r;
      const horsY = y < y0 + r || y > y1 - r;
      if (horsX && horsY) {
        const proche = Math.abs(x - cx) <= r && Math.abs(y - cy) <= r;
        if (proche && (x - cx) ** 2 + (y - cy) ** 2 > r * r) return false;
      }
    }
    return true;
  }
  // pointe
  return y > y1 && y <= y1 + 5 && x >= 9 && x <= 9 + (y1 + 5 - y);
};

const lignes = [];
for (let y = 0; y < T; y++) {
  const ligne = [0]; // filtre "none"
  for (let x = 0; x < T; x++) ligne.push(...(dansBulle(x, y) ? NOIR : JAUNE));
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
