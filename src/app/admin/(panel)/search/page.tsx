import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/server/auth";
import { SearchScreen } from "@/components/admin/search/search-screen";
import { Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Search searchParams={searchParams} />
    </Suspense>
  );
}

async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q } = await searchParams;
  return <SearchScreen initialQ={(q ?? "").slice(0, 100)} />;
}
