"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { LogoLockup } from "./brand";
import { ButtonLink } from "@/components/ui/primitives";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/#services", label: "Services" },
  { href: "/#visit", label: "Visit" },
  { href: "/booking", label: "Find my booking" },
];

const linkClass =
  "inline-flex min-h-11 items-center px-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink-2 underline-offset-[10px] decoration-2 decoration-lilac hover:text-accent-text hover:underline aria-[current=page]:text-accent-text aria-[current=page]:underline";

function DesktopLinks({ pathname }: { pathname: string | null }) {
  return (
    <>
      {NAV.map((item) => (
        <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} className={linkClass}>
          {item.label}
        </Link>
      ))}
    </>
  );
}

function LiveDesktopLinks() {
  return <DesktopLinks pathname={usePathname()} />;
}

function BookCta({ hidden }: { hidden: boolean }) {
  if (hidden) return null;
  return (
    <ButtonLink href="/book" size="sm" className="px-3.5 sm:px-5">
      <span>Book<span className="hidden sm:inline"> now</span></span>
    </ButtonLink>
  );
}

/** Hides the header CTA while the visitor is already inside the booking flow. */
function LiveBookCta() {
  const pathname = usePathname();
  return <BookCta hidden={pathname === "/book"} />;
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 bg-surface shadow-[0_6px_18px_-12px_rgb(62_40_61/0.25)]">
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-20">
        <LogoLockup />

        <nav aria-label="Main" className="hidden items-center md:flex">
          <Suspense fallback={<DesktopLinks pathname={null} />}>
            <LiveDesktopLinks />
          </Suspense>
        </nav>

        <div className="flex items-center gap-2">
          <Suspense fallback={<BookCta hidden={false} />}>
            <LiveBookCta />
          </Suspense>
          <button
            ref={menuButton}
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-accent-text hover:bg-sand md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden className="size-6" /> : <Menu aria-hidden className="size-6" />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </div>

      <nav id="mobile-menu" aria-label="Main (mobile)" hidden={!open} className="border-t border-line bg-surface px-4 pb-5 pt-2 md:hidden">
        <ul className="divide-y divide-line">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center px-2 text-[0.8rem] font-semibold uppercase tracking-[0.16em] text-accent-text hover:bg-sand">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
