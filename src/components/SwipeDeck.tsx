import { useEffect, useMemo, useState } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useAnimationControls,
  AnimatePresence,
} from "motion/react";
import { Heart, X, RotateCcw, ShoppingBag } from "lucide-react";
import type { Produit } from "@/lib/catalogue";
import { formatPrixDecimal } from "@/lib/catalogue";

type Props = {
  produits: Produit[];
  onLike: (p: Produit) => void;
  onSkip?: (p: Produit) => void;
  picked: Set<string>;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  onComplete?: () => void;
};

export function SwipeDeck({ produits, onLike, onSkip, picked, eyebrow, title, subtitle, onComplete }: Props) {
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<
    Array<{ id: string; dir: "like" | "skip" }>
  >([]);
  const [command, setCommand] = useState<{ id: string; dir: "like" | "skip" } | null>(null);

  const visible = useMemo(() => produits.slice(index, index + 3), [produits, index]);

  useEffect(() => {
    if (produits.length > 0 && index >= produits.length) {
      onComplete?.();
    }
  }, [index, produits.length, onComplete]);

  const requestDecide = (dir: "like" | "skip") => {
    if (command) return;
    const p = produits[index];
    if (!p) return;
    setCommand({ id: p.id, dir });
  };

  const commitDecide = () => {
    if (!command) return;
    const p = produits[index];
    if (!p) return;
    if (command.dir === "like") onLike(p);
    else onSkip?.(p);
    setHistory((h) => [...h, { id: p.id, dir: command.dir }]);
    setIndex((i) => i + 1);
    setCommand(null);
  };

  const undo = () => {
    if (history.length === 0 || index === 0) return;
    setIndex((i) => i - 1);
    setHistory((h) => h.slice(0, -1));
  };

  const remaining = produits.length - index;

  if (produits.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Pas d'autre produit à te proposer pour ton profil.
      </div>
    );
  }

  return (
    <div className="ticket p-6 md:p-8">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            {eyebrow ?? "Affine ta sélection"}
          </div>
          <h3 className="font-display text-2xl md:text-3xl leading-tight">
            {title ?? "Swipe nos coups de cœur"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {subtitle ?? "← Passe · Ajoute → On les ajoute à ton panier en direct."}
          </p>
        </div>
        <div className="text-right text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          {remaining > 0 ? `${remaining} restants` : "Terminé"}
        </div>
      </div>

      <div className="relative mx-auto h-[420px] w-full max-w-sm">
        <AnimatePresence>
          {visible.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center rounded-sm border border-border bg-card text-center"
            >
              <div className="font-display text-xl">C'est tout pour aujourd'hui.</div>
              <p className="mt-2 text-sm text-muted-foreground">
                {history.filter((h) => h.dir === "like").length} produit
                {history.filter((h) => h.dir === "like").length > 1 ? "s ajoutés" : " ajouté"} via swipe.
              </p>
              <button
                onClick={() => {
                  setIndex(0);
                  setHistory([]);
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-sm border border-border bg-background px-3 py-1.5 text-xs uppercase tracking-widest hover:border-foreground"
              >
                <RotateCcw className="h-3 w-3" /> Recommencer
              </button>
            </motion.div>
          )}
          {visible
            .map((p, i) => ({ p, i, depth: i }))
            .reverse()
            .map(({ p, i, depth }) => (
              <SwipeCard
                key={p.id}
                produit={p}
                isTop={i === 0}
                depth={depth}
                alreadyPicked={picked.has(p.id)}
                onDecide={requestDecide}
                command={command && command.id === p.id ? command.dir : null}
                onExitComplete={commitDecide}
              />
            ))}
        </AnimatePresence>
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          onClick={() => requestDecide("skip")}
          disabled={visible.length === 0 || !!command}
          aria-label="Passer"
          className="tap-target flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink bg-background text-ink shadow-sm transition hover:-translate-y-0.5 hover:bg-ink hover:text-background disabled:opacity-40"
        >
          <X className="h-6 w-6" />
        </button>
        <button
          onClick={undo}
          disabled={index === 0}
          aria-label="Revenir"
          className="tap-target flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:border-foreground hover:text-foreground disabled:opacity-30"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          onClick={() => requestDecide("like")}
          disabled={visible.length === 0 || !!command}
          aria-label="Ajouter"
          className="tap-target flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink bg-[var(--brass)] text-ink shadow-sm transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-40"
        >
          <Heart className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}

function SwipeCard({
  produit,
  isTop,
  depth,
  alreadyPicked,
  onDecide,
  command,
  onExitComplete,
}: {
  produit: Produit;
  isTop: boolean;
  depth: number;
  alreadyPicked: boolean;
  onDecide: (dir: "like" | "skip") => void;
  command?: "like" | "skip" | null;
  onExitComplete?: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15]);
  const likeOpacity = useTransform(x, [40, 140], [0, 1]);
  const skipOpacity = useTransform(x, [-140, -40], [1, 0]);
  const controls = useAnimationControls();

  const offset = depth * 8;
  const scale = 1 - depth * 0.04;

  useEffect(() => {
    if (!isTop || !command) return;
    let cancelled = false;
    (async () => {
      await controls.start({
        x: command === "like" ? 600 : -600,
        rotate: command === "like" ? 18 : -18,
        opacity: 0,
        transition: { duration: 0.35, ease: "easeOut" },
      });
      if (!cancelled) onExitComplete?.();
    })();
    return () => {
      cancelled = true;
    };
  }, [command, isTop]);

  return (
    <motion.div
      className={`absolute inset-0 rounded-sm border-2 border-ink bg-card overflow-hidden ${
        isTop ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"
      }`}
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        zIndex: 10 - depth,
      }}
      initial={{ scale: scale - 0.04, y: offset + 16, opacity: 0 }}
      animate={isTop && command ? controls : { scale, y: offset, opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      drag={isTop && !command ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={(_, info) => {
        if (info.offset.x > 120) onDecide("like");
        else if (info.offset.x < -120) onDecide("skip");
      }}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-paper">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center font-display text-2xl text-ink/20">
          {produit.marque}
        </div>
        {produit.image ? (
          <img
            src={produit.image}
            alt={produit.nom}
            className="relative h-full w-full object-contain p-3"
            draggable={false}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
        <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-sm border border-ink bg-gold px-2 py-1 font-display text-[10px] tracking-[0.25em] text-ink">
          {produit.marque}
        </div>
        {produit.mif && (
          <div className="absolute right-3 top-3 rounded-sm border border-ink bg-background px-2 py-1 text-[10px] uppercase tracking-widest text-ink">
            Made in France
          </div>
        )}
        {alreadyPicked && (
          <div className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-sm bg-ink/85 px-2 py-1 text-[10px] uppercase tracking-widest text-background">
            <ShoppingBag className="h-3 w-3" /> Déjà au panier
          </div>
        )}
        {isTop && (
          <>
            <motion.div
              style={{ opacity: likeOpacity }}
              className="absolute left-4 top-1/2 -translate-y-1/2 rotate-[-12deg] border-4 border-[var(--brass)] bg-background/80 px-3 py-1 font-display text-2xl tracking-widest text-[var(--brass)]"
            >
              J'AIME
            </motion.div>
            <motion.div
              style={{ opacity: skipOpacity }}
              className="absolute right-4 top-1/2 -translate-y-1/2 rotate-[12deg] border-4 border-[var(--oxblood)] bg-background/80 px-3 py-1 font-display text-2xl tracking-widest text-[var(--oxblood)]"
            >
              PASSE
            </motion.div>
          </>
        )}
      </div>
      <div className="p-4">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {produit.categorie}
        </div>
        <div className="mt-1 font-display text-lg leading-tight">{produit.nom}</div>
        <div className="mt-2 flex items-center justify-between">
          <p className="line-clamp-2 max-w-[70%] text-xs text-muted-foreground">
            {produit.recap}
          </p>
          <div className="font-display text-xl text-ink">
            {formatPrixDecimal(produit.prix)}
          </div>
        </div>
      </div>
    </motion.div>
  );
}