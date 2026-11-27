/**
 * Android / browser Back for an app without a router.
 *
 * While the app has somewhere to go back to, one extra history entry is kept on
 * top. The system Back pops it, we run the in-app back step, and push it again if
 * there is still somewhere to go. On the root screen there is no extra entry, so
 * Back leaves the app as usual (Moovit).
 */

import { useEffect, useRef, useState } from 'react';

const MARK = { bmiBack: true };

export function useBackTrap(canGoBack: boolean, onBack: () => void): void {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  /** True while our extra entry is on top of the history stack. */
  const trapped = useRef(false);
  /** Our own history.back() (removing the entry) must not run a back step. */
  const ignoreNextPop = useRef(false);
  const [pops, setPops] = useState(0);

  useEffect(() => {
    const onPop = () => {
      if (ignoreNextPop.current) {
        ignoreNextPop.current = false;
        return;
      }
      if (!trapped.current) return;
      trapped.current = false;
      onBackRef.current();
      setPops((n) => n + 1);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (canGoBack && !trapped.current) {
      window.history.pushState(MARK, '');
      trapped.current = true;
    } else if (!canGoBack && trapped.current) {
      // Back to the root through the app's own buttons: drop the extra entry.
      trapped.current = false;
      ignoreNextPop.current = true;
      window.history.back();
    }
  }, [canGoBack, pops]);
}
