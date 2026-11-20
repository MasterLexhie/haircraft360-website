import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "@/components/ui/primitives";

/** Page links for the admin lists: previous, first, nearby, last, next. Plain links, so they work without JavaScript. */
export function Pagination({
  label,
  page,
  pageCount,
  first,
  last,
  total,
  noun,
  hrefFor,
}: {
  /** For screen readers, for example "Bookings pages". */
  label: string;
  page: number;
  pageCount: number;
  first: number;
  last: number;
  total: number;
  /** What's being counted, for example "days". */
  noun?: string;
  hrefFor: (n: number) => string;
}) {
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter((n) => n === 1 || n === pageCount || Math.abs(n - page) <= 1);
  const item = "inline-flex min-h-10 min-w-10 items-center justify-center rounded-[var(--radius-control)] px-2 text-sm font-semibold tabular";
  return (
    <nav aria-label={label} className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-ink-2 tabular">
        Showing {first} to {last} of {total}
        {noun ? ` ${noun}` : ""}
      </p>
      {pageCount > 1 && (
        <ul className="flex flex-wrap items-center gap-1">
          <li>
            {page > 1 ? (
              <Link href={hrefFor(page - 1)} className={cx(item, "text-ink-2 hover:bg-surface")} aria-label="Previous page">
                <ChevronLeft aria-hidden className="size-4" />
              </Link>
            ) : (
              <span className={cx(item, "text-ink-3/50")} aria-hidden>
                <ChevronLeft className="size-4" />
              </span>
            )}
          </li>
          {pages.map((n, i) => (
            <li key={n} className="flex items-center gap-1">
              {i > 0 && n - pages[i - 1]! > 1 && (
                <span className="px-1 text-ink-3" aria-hidden>
                  …
                </span>
              )}
              <Link
                href={hrefFor(n)}
                aria-current={n === page ? "page" : undefined}
                aria-label={`Page ${n}`}
                className={cx(item, n === page ? "bg-accent text-on-accent" : "text-ink-2 hover:bg-surface")}
              >
                {n}
              </Link>
            </li>
          ))}
          <li>
            {page < pageCount ? (
              <Link href={hrefFor(page + 1)} className={cx(item, "text-ink-2 hover:bg-surface")} aria-label="Next page">
                <ChevronRight aria-hidden className="size-4" />
              </Link>
            ) : (
              <span className={cx(item, "text-ink-3/50")} aria-hidden>
                <ChevronRight className="size-4" />
              </span>
            )}
          </li>
        </ul>
      )}
    </nav>
  );
}
