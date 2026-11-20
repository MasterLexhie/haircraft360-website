import { Suspense } from "react";
import { getSalon } from "@/server/queries";

/**
 * The salon's phone from Settings as a tap-to-call link, for "call us" lines. Falls back to
 * plain words when no number is set. Streams in, so the rest of the page doesn't wait.
 */
export function SalonPhone({ className = "font-semibold underline", fallback = "the salon" }: { className?: string; fallback?: string }) {
  return (
    <Suspense fallback={<span>{fallback}</span>}>
      <SalonPhoneLink className={className} fallback={fallback} />
    </Suspense>
  );
}

async function SalonPhoneLink({ className, fallback }: { className: string; fallback: string }) {
  const { phone } = await getSalon();
  if (!phone) return <span>{fallback}</span>;
  return (
    <a className={className} href={`tel:${phone.e164}`}>
      {phone.display}
    </a>
  );
}
