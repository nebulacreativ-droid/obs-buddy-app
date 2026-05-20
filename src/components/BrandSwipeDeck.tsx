import { useEffect, useMemo, useState } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useAnimationControls,
  AnimatePresence,
} from "motion/react";
import { Heart, X, RotateCcw, Check } from "lucide-react";
import type { BrandCard } from "@/lib/assistant-config";

type Props = {
  brands: BrandCard[];
  picked: Set<string>;
  onLike: (b: BrandCard) => void;
  onSkip?: (b: BrandCard) => void;
  objective?: number;
};

export function BrandSwipeDeck({ brands, picked, onLike, onSkip, objective = 5 }: Props) {
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<Array<{ id: string; dir: "like" | "skip" }>>([]);
  const [version, setVersion] = useState(0); // reshuffle seed
  const [command, setCommand] = useState<{ id: string; dir: "like" | "skip" } | null>(null);

  const ordered = useMemo(() => {
    const arr = [...brands];
    // simple shuffle dépendant de version
    let seed = version + 1;
    for (let i = arr.length - 1; i > 0; i--) {
      seed = (seed * 9301 + 49297) % 233280;
      const j = Math.floor((seed / 233280) * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [brands, version]);

  const visible = useMemo(() => ordered.slice(index, index + 3), [ordered, index]);

  const requestDecide = (dir: "like" | "skip") => {
    if (command) return;
    const b = ordered[index];
    if (!b) return;
    setCommand({ id: b.id, dir });
  };

  const commitDecide = () => {
    if (!command) return;
    const b = ordered[index];
    if (!b) return;
    if (command.dir === "like") onLike(b);
    else onSkip?.(b);
    setHistory((h) => [...h, { id: b.id, dir: command.dir }]);
    setIndex((i) => i + 1);
    setCommand(null);
  };

  const undo = () => {
    if (history.length === 0 || index === 0) return;
    setIndex((i) => i - 1);
    setHistory((h) => h.slice(0, -1));
  };

  const reshuffle = () => {
    setIndex(0);
    setHistory([]);
    setVersion((v) => v + 1);
  };

  const remaining = ordered.length - index;
  const likedCount = picked.size;
  const objectiveReached = likedCount >= objective;
  const progress = Math.min(100, (likedCount / objective) * 100);

  if (brands.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Pas de marque à proposer pour ce style.
      </div>
    );
  }

  return (
    <div className="ticket p-6 md:p-8">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Affine ton mur de revente
          </div>
          <h3 className="font-display text-2xl md:text-3xl leading-tight">
            Swipe les marques
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Le design colle à ta clientèle ? ← Passe · Adopte →
          </p>
        </div>
        <div className="text-right text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          {remaining > 0 ? `${remaining} restantes` : "Tour fini"}
        </div>
      </div>

      {/* Objectif + progression */}
      <div className="mb-5 rounded-sm border border-border bg-paper p-3">
        <div className="flex items-baseline justify-between text-[10px] uppercase tracking-[0.25em]">
          <span className="text-ink">
            Objectif · {objective} marques mini
          </span>
          <span className={objectiveReached ? "text-[var(--brass)]" : "text-muted-foreground"}>
            {likedCount} / {objective}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-background">
          <motion.div
            className="h-full bg-gold"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      <div className="relative mx-auto h-[480px] w-full max-w-sm">
        <AnimatePresence>
          {visible.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center rounded-sm border border-border bg-card text-center p-6"
            >
              <div className="font-display text-xl">Tour bouclé.</div>
              <p className="mt-2 text-sm text-muted-foreground">
                {likedCount} marque{likedCount > 1 ? "s adoptées" : " adoptée"}
                {!objectiveReached && ` — il t'en manque ${objective - likedCount} pour atteindre l'objectif.`}
              </p>
              <button
                onClick={reshuffle}
                className="mt-4 inline-flex items-center gap-2 rounded-sm border-2 border-ink bg-gold px-4 py-2 text-xs font-semibold uppercase tracking-widest text-ink hover:brightness-105"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Refaire un tour
              </button>
            </motion.div>
          )}
          {visible
            .map((b, i) => ({ b, i, depth: i }))
            .reverse()
            .map(({ b, i, depth }) => (
              <BrandCardView
                key={`${version}-${b.id}`}
                brand={b}
                isTop={i === 0}
                depth={depth}
                alreadyPicked={picked.has(b.id)}
                onDecide={requestDecide}
                command={command && command.id === b.id ? command.dir : null}
                onExitComplete={commitDecide}
              />
            ))}
        </AnimatePresence>
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          onClick={() => requestDecide("skip")}
          disabled={visible.length === 0}
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
          disabled={visible.length === 0}
          aria-label="Adopter"
          className="tap-target flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink bg-[var(--brass)] text-ink shadow-sm transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-40"
        >
          <Heart className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}

function BrandCardView({
  brand,
  isTop,
  depth,
  alreadyPicked,
  onDecide,
  command,
  onExitComplete,
}: {
  brand: BrandCard;
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

  const images = brand.sampleImages.length > 0 ? brand.sampleImages : [brand.logo];
  const [imgIdx, setImgIdx] = useState(0);

  // Auto-carousel uniquement sur la carte du dessus
  useEffect(() => {
    if (!isTop || images.length <= 1) return;
    const t = setInterval(() => setImgIdx((i) => (i + 1) % images.length), 1500);
    return () => clearInterval(t);
  }, [isTop, images.length]);

  // Animation de sortie déclenchée par un bouton (command) ou un drag fort.
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
        <AnimatePresence mode="wait">
          <motion.img
            key={imgIdx}
            src={images[imgIdx]}
            alt={`${brand.label} — visuel ${imgIdx + 1}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 h-full w-full object-contain p-3"
            draggable={false}
          />
        </AnimatePresence>

        <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-sm border border-ink bg-gold px-2 py-1 font-display text-[10px] tracking-[0.25em] text-ink">
          {brand.pays || brand.styleTag}
        </div>

        {/* Pagination dots */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
            {images.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${
                  i === imgIdx ? "bg-ink" : "bg-ink/30"
                }`}
              />
            ))}
          </div>
        )}

        {alreadyPicked && (
          <div className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-sm bg-ink/85 px-2 py-1 text-[10px] uppercase tracking-widest text-background">
            <Check className="h-3 w-3" /> Adoptée
          </div>
        )}
        {isTop && (
          <>
            <motion.div
              style={{ opacity: likeOpacity }}
              className="absolute left-4 top-1/2 -translate-y-1/2 rotate-[-12deg] border-4 border-[var(--brass)] bg-background/80 px-3 py-1 font-display text-2xl tracking-widest text-[var(--brass)]"
            >
              ADOPTE
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
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-sm border border-border bg-background">
            <img src={brand.logo} alt={brand.label} className="h-full w-full object-contain p-0.5" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-xl leading-tight">{brand.label}</div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              {brand.styleTag}
            </div>
          </div>
        </div>
        <p className="text-[12px] leading-snug text-muted-foreground line-clamp-3">
          {brand.desc}
        </p>
      </div>
    </motion.div>
  );
}
