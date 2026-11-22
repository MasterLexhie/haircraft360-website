import { Suspense } from "react";
import { AdminNav, AdminNavList } from "@/components/admin/admin-nav";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopBar } from "@/components/admin/admin-topbar";
import { adminChrome, NO_COUNTS } from "@/server/admin-chrome";
import { logoutAction } from "../auth-actions";

/**
 * App-shell layout: the frame is exactly the viewport height and only the page area
 * (#admin-scroll) scrolls.
 * - Phone: each page's own plum header (PageHeader) and a bottom bar with More.
 * - Tablet: plum top bar and an icon rail.
 * - Desktop: plum top bar and the full sidebar on the grey workspace.
 * `data-admin` switches the shared components to the admin look (see globals.css).
 */
export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-admin className="flex h-dvh flex-col overflow-hidden bg-sand">
      <Suspense fallback={<AdminTopBar name={null} />}>
        <TopBar />
      </Suspense>

      <div className="flex min-h-0 flex-1">
        <Suspense fallback={<AdminSidebar counts={NO_COUNTS} logoutAction={logoutAction} />}>
          <Sidebar />
        </Suspense>

        <div className="flex min-w-0 flex-1 flex-col">
          <div id="admin-scroll" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <main className="mx-auto max-w-6xl px-4 pb-8 md:px-6 md:py-8">{children}</main>
          </div>

          <div className="shrink-0 border-t border-line bg-surface px-1 pt-1.5 md:hidden" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
            <Suspense fallback={<AdminNavList variant="bottom" counts={NO_COUNTS} pathname={null} />}>
              <BottomBar />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}

async function TopBar() {
  const { name } = await adminChrome();
  return <AdminTopBar name={name} />;
}

async function Sidebar() {
  const { counts } = await adminChrome();
  return <AdminSidebar counts={counts} logoutAction={logoutAction} />;
}

async function BottomBar() {
  const { counts } = await adminChrome();
  return <AdminNav variant="bottom" counts={counts} />;
}
