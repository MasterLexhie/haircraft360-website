import Link from "next/link";
import { Suspense } from "react";
import { MapPin, MessageCircle, Phone } from "lucide-react";
import { getSalon } from "@/server/queries";
import { LogoLockup } from "./brand";
import { SocialIcon } from "./social-icons";

const linkCls = "inline-flex min-h-9 items-center text-on-night-2 hover:text-lilac";
const headCls = "text-[0.9rem] font-bold text-on-night";

export function SiteFooter() {
  const year = 2026;
  return (
    <footer className="on-night bg-dusk-deep text-on-night-2">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 pb-10 pt-12 text-sm sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:px-12">
        <div>
          <LogoLockup />
          <Suspense fallback={null}>
            <SocialLinks />
          </Suspense>
        </div>

        <div>
          <h2 className={headCls}>Salon</h2>
          <ul className="mt-2">
            <li><Link className={linkCls} href="/#services">Locs and more</Link></li>
            <li><Link className={linkCls} href="/#work">Our work</Link></li>
            <li><Link className={linkCls} href="/locs-mastery">Locs Mastery</Link></li>
          </ul>
        </div>

        <div>
          <h2 className={headCls}>Your booking</h2>
          <ul className="mt-2">
            <li><Link className={linkCls} href="/book">Book a visit</Link></li>
            <li><Link className={linkCls} href="/booking">Find my booking</Link></li>
            <li><Link className={linkCls} href="/terms">Booking terms</Link></li>
          </ul>
        </div>

        <div>
          <h2 className={headCls}>Contact</h2>
          <Suspense fallback={<div className="mt-3 h-16" />}>
            <FooterContact />
          </Suspense>
        </div>
      </div>
      <div className="border-t border-on-night/10">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-2 px-4 pb-28 pt-5 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6 md:pb-5 lg:px-12">
          <p>© {year} Haircraft360</p>
          <Link href="/admin" className="inline-flex min-h-9 items-center hover:text-lilac">Salon admin</Link>
        </div>
      </div>
    </footer>
  );
}

async function FooterContact() {
  const salon = await getSalon();
  return (
    <ul className="mt-3 space-y-3">
      {salon.address && (
        <li className="flex gap-2.5">
          <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-lilac" />
          <span>{salon.address}</span>
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
      {salon.whatsapp && (
        <li className="flex gap-2.5">
          <MessageCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-lilac" />
          <a href={`https://wa.me/${salon.whatsapp.e164.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-on-night underline decoration-on-night/40 underline-offset-4 hover:decoration-lilac">
            WhatsApp {salon.whatsapp.display}
            <span className="sr-only"> (opens in a new tab)</span>
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
    <ul className="mt-6 flex flex-wrap gap-2.5" aria-label="Follow the salon">
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
  );
}
