import { ProductCard } from "@/components/ProductCard";
import { DashboardShell, SectionTitle, BarberNote } from "@/components/DashboardShell";
import type { recommend } from "@/lib/assistant-config";

type Recos = ReturnType<typeof recommend>;
type Answers = Record<string, string | string[]>;

// bucket → moment de routine
const MOMENT: Record<string, "matin" | "soir" | "hebdo"> = {
  Cheveux: "matin",
  Barbe: "matin",
  Parfum: "matin",
  Peau: "soir",
  Rasage: "soir",
};

const CHEVEUX_LABEL: Record<string, string> = {
  raides: "Raides",
  ondules: "Ondulés",
  frises: "Bouclés",
  crepus: "Crépus",
};
const BARBE_LABEL: Record<string, string> = {
  rase: "Rasé",
  courte: "Barbe courte",
  moyenne: "Barbu",
  longue: "Barbu hipster",
};
const STYLE_LABEL: Record<string, string> = {
  old_school: "Old school",
  moderne: "Moderne",
  urbain: "Urbain",
  premium: "Premium",
};
const COIFFAGE_LABEL: Record<string, string> = {
  naturel: "Naturel mat",
  structure: "Structuré",
  slick: "Slick",
  texture: "Texturé",
};
const PEAU_LABEL: Record<string, string> = {
  seche: "Peau sèche",
  normale: "Peau normale",
  mixte: "Peau mixte",
  sensible: "Peau sensible",
};

function buildTitle(a: Answers): string {
  const parts: string[] = [];
  const barbe = a.barbe as string;
  if (barbe && BARBE_LABEL[barbe]) parts.push(BARBE_LABEL[barbe]);
  const ch = a.cheveux_type as string;
  if (ch && CHEVEUX_LABEL[ch]) parts.push(CHEVEUX_LABEL[ch]);
  const st = a.style_vibe as string;
  if (st && STYLE_LABEL[st]) parts.push(STYLE_LABEL[st]);
  if (parts.length === 0) parts.push("Ton profil grooming");
  return parts.join(" · ");
}

function buildTags(a: Answers): string[] {
  const t: string[] = [];
  const besoins = (a.besoins as string[]) || [];
  besoins.forEach((b) => t.push(b));
  if (a.coiffage && COIFFAGE_LABEL[a.coiffage as string])
    t.push(COIFFAGE_LABEL[a.coiffage as string]);
  if (a.peau && PEAU_LABEL[a.peau as string]) t.push(PEAU_LABEL[a.peau as string]);
  if (a.objectif) t.push(String(a.objectif));
  return t.slice(0, 6);
}

function buildAstuce(a: Answers): string {
  const barbe = a.barbe as string;
  const cuir = a.cuir_chevelu as string;
  const peau = a.peau as string;
  if (barbe === "moyenne" || barbe === "longue") {
    return "Brosse à barbe le matin sur barbe sèche : ça discipline les poils, répartit le sébum et fait pénétrer ton huile en profondeur. Trois passages, pas plus.";
  }
  if (cuir === "pellicules") {
    return "Shampoing antipelliculaire 2× par semaine max, jamais plus chaud que tiède. Le reste du temps, un lavant doux : tu calmes le cuir au lieu de l'irriter.";
  }
  if (peau === "sensible") {
    return "Après le rasage, jamais d'alcool. Un baume apaisant à froid, deux minutes, et tu épargnes ta peau pour la prochaine session.";
  }
  return "Une routine, c'est pas une accumulation. Trois produits bien choisis battent dix qui dorment dans la salle de bain. Reste régulier — c'est ça qui paie.";
}

export function DashboardRoutine({
  recos,
  sum,
  answers,
  onReset,
}: {
  recos: Recos;
  sum: number;
  answers: Answers;
  onReset: () => void;
}) {
  const sections: Record<"matin" | "soir" | "hebdo", Recos> = {
    matin: [],
    soir: [],
    hebdo: [],
  };
  recos.forEach((r) => {
    const moment = MOMENT[r.bucket] ?? "matin";
    sections[moment].push(r);
  });

  const besoinsCount = ((answers.besoins as string[]) || []).length;
  const level = besoinsCount >= 4 ? "Complète" : besoinsCount >= 2 ? "Solide" : "Essentielle";

  return (
    <DashboardShell
      eyebrow="Ton diagnostic"
      title={buildTitle(answers)}
      tags={buildTags(answers)}
      productCount={recos.length}
      totalHT={sum}
      level={level}
      onReset={onReset}
    >
      {(["matin", "soir", "hebdo"] as const).map((moment) => {
        const items = sections[moment];
        if (items.length === 0) return null;
        const label =
          moment === "matin"
            ? "Routine matin"
            : moment === "soir"
              ? "Routine soir"
              : "Routine hebdo";
        return (
          <section key={moment}>
            <SectionTitle>{label}</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((r, i) => (
                <ProductCard
                  key={`${moment}-${r.produit.id}`}
                  produit={r.produit}
                  index={i}
                  qty={r.qty}
                  reasons={[r.reason]}
                />
              ))}
            </div>
          </section>
        );
      })}
      <BarberNote eyebrow="L'astuce du barbier" body={buildAstuce(answers)} />
    </DashboardShell>
  );
}