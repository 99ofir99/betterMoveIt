/**
 * "A ↔ B" line endpoints with a drawn two-way arrow instead of the ↔ glyph,
 * which most fonts draw small and low next to Hebrew text.
 */

export function LineEndpoints({ text }: { text: string }) {
  const parts = text.split(' ↔ ');
  if (parts.length !== 2) return <>{text}</>;
  return (
    <>
      <span>{parts[0]}</span>
      <svg
        className="line-endpoints__arrow"
        width="16"
        height="12"
        viewBox="0 0 16 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label="↔"
        role="img"
      >
        <path d="M1.5 6h13M4.5 2.5 1 6l3.5 3.5M11.5 2.5 15 6l-3.5 3.5" />
      </svg>
      <span>{parts[1]}</span>
    </>
  );
}
