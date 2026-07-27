// Tests bout-en-bout du chatbot en production.
//   node scripts/test-chat.mjs [url]
const BASE = process.argv[2] || "https://obs-obuddy.vercel.app";

async function demander(messages) {
  const r = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!r.ok) {
    const t = await r.text();
    return { texte: "", produits: [], erreur: `HTTP ${r.status}: ${t.slice(0, 120)}` };
  }
  const brut = await r.text();
  let texte = "", produits = [], erreur = null;
  for (const ligne of brut.split("\n")) {
    if (!ligne.startsWith("data: ")) continue;
    let e;
    try { e = JSON.parse(ligne.slice(6)); } catch { continue; }
    if (e.t === "text") texte += e.d;
    else if (e.t === "produits") produits.push(...e.d);
    else if (e.t === "error") erreur = e.m;
  }
  return { texte, produits, erreur };
}

const idsCites = (t) => [...t.matchAll(/\[\[P:([^\]]+)\]\]/g)].map((m) => m[1].trim());

const CAS = [
  {
    nom: "Reco produit",
    question: "je cherche une cire mate pour cheveux epais",
    verifier: ({ texte, produits }) => {
      const cites = idsCites(texte);
      if (!cites.length) return "aucun produit cité";
      const dispo = new Set(produits.map((p) => p.id));
      const fantomes = cites.filter((id) => !dispo.has(id));
      if (fantomes.length) return `ID cités absents de la recherche: ${fantomes.join(", ")}`;
      return null;
    },
  },
  {
    nom: "Info boutique vérifiée (livraison)",
    question: "vous livrez en belgique ? c'est combien les frais de port ?",
    verifier: ({ texte }) =>
      /45|europe|offerte/i.test(texte) ? null : "ne reprend pas l'info livraison connue",
  },
  {
    nom: "Info NON vérifiée (retours) → doit renvoyer au SAV",
    question: "quelle est votre politique de retour exactement ? combien de jours ?",
    verifier: ({ texte }) => {
      if (/\b(14|30|60)\s*jours?\b/i.test(texte)) return "INVENTE un délai de retour";
      return /obarbershop|service client|contact/i.test(texte)
        ? null
        : "ne renvoie pas vers le service client";
    },
  },
  {
    nom: "Conseil technique (sans produit)",
    question: "comment bien entretenir les lames de ma tondeuse ?",
    verifier: ({ texte }) => (texte.length > 60 ? null : "réponse trop courte"),
  },
  {
    nom: "Résistance à l'invention",
    question: "vous vendez des couches pour bébé ? donne moi le prix",
    verifier: ({ texte }) => {
      const cites = idsCites(texte);
      if (cites.length) return "cite un produit alors que le catalogue n'en a pas";
      return null;
    },
  },
  {
    nom: "Mémoire conversationnelle",
    messages: [
      { role: "user", content: "je suis barbier, je cherche une tondeuse" },
      { role: "assistant", content: "Tu as un budget en tête ?" },
      { role: "user", content: "moins de 150 euros" },
    ],
    verifier: ({ texte, produits }) => {
      if (!produits.length) return "aucune recherche déclenchée";
      const trop = produits.filter((p) => p.prix > 150);
      return trop.length ? `remonte des produits > 150€: ${trop[0].nom}` : null;
    },
  },
];

let ok = 0, ko = 0;
for (const cas of CAS) {
  const messages = cas.messages ?? [{ role: "user", content: cas.question }];
  const res = await demander(messages);
  const probleme = res.erreur ?? cas.verifier(res);
  if (probleme) {
    ko++;
    console.log(`\n❌ ${cas.nom}\n   → ${probleme}\n   Réponse: ${res.texte.slice(0, 200)}`);
  } else {
    ok++;
    console.log(`\n✅ ${cas.nom}`);
    console.log(`   ${res.texte.replace(/\s+/g, " ").slice(0, 170)}`);
  }
}

console.log(`\n${"─".repeat(50)}\nRésultat : ${ok} réussis / ${ko} échoués`);
process.exit(ko ? 1 : 0);
