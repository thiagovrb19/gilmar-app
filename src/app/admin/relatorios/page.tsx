import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/auth";
import { listarRelatoriosAction } from "@/actions/relatorios";
import { AdminReportsView } from "@/components/admin/admin-reports-view";

export const dynamic = "force-dynamic";

export default async function AdminRelatoriosPage() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") {
    redirect("/admin/login");
  }

  const res = await listarRelatoriosAction();

  return (
    <div className="space-y-6 pb-10">
      <AdminReportsView relatorios={res.relatorios} erro={res.success ? null : res.error || null} />
    </div>
  );
}
