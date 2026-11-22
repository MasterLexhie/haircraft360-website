"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { searchAction } from "@/app/admin/actions";
import type { AdminSearch, SearchBooking, SearchCustomer } from "@/server/admin-queries";
import { bookingStatusLabel, paymentSummaryLabel } from "@/domain/labels";
import type { PaymentSummaryState } from "@/domain/pricing";
import { formatPhone } from "@/domain/phone";
import { formatNaira } from "@/lib/money";
import { formatDayHeading, formatTime } from "@/lib/time";
import { cx } from "@/components/ui/primitives";

/* ───────────── Live results ───────────── */

/** Asks the server as the owner types, a moment after they pause. Older answers never overwrite newer ones. */
export function useAdminSearch(q: string, take: number): { data: AdminSearch | null; loading: boolean } {
  const needle = q.trim();
  const valid = needle.length >= 2;
  const [result, setResult] = useState<{ q: string; data: AdminSearch } | null>(null);
  const latest = useRef(0);
  useEffect(() => {
    if (!valid) return;
    const ticket = ++latest.current;
    const timer = setTimeout(async () => {
      let data: AdminSearch;
      try {
        data = await searchAction(needle, take);
      } catch {
        data = { customers: [], bookings: [], customerCount: 0, bookingCount: 0 };
      }
      if (ticket === latest.current) setResult({ q: needle, data });
    }, 220);
    return () => clearTimeout(timer);
  }, [needle, take, valid]);
  // While a new answer is on its way, the previous results stay on screen.
  return { data: valid ? (result?.data ?? null) : null, loading: valid && result?.q !== needle };
}

/* ───────────── Recent searches and recently opened (this browser only) ───────────── */

const RECENT_KEY = "hc360-admin-recent-searches";
const OPENED_KEY = "hc360-admin-recent-opened";

export interface OpenedItem {
  href: string;
  title: string;
  sub: string;
  kind: "customer" | "booking";
}

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, items: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {}
}

export function recentSearches(): string[] {
  return read<string>(RECENT_KEY).filter((s) => typeof s === "string");
}

export function rememberSearch(q: string) {
  const needle = q.trim();
  if (needle.length < 2) return;
  write(RECENT_KEY, [needle, ...recentSearches().filter((s) => s.toLowerCase() !== needle.toLowerCase())].slice(0, 5));
}

export function recentlyOpened(): OpenedItem[] {
  return read<OpenedItem>(OPENED_KEY).filter((o) => o && typeof o.href === "string" && o.href.startsWith("/admin/"));
}

export function rememberOpened(item: OpenedItem) {
  write(OPENED_KEY, [item, ...recentlyOpened().filter((o) => o.href !== item.href)].slice(0, 4));
}

export function customerItem(c: SearchCustomer): OpenedItem {
  return { href: `/admin/customers/${c.id}`, title: c.name, sub: `Customer · ${c.bookingCount} booking${c.bookingCount === 1 ? "" : "s"}`, kind: "customer" };
}

export function bookingItem(b: SearchBooking): OpenedItem {
  return { href: `/admin/bookings/${b.id}`, title: b.reference, sub: `${b.customerName} · ${formatDayHeading(b.startAt)}, ${formatTime(b.startAt)}`, kind: "booking" };
}

/**
 * The search text never goes in the address, so customer names and numbers stay out of browser
 * history. The search screen keeps it on its own history entry instead (history.state), so Back
 * from a result restores the results, while opening search afresh starts empty. The top bar
 * hands its text to the search screen once, through this tab's session storage.
 */
const STATE_KEY = "hc360AdminSearch";
const HANDOFF_KEY = "hc360-admin-search-handoff";

export function searchFromHistory(): string | null {
  const v = (window.history.state as Record<string, unknown> | null)?.[STATE_KEY];
  return typeof v === "string" ? v : null;
}

export function keepSearchInHistory(q: string) {
  window.history.replaceState({ ...(window.history.state ?? {}), [STATE_KEY]: q }, "");
}

export function handOffSearch(q: string) {
  try {
    sessionStorage.setItem(HANDOFF_KEY, q);
  } catch {}
}

export function takeHandOff(): string | null {
  try {
    const v = sessionStorage.getItem(HANDOFF_KEY);
    sessionStorage.removeItem(HANDOFF_KEY);
    return v;
  } catch {
    return null;
  }
}

/* ───────────── Rows ───────────── */

const toneText: Record<string, string> = { success: "text-success", warning: "text-warning", danger: "text-danger", info: "text-info", neutral: "text-ink-3", accent: "text-accent-text" };
const toneDot: Record<string, string> = { success: "bg-success", warning: "bg-warning", danger: "bg-danger", info: "bg-info", neutral: "bg-ink-3", accent: "bg-accent" };

/** Marks the typed words inside a result. */
export function Highlight({ text, q }: { text: string; q: string }): ReactNode {
  const needle = q.trim();
  if (needle.length < 2) return text;
  const i = text.toLowerCase().indexOf(needle.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-[3px] bg-lilac px-0.5 text-ink">{text.slice(i, i + needle.length)}</mark>
      {text.slice(i + needle.length)}
    </>
  );
}

function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function CustomerRow({ c, q, active, compact, onOpen }: { c: SearchCustomer; q: string; active?: boolean; compact?: boolean; onOpen: () => void }) {
  return (
    <Link
      href={`/admin/customers/${c.id}`}
      onClick={onOpen}
      className={cx("flex items-center gap-3 px-4 hover:bg-sand/50", compact ? "py-2" : "min-h-14 border-b border-accent-soft py-2.5", active && "bg-accent-soft")}
    >
      <span aria-hidden className={cx("grid shrink-0 place-items-center rounded-full bg-accent-soft font-bold text-accent-text", compact ? "size-8 text-xs" : "size-10 text-[0.8125rem]")}>{initials(c.name)}</span>
      <span className="min-w-0 flex-1">
        <span className={cx("block truncate font-semibold", compact && "text-[0.8125rem]")}><Highlight text={c.name} q={q} /></span>
        <span className="block truncate text-xs text-ink-3">
          {c.bookingCount} booking{c.bookingCount === 1 ? "" : "s"}
          {c.phone && <> · <Highlight text={formatPhone(c.phone)} q={q} /></>}
          {c.email && !compact && <> · <Highlight text={c.email} q={q} /></>}
        </span>
      </span>
      {!compact && <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />}
    </Link>
  );
}

export function BookingRow({ b, q, active, compact, onOpen }: { b: SearchBooking; q: string; active?: boolean; compact?: boolean; onOpen: () => void }) {
  const pay = paymentSummaryLabel[b.payment as PaymentSummaryState] ?? { label: "", tone: "neutral" };
  const status = bookingStatusLabel[b.status];
  if (compact) {
    return (
      <Link href={`/admin/bookings/${b.id}`} onClick={onOpen} className={cx("grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 text-[0.8125rem] hover:bg-sand/50", active && "bg-accent-soft")}>
        <span className="font-bold text-accent-text"><Highlight text={b.reference} q={q} /></span>
        <span className="truncate text-ink-2"><Highlight text={b.customerName} q={q} /> · {b.services}</span>
        <span className="whitespace-nowrap text-xs text-ink-3">{formatDayHeading(b.startAt)}, {formatTime(b.startAt)}</span>
      </Link>
    );
  }
  return (
    <Link href={`/admin/bookings/${b.id}`} onClick={onOpen} className="grid min-h-14 grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3 border-b border-accent-soft px-4 py-3 hover:bg-sand/40">
      <span>
        <span className="block whitespace-nowrap text-[0.7rem] text-ink-3">{formatDayHeading(b.startAt)}</span>
        <span className="block whitespace-nowrap text-[0.8125rem] font-bold tabular">{formatTime(b.startAt)}</span>
      </span>
      <span className="min-w-0">
        <span className="block font-semibold"><Highlight text={b.reference} q={q} /></span>
        <span className="block truncate text-xs text-ink-3"><Highlight text={b.customerName} q={q} /> · {b.services}</span>
        {b.status !== "confirmed" && <span className={cx("block text-[0.7rem] font-semibold", toneText[status.tone])}>{status.label}</span>}
      </span>
      <span className="text-right">
        <span className="block text-[0.8125rem] font-semibold tabular">{formatNaira(b.totalKobo)}</span>
        <span className={cx("inline-flex items-center gap-1 text-[0.7rem] font-semibold", toneText[pay.tone])}>
          <span aria-hidden className={cx("size-1.5 rounded-full", toneDot[pay.tone])} />
          {pay.label}
        </span>
      </span>
    </Link>
  );
}
