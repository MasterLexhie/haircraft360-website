"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { cx } from "@/components/ui/primitives";
import { BookingRow, CustomerRow, bookingItem, customerItem, rememberOpened, rememberSearch, useAdminSearch, type OpenedItem } from "./search-parts";

/**
 * Tablet and desktop: the top bar search. Results drop down as the owner types; arrow keys
 * move through them, Enter opens one (or the full search screen), Esc closes.
 */
export function TopbarSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const { data, loading } = useAdminSearch(q, 5);
  const needle = q.trim();

  // Close on navigation and on a click outside.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
    setQ("");
  }, [pathname]);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const items: { item: OpenedItem }[] = [...(data?.customers.map((c) => ({ item: customerItem(c) })) ?? []), ...(data?.bookings.map((b) => ({ item: bookingItem(b) })) ?? [])];
  const showPanel = open && needle.length >= 2;
  const allHref = `/admin/search?q=${encodeURIComponent(needle)}`;

  /** A result link was clicked: the link itself navigates. */
  const remember = (item: OpenedItem) => {
    rememberSearch(needle);
    rememberOpened(item);
    setOpen(false);
  };

  const go = (item: OpenedItem | null) => {
    rememberSearch(needle);
    if (item) rememberOpened(item);
    setOpen(false);
    input.current?.blur();
    router.push(item ? item.href : allHref);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      input.current?.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setCursor((c) => Math.min(c + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (needle.length >= 2) go(cursor >= 0 ? (items[cursor]?.item ?? null) : null);
    }
  };

  const customers = data?.customers ?? [];
  const bookings = data?.bookings ?? [];

  return (
    <>
      {showPanel && <div aria-hidden className="fixed inset-x-0 bottom-0 top-14 z-30 bg-ink/30" />}
      <div ref={box} role="search" className="relative z-40 mx-auto w-full max-w-[560px] flex-1">
        <label className={cx("flex h-9 w-full items-center gap-2 rounded-[10px] border px-3", showPanel ? "border-transparent bg-on-night text-ink-3 ring-[3px] ring-lilac" : "border-on-night/20 bg-on-night/10 text-on-night-2")}>
          <Search aria-hidden className="size-4 shrink-0" />
          <span className="sr-only">Search bookings and customers</span>
          <input
            ref={input}
            type="search"
            role="combobox"
            aria-expanded={showPanel}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={cursor >= 0 ? `${listId}-${cursor}` : undefined}
            autoComplete="off"
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); setCursor(-1); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search bookings, customers, references"
            className={cx("min-w-0 flex-1 bg-transparent text-sm focus:outline-none [&::-webkit-search-cancel-button]:hidden", showPanel ? "text-ink placeholder:text-ink-3" : "text-on-night placeholder:text-on-night-2")}
          />
          {showPanel && <kbd className="rounded-md bg-sand-2 px-1.5 py-0.5 font-sans text-[0.68rem] text-ink-2">Esc</kbd>}
        </label>

        {showPanel && (
          <div id={listId} role="listbox" aria-label="Search results" className="absolute inset-x-0 top-[46px] overflow-hidden rounded-[var(--radius)] bg-surface text-ink shadow-[0_18px_40px_-16px_rgb(62_40_61/0.45),0_2px_6px_rgb(62_40_61/0.08)]">
            {!data && loading && <p className="px-4 py-4 text-sm text-ink-3">Searching…</p>}
            {data && customers.length + bookings.length === 0 && <p className="px-4 py-4 text-sm text-ink-2">Nothing matches “{needle}”.</p>}
            {customers.length > 0 && (
              <>
                <h2 className="px-4 pb-1.5 pt-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ink-3">Customers</h2>
                {customers.map((c, i) => (
                  <div key={c.id} id={`${listId}-${i}`} role="option" aria-selected={cursor === i}>
                    <CustomerRow c={c} q={needle} compact active={cursor === i} onOpen={() => remember(customerItem(c))} />
                  </div>
                ))}
              </>
            )}
            {bookings.length > 0 && (
              <>
                <h2 className={cx("px-4 pb-1.5 pt-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ink-3", customers.length > 0 && "mt-1 border-t border-line")}>Bookings</h2>
                {bookings.map((b, i) => {
                  const n = customers.length + i;
                  return (
                    <div key={b.id} id={`${listId}-${n}`} role="option" aria-selected={cursor === n}>
                      <BookingRow b={b} q={needle} compact active={cursor === n} onOpen={() => remember(bookingItem(b))} />
                    </div>
                  );
                })}
              </>
            )}
            {data && data.customerCount + data.bookingCount > 0 && (
              <Link href={allHref} onClick={() => { rememberSearch(needle); setOpen(false); }} className="mt-1.5 flex items-center justify-between border-t border-line bg-sand/50 px-4 py-3 text-[0.8125rem] font-semibold text-accent-text hover:bg-sand">
                See all results for “{needle}”
                <span className="font-medium text-ink-3">
                  {data.customerCount} customer{data.customerCount === 1 ? "" : "s"} · {data.bookingCount} booking{data.bookingCount === 1 ? "" : "s"}
                </span>
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}
