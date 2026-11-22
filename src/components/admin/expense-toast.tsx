"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { newExpenseHref } from "@/domain/finance-nav";
import { formatNaira } from "@/lib/money";

/**
 * "Expense added" after a save. The form leaves a note in this tab's session storage rather
 * than in the address, so a reload or a shared link never shows it again. The new expense's
 * row, when it is on screen, is marked for a moment.
 */
const KEY = "hc360-expense-added";

export interface AddedExpense {
  id: string;
  amountKobo: number;
  categoryName: string;
}

export function noteExpenseAdded(e: AddedExpense) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(e));
  } catch {}
}

function takeNote(): AddedExpense | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    const v = raw ? (JSON.parse(raw) as AddedExpense) : null;
    return v && typeof v.id === "string" && typeof v.amountKobo === "number" && typeof v.categoryName === "string" ? v : null;
  } catch {
    return null;
  }
}

export function ExpenseAddedToast({ back }: { back: string }) {
  const [added, setAdded] = useState<AddedExpense | null>(null);

  useEffect(() => {
    const note = takeNote();
    if (!note) return;
    // Session storage is browser-only, so the note is read after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAdded(note);
    const row = document.querySelector<HTMLElement>(`[data-expense-id="${CSS.escape(note.id)}"]`);
    row?.setAttribute("data-fresh", "");
    const timer = setTimeout(() => setAdded(null), 8000);
    const unmark = setTimeout(() => row?.removeAttribute("data-fresh"), 4000);
    return () => {
      clearTimeout(timer);
      clearTimeout(unmark);
    };
  }, []);

  if (!added) return null;
  return (
    <div
      role="status"
      className="on-night flex items-center gap-3 rounded-[var(--radius)] bg-night px-3.5 py-3 text-on-night shadow-[0_18px_40px_-16px_rgb(62_40_61/0.6)] max-md:absolute max-md:inset-x-4 max-md:bottom-full max-md:mb-2 md:fixed md:bottom-6 md:right-6 md:z-40 md:w-[420px]"
    >
      <CheckCircle2 aria-hidden className="size-5 shrink-0 text-lilac" />
      <p className="min-w-0 flex-1 text-[0.8125rem] leading-snug">
        <span className="block font-semibold">Expense added</span>
        <span className="line-clamp-2 block text-on-night-2">
          {formatNaira(added.amountKobo)} · {added.categoryName}
        </span>
      </p>
      <Link href={newExpenseHref(back)} className="shrink-0 rounded-lg bg-on-night/12 px-3 py-2 text-[0.8125rem] font-semibold hover:bg-on-night/20">
        Add another
      </Link>
      <button type="button" onClick={() => setAdded(null)} className="grid size-8 shrink-0 place-items-center rounded-lg text-on-night-2 hover:bg-on-night/10">
        <X aria-hidden className="size-4" />
        <span className="sr-only">Dismiss</span>
      </button>
    </div>
  );
}
