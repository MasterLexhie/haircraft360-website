import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { TopbarSearch } from "@/components/admin/search/topbar-search";

export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** Tablet and desktop: plum bar with the logo, the search with its results dropdown, and the account. */
export function AdminTopBar({ name }: { name: string | null }) {
  return (
    <header className="on-night hidden h-14 shrink-0 items-center gap-4 bg-night px-4 text-on-night md:flex">
      <Link href="/admin" className="flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg">
        <Image src="/brand/logo-pink-full.webp" alt="" width={569} height={571} className="size-8" />
        <span className="text-[0.75rem] font-bold uppercase tracking-[0.18em]">
          Haircraft<span className="font-display text-[0.95rem] font-normal normal-case italic tracking-normal">360</span>
          <span className="sr-only"> admin home</span>
        </span>
      </Link>

      <Suspense fallback={<div className="mx-auto h-9 w-full max-w-[560px] flex-1 rounded-[10px] border border-on-night/20 bg-on-night/10" />}>
        <TopbarSearch />
      </Suspense>

      <Link href="/admin/account" className="flex h-10 shrink-0 items-center gap-2 rounded-[10px] bg-on-night/10 pl-1 pr-2.5 text-sm hover:bg-on-night/15">
        <span aria-hidden className="grid size-[30px] place-items-center rounded-lg bg-lilac text-xs font-bold text-night">{name ? initials(name) : ""}</span>
        <span className="max-lg:sr-only">{name ?? "Account"}</span>
        <span className="sr-only">, account</span>
      </Link>
    </header>
  );
}
