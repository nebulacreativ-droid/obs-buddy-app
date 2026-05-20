import { motion } from "motion/react";
import { ExternalLink } from "lucide-react";
import type { Produit } from "@/lib/catalogue";
import { formatPriceTTC } from "@/lib/format";
import { badgeForScore, badgeLabel } from "@/lib/scoring";
import { isBestSeller } from "@/lib/brands-cartographie";

export type ProductCardProps = {
  produit: Produit;
  badge?: string;
  reasons?: string[];
  index?: number;
  qty?: number;
  score?: number;
};

export function ProductCard({ produit, badge, reasons, index = 0, qty, score }: ProductCardProps) {
  const tier = typeof score === "number" ? badgeForScore(score) : "none";
  const scoreLabel = tier !== "none" ? badgeLabel(tier) : "";
  const effectiveBadge = badge || scoreLabel;
  const badgeBg = tier === "match" ? "#F7E61C" : tier === "good" ? "#0F0F0F" : tier === "alt" ? "#2A2A2A" : "#0F0F0F";
  const badgeFg = tier === "match" ? "#0F0F0F" : "#F7E61C";
  const badgeBorder = tier === "good" ? "1px solid #F7E61C" : tier === "alt" ? "1px solid #3A3A3A" : "none";
  const bestSeller = isBestSeller(produit);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      whileHover={{ y: -4 }}
      className="group relative flex flex-col overflow-hidden rounded-sm border transition-colors duration-200"
      style={{
        backgroundColor: "#1A1A1A",
        borderColor: "#2A2A2A",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#F7E61C")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2A2A2A")}
    >
      {effectiveBadge && (
        <div
          className="absolute right-2 top-2 z-10 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-widest"
          style={{ backgroundColor: badgeBg, color: tier === "match" ? badgeFg : "#F7E61C", border: badgeBorder, fontFamily: "Anton, sans-serif" }}
        >
          {effectiveBadge}
        </div>
      )}
      {produit.mif && (
        <div
          className="absolute left-2 top-2 z-10 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold"
          style={{ color: "#0F0F0F" }}
        >
          🇫🇷 FR
        </div>
      )}
      {bestSeller && (
        <div
          className="absolute left-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            top: produit.mif ? "2rem" : "0.5rem",
            backgroundColor: "#F7E61C",
            color: "#0F0F0F",
            fontFamily: "Anton, sans-serif",
            letterSpacing: "0.05em",
          }}
        >
          ⭐ BEST-SELLER
        </div>
      )}
      <div className="aspect-square w-full bg-white p-3">
        {produit.image && (
          <img
            src={produit.image}
            alt={produit.nom}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div
          className="text-[11px] uppercase tracking-widest"
          style={{ color: "#F7E61C", fontFamily: "Anton, sans-serif" }}
        >
          {produit.marque}
        </div>
        <div
          className="text-lg leading-tight text-white"
          style={{ fontFamily: "Anton, sans-serif" }}
        >
          {produit.nom}
        </div>
        <p
          className="text-xs leading-relaxed text-neutral-400"
          style={{
            fontFamily: "Montserrat, sans-serif",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {produit.recap}
        </p>
        {reasons && reasons.length > 0 && (
          <ul className="mt-1 space-y-1">
            {reasons.map((r, i) => (
              <li
                key={i}
                className="flex gap-1.5 text-[11px] leading-snug text-neutral-300"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                <span style={{ color: "#F7E61C" }}>▸</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div
            className="text-2xl"
            style={{ color: "#F7E61C", fontFamily: "Anton, sans-serif" }}
          >
            {qty && qty > 1 ? `${qty}× ` : ""}
            {formatPriceTTC(produit.prix)}
          </div>
        </div>
        <a
          href={produit.lien}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-sm px-4 py-2.5 text-xs uppercase tracking-widest transition-transform hover:scale-[1.02]"
          style={{
            backgroundColor: "#F7E61C",
            color: "#0F0F0F",
            fontFamily: "Anton, sans-serif",
          }}
        >
          Voir le produit <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </motion.div>
  );
}