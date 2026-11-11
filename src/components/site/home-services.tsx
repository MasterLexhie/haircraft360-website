"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Plus } from "lucide-react";
import type { Service } from "@/domain/types";
import { ServiceDemoTag, ServiceMeta } from "@/components/booking/service-bits";
import { Button, ButtonLink, cx } from "@/components/ui/primitives";
import { PhotoPlaceholder, StockPhoto } from "@/components/site/brand";
import { SERVICE_PHOTOS } from "@/config/stock-photos";

/** Service cards on the home page. Customers can pick several, then carry them into booking. */
export function HomeServices({ services, defaultDuration }: { services: Service[]; defaultDuration: number }) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const href = picked.length ? `/book?services=${picked.join(",")}` : "/book";

  return (
    <div>
      <ul className="grid gap-6 sm:grid-cols-2">
        {services.map((s, i) => {
          const on = picked.includes(s.id);
          return (
            <li key={s.id}>
              <article
                className={cx(
                  "group flex h-full flex-col bg-surface shadow-[var(--shadow-sm)] outline-2 -outline-offset-2 transition-[outline-color,box-shadow]",
                  on ? "shadow-[var(--shadow-md)] outline outline-accent" : "outline-transparent hover:shadow-[var(--shadow-md)]",
                )}
              >
                <h3 className="type-caps flex min-h-16 items-center justify-center bg-sand-2 px-5 py-4 text-center text-[0.85rem] leading-snug text-accent-text sm:text-[0.95rem]">
                  {s.name}
                </h3>
                {SERVICE_PHOTOS[s.id] ? (
                  <StockPhoto photo={SERVICE_PHOTOS[s.id]} ratio="16/9" sizes="(min-width: 640px) 50vw, 100vw" className="rounded-none" />
                ) : (
                  <PhotoPlaceholder label="service photo" ratio="16/9" className="rounded-none" />
                )}
                <div className="flex flex-1 flex-col px-5 pb-6 pt-5 sm:px-7">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-display text-lg italic text-accent-text tabular">{String(i + 1).padStart(2, "0")}</span>
                    <ServiceDemoTag service={s} />
                  </div>
                  <p className="mt-2 flex-1 text-ink-2">{s.description}</p>
                  <div className="mt-5 border-t border-line pt-4">
                    <ServiceMeta service={s} defaultDuration={defaultDuration} />
                  </div>
                  <Button
                    type="button"
                    variant={on ? "primary" : "secondary"}
                    onClick={() => toggle(s.id)}
                    aria-pressed={on}
                    className="mt-5 w-full"
                  >
                    {on ? <Check aria-hidden className="size-4" /> : <Plus aria-hidden className="size-4" />}
                    {on ? "Added to booking" : "Add to booking"}
                    <span className="sr-only">: {s.name}</span>
                  </Button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      <div className="mt-10 flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-ink-2" aria-live="polite">
          {picked.length === 0
            ? "Pick one or more services, or choose them as you book."
            : `${picked.length} service${picked.length > 1 ? "s" : ""} selected.`}
        </p>
        <ButtonLink href={href} size="lg">
          {picked.length ? "Continue to choose a time" : "Book an appointment"}
          <ArrowRight aria-hidden className="size-4" />
        </ButtonLink>
      </div>
      <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-ink-3">
        Every service and price above is a <strong className="font-semibold text-ink-2">demo placeholder</strong> until
        Haircraft360 approves its real menu. <Link href="/book" className="underline">Booking</Link> shows the full estimate before any (simulated) payment.
      </p>
    </div>
  );
}
