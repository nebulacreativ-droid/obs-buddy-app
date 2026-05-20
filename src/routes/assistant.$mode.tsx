import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useReducer, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BookingWidget } from "@/components/BookingWidget";
import { DashboardRoutine } from "@/components/DashboardRoutine";
import { DashboardMateriel } from "@/components/DashboardMateriel";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  RotateCcw,
  Scissors,
  ShoppingBag,
  Sparkles,
  Wrench,
} from "lucide-react";
import {
  MODE_CONFIG,
  recommend,
  ouvertureInsights,
  OUVERTURE_BRAND_POOL,
  filterBrandPoolByStyle,
  type Mode,
  type OuvertureInsight,
  type BrandReco,
  type ComboGap,
} from "@/lib/assistant-config";
import { formatPrix, formatPrixDecimal, PRODUITS, type Produit } from "@/lib/catalogue";
import { Logo } from "@/components/Logo";
import { SwipeDeck } from "@/components/SwipeDeck";
import { BrandSwipeDeck } from "@/components/BrandSwipeDeck";

export const Route = createFileRoute("/assistant/$mode")({
  component: AssistantPage,
  validateSearch: (search: Record<string, unknown>) => ({
    embed: search.embed === "1" || search.embed === 1 || search.embed === true ? 1 : undefined,
  }),
  beforeLoad: ({ params }) => {
    if (params.mode === "revente") {
      throw redirect({ to: "/assistant/$mode", params: { mode: "ouverture" } });
    }
    if (!(params.mode in MODE_CONFIG)) throw notFound();
  },
  head: ({ params, match }) => {
    const cfg = MODE_CONFIG[params.mode as Mode];
    const title = cfg ? `${cfg.title} — O'Barbershop` : "Assistant — O'Barbershop";
    const isEmbed = (match.search as { embed?: number } | undefined)?.embed === 1;
    return {
      meta: [
        { title },
        { name: "description", content: cfg?.intro ?? "" },
        ...(isEmbed ? [{ name: "robots", content: "noindex,nofollow" }] : []),
      ],
    };
  },
});

type State = {
  answers: Record<string, string | string[]>;
  step: number;
  done: boolean;
  phase: "prefs" | "questions" | "brand-swipe";
  brandSwipeDone: boolean;
};

type Action =
  | { type: "answer"; id: string; value: string | string[]; advance: boolean }
  | { type: "back" }
  | { type: "next" }
  | { type: "reset" }
  | { type: "finish" }
  | { type: "startQuestions" }
  | { type: "openBrandSwipe" }
  | { type: "closeBrandSwipe" };

const initial: State = { answers: {}, step: 0, done: false, phase: "prefs", brandSwipeDone: false };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "answer":
      return {
        ...state,
        answers: { ...state.answers, [action.id]: action.value },
        step: action.advance ? state.step + 1 : state.step,
      };
    case "back":
      if (state.phase === "questions" && state.step === 0) {
        return { ...state, phase: "prefs", done: false };
      }
      return { ...state, step: Math.max(0, state.step - 1), done: false };
    case "next":
      return { ...state, step: state.step + 1 };
    case "finish":
      return { ...state, done: true };
    case "startQuestions":
      return { ...state, phase: "questions" };
    case "openBrandSwipe":
      return { ...state, phase: "brand-swipe" };
    case "closeBrandSwipe":
      return { ...state, phase: "questions", brandSwipeDone: true };
    case "reset":
      return initial;
  }
}

function AssistantPage() {
  const { mode } = Route.useParams();
  const { embed } = Route.useSearch();
  const isEmbed = embed === 1;
  const m = mode as Mode;
  const cfg = MODE_CONFIG[m];
  const isOuverture = m === "ouverture";
  const [state, dispatch] = useReducer(
    reducer,
    isOuverture ? { ...initial, phase: "questions" as const } : initial,
  );

  // Filtrage dynamique des questions par besoins (mode particulier)
  const activeQuestions = useMemo(() => {
    const besoins = (state.answers.besoins as string[]) || [];
    return cfg.questions.filter((q) => {
      if (q.needsFrom && q.needsValues) {
        const src = state.answers[q.needsFrom];
        if (typeof src !== "string") return false;
        return q.needsValues.includes(src);
      }
      if (!q.needs || q.needs.length === 0) return true;
      if (besoins.length === 0) return true; // tant que pas répondu
      return q.needs.some((n) => besoins.includes(n));
    });
  }, [cfg.questions, state.answers]);

  const total = activeQuestions.length;
  const atEnd = state.step >= total;
  const currentQ = atEnd ? null : activeQuestions[state.step];
  const progress = Math.min(100, (Object.keys(state.answers).length / total) * 100);

  const hasAnswers = Object.keys(state.answers).length > 0;
  const recos = useMemo(
    () => (hasAnswers ? recommend(m, state.answers) : []),
    [m, state.answers, hasAnswers],
  );

  // Swipe-deck extras
  const [extras, setExtras] = useState<Produit[]>([]);
  // Préférences swipe (étape 1) — sert juste à comprendre les goûts,
  // n'est PAS ajouté à la routine / panier.
  const [prefsLiked, setPrefsLiked] = useState<Produit[]>([]);
  const pickedIds = useMemo(() => {
    const s = new Set<string>();
    recos.forEach((r) => s.add(r.produit.id));
    extras.forEach((p) => s.add(p.id));
    return s;
  }, [recos, extras]);

  const insights = useMemo(
    () => (isOuverture && hasAnswers ? ouvertureInsights(state.answers) : []),
    [isOuverture, state.answers, hasAnswers],
  );

  // Mur revente (en mode ouverture) — recos produits dérivées des mêmes réponses.
  // Mappe les clés ouverture (style, positionnement) vers celles attendues par recoRevente.
  const reventeRecos = useMemo(() => {
    if (!isOuverture || !atEnd) return [];
    const a = state.answers;
    const positionnement = (a.positionnement as string) || "";
    // positionnement (ouverture) → ticket moyen revente
    const ticketRevente =
      positionnement === "premium" || positionnement === "luxe"
        ? "35"
        : positionnement === "milieu"
          ? "25"
          : "12";
    const mapped: typeof a = {
      ...a,
      style_shop: a.style as string,
      ticket_revente: ticketRevente,
      marques_interet: (a.marques_revente as string[]) || [],
    };
    return recommend("revente", mapped);
  }, [isOuverture, atEnd, state.answers]);

  const styleAnswer =
    (state.answers.style as string) ||
    (state.answers.style_vibe as string) ||
    "";
  const styleAnswerForPool = (state.answers.style as string) || "";
  // Brand pool for ouverture — filtré par style si dispo
  const brandPool = useMemo(
    () =>
      isOuverture
        ? filterBrandPoolByStyle(styleAnswerForPool)
        : OUVERTURE_BRAND_POOL,
    [isOuverture, styleAnswerForPool],
  );
  const likedBrandIds = useMemo(
    () => new Set(((state.answers.marques_revente as string[]) || [])),
    [state.answers.marques_revente],
  );

  // Preference swipe deck — shown BEFORE the questionnaire. 5 produits curés
  // pour cerner les goûts marque / style / segment de la personne.
  const prefsPool = useMemo(() => {
    if (isOuverture) return [] as Produit[];
    const PRO_CATS = new Set([
      "materiel_coupe",
      "mobilier_equipement",
      "accessoires_pro",
      "hygiene_consommables",
    ]);
    const isPro = m === "materiel-pro";
    const base = PRODUITS.filter((p) => {
      if (p.dispo === "rupture") return false;
      if (!p.image) return false;
      return isPro ? PRO_CATS.has(p.super_cat) : p.super_cat === "soin_revente";
    });
    // diversifier : un par marque tant que possible
    const seenMarque = new Set<string>();
    const seenCat = new Set<string>();
    const shuffled = [...base].sort(() => Math.random() - 0.5);
    const out: Produit[] = [];
    for (const p of shuffled) {
      if (seenMarque.has(p.id_marque)) continue;
      if (seenCat.has(p.categorie) && out.length >= 3) continue;
      out.push(p);
      seenMarque.add(p.id_marque);
      seenCat.add(p.categorie);
      if (out.length === 5) break;
    }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, isOuverture]);

  const sum =
    recos.reduce((s, r) => s + r.produit.prix * r.qty, 0) +
    extras.reduce((s, p) => s + p.prix, 0);

  const Icon = m === "ouverture" ? Scissors : m === "particulier" ? Sparkles : Wrench;

  // Embed mode: applique les styles nécessaires (pas de scroll interne, marge nulle).
  // La hauteur est mesurée et postée par le hook global `useEmbedHeight` (sur document.body).
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

  // Signale un changement de "page" interne (form/step) à l'iframe parent
  // pour qu'elle réinitialise sa hauteur et son scroll.
  useEffect(() => {
    if (!isEmbed || typeof window === "undefined") return;
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    window.parent?.postMessage({ type: "obs-assistant-page-change" }, "*");
    window.dispatchEvent(new Event("obs-assistant-page-change"));
  }, [isEmbed, state.phase, state.step, state.done, m]);

  // Auto-passage à la question suivante dès que l'objectif de 5 marques est atteint
  useEffect(() => {
    if (state.phase !== "brand-swipe") return;
    if (likedBrandIds.size < 5) return;
    const t = window.setTimeout(() => {
      dispatch({ type: "closeBrandSwipe" });
    }, 450);
    return () => window.clearTimeout(t);
  }, [state.phase, likedBrandIds.size]);

  return (
    <div id="obs-embed-root" className={isEmbed ? "" : "min-h-screen"}>
      {!isEmbed && (
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link to="/" className="tap-target flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
              Assistant shop
            </Link>
            <div className="h-4 w-px bg-border" />
            <Logo size="sm" />
            <div className="hidden md:flex items-center gap-2 border-l border-border pl-4">
              <div className="flex h-7 w-7 items-center justify-center bg-ink text-gold">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="leading-tight">
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  {cfg.eyebrow}
                </div>
                <div className="font-display text-lg">{cfg.title}</div>
              </div>
            </div>
          </div>
          <button
            onClick={() => dispatch({ type: "reset" })}
            className="tap-target flex items-center gap-1.5 rounded-sm border border-border bg-background px-3 py-1.5 text-xs uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            Recommencer
          </button>
        </div>
        <div className="relative h-0.5 w-full bg-border">
          <motion.div
            className="absolute inset-y-0 left-0 bg-[var(--brass)]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </header>
      )}
      {isEmbed && (
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2">
            <div className="flex items-center gap-2">
              <Link
                to="/"
                search={{ embed: 1 }}
                className="tap-target flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" />
                Accueil
              </Link>
              <div className="h-3 w-px bg-border" />
              <div className="flex h-6 w-6 items-center justify-center bg-ink text-gold">
                <Icon className="h-3 w-3" />
              </div>
              <div className="font-display text-sm">{cfg.title}</div>
            </div>
            <button
              onClick={() => dispatch({ type: "reset" })}
              className="tap-target flex items-center gap-1.5 rounded-sm border border-border bg-background px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              Recommencer
            </button>
          </div>
          <div className="relative h-0.5 w-full bg-border">
            <motion.div
              className="absolute inset-y-0 left-0 bg-[var(--brass)]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      <div className={`mx-auto grid max-w-7xl gap-6 px-6 ${isEmbed ? "py-4" : "py-8"} lg:grid-cols-[1.2fr_1fr]`}>
        {/* LEFT: questionnaire */}
        <section className="min-w-0">
          {state.phase === "brand-swipe" ? (
            <div>
              <div className="ticket mb-4 p-6 md:p-8">
                <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                  Pause swipe · Marques
                </div>
                <h2 className="mt-2 font-display text-3xl leading-[1.05] md:text-4xl">
                  On calibre ton mur de marques.
                </h2>
                <p className="mt-3 text-base text-muted-foreground">
                  Pool filtré pour ton style{" "}
                  <strong className="text-foreground">
                    {(state.answers.style as string) || "—"}
                  </strong>
                  . Adopte celles dont le design colle à ta clientèle. Passe les autres.
                </p>
              </div>
              <BrandSwipeDeck
                brands={brandPool}
                picked={likedBrandIds}
                onLike={(b) => {
                  const cur = (state.answers.marques_revente as string[]) || [];
                  if (cur.includes(b.id)) return;
                  dispatch({
                    type: "answer",
                    id: "marques_revente",
                    value: [...cur, b.id],
                    advance: false,
                  });
                }}
                objective={5}
              />
              <div className="mt-6 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  {likedBrandIds.size} marque{likedBrandIds.size > 1 ? "s" : ""} adoptée{likedBrandIds.size > 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => dispatch({ type: "closeBrandSwipe" })}
                  className={`tap-target inline-flex items-center gap-2 rounded-sm px-5 py-2.5 text-sm font-medium uppercase tracking-widest transition ${
                    likedBrandIds.size >= 5
                      ? "bg-[var(--brass)] text-ink hover:brightness-105"
                      : "bg-foreground text-background hover:bg-foreground/90"
                  }`}
                >
                  Reprendre les questions <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : state.phase === "prefs" ? (
            <div>
              <SwipeDeck
                produits={prefsPool}
                picked={pickedIds}
                eyebrow="Étape 1 / 2 · On cerne ton goût"
                title="Affine ta sélection"
                subtitle="Swipe 5 produits — j'aime ou je passe. C'est juste pour cerner tes goûts, rien n'est ajouté à ta routine."
                onLike={(p) =>
                  setPrefsLiked((prev) =>
                    prev.some((x) => x.id === p.id) ? prev : [...prev, p],
                  )
                }
                onComplete={() => dispatch({ type: "startQuestions" })}
              />
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => dispatch({ type: "startQuestions" })}
                  className="tap-target inline-flex items-center gap-2 rounded-sm bg-foreground px-5 py-2.5 text-sm font-medium uppercase tracking-widest text-background hover:bg-foreground/90"
                >
                  Passer aux questions <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
          <div className="ticket p-8 md:p-10">
            <div className="mb-6 flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              <span>
                {atEnd
                  ? "Récap"
                  : `Question ${state.step + 1} / ${total}`}
              </span>
              <span />
            </div>

            <AnimatePresence mode="wait">
              {currentQ ? (
                <motion.div
                  key={currentQ.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.35 }}
                >
                  <h2 className="font-display text-4xl leading-[1.05] md:text-5xl">
                    {currentQ.prompt}
                  </h2>
                  {currentQ.helper && (
                    <p className="mt-3 text-base text-muted-foreground">
                      {currentQ.helper}
                    </p>
                  )}

                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    {currentQ.options.map((opt) => {
                      const current = state.answers[currentQ.id];
                      const selected =
                        currentQ.type === "multi"
                          ? Array.isArray(current) && current.includes(opt.value)
                          : current === opt.value;
                      const onClick = () => {
                        if (currentQ.type === "multi") {
                          const arr = Array.isArray(current) ? [...current] : [];
                          const i = arr.indexOf(opt.value);
                          if (i >= 0) arr.splice(i, 1);
                          else arr.push(opt.value);
                          dispatch({ type: "answer", id: currentQ.id, value: arr, advance: false });
                        } else {
                          // Ouverture : juste après clientèle, on déclenche le swipe marques avant d'avancer
                          const triggerBrandSwipe =
                            isOuverture &&
                            currentQ.id === "clientele" &&
                            !state.brandSwipeDone;
                          dispatch({
                            type: "answer",
                            id: currentQ.id,
                            value: opt.value,
                            advance: !triggerBrandSwipe,
                          });
                          if (triggerBrandSwipe) {
                            dispatch({ type: "openBrandSwipe" });
                          }
                        }
                      };
                      return (
                        <button
                          key={opt.value}
                          onClick={onClick}
                          className={`tap-target group relative flex items-start gap-3 rounded-sm border p-4 text-left transition-all ${
                            selected
                              ? "border-foreground bg-foreground text-background shadow-[inset_0_0_0_1px_var(--brass)]"
                              : "border-border bg-card hover:border-foreground/40 hover:-translate-y-0.5"
                          }`}
                        >
                          {opt.logo ? (
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-sm border ${selected ? "border-background/30 bg-background" : "border-border bg-paper"}`}>
                              <img
                                src={opt.logo}
                                alt={opt.label}
                                loading="lazy"
                                className="h-full w-full object-contain p-1"
                              />
                            </div>
                          ) : (
                            opt.emoji && (
                              <div className="text-2xl leading-none">{opt.emoji}</div>
                            )
                          )}
                          <div className="flex-1">
                            <div className="font-display text-xl leading-tight">{opt.label}</div>
                            {opt.desc && (
                              <div className={`mt-1 text-xs ${selected ? "text-background/70" : "text-muted-foreground"}`}>
                                {opt.desc}
                              </div>
                            )}
                          </div>
                          {selected && (
                            <Check className="h-4 w-4 text-[var(--brass)]" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-8 flex items-center justify-between">
                    <button
                      onClick={() => dispatch({ type: "back" })}
                      disabled={state.step === 0}
                      className="tap-target flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40 hover:text-foreground"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Retour
                    </button>
                    {currentQ.type === "multi" && (
                      <button
                        onClick={() => dispatch({ type: "next" })}
                        className="tap-target inline-flex items-center gap-2 rounded-sm bg-foreground px-5 py-2.5 text-sm font-medium uppercase tracking-widest text-background hover:bg-foreground/90"
                      >
                        Continuer <ArrowRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <h2 className="font-display text-5xl leading-none">C'est prêt.</h2>
                  <p className="mt-3 text-lg text-muted-foreground">
                    Ta sélection est à droite. Tu peux ajuster une réponse à tout moment.
                  </p>
                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    {activeQuestions.map((q, i) => {
                      const a = state.answers[q.id];
                      const opts = q.options.filter((o) =>
                        Array.isArray(a) ? a.includes(o.value) : o.value === a,
                      );
                      return (
                        <div
                          key={q.id}
                          className="rounded-sm border border-border bg-card p-3 text-left text-xs"
                        >
                          <div className="uppercase tracking-widest text-muted-foreground">
                            {q.prompt}
                          </div>
                          <div className="mt-1 font-display text-base">
                            {opts.map((o) => o.label).join(" · ") || "—"}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              for (let k = state.step; k > i; k--) dispatch({ type: "back" });
                            }}
                            className="mt-2 text-[10px] uppercase tracking-widest text-[var(--oxblood)]"
                          >
                            Modifier
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          )}
        </section>

        {/* RIGHT: dashboard */}
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
          {isOuverture ? (
            <InsightsPanel
              insights={insights}
              done={atEnd}
              answersCount={Object.keys(state.answers).length}
              reventeRecos={reventeRecos}
              isEmbed={isEmbed}
            />
          ) : (
            <Dashboard
              mode={m}
              recos={recos}
              extras={extras}
              onRemoveExtra={(id) =>
                setExtras((prev) => prev.filter((p) => p.id !== id))
              }
              sum={sum}
              done={atEnd}
              answersCount={Object.keys(state.answers).length}
              isEmbed={isEmbed}
            />
          )}
        </aside>
      </div>

      {atEnd && isOuverture && (
        <section className="mx-auto mt-12 mb-16 max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-sm border border-[var(--brass)]/40 bg-foreground p-8 text-background shadow-[0_24px_60px_-30px_oklch(0.18_0.015_60_/_0.5)] md:p-12"
          >
            <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--brass)]">
              Prochaine étape
            </div>
            <h2 className="mt-2 font-display text-3xl md:text-4xl">
              Cale un RDV avec un expert O'Barbershop
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-background/70 md:text-base">
              Choisis un créneau pour transformer ce positionnement en plan d'action concret : naming, identité, moodboard, mobilier & revente.
            </p>
            <div className="mt-6">
              <BookingWidget />
            </div>
          </motion.div>
        </section>
      )}

      {atEnd && m === "particulier" && (
        <section className="mx-auto mt-12 mb-16 max-w-7xl px-6">
          <DashboardRoutine
            recos={recos}
            sum={sum}
            answers={state.answers}
            onReset={() => dispatch({ type: "reset" })}
          />
        </section>
      )}

      {atEnd && m === "materiel-pro" && (
        <section className="mx-auto mt-12 mb-16 max-w-7xl px-6">
          <DashboardMateriel
            recos={recos}
            sum={sum}
            answers={state.answers}
            onReset={() => dispatch({ type: "reset" })}
          />
        </section>
      )}
    </div>
  );
}

function Dashboard({
  mode,
  recos,
  extras,
  onRemoveExtra,
  sum,
  done,
  answersCount,
  isEmbed,
}: {
  mode: Mode;
  recos: ReturnType<typeof recommend>;
  extras: Produit[];
  onRemoveExtra: (id: string) => void;
  sum: number;
  done: boolean;
  answersCount: number;
  isEmbed?: boolean;
}) {
  const cfg = MODE_CONFIG[mode];
  const grouped = recos.reduce<Record<string, typeof recos>>((acc, r) => {
    (acc[r.bucket] = acc[r.bucket] || []).push(r);
    return acc;
  }, {});

  return (
    <div className="rounded-sm border border-border bg-foreground text-background shadow-[0_24px_60px_-30px_oklch(0.18_0.015_60_/_0.5)]">
      <div className="border-b border-background/15 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-background/60">
              {cfg.dashboardSubtitle}
            </div>
            <div className="font-display text-2xl">{cfg.dashboardTitle}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.3em] text-background/60">
              {mode === "particulier" ? "Total routine" : "Total HT"}
            </div>
            <motion.div
              key={sum}
              initial={{ scale: 0.92, opacity: 0.5 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="font-display text-3xl text-[var(--brass)]"
            >
              {formatPrix(sum)}
            </motion.div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {recos.length === 0 ? (
          <EmptyState mode={mode} />
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([bucket, items]) => (
              <div key={bucket}>
                <div className="mb-3 flex items-center justify-between border-b border-background/10 pb-2">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-background/60">
                    {bucket}
                  </div>
                  <div className="text-[10px] text-background/40">
                    {items.length} {items.length > 1 ? "produits" : "produit"}
                  </div>
                </div>
                <AnimatePresence initial={false}>
                  {items.map((r) => (
                    <ProductLine key={`${bucket}-${r.produit.id}`} r={r} />
                  ))}
                </AnimatePresence>
              </div>
            ))}
            {extras.length > 0 && (
              <div>
                <div className="mb-3 flex items-center justify-between border-b border-[var(--brass)]/30 pb-2">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--brass)]">
                    Coups de cœur (swipe)
                  </div>
                  <div className="text-[10px] text-background/40">
                    {extras.length} ajouté{extras.length > 1 ? "s" : ""}
                  </div>
                </div>
                <AnimatePresence initial={false}>
                  {extras.map((p) => (
                    <motion.div
                      key={`extra-${p.id}`}
                      layout
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.3 }}
                      className="flex gap-3 py-3"
                    >
                      <div className="h-14 w-14 flex-none overflow-hidden rounded-sm bg-background/10">
                        {p.image && (
                          <img
                            src={p.image}
                            alt={p.nom}
                            className="h-full w-full object-contain p-0.5"
                            loading="lazy"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="truncate text-[10px] uppercase tracking-widest text-background/50">
                            {p.marque}
                          </div>
                          <div className="whitespace-nowrap text-xs text-background/80">
                            {formatPrixDecimal(p.prix)}
                          </div>
                        </div>
                        <div className="truncate text-sm font-medium leading-tight">
                          {p.nom}
                        </div>
                        <button
                          onClick={() => onRemoveExtra(p.id)}
                          className="mt-0.5 text-[10px] uppercase tracking-widest text-background/40 hover:text-[var(--oxblood)]"
                        >
                          Retirer
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

          </div>
        )}
      </div>

      {!done && (
        <div className="border-t border-background/10 px-6 py-3 text-[10px] uppercase tracking-[0.3em] text-background/40">
          {answersCount === 0
            ? "Réponds à la 1ère question pour commencer"
            : `${answersCount} réponse${answersCount > 1 ? "s" : ""} prise${answersCount > 1 ? "s" : ""} en compte`}
        </div>
      )}
    </div>
  );
}

function ProductLine({ r }: { r: ReturnType<typeof recommend>[number] }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.3 }}
      className="flex gap-3 py-3 first:pt-1"
    >
      <div className="h-14 w-14 flex-none overflow-hidden rounded-sm bg-background/10">
        {r.produit.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.produit.image}
            alt={r.produit.nom}
            className="h-full w-full object-contain p-0.5"
            loading="lazy"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="truncate text-[10px] uppercase tracking-widest text-background/50">
            {r.produit.marque}
          </div>
          <div className="whitespace-nowrap text-xs text-background/80">
            {r.qty > 1 ? `${r.qty}× ` : ""}
            {formatPrixDecimal(r.produit.prix)}
          </div>
        </div>
        <div className="truncate text-sm font-medium leading-tight">{r.produit.nom}</div>
        <div className="mt-0.5 truncate text-[11px] text-background/60">{r.reason}</div>
      </div>
    </motion.div>
  );
}

function EmptyState({ mode }: { mode: Mode }) {
  const Icon = mode === "ouverture" ? Scissors : mode === "particulier" ? Sparkles : Wrench;
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-background/20">
        <Icon className="h-6 w-6 text-background/50" />
      </div>
      <div className="font-display text-xl text-background/80">
        {mode === "ouverture"
          ? "Ton shop guide prend forme ici"
          : mode === "particulier"
            ? "Ta routine se compose ici"
            : "Ta sélection apparaît ici"}
      </div>
      <div className="mt-2 max-w-xs text-xs text-background/50">
        À chaque réponse, ta sélection se précise.
      </div>
    </div>
  );
}

function InsightsPanel({
  insights,
  done,
  answersCount,
  reventeRecos,
  isEmbed,
}: {
  insights: OuvertureInsight[];
  done: boolean;
  answersCount: number;
  reventeRecos: ReturnType<typeof recommend>;
  isEmbed?: boolean;
}) {
  const grouped = insights.reduce<Record<string, OuvertureInsight[]>>((acc, i) => {
    (acc[i.bucket] = acc[i.bucket] || []).push(i);
    return acc;
  }, {});

  return (
    <div className="rounded-sm border border-border bg-foreground text-background shadow-[0_24px_60px_-30px_oklch(0.18_0.015_60_/_0.5)]">
      <div className="border-b border-background/15 p-6">
        <div className="text-[10px] uppercase tracking-[0.3em] text-background/60">
          Positionnement · Ambiance · Ton
        </div>
        <div className="font-display text-2xl">Ton shop guide</div>
        <p className="mt-2 text-xs text-background/60">
          Stratégie + mur revente. Pour le matériel pro, lance l'assistant
          dédié depuis l'accueil.
        </p>
      </div>

      <div className="p-6">
        {insights.length === 0 ? (
          <EmptyState mode="ouverture" />
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([bucket, items]) => (
              <div key={bucket}>
                <div className="mb-3 border-b border-background/10 pb-2 text-[10px] uppercase tracking-[0.3em] text-background/60">
                  {bucket}
                </div>
                <AnimatePresence initial={false}>
                  {items.map((it, idx) => (
                    <motion.div
                      key={`${bucket}-${idx}`}
                      layout
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.3 }}
                      className="py-3 first:pt-1"
                    >
                      <div className="font-display text-base leading-tight">{it.title}</div>
                      <p className="mt-1 text-[13px] leading-relaxed text-background/75">
                        {it.body}
                      </p>
                      {it.swatches && it.swatches.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {it.swatches.map((s) => (
                            <div key={s.hex} className="flex flex-col items-center gap-1">
                              <span
                                className="h-10 w-10 rounded-sm border border-background/20 shadow-inner"
                                style={{ backgroundColor: s.hex }}
                                title={`${s.name} · ${s.hex}`}
                              />
                              <span className="text-[9px] uppercase tracking-wider text-background/60">
                                {s.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {it.tags && it.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {it.tags.map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center rounded-sm border border-[var(--brass)]/40 bg-[var(--brass)]/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-[var(--brass)]"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {it.brands && it.brands.length > 0 && (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {it.brands.map((b) => (
                            <div
                              key={b.id}
                              className="flex gap-2 rounded-sm border border-background/15 bg-background/5 p-2"
                            >
                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-sm border border-background/20 bg-background">
                                <img
                                  src={b.logo}
                                  alt={b.label}
                                  className="h-full w-full object-contain p-0.5"
                                  loading="lazy"
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate font-display text-sm leading-tight">
                                  {b.label}
                                </div>
                                <div className="truncate text-[10px] uppercase tracking-widest text-background/55">
                                  {b.pays} · {b.styleTag}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {it.brandRecos && it.brandRecos.length > 0 && (
                        <div className="mt-4 space-y-3">
                          {it.brandRecos.map((r) => (
                            <BrandRecoCard key={r.brand.id} reco={r} />
                          ))}
                        </div>
                      )}
                      {it.comboGaps && it.comboGaps.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {it.comboGaps.map((g) => (
                            <ComboGapCard key={g.famille} gap={g} />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ))}

            {done && reventeRecos.length > 0 && (
              <div className="mt-4 rounded-sm border border-[var(--brass)]/30 bg-background/5 p-5">
                <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--brass)]">
                  Mur revente · {reventeRecos.length} produit
                  {reventeRecos.length > 1 ? "s" : ""}
                </div>
                <div className="mt-1 font-display text-xl">
                  Ce que tu mets en rayon
                </div>
                <p className="mt-1 text-xs text-background/60">
                  Sélection dérivée de ton style, ta clientèle et ton positionnement prix.
                </p>
                <div className="mt-3 divide-y divide-background/10">
                  {reventeRecos.map((r) => (
                    <ProductLine key={`revente-${r.produit.id}`} r={r} />
                  ))}
                </div>
              </div>
            )}

            {done && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 rounded-sm border border-[var(--brass)]/40 bg-background/5 p-5"
              >
                <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--brass)]">
                  Shop guide finalisé
                </div>
                <div className="mt-1 font-display text-xl">
                  Ton positionnement est prêt
                </div>
                <p className="mt-2 text-sm text-background/70">
                  Récupère le tout en bas de page : un créneau avec un expert
                  pour transformer ce shop guide en plan d'action concret.
                </p>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {!done && (
        <div className="border-t border-background/10 px-6 py-3 text-[10px] uppercase tracking-[0.3em] text-background/40">
          {answersCount === 0
            ? "Réponds à la 1ère question pour démarrer"
            : `${answersCount} réponse${answersCount > 1 ? "s" : ""} prise${answersCount > 1 ? "s" : ""} en compte`}
        </div>
      )}
    </div>
  );
}

function BrandRecoCard({ reco }: { reco: BrandReco }) {
  const { brand, alignedWithStyle, topProducts, categories } = reco;
  return (
    <div className="rounded-sm border border-background/20 bg-background/5 p-3">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-sm border border-background/30 bg-background">
          <img src={brand.logo} alt={brand.label} className="h-full w-full object-contain p-0.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="font-display text-base leading-tight">{brand.label}</div>
            {alignedWithStyle && (
              <span className="inline-flex items-center rounded-sm bg-[var(--brass)]/20 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-[var(--brass)]">
                ✓ Aligné style
              </span>
            )}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-background/55">
            {brand.pays}
            {brand.segment ? ` · ${brand.segment}` : ""}
            {` · ${brand.styleTag}`}
          </div>
        </div>
      </div>

      <p className="mt-2 text-[12px] leading-snug text-background/70 line-clamp-3">
        {brand.desc}
      </p>

      {categories.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {categories.slice(0, 4).map((c) => (
            <span
              key={c}
              className="rounded-sm border border-background/20 bg-background/5 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-background/60"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {topProducts.length > 0 && (
        <div className="mt-3 border-t border-background/10 pt-3">
          <div className="mb-2 text-[9px] uppercase tracking-[0.25em] text-[var(--brass)]">
            Produits phares à commander
          </div>
          <div className="space-y-2">
            {topProducts.map(({ produit, prixIndicatif }) => (
              <div key={produit.id} className="flex gap-2">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-sm bg-background/10">
                  {produit.image && (
                    <img
                      src={produit.image}
                      alt={produit.nom}
                      className="h-full w-full object-contain p-0.5"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-medium leading-tight">{produit.nom}</div>
                  <div className="text-[10px] text-background/55">
                    {produit.categorie} · {formatPrixDecimal(prixIndicatif)} HT pro
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1 text-[9px] italic text-background/40">
            Tarif pro estimé (≈ 55% du PVP). À confirmer au devis.
          </div>
        </div>
      )}
    </div>
  );
}

function ComboGapCard({ gap }: { gap: ComboGap }) {
  return (
    <div className="flex items-start gap-3 rounded-sm border border-dashed border-[var(--brass)]/40 bg-[var(--brass)]/5 p-3">
      {gap.suggestion ? (
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-sm border border-background/30 bg-background">
          <img
            src={gap.suggestion.logo}
            alt={gap.suggestion.label}
            className="h-full w-full object-contain p-0.5"
          />
        </div>
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-dashed border-background/30 text-[10px] text-background/40">
          ?
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-[var(--brass)]">
          Famille manquante · {gap.label}
        </div>
        <div className="font-display text-sm leading-tight">
          {gap.suggestion ? gap.suggestion.label : "À compléter"}
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-background/70">{gap.reason}</p>
      </div>
    </div>
  );
}

