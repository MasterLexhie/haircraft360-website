import Link from "next/link";
import { Suspense } from "react";
import { MapPin, Phone } from "lucide-react";
import { getSalon } from "@/server/queries";
import { LogoLockup } from "./brand";
import { SocialIcon } from "./social-icons";

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
          <Suspense fallback={null}>
            <SocialLinks />
          </Suspense>
        </div>

        <div>
          <h2 className="type-caps text-[0.72rem] text-lilac">Visit</h2>
          <Suspense fallback={<div className="mt-5 h-16" />}>
            <FooterVisit />
          </Suspense>
        </div>

        <div>
          <h2 className="type-caps text-[0.72rem] text-lilac">Explore</h2>
          <ul className="mt-4 text-sm">
            <li><Link className={linkCls} href="/book">Book an appointment</Link></li>
            <li><Link className={linkCls} href="/#services">Services</Link></li>
            <li><Link className={linkCls} href="/#visit">Location &amp; hours</Link></li>
            <li><Link className={linkCls} href="/booking">Find my booking</Link></li>
            <li><Link className={linkCls} href="/terms">Booking terms</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-on-night/15">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 pb-24 pt-5 text-xs text-on-night-2 sm:flex-row sm:items-center sm:justify-between sm:px-6 md:pb-5">
          <p>© {year} Haircraft360</p>
          <Link href="/admin" className="inline-flex min-h-9 items-center hover:text-lilac">Salon admin</Link>
        </div>
      </div>
    </footer>
  );
}

async function FooterVisit() {
  const salon = await getSalon();
  return (
    <ul className="mt-5 space-y-3 text-sm">
      {salon.address && (
        <li className="flex gap-2.5">
          <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-lilac" />
          <span className="text-on-night-2">{salon.address}</span>
        </li>
      )}
      {salon.phone && (
        <li className="flex gap-2.5">
          <Phone aria-hidden className="mt-0.5 size-4 shrink-0 text-lilac" />
          <a href={`tel:${salon.phone.e164}`} className="text-on-night underline decoration-on-night/40 underline-offset-4 hover:decoration-lilac">
            {salon.phone.display}
          </a>
        </li>
      )}
    </ul>
  );
}

/** Social icons for the profiles the owner has added in Settings. None added: nothing shown. */
async function SocialLinks() {
  const salon = await getSalon();
  if (salon.social.length === 0) return null;
  return (
    <div className="mt-7">
      <h2 className="type-caps text-[0.72rem] text-lilac">Follow</h2>
      <ul className="mt-3 flex flex-wrap gap-2.5">
        {salon.social.map((s) => (
          <li key={s.platform}>
            <a
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${salon.name} on ${s.label} (opens in a new tab)`}
              className="grid size-11 place-items-center rounded-full border border-on-night/30 text-on-night transition-colors hover:border-lilac hover:bg-lilac hover:text-night"
            >
              <SocialIcon platform={s.platform} className="size-[18px]" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
