/**
 * Marks every page of the staging copy, so test data is never mistaken for real: a thin stripe
 * along the top and a small tab on the right edge, both placed where they cover no content.
 */
export function StagingMark() {
  return (
    <div role="note" aria-label="Staging copy: test data only" className="pointer-events-none">
      <div aria-hidden className="fixed inset-x-0 top-0 z-[60] h-1 bg-warning" />
      <div
        aria-hidden
        className="fixed right-0 top-28 z-[60] rounded-l-[var(--radius-control)] bg-warning px-0.5 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-on-night [writing-mode:vertical-rl]"
      >
        Staging
      </div>
    </div>
  );
}
