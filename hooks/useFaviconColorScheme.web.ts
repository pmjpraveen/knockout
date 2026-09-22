import { useEffect } from 'react';

const hrefFor = (dark: boolean) => (dark ? '/favicon-dark.png' : '/favicon-light.png');

/** Swaps the browser tab's favicon to match the OS/browser color scheme, and keeps it in sync as that changes. */
export function useFaviconColorScheme() {
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    // Chrome won't always redraw the tab icon from a mutated `href` on an existing <link> — replacing the
    // element outright is what reliably forces a repaint.
    const apply = () => {
      document.querySelectorAll('link[rel="icon"]').forEach((el) => el.remove());
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = hrefFor(query.matches);
      document.head.appendChild(link);
    };
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);
}
