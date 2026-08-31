// Vérifie le découpage des marqueurs de formulaire et la validation des champs.
import { decouperMessage } from "../src/lib/chat-client";
import { FORMULAIRES, erreursFormulaire } from "../src/lib/formulaires";

let echecs = 0;
const verifier = (nom: string, obtenu: unknown, attendu: unknown) => {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs++;
  console.log(`${ok ? "ok  " : "ÉCHEC"} ${nom}`);
  if (!ok) console.log(`      attendu ${JSON.stringify(attendu)}\n      obtenu  ${JSON.stringify(obtenu)}`);
};

// ── Découpage ────────────────────────────────────────────────────────────
const a = decouperMessage("Je regarde ça tout de suite. [[F:COMMANDE]]");
verifier("formulaire reconnu", a.segments.map((s) => s.type), ["texte", "formulaire"]);
verifier("modèle transporté", (a.segments[1] as { modele: string }).modele, "COMMANDE");

const b = decouperMessage("Un modèle inventé [[F:INEXISTANT]] disparaît.");
verifier("modèle inconnu ignoré", b.segments.map((s) => s.type), ["texte", "texte"]);

// Les autres marqueurs ne doivent pas avoir bougé de groupe de capture.
const c = decouperMessage("Voilà [[P:123]] et [[MARQUES]] et [[FIDELITE]] [[C:Oui|Non]]");
verifier(
  "anciens marqueurs intacts",
  c.segments.map((s) => s.type),
  ["texte", "produit", "texte", "marques", "texte", "fidelite", "texte"],
);
verifier("choix intacts", c.choix, ["Oui", "Non"]);
verifier("id produit intact", (c.segments[1] as { id: string }).id, "123");

const d = decouperMessage("Deux d'un coup [[F:COMMANDE]][[F:COMPTE_PRO]]");
verifier("deux formulaires", d.segments.filter((s) => s.type === "formulaire").length, 2);

// ── Validation ───────────────────────────────────────────────────────────
const cmd = FORMULAIRES.COMMANDE;
verifier("commande vide → 2 manques", Object.keys(erreursFormulaire(cmd, {})).sort(), ["email", "reference"]);
verifier(
  "email malformé refusé",
  Object.keys(erreursFormulaire(cmd, { reference: "XKBKNABJK", email: "younes@" })),
  ["email"],
);
verifier(
  "référence trop courte refusée",
  Object.keys(erreursFormulaire(cmd, { reference: "AB", email: "a@b.fr" })),
  ["reference"],
);
verifier(
  "commande complète acceptée",
  erreursFormulaire(cmd, { reference: "XKBKNABJK", email: "a@b.fr" }),
  {},
);
verifier(
  "résumé commande",
  cmd.resume({ reference: "XKBKNABJK", email: "a@b.fr" }),
  "Suivi de commande — référence : XKBKNABJK, email : a@b.fr",
);

const pro = FORMULAIRES.COMPTE_PRO;
verifier(
  "activité facultative",
  erreursFormulaire(pro, {
    nom: "Prénom Nom", email: "a@b.fr", telephone: "0612345678", besoin: "Tondeuses",
  }),
  {},
);
verifier(
  "téléphone trop court refusé",
  Object.keys(erreursFormulaire(pro, {
    nom: "Prénom Nom", email: "a@b.fr", telephone: "0612", besoin: "Tondeuses",
  })),
  ["telephone"],
);
verifier(
  "résumé pro sans activité",
  pro.resume({ nom: "Prénom Nom", email: "a@b.fr", telephone: "06 12 34 56 78", besoin: "Tondeuses" }),
  "Demande de compte pro — nom : Prénom Nom ; email : a@b.fr ; téléphone : 06 12 34 56 78 ; besoin : Tondeuses",
);
verifier(
  "résumé pro avec activité",
  pro.resume({ nom: "X", email: "a@b.fr", telephone: "0612345678", activite: "À domicile", besoin: "Cires" }),
  "Demande de compte pro — nom : X ; email : a@b.fr ; téléphone : 0612345678 ; activité : À domicile ; besoin : Cires",
);

console.log(echecs ? `\n${echecs} échec(s)` : "\nTout passe.");
process.exit(echecs ? 1 : 0);
