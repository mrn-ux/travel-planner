/** Faro wayfinding mark: a compass ring with a needle, drawn in the accent colour. */
export function Mark({ large = false }: { large?: boolean }) {
  return (
    <svg
      className={`text-accent ${large ? 'size-mark-lg' : 'size-mark'}`}
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="9.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 4.5l2.6 6.5L11 17.5 8.4 11z" fill="currentColor" />
    </svg>
  );
}
