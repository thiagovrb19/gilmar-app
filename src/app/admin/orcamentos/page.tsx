import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/auth";
import { getServicos } from "@/actions/booking";
import { listarOrcamentosAdminAction } from "@/actions/orcamentos";
import { AdminOrcamentosView } from "@/components/admin/admin-orcamentos-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Orçamentos | Painel do Gilmar",
};

export default async function AdminOrcamentosPage() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") {
    redirect("/admin/login");
  }

  const [lista, servicos] = await Promise.all([listarOrcamentosAdminAction(), getServicos()]);

  return (
    <div className="w-full pb-10">
      <AdminOrcamentosView
        orcamentos={lista.success ? lista.orcamentos : []}
        servicos={servicos}
        erro={lista.success ? null : lista.error}
      />
    </div>
  );
}
