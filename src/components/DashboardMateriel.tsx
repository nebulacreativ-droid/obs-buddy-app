import { ProductCard } from "@/components/ProductCard";
import { DashboardShell, SectionTitle, BarberNote } from "@/components/DashboardShell";
import type { recommend } from "@/lib/assistant-config";

type Recos = ReturnType<typeof recommend>;
type Answers = Record<string, string | string[]>;

const TOP_BUCKETS = new Set([
  "Tondeuse coupe",
  "Tondeuse finition",
  "Shaver",
  "Ciseaux",
]);
const ACCESS_BUCKETS = new Set([
  "Entretien lames",
  "Accessoires",
  "Rasage traditionnel",
]);

const SPE_LABEL: Record<string, string> = {
  fade: "fade précis",
  ciseaux: "travail ciseaux",
  barbe: "taille de barbe",
  rasage: "rasage traditionnel",
};
const VOL_LABEL: Record<string, string> = {
  "5": "moins de 5 clients/jour",
  "10": "5 à 10 clients/jour",
  "15": "10-15 clients/jour",
  "25": "15+ clients/jour",
};

function buildTitle(a: Answers): string {
  const spe = SPE_LABEL[a.specialite as string] || "ton style";
  const vol = VOL_LABEL[a.volume_jour as string] || "ton volume";
  return `Match parfait pour ${spe} · ${vol}`;
}

function buildTags(a: Answers): string[] {
  const t: string[] = [];
  const postes = (a.postes as string[]) || [];
  postes.forEach((p) => t.push(p.replace(/_/g, " ")));
  if (a.alimentation) t.push(String(a.alimentation));
  if (a.experience) t.push(String(a.experience));
  return t.slice(0, 6);
}

function buildReasons(reason: string, segment: string, mif: boolean): string[] {
  const out: string[] = [];
  out.push(reason);
  if (segment === "premium") out.push("Segment premium · finition pro");
  else if (segment === "milieu") out.push("Rapport qualité/prix éprouvé en shop");
  else out.push("Setup accessible pour démarrer");
  if (mif) out.push("Made in France");
  else out.push("Référence éprouvée sur le marché pro");
  return out.slice(0, 3);
}

function buildVerdict(a: Answers): string {
  const spe = a.specialite as string;
  if (spe === "fade")
    return "Setup taillé pour le fade : tondeuse de coupe + finition + entretien lames quotidien. Avec ce combo, tu tiens la précision sur tout le shift sans perte de qualité entre le premier et le dernier client.";
  if (spe === "ciseaux")
    return "Investis sur tes ciseaux avant tout — c'est ton outil signature. Le reste vient compléter, mais c'est la lame japonaise qui va te porter sur dix ans.";
  if (spe === "barbe")
    return "Le combo finition + shavette + entretien fait la différence sur les contours. C'est là que se joue la perception client, plus que sur la longueur principale.";
  if (spe === "rasage")
    return "Coupe-chou ou shavette + après-rasage pro, c'est le minimum vital. Soigne le rituel autant que le geste : c'est ce qui transforme un rasage en expérience.";
  return "Setup solide et cohérent. Tu peux démarrer avec ça et upgrader marque par marque selon ce qui te plaît en main.";
}

export function DashboardMateriel({
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
  const tops = recos.filter((r) => TOP_BUCKETS.has(r.bucket)).slice(0, 3);
  const accessories = recos.filter((r) => ACCESS_BUCKETS.has(r.bucket));
  const others = recos.filter(
    (r) => !TOP_BUCKETS.has(r.bucket) && !ACCESS_BUCKETS.has(r.bucket),
  );

  const badges = ["Match parfait", "Très bon choix", ""];
  if (tops.length === 3) {
    badges[2] = tops[2].produit.prix < tops[0].produit.prix
      ? "Alternative budget"
      : "Alternative premium";
  }

  return (
    <DashboardShell
      eyebrow="Ton diagnostic"
      title={buildTitle(answers)}
      tags={buildTags(answers)}
      productCount={recos.length}
      totalHT={sum}
      level="Pro"
      onReset={onReset}
    >
      {tops.length > 0 && (
        <section>
          <SectionTitle>Top {tops.length} pour toi</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tops.map((r, i) => (
              <ProductCard
                key={`top-${r.produit.id}`}
                produit={r.produit}
                index={i}
                badge={badges[i]}
                reasons={buildReasons(r.reason, r.produit.segment, r.produit.mif)}
              />
            ))}
          </div>
        </section>
      )}

      {accessories.length > 0 && (
        <section>
          <SectionTitle>Accessoires recommandés</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accessories.map((r, i) => (
              <ProductCard
                key={`acc-${r.produit.id}`}
                produit={r.produit}
                index={i}
                qty={r.qty}
                reasons={[r.reason]}
              />
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section>
          <SectionTitle>Le reste de la sélection</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((r, i) => (
              <ProductCard
                key={`oth-${r.produit.id}`}
                produit={r.produit}
                index={i}
                qty={r.qty}
                reasons={[r.reason]}
              />
            ))}
          </div>
        </section>
      )}

      <BarberNote
        eyebrow="Le verdict du barbier O'Barbershop"
        body={buildVerdict(answers)}
      />
    </DashboardShell>
  );
}