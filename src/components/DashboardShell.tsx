import { motion } from "motion/react";
import { RotateCcw, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { formatPriceTTC } from "@/lib/format";

export function DashboardShell({
  eyebrow,
  title,
  tags,
  productCount,
  totalHT,
  level,
  onReset,
  children,
}: {
  eyebrow: string;
  title: string;
  tags: string[];
  productCount: number;
  totalHT: number;
  level: string;
  onReset: () => void;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="overflow-hidden rounded-sm"
      style={{ backgroundColor: "#0F0F0F", color: "#FFFFFF" }}
    >
      {/* HEADER */}
      <div className="border-b p-8 md:p-12" style={{ borderColor: "#2A2A2A" }}>
        <div
          className="text-sm italic"
          style={{ fontFamily: "'Playfair Display', serif", color: "#F7E61C" }}
        >
          {eyebrow}
        </div>
        <h2
          className="mt-3 text-4xl uppercase leading-[0.95] md:text-6xl"
          style={{ fontFamily: "Anton, sans-serif" }}
        >
          {title}
        </h2>
        {tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-sm border px-2.5 py-1 text-[10px] uppercase tracking-widest"
                style={{
                  borderColor: "#F7E61C",
                  color: "#F7E61C",
                  fontFamily: "Montserrat, sans-serif",
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* STATS */}
      <div
        className="grid grid-cols-1 gap-px sm:grid-cols-3"
        style={{ backgroundColor: "#2A2A2A" }}
      >
        <Stat label="Produits" value={String(productCount)} icon="📦" />
        <Stat
          label="Total panier"
          value={formatPriceTTC(totalHT)}
          icon="💰"
          animated
        />
        <Stat label="Niveau" value={level} icon="⭐" />
      </div>

      {/* BODY */}
      <div className="space-y-10 p-6 md:p-10">{children}</div>

      {/* CTA */}
      <div
        className="flex flex-col gap-3 border-t p-6 sm:flex-row sm:justify-between md:p-10"
        style={{ borderColor: "#2A2A2A" }}
      >
        <a
          href="https://www.obarbershop.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-sm px-6 py-3 text-sm uppercase tracking-widest"
          style={{
            backgroundColor: "#F7E61C",
            color: "#0F0F0F",
            fontFamily: "Anton, sans-serif",
          }}
        >
          Voir tous les produits <ExternalLink className="h-4 w-4" />
        </a>
        <button
          onClick={onReset}
          className="inline-flex items-center justify-center gap-2 rounded-sm border px-6 py-3 text-sm uppercase tracking-widest text-white hover:bg-white/5"
          style={{ borderColor: "#2A2A2A", fontFamily: "Anton, sans-serif" }}
        >
          <RotateCcw className="h-4 w-4" /> Refaire le test
        </button>
      </div>
    </motion.div>
  );
}

function Stat({
  label,
  value,
  icon,
  animated,
}: {
  label: string;
  value: string;
  icon: string;
  animated?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 p-6" style={{ backgroundColor: "#0F0F0F" }}>
      <div className="text-2xl">{icon}</div>
      <div>
        <div
          className="text-[10px] uppercase tracking-widest text-neutral-500"
          style={{ fontFamily: "Montserrat, sans-serif" }}
        >
          {label}
        </div>
        <motion.div
          key={animated ? value : undefined}
          initial={animated ? { scale: 0.85, opacity: 0.4 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="mt-0.5 text-2xl"
          style={{ color: "#F7E61C", fontFamily: "Anton, sans-serif" }}
        >
          {value}
        </motion.div>
      </div>
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3
      className="mb-5 text-2xl uppercase"
      style={{ fontFamily: "Anton, sans-serif", color: "#FFFFFF" }}
    >
      <span style={{ color: "#F7E61C" }}>—</span> {children}
    </h3>
  );
}

export function BarberNote({
  eyebrow,
  body,
}: {
  eyebrow: string;
  body: string;
}) {
  return (
    <div
      className="rounded-sm p-6 md:p-8"
      style={{ backgroundColor: "#F7E61C", color: "#0F0F0F" }}
    >
      <div
        className="text-xs italic"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        {eyebrow}
      </div>
      <p
        className="mt-2 text-base leading-relaxed md:text-lg"
        style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 500 }}
      >
        {body}
      </p>
    </div>
  );
}