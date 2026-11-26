import type { LinesSearchBarProps } from './types';
import { SearchIcon } from '../shared/icons';

export function LinesSearchBar({ value, onChange }: LinesSearchBarProps) {
  return (
    <div className="lines-search">
      <input
        type="search"
        className="lines-search__input"
        placeholder="Search for a line"
        aria-label="Search for a line"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir="auto"
      />
      <span className="lines-search__icon" aria-hidden="true">
        <SearchIcon size={20} />
      </span>
    </div>
  );
}
