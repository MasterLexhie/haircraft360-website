import { Clock, Tag } from "lucide-react";
import type { Service } from "@/domain/types";
import { formatNaira } from "@/lib/money";
import { formatDuration } from "@/lib/time";
import { DemoTag } from "@/components/ui/primitives";

export function servicePriceLabel(s: Pick<Service, "priceKobo">): string {
  return s.priceKobo === null ? "Price confirmed at appointment" : formatNaira(s.priceKobo);
}

/** Price + duration line. Demo values are always tagged as such. */
export function ServiceMeta({ service, defaultDuration }: { service: Service; defaultDuration: number }) {
  const isDemo = service.status === "demo";
  return (
    <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-2">
      <div className="flex items-center gap-1.5">
        <dt><Tag aria-hidden className="size-4 text-ink-3" /><span className="sr-only">Price</span></dt>
        <dd className="tabular font-semibold text-ink">
          {servicePriceLabel(service)}
          {isDemo && service.priceKobo !== null && <span className="ml-1 font-normal text-ink-3">(demo price)</span>}
        </dd>
      </div>
      <div className="flex items-center gap-1.5">
        <dt><Clock aria-hidden className="size-4 text-ink-3" /><span className="sr-only">Estimated duration</span></dt>
        <dd>
          {service.durationMinutes ? `About ${formatDuration(service.durationMinutes)}` : `Up to ${formatDuration(defaultDuration)} reserved`}
          {isDemo && <span className="ml-1 text-ink-3">(demo estimate)</span>}
        </dd>
      </div>
    </dl>
  );
}

export function ServiceDemoTag({ service }: { service: Pick<Service, "status"> }) {
  return service.status === "demo" ? <DemoTag>Demo service</DemoTag> : null;
}
