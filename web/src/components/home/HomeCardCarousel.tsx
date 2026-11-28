/**
 * HomeCardCarousel — horizontally swipeable home cards with page dots (Moovit).
 * Native scroll-snap; the dots follow the scroll position and jump on tap.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '../../lib/i18n';

export function HomeCardCarousel({ cards }: { cards: ReactNode[] }) {
  const items = cards.filter(Boolean);
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  /** Height of the card in view: a short card must not stretch to the tallest one. */
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const slide = track.children[Math.min(active, track.children.length - 1)] as
        | HTMLElement
        | undefined;
      const card = slide?.firstElementChild as HTMLElement | null | undefined;
      if (card) setHeight(card.offsetHeight);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    for (const slide of Array.from(track.children)) {
      if (slide.firstElementChild) ro.observe(slide.firstElementChild);
    }
    return () => ro.disconnect();
  }, [active, items.length]);

  if (items.length === 0) return null;

  const onScroll = () => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    // scrollLeft is negative in RTL; the magnitude gives the page either way.
    setActive(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
  };

  const goTo = (i: number) => {
    const slide = trackRef.current?.children[i] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  };

  return (
    <div className="home-card-band">
      <div
        className="home-card-track"
        ref={trackRef}
        onScroll={onScroll}
        style={height != null ? { height } : undefined}
      >
        {items.map((card, i) => (
          <div className="home-card-slide" key={i}>
            {card}
          </div>
        ))}
      </div>
      {items.length > 1 ? (
        <div className="home-card-dots" role="tablist" aria-label={t('Cards')}>
          {items.map((_, i) => (
            <button
              type="button"
              key={i}
              role="tab"
              aria-selected={i === active}
              aria-label={t('Card {n}', { n: i + 1 })}
              className={`home-card-dots__dot${i === active ? ' is-active' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      ) : (
        <div className="home-card-dots" aria-hidden="true">
          <span className="home-card-dots__dot is-active" />
        </div>
      )}
    </div>
  );
}
