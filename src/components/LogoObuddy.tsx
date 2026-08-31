/**
 * Le visage d'O'Buddy.
 *
 * Une coupe dégradée, deux yeux, une moustache : de quoi reconnaître un
 * barbier plutôt qu'un logiciel. Les initiales "OB" ne personnifiaient rien —
 * on parlait à un sigle.
 *
 * Aucun contour de tête : les essais avec silhouette pleine donnaient une
 * brique de Lego dès qu'on descendait sous 32 px. Ici, les trois formes
 * posées sur le fond tiennent la lecture jusqu'à 16 px.
 *
 * L'éclat en haut à droite reprend l'étoile du lanceur sur la boutique :
 * O'Buddy conseille, il ne fait pas que répondre.
 */
export function LogoObuddy({
  className = "",
  inverse = false,
}: {
  className?: string;
  /** Encre sur or par défaut ; or sur encre pour les fonds clairs. */
  inverse?: boolean;
}) {
  const fond = inverse ? "#0F0F0F" : "#FCF24F";
  const trait = inverse ? "#FCF24F" : "#0F0F0F";

  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="O'Buddy">
      <rect width="48" height="48" rx="13" fill={fond} />
      {/* Coupe : dégradé court sur les côtés, volume sur le dessus. */}
      <path
        d="M24 7c-6.9 0-11.5 4.4-11.5 10.7 0 1.7.2 3.1.7 4.5l3.5-1.4v-2.5c0-2.7 3-4.4 7.3-4.4s7.3 1.7 7.3 4.4v2.5l3.5 1.4c.5-1.4.7-2.8.7-4.5C35.5 11.4 30.9 7 24 7Z"
        fill={trait}
      />
      <circle cx="20.1" cy="25.6" r="1.95" fill={trait} />
      <circle cx="27.9" cy="25.6" r="1.95" fill={trait} />
      <path
        d="M24 32c-2.1-2.2-4.7-2.8-7.5-1.6.5 3.4 3.4 5.4 7.5 5.4s7-2 7.5-5.4c-2.8-1.2-5.4-.6-7.5 1.6Z"
        fill={trait}
      />
      <path
        d="M39.4 9.6l.85 2.25 2.25.85-2.25.85-.85 2.25-.85-2.25-2.25-.85 2.25-.85.85-2.25Z"
        fill={trait}
      />
    </svg>
  );
}
