import Image from "next/image";
import Link from "next/link";

/** Shared frame for the sign-in, two-factor and setup steps. */
export function AuthCard({ title, subtitle, children, wide }: { title: string; subtitle: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-sand/60 px-4 py-12">
      <div className={wide ? "w-full max-w-md" : "w-full max-w-sm"}>
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/brand/logo-pink-full.webp" alt="Haircraft360 logo" width={569} height={571} priority className="size-20" />
          <h1 className="type-display mt-4 text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-ink-2">{subtitle}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-line bg-surface p-6 shadow-[var(--shadow-md)]">{children}</div>
        <p className="mt-6 text-center text-sm"><Link className="text-ink-2 underline" href="/">Back to the public site</Link></p>
      </div>
    </div>
  );
}
