import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/server/auth";
import { SearchScreen } from "@/components/admin/search/search-screen";
import { Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Search" };

/** The search text never goes in the address; the screen keeps it for the tab (see search-parts). */
export default function SearchPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Search />
    </Suspense>
  );
}

async function Search() {
  await requireAdmin();
  return <SearchScreen />;
}
