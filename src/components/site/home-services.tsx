"use client";

import { useState } from "react";
import { ArrowRight, Check, Plus } from "lucide-react";
import type { Service } from "@/domain/types";
import { ServiceMeta } from "@/components/booking/service-bits";
import { Button, ButtonLink, cx } from "@/components/ui/primitives";
import { PhotoPlaceholder, StockPhoto } from "@/components/site/brand";
import { SERVICE_PHOTOS } from "@/config/stock-photos";

/** Service cards on the home page. The customer picks one main service and carries it into booking. */
export function HomeServices({ services }: { services: Service[] }) {
  const [picked, setPicked] = useState<string | null>(null);
  const toggle = (id: string) => setPicked((p) => (p === id ? null : id));
  const href = picked ? `/book?service=${picked}` : "/book";

  return (
    <div>
      <ul className="grid gap-6 sm:grid-cols-2">
        {services.map((s, i) => {
          const on = picked === s.id;
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
                  </div>
                  <p className="mt-2 flex-1 text-ink-2">{s.description}</p>
                  <div className="mt-5 border-t border-line pt-4">
                    <ServiceMeta service={s} />
                  </div>
                  <Button
                    type="button"
                    variant={on ? "primary" : "secondary"}
                    onClick={() => toggle(s.id)}
                    aria-pressed={on}
                    className="mt-5 w-full"
                  >
                    {on ? <Check aria-hidden className="size-4" /> : <Plus aria-hidden className="size-4" />}
                    {on ? "Selected" : "Choose this service"}
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
          {picked ? "Service selected. Add extras on the next step." : "Pick a service, or choose it as you book."}
        </p>
        <ButtonLink href={href} size="lg">
          {picked ? "Continue to booking" : "Book an appointment"}
          <ArrowRight aria-hidden className="size-4" />
        </ButtonLink>
      </div>
    </div>
  );
}
