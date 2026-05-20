import { createFileRoute, redirect } from "@tanstack/react-router";

// Route dédiée à l'intégration iframe (PrestaShop / Creative Elements).
// Redirige vers /assistant/$mode?embed=1 — la page assistant masque alors
// son header global et envoie sa hauteur au parent via postMessage.
export const Route = createFileRoute("/embed/$mode")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/assistant/$mode",
      params: { mode: params.mode },
      search: { embed: 1 },
    });
  },
});
