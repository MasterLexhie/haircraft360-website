import Link from "next/link";
import { FlaskConical, MapPin, Phone } from "lucide-react";
import { business, fullAddress, PREVIEW_MODE } from "@/config/business";
import { LogoLockup } from "./brand";

/** Discreet banner shown in preview builds. */
export function PreviewNotice() {
  if (!PREVIEW_MODE) return null;
  return (
    <div className="bg-sand-2 text-ink-2">
      <p className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2 text-[0.72rem] leading-snug sm:items-center sm:px-6">
        <FlaskConical aria-hidden className="mt-px size-3.5 shrink-0 text-accent-text sm:mt-0" />
        <span>
          <strong className="font-display text-[0.85rem] font-normal italic text-accent-text">Prototype preview.</strong> Contact details and hours come from a public
          listing and are awaiting owner confirmation. Services, prices and payments are demo only — no real money is taken.
        </span>
      </p>
    </div>
  );
}

export function SiteFooter() {
  const year = 2026;
  const linkCls = "inline-flex min-h-9 items-center text-on-night-2 hover:text-lilac";
  return (
    <footer className="on-night bg-accent text-on-night">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-12 pt-16 sm:px-6 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <LogoLockup tone="dark" />
          <p className="mt-5 max-w-xs font-display text-xl font-light leading-snug text-on-night">
            Loc care in Ibadan. <em className="text-lilac">Book online</em>, pay a small deposit, settle the rest after your appointment.
          </p>
        </div>

        <div>
          <h2 className="type-caps text-[0.72rem] text-lilac">Visit</h2>
          <ul className="mt-5 space-y-3 text-sm">
            <li className="flex gap-2.5">
              <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-lilac" />
              <span className="text-on-night-2">{fullAddress}</span>
            </li>
            <li className="flex gap-2.5">
              <Phone aria-hidden className="mt-0.5 size-4 shrink-0 text-lilac" />
              <a href={`tel:${business.phone.value.e164}`} className="text-on-night underline decoration-on-night/40 underline-offset-4 hover:decoration-lilac">
                {business.phone.value.display}
              </a>
            </li>
          </ul>
          {PREVIEW_MODE && <p className="mt-3 text-xs text-on-night-2">From a public listing · awaiting owner confirmation</p>}
        </div>

        <div>
          <h2 className="type-caps text-[0.72rem] text-lilac">Explore</h2>
          <ul className="mt-4 text-sm">
            <li><Link className={linkCls} href="/book">Book an appointment</Link></li>
            <li><Link className={linkCls} href="/#services">Services</Link></li>
            <li><Link className={linkCls} href="/#visit">Location &amp; hours</Link></li>
            <li><Link className={linkCls} href="/booking">Find my booking</Link></li>
          </ul>
          <p className="mt-5 text-xs text-on-night-2">
            Booking, deposit and cancellation terms will appear here once the owner approves them.
          </p>
        </div>
      </div>
      <div className="border-t border-on-night/15">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 pb-24 pt-5 text-xs text-on-night-2 sm:flex-row sm:items-center sm:justify-between sm:px-6 md:pb-5">
          <p>© {year} Haircraft360 · Prototype build, not a live booking site.</p>
          <Link href="/admin" className="inline-flex min-h-9 items-center hover:text-lilac">Salon admin (demo)</Link>
        </div>
      </div>
    </footer>
  );
}
