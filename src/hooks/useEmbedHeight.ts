import { useEffect } from 'react';
import { useRouterState } from '@tanstack/react-router';

export function useEmbedHeight() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const isEmbed = params.get('embed') === '1';
    if (!isEmbed) return;

    document.documentElement.classList.add('embed-mode');

    let timeoutId: number | null = null;
    let lastSent = 0;

    const sendHeight = () => {
      if (timeoutId) window.clearTimeout(timeoutId);

      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        const height = document.body.scrollHeight;

        // Toujours envoyer si la hauteur diminue (retour arrière dans un Form),
        // sinon ignorer les micro-variations.
        if (height >= lastSent && Math.abs(height - lastSent) < 4) return;

        lastSent = height;
        window.parent.postMessage({ type: 'obs-assistant-height', height }, '*');
      }, 100);
    };

    const resetForPageChange = () => {
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      lastSent = 0;
      window.parent.postMessage({ type: 'obs-assistant-page-change' }, '*');
      sendHeight();
    };

    sendHeight();

    const resizeObserver = new ResizeObserver(() => sendHeight());
    resizeObserver.observe(document.body);

    const mutationObserver = new MutationObserver(() => sendHeight());
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    window.addEventListener('resize', sendHeight);

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'obs-assistant-request-height') sendHeight();
    };
    window.addEventListener('message', handleMessage);

    const handlePageChange = () => resetForPageChange();
    window.addEventListener('obs-assistant-page-change', handlePageChange);

    let ticks = 0;
    const interval = setInterval(() => {
      sendHeight();
      if (++ticks > 10) clearInterval(interval);
    }, 500);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', sendHeight);
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('obs-assistant-page-change', handlePageChange);
      clearInterval(interval);
      if (timeoutId) window.clearTimeout(timeoutId);
      document.documentElement.classList.remove('embed-mode');
    };
  }, []);

  // À chaque changement de route, signaler un page-change au parent
  // et reset le scroll pour éviter l'accumulation de hauteur.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('embed') !== '1') return;
    window.dispatchEvent(new Event('obs-assistant-page-change'));
  }, [pathname]);
}