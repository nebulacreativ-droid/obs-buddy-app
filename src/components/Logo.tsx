import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo.svg";

export function Logo({
  tagline = false,
  size = "md",
}: {
  tagline?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "auto" | "mark";
}) {
  const h =
    size === "lg" ? "h-16 md:h-20" : size === "sm" ? "h-10" : "h-12 md:h-14";
  return (
    <Link
      to="/"
      className="tap-target inline-flex flex-col items-start leading-none"
    >
      <img
        src={logo}
        alt="O'Barbershop"
        className={`${h} w-auto`}
        draggable={false}
      />
      {tagline && (
        <div className="mt-1.5 inline-block bg-ink text-gold px-2 py-0.5 font-display text-[10px] tracking-[0.3em]">
          TIME TO GROOM
        </div>
      )}
    </Link>
  );
}
