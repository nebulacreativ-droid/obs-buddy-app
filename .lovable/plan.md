Je vais appliquer le correctif uniquement sur la logique d’embed/hauteur iframe.

1. Centraliser la mesure dans `useEmbedHeight.ts`
- Garder le hook global déjà appelé dans `__root.tsx`.
- Mesurer systématiquement `document.body.scrollHeight`.
- Observer `document.body` avec `ResizeObserver`.
- Garder un debounce de 100 ms avant d’envoyer `obs-assistant-height`.
- Forcer le reset scroll (`window.scrollTo`, `body.scrollTop`, `documentElement.scrollTop`) lors des changements internes.
- Envoyer `obs-assistant-page-change` à chaque changement de route.

2. Corriger l’assistant embed
- Remplacer la logique locale actuelle qui observe `#obs-embed-root` par une logique compatible avec le hook, pour éviter deux systèmes concurrents.
- Sur changement Form/étape (`phase`, `step`, `done`, `mode`), déclencher le reset scroll + message `obs-assistant-page-change`.
- Laisser le hook envoyer la hauteur finale après debounce.

3. Corriger l’accueil embed si nécessaire
- Supprimer/adapter la mesure locale de `#obs-embed-root` sur la home embed, car elle peut contredire la mesure globale `document.body`.
- Conserver uniquement les styles nécessaires au mode embed, sans accumulation de min-height/padding.

4. Validation
- Vérifier qu’aucune mesure ne repose encore sur `#obs-embed-root` pour la hauteur iframe.
- Vérifier qu’il n’y a pas de garde empêchant une baisse de hauteur.
- Vérifier que les messages `obs-assistant-page-change` et `obs-assistant-height` sont bien envoyés dans les cas embed.