import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/auth";
import { getServicos } from "@/actions/booking";
import { listarClientesParaOrcamentoAction, listarOrcamentosAdminAction } from "@/actions/orcamentos";
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

  const [lista, clientes, servicos] = await Promise.all([
    listarOrcamentosAdminAction(),
    listarClientesParaOrcamentoAction(),
    getServicos(),
  ]);

  return (
    <div className="w-full pb-10">
      <AdminOrcamentosView
        orcamentos={lista.success ? lista.orcamentos : []}
        clientes={clientes.success ? clientes.clientes : []}
        servicos={servicos}
        erro={lista.success ? null : lista.error}
      />
    </div>
  );
}
