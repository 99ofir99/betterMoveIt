import type { Place, SearchResult } from '../../types';

export interface PlaceFieldProps {
  id: string;
  label: string;
  value: Place | null;
  placeholder: string;
  accent: 'origin' | 'destination';
  query: string;
  onQueryChange: (q: string) => void;
  results: SearchResult[];
  searchLoading: boolean;
  onPick: (place: Place) => void;
  onClear: () => void;
  onUseMyLocation?: () => void;
  locating?: boolean;
  recent: Place[];
}

export interface PlaceSuggestionRowProps {
  result: SearchResult;
  favored: boolean;
  onPick: () => void;
  onToggleFavorite: () => void;
}
