export interface IconProps {
  /** Rendered width/height in px. */
  size?: number;
  className?: string;
}

/** Glyph keys for the data-driven `<Icon name="…" />` component. */
export type IconName =
  | 'arrow-back'
  | 'search'
  | 'star'
  | 'star-outline'
  | 'trip-origin'
  | 'place'
  | 'history'
  | 'home'
  | 'work'
  | 'sliders'
  | 'swap-vert'
  | 'swap-horiz'
  | 'walk'
  | 'trophy'
  | 'bus'
  | 'light-rail'
  | 'train'
  | 'cable'
  | 'shuttle'
  | 'bike'
  | 'sparkle'
  | 'close'
  | 'expand-more'
  | 'map'
  | 'list'
  | 'my-location';

export interface NamedIconProps extends IconProps {
  name: IconName;
}
