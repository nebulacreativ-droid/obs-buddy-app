import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useEffect } from "react";
import {
  Scissors,
  Wrench,
  ArrowRight,
  User,
  Store,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
  validateSearch: (search: Record<string, unknown>) => ({
    embed: search.embed === "1" || search.embed === 1 || search.embed === true ? 1 : undefined,
  }),
});

const MODES: Array<{
  slug: "particulier" | "materiel-pro" | "ouverture";
  title: string;
  desc: string;
  icon: typeof Scissors;
  badge: string;
  eyebrow: string;
  duration: string;
  number: string;
}> = [
  {
    slug: "particulier",
    eyebrow: "Particulier",
    title: "Ma routine perso",
    desc: "Cheveux, barbe, peau, parfum. On te compose une routine qui tient la route.",
    icon: User,
    badge: "Routine perso",
    duration: "≈ 3 min",
    number: "01",
  },
  {
    slug: "materiel-pro",
    eyebrow: "Pro barbier",
    title: "Mon matériel pro",
    desc: "Tondeuses, ciseaux, shavers. La sélection calée sur ta technique et ton fauteuil.",
    icon: Wrench,
    badge: "Matériel pro",
    duration: "≈ 5 min",
    number: "02",
  },
  {
    slug: "ouverture",
    eyebrow: "Pro ouverture",
    title: "J'ouvre mon barbershop",
    desc: "Positionnement, ambiance, mur revente. On te monte le shop de A à Z.",
    icon: Store,
    badge: "Shop guide",
    duration: "≈ 8 min",
    number: "03",
  },
];

function HomePage() {
  const { embed } = Route.useSearch();
  const isEmbed = embed === 1;

  // Embed mode: applique les styles nécessaires. La hauteur est mesurée et postée
  // par le hook global `useEmbedHeight` sur document.body.
  useEffect(() => {
    if (!isEmbed || typeof window === "undefined") return;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyMargin = document.body.style.margin;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.margin = "0";
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.margin = prevBodyMargin;
    };
  }, [isEmbed]);

  return (
    <div id="obs-embed-root" className={isEmbed ? "bg-paper text-ink" : "min-h-screen bg-paper text-ink"}>
      {/* Sélecteur plein écran — app launcher */}
      <section className={`relative flex ${isEmbed ? "" : "min-h-screen"} flex-col overflow-hidden bg-paper`}>
        {/* fond blanc classique */}

        {/* Header minimal */}
        {!isEmbed && (
        <header className="relative z-10 border-b-2 border-ink/10">
          <div className="mx-auto flex max-w-7xl items-center justify-end px-6 py-4">
            <div className="font-display text-[11px] tracking-[0.3em] text-ink/50">
              ASSISTANT GROOMING
            </div>
          </div>
        </header>
        )}

        {/* Bloc question + tuiles, centré verticalement */}
        <div className={`relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-6 ${isEmbed ? "pt-6 pb-10" : "py-12"}`}>
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={isEmbed ? "mb-6" : "mb-10 md:mb-14"}
          >
            <div className="mb-3 font-display text-xs tracking-[0.4em] text-ink/50">
              TIME TO GROOM
            </div>
            <h1 className="font-display text-[clamp(2.5rem,6.5vw,5.5rem)] leading-[0.95] tracking-tight text-ink">
              Par quoi on <span className="bg-gold px-2 box-decoration-clone">commence</span> ?
            </h1>
            <div className="mb-8 md:mb-12" />
          </motion.div>

          <div className="grid gap-5 md:grid-cols-3">
            {MODES.map((m, i) => {
              const Icon = m.icon;
              return (
                <motion.div
                  key={m.slug}
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.15 + i * 0.08, ease: [0.2, 0.7, 0.2, 1] }}
                >
                  <Link
                    to={isEmbed ? "/embed/$mode" : "/assistant/$mode"}
                    params={{ mode: m.slug }}
                    className="tap-target group relative flex aspect-[4/5] flex-col overflow-hidden border-2 border-ink bg-paper transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brut focus-visible:-translate-x-1 focus-visible:-translate-y-1 focus-visible:shadow-brut focus-visible:outline-none"
                  >
                    {/* Numéro géant en filigrane */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -right-4 -top-6 font-display text-[12rem] leading-none text-ink/[0.06] transition-colors duration-300 group-hover:text-gold/30"
                    >
                      {m.number}
                    </div>

                    {/* Top strip */}
                    <div className="relative z-10 flex items-center justify-between border-b-2 border-ink bg-ink px-5 py-3 text-gold">
                      <span className="font-display text-[11px] tracking-[0.3em]">
                        {m.number}&nbsp;&nbsp;{m.eyebrow.toUpperCase()}
                      </span>
                      <Icon className="h-5 w-5" strokeWidth={2} />
                    </div>

                    {/* Corps de carte */}
                    <div className="relative z-10 flex flex-1 flex-col p-6">
                      <div className="mb-1 font-display text-[10px] tracking-[0.3em] text-ink/60">
                        {m.duration.toUpperCase()}
                      </div>
                      <h2 className="font-display text-3xl leading-[0.95] text-ink md:text-4xl">
                        {m.title}
                      </h2>
                      <p className="mt-4 flex-1 text-sm leading-snug text-ink/70">
                        {m.desc}
                      </p>
                      <div className="mt-6 inline-flex items-center gap-2 font-display text-sm tracking-[0.25em] text-ink">
                        <span className="border-b-2 border-ink pb-0.5 transition-all group-hover:border-gold group-hover:text-ink">
                          COMMENCER
                        </span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>

                    {/* Bandeau gold qui sort au hover */}
                    <div className="absolute inset-x-0 bottom-0 z-0 h-0 bg-gold transition-all duration-300 group-hover:h-2" />
                  </Link>
                </motion.div>
              );
            })}
          </div>

        </div>
      </section>
    </div>
  );
}
