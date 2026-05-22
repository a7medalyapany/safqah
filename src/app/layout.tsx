import { Outlet } from "react-router-dom";

import { Sidebar } from "@/app/sidebar/Sidebar";

const SIDEBAR_WIDTH = 240;

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />

      <main
        className="min-h-screen"
        style={{ marginRight: `${SIDEBAR_WIDTH}px` }}
      >
        <Outlet />
      </main>
    </div>
  );
}
