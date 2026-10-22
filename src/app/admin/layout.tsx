import React from "react";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminBottomNav } from "@/components/layout/admin-bottom-nav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-bg-base text-text-main">
      <AdminSidebar />
      <main className="flex-1 min-w-0 pb-20 md:pb-8 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>
      <AdminBottomNav />
    </div>
  );
}
