/**
 * Lightweight screen stack so ← returns to the previous UI state.
 * Visual screens stay in App; this only tracks history entries.
 */

import { useCallback, useRef, useState } from 'react';

export type NavScreen =
  | 'home'
  | 'plan'
  | 'results'
  | 'detail'
  | 'search'
  | 'stop'
  | 'preferences'
  | 'live';

export function useNavHistory(initial: NavScreen = 'home') {
  const [current, setCurrent] = useState<NavScreen>(initial);
  const stackRef = useRef<NavScreen[]>([]);

  const push = useCallback((screen: NavScreen) => {
    setCurrent((prev) => {
      if (prev === screen) return prev;
      stackRef.current.push(prev);
      return screen;
    });
  }, []);

  const replace = useCallback((screen: NavScreen) => {
    setCurrent(screen);
  }, []);

  const back = useCallback((): NavScreen => {
    const prev = stackRef.current.pop() ?? 'home';
    setCurrent(prev);
    return prev;
  }, []);

  const canGoBack = stackRef.current.length > 0 || current !== 'home';

  const clear = useCallback(() => {
    stackRef.current = [];
    setCurrent('home');
  }, []);

  return { current, push, replace, back, canGoBack, clear, stackDepth: stackRef.current.length };
}
