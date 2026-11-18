import { Clock, Tag } from "lucide-react";
import type { Service } from "@/domain/types";
import { formatNaira } from "@/lib/money";
import { formatDuration } from "@/lib/time";

/** Price and duration line for a service card. */
export function ServiceMeta({ service }: { service: Pick<Service, "priceKobo" | "durationMinutes"> }) {
  return (
    <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-2">
      <div className="flex items-center gap-1.5">
        <dt><Tag aria-hidden className="size-4 text-ink-3" /><span className="sr-only">Price</span></dt>
        <dd className="tabular font-semibold text-ink">{formatNaira(service.priceKobo)}</dd>
      </div>
      <div className="flex items-center gap-1.5">
        <dt><Clock aria-hidden className="size-4 text-ink-3" /><span className="sr-only">Estimated duration</span></dt>
        <dd>About {formatDuration(service.durationMinutes)}</dd>
      </div>
    </dl>
  );
}
