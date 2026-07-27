// Vérification structurelle du module PHP (PHP n'est pas installé localement).
import { readFileSync } from "node:fs";

const chemin = new URL("../prestashop-module/obsbuddy/obsbuddy.php", import.meta.url);
const src = readFileSync(chemin, "utf8");

// Retire chaînes et commentaires avant de compter les délimiteurs.
let net = "";
let i = 0;
let etat = null; // "simple" | "double" | "ligne" | "bloc"
while (i < src.length) {
  const c = src[i];
  const suivant = src[i + 1];
  if (etat === null) {
    if (c === "'") etat = "simple";
    else if (c === '"') etat = "double";
    else if (c === "/" && suivant === "/") etat = "ligne";
    else if (c === "/" && suivant === "*") etat = "bloc";
    else if (c === "#") etat = "ligne";
    else net += c;
    i++;
    continue;
  }
  if (etat === "simple" || etat === "double") {
    if (c === "\\") i += 2;
    else {
      if ((etat === "simple" && c === "'") || (etat === "double" && c === '"')) etat = null;
      i++;
    }
    continue;
  }
  if (etat === "ligne") {
    if (c === "\n") etat = null;
    i++;
    continue;
  }
  if (etat === "bloc") {
    if (c === "*" && suivant === "/") {
      etat = null;
      i += 2;
    } else i++;
  }
}

const compter = (ch) => net.split(ch).length - 1;
const paires = [
  ["accolades", "{", "}"],
  ["parenthèses", "(", ")"],
  ["crochets", "[", "]"],
];

let souci = 0;
for (const [nom, a, b] of paires) {
  const na = compter(a);
  const nb = compter(b);
  const ok = na === nb;
  if (!ok) souci++;
  console.log(`${nom.padEnd(13)} ${String(na).padStart(3)} / ${String(nb).padStart(3)}  ${ok ? "OK" : "DÉSÉQUILIBRÉ"}`);
}

const controles = [
  ["balise <?php en tête", src.startsWith("<?php")],
  ["garde _PS_VERSION_", /if \(!defined\('_PS_VERSION_'\)\)/.test(src)],
  ["classe Obsbuddy (doit matcher obsbuddy.php)", /class Obsbuddy extends Module/.test(src)],
  ["$this->name = 'obsbuddy'", /\$this->name = 'obsbuddy'/.test(src)],
  [
    "hook enregistré ET implémenté",
    /registerHook\('displayBeforeBodyClosingTag'\)/.test(src) &&
      /function hookDisplayBeforeBodyClosingTag/.test(src),
  ],
  ["install() présent", /public function install\(\)/.test(src)],
  ["uninstall() présent", /public function uninstall\(\)/.test(src)],
  ["échappement de l'URL injectée", /htmlspecialchars\(\$url/.test(src)],
  ["validation de l'URL", /FILTER_VALIDATE_URL/.test(src)],
  ["pas de balise fermante ?>", !/\?>\s*$/.test(src)],
];

console.log();
for (const [libelle, ok] of controles) {
  if (!ok) souci++;
  console.log(`${ok ? "✅" : "❌"} ${libelle}`);
}

console.log(`\n${souci === 0 ? "Structure conforme." : souci + " problème(s) à corriger."}`);
process.exit(souci ? 1 : 0);
