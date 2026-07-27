// Vérifie que les 3 parcours sont bien menés en conversation.
//   node scripts/test-parcours.mjs
const BASE = process.argv[2] || "https://obs-obuddy.vercel.app";

async function demander(messages) {
  const r = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  const brut = await r.text();
  let texte = "", produits = [];
  for (const l of brut.split("\n")) {
    if (!l.startsWith("data: ")) continue;
    let e;
    try { e = JSON.parse(l.slice(6)); } catch { continue; }
    if (e.t === "text") texte += e.d;
    else if (e.t === "produits") produits.push(...e.d);
  }
  return { texte, produits };
}

const PARCOURS = [
  {
    nom: "Ma routine perso",
    ouverture: "Je veux me composer une routine perso.",
    suite: "Cheveux épais et bouclés, peau sensible, budget 50 euros max.",
  },
  {
    nom: "Mon matériel pro",
    ouverture: "Je cherche du matériel pro pour mon activité de barbier.",
    suite: "Je fais surtout des fades, environ 12 clients par jour, budget 200 euros.",
  },
  {
    nom: "J'ouvre mon shop",
    ouverture: "J'ouvre mon barbershop, aide-moi à monter le projet.",
    suite: "Ambiance old school, 3 postes, clientèle urbaine 25-40 ans, positionnement milieu de gamme.",
  },
];

for (const p of PARCOURS) {
  console.log(`\n${"═".repeat(60)}\n  ${p.nom}\n${"═".repeat(60)}`);

  const t1 = await demander([{ role: "user", content: p.ouverture }]);
  const question = /\?/.test(t1.texte);
  console.log(`\n[1] Ouverture → ${question ? "pose une question ✅" : "ne questionne pas ⚠️"}`);
  console.log(`    ${t1.texte.replace(/\s+/g, " ").slice(0, 180)}`);

  const t2 = await demander([
    { role: "user", content: p.ouverture },
    { role: "assistant", content: t1.texte },
    { role: "user", content: p.suite },
  ]);
  const ids = [...t2.texte.matchAll(/\[\[P:([^\]]+)\]\]/g)].map((m) => m[1]);
  const connus = new Set(t2.produits.map((x) => x.id));
  const fantomes = ids.filter((id) => !connus.has(id));

  console.log(`\n[2] Après précisions → ${ids.length} produit(s) cité(s)${fantomes.length ? " ❌ dont " + fantomes.length + " inexistant(s)" : ids.length ? " ✅" : " ⚠️ aucun"}`);
  console.log(`    ${t2.texte.replace(/\s+/g, " ").slice(0, 260)}`);
  if (t2.produits.length) {
    console.log(`    Catalogue consulté : ${t2.produits.length} candidats`);
  }
}
