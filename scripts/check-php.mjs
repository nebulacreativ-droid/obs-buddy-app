// Vérification structurelle des fichiers PHP du module.
// PHP n'est pas installé sur le poste de développement : ce script attrape au
// moins les déséquilibres de délimiteurs et les oublis de convention
// PrestaShop, qui sont les fautes les plus coûteuses (module refusé à
// l'installation, page blanche en front).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const MODULE = join(ICI, "..", "prestashop-module", "obsbuddy");

function listerPhp(base) {
  const sortie = [];
  for (const nom of readdirSync(base)) {
    const chemin = join(base, nom);
    if (statSync(chemin).isDirectory()) sortie.push(...listerPhp(chemin));
    else if (nom.endsWith(".php")) sortie.push(chemin);
  }
  return sortie;
}

/** Retire chaînes et commentaires avant de compter les délimiteurs. */
function sansLitteraux(src) {
  let net = "";
  let i = 0;
  let etat = null;

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
  return net;
}

let soucis = 0;

for (const chemin of listerPhp(MODULE)) {
  const nom = relative(MODULE, chemin).replace(/\\/g, "/");
  const src = readFileSync(chemin, "utf8");
  const net = sansLitteraux(src);
  const compter = (ch) => net.split(ch).length - 1;

  const problemes = [];

  for (const [libelle, ouvrant, fermant] of [
    ["accolades", "{", "}"],
    ["parenthèses", "(", ")"],
    ["crochets", "[", "]"],
  ]) {
    const a = compter(ouvrant);
    const b = compter(fermant);
    if (a !== b) problemes.push(`${libelle} déséquilibrées (${a}/${b})`);
  }

  if (!src.startsWith("<?php")) problemes.push("ne commence pas par <?php");
  if (/\?>\s*$/.test(src)) problemes.push("balise fermante ?> présente");

  // Les index.php de sécurité sont de simples redirections : la convention
  // PrestaShop ne leur demande pas la garde _PS_VERSION_, réservée au code.
  const estStub = !/\bclass\s+\w+/.test(net);
  if (!estStub && !/_PS_VERSION_/.test(src)) {
    problemes.push("garde _PS_VERSION_ absente");
  }

  // Une variable perdue par un échappement shell laisse des "->" orphelins :
  // c'est exactement le genre de corruption silencieuse qu'on veut attraper.
  if (/(^|[\s(=.])->/m.test(net)) problemes.push("appel ->methode() sans objet ($this manquant ?)");

  if (problemes.length) {
    soucis += problemes.length;
    console.log(`❌ ${nom}`);
    problemes.forEach((p) => console.log(`     ${p}`));
  } else {
    console.log(`✅ ${nom}`);
  }
}

console.log(soucis === 0 ? "\nStructure conforme." : `\n${soucis} problème(s) à corriger.`);
process.exit(soucis ? 1 : 0);
