"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Search, X } from "lucide-react";
import { cx } from "@/components/ui/primitives";
import {
  BookingRow,
  CustomerRow,
  bookingItem,
  customerItem,
  recentSearches,
  recentlyOpened,
  rememberOpened,
  rememberSearch,
  useAdminSearch,
  type OpenedItem,
} from "./search-parts";

type Scope = "all" | "customers" | "bookings";

/**
 * The search screen (/admin/search). On a phone the search box takes over the plum header;
 * the back arrow returns to the page the owner came from. Results arrive as they type.
 */
export function SearchScreen({ initialQ }: { initialQ: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [scope, setScope] = useState<Scope>("all");
  const [recent, setRecent] = useState<string[]>([]);
  const [opened, setOpened] = useState<OpenedItem[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const { data, loading } = useAdminSearch(q, 20);

  useEffect(() => {
    // Browser-only lists, read after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(recentSearches());
    setOpened(recentlyOpened());
  }, []);

  // Keep ?q= in the address so Back from a result returns to the same results.
  useEffect(() => {
    const url = q.trim() ? `/admin/search?q=${encodeURIComponent(q.trim())}` : "/admin/search";
    window.history.replaceState(window.history.state, "", url);
  }, [q]);

  const back = () => {
    if (window.history.length > 1) router.back();
    else router.push("/admin");
  };

  const open = (item: OpenedItem) => {
    rememberSearch(q);
    rememberOpened(item);
  };

  const needle = q.trim();
  const showCustomers = scope !== "bookings" && !!data?.customers.length;
  const showBookings = scope !== "customers" && !!data?.bookings.length;
  const nothing = data && data.customerCount + data.bookingCount === 0;

  return (
    <div className="-mx-4 md:mx-auto md:max-w-2xl">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          rememberSearch(q);
          setRecent(recentSearches());
          input.current?.blur();
        }}
        className="on-night flex items-center gap-2.5 bg-night px-4 pb-3 text-on-night md:mb-4 md:rounded-[var(--radius)] md:p-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <button type="button" onClick={back} className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-on-night/10 hover:bg-on-night/15">
          <ChevronLeft aria-hidden className="size-[18px]" />
          <span className="sr-only">Close search</span>
        </button>
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[10px] bg-on-night pl-3 pr-1.5 text-ink-3 ring-[3px] ring-lilac">
          <Search aria-hidden className="size-4 shrink-0" />
          <span className="sr-only">Search bookings and customers</span>
          <input
            ref={input}
            type="search"
            enterKeyHint="search"
            autoFocus
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, phone, email or reference"
            className="min-w-0 flex-1 bg-transparent text-[0.9375rem] text-ink placeholder:text-ink-3 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <button type="button" onClick={() => { setQ(""); input.current?.focus(); }} className="grid size-8 shrink-0 place-items-center rounded-lg bg-sand-2 text-ink-2">
              <X aria-hidden className="size-3.5" />
              <span className="sr-only">Clear search</span>
            </button>
          )}
        </label>
      </form>

      {needle.length < 2 ? (
        <div className="space-y-5 px-4 pt-4 md:px-0">
          {recent.length > 0 && (
            <section aria-labelledby="recent-searches">
              <h2 id="recent-searches" className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ink-3">Recent searches</h2>
              <div className="flex flex-wrap gap-2">
                {recent.map((r) => (
                  <button key={r} type="button" onClick={() => setQ(r)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-[0.8125rem] hover:bg-sand">
                    <Clock aria-hidden className="size-3.5 text-ink-3" /> {r}
                  </button>
                ))}
              </div>
            </section>
          )}
          {opened.length > 0 && (
            <section aria-labelledby="recent-opened">
              <h2 id="recent-opened" className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ink-3">Recently opened</h2>
              <ul className="divide-y divide-accent-soft overflow-hidden rounded-[var(--radius)] bg-surface shadow-[var(--shadow-admin-card)]">
                {opened.map((o) => (
                  <li key={o.href}>
                    <Link href={o.href} className="flex min-h-14 items-center gap-3 px-3.5 py-2 hover:bg-sand/40">
                      <span aria-hidden className={cx("grid size-[34px] shrink-0 place-items-center bg-accent-soft text-accent-text", o.kind === "customer" ? "rounded-full" : "rounded-[9px]")}>
                        {o.kind === "customer" ? <span className="text-xs font-bold">{o.title.slice(0, 1).toUpperCase()}</span> : <CalendarDays className="size-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{o.title}</span>
                        <span className="block truncate text-xs text-ink-3">{o.sub}</span>
                      </span>
                      <ChevronRight aria-hidden className="size-4 text-ink-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="rounded-[var(--radius)] bg-sand p-3.5 text-xs leading-relaxed text-ink-2 md:bg-surface md:shadow-[var(--shadow-admin-card)]">
            Finds customers and bookings, past ones too. Try a name, a phone number like 0803 555 0781, an email, or a reference like HC-B2JDC.
          </p>
        </div>
      ) : (
        <div className="bg-surface md:overflow-hidden md:rounded-[var(--radius)] md:shadow-[var(--shadow-admin-card)]">
          <div className="flex gap-2 border-b border-line px-4 pb-2.5 pt-3" role="group" aria-label="Show">
            {([
              { id: "all", label: "All", count: (data?.customerCount ?? 0) + (data?.bookingCount ?? 0) },
              { id: "customers", label: "Customers", count: data?.customerCount ?? 0 },
              { id: "bookings", label: "Bookings", count: data?.bookingCount ?? 0 },
            ] as const).map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={scope === s.id}
                onClick={() => setScope(s.id)}
                className={cx("min-h-[34px] rounded-full border px-3.5 text-[0.8125rem] font-semibold", scope === s.id ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-surface text-ink")}
              >
                {s.label} <span className="font-medium opacity-80">{data ? s.count : ""}</span>
              </button>
            ))}
          </div>

          <div aria-live="polite" className="sr-only">
            {loading ? "Searching" : data ? `${data.customerCount} customers and ${data.bookingCount} bookings found` : ""}
          </div>

          {!data && loading && <p className="px-4 py-6 text-sm text-ink-3">Searching…</p>}
          {nothing && <p className="px-4 py-8 text-center text-sm text-ink-2">Nothing matches “{needle}”. Check the spelling, or try a phone number or reference.</p>}

          {showCustomers && (
            <section aria-labelledby="found-customers">
              <SectionTitle id="found-customers" title="Customers" count={data!.customerCount} />
              <ul>
                {data!.customers.map((c) => (
                  <li key={c.id}><CustomerRow c={c} q={needle} onOpen={() => open(customerItem(c))} /></li>
                ))}
              </ul>
              {data!.customerCount > data!.customers.length && <SeeAll href={`/admin/customers?q=${encodeURIComponent(needle)}`} label={`See all ${data!.customerCount} customers`} />}
            </section>
          )}

          {showBookings && (
            <section aria-labelledby="found-bookings">
              <SectionTitle id="found-bookings" title="Bookings" count={data!.bookingCount} />
              <ul>
                {data!.bookings.map((b) => (
                  <li key={b.id}><BookingRow b={b} q={needle} onOpen={() => open(bookingItem(b))} /></li>
                ))}
              </ul>
              <SeeAll href={`/admin/bookings?q=${encodeURIComponent(needle)}&when=all`} label={`See ${data!.bookingCount === 1 ? "it" : `all ${data!.bookingCount}`} in the Bookings list`} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ id, title, count }: { id: string; title: string; count: number }) {
  return (
    <h2 id={id} className="flex justify-between px-4 pb-1.5 pt-3.5 text-xs font-bold uppercase tracking-[0.12em] text-accent-text">
      {title}
      <span className="font-medium normal-case tracking-normal text-ink-3">{count} found</span>
    </h2>
  );
}

function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mx-4 my-3 flex min-h-11 items-center justify-center rounded-[10px] border border-line-strong text-[0.8125rem] font-semibold hover:bg-sand">
      {label}
    </Link>
  );
}
