import type { Metadata } from "next";
import Image from "next/image";
import { SalonPhone } from "@/components/site/salon-phone";
import { ButtonLink } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-sand/60 px-4 py-16">
      <div className="max-w-md text-center">
        <Image src="/brand/logo-pink-full.webp" alt="Haircraft360" width={569} height={571} className="mx-auto size-20" />
        <h1 className="type-display mt-6 text-[2.4rem]">We can&apos;t find that page</h1>
        <p className="mt-3 text-ink-2">The link may be old or mistyped. You can book, or check a booking, from the home page.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/">Go to the home page</ButtonLink>
          <ButtonLink href="/booking" variant="secondary">Find my booking</ButtonLink>
        </div>
        <p className="mt-6 text-sm text-ink-3">
          Need help? Call <SalonPhone />
        </p>
      </div>
    </div>
  );
}
