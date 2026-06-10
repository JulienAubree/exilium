import { useEffect } from 'react';
import { useIsQuart } from '@/stores/theme.store';

/**
 * Applique le thème lab sur <html> et charge la fonte de donnée à la demande
 * (IBM Plex Mono, ~50 Ko, seulement quand Quart de nuit est actif — les
 * joueurs hors lab ne la téléchargent jamais).
 */
export function useThemeManager() {
  const isQuart = useIsQuart();

  useEffect(() => {
    document.documentElement.classList.toggle('theme-quart', isQuart);
    if (isQuart) {
      void import('@fontsource/ibm-plex-mono/400.css');
      void import('@fontsource/ibm-plex-mono/500.css');
    }
    return () => {
      document.documentElement.classList.remove('theme-quart');
    };
  }, [isQuart]);
}
