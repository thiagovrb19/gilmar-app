import React from "react";
import { AdminClientsView } from "@/components/admin/admin-clients-view";
import { getClientesStats } from "@/actions/admin";
import { getServicos } from "@/actions/booking";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Clientes | Painel do Luiz",
};

export default async function AdminClientesPage() {
  const [clientes, servicos] = await Promise.all([
    getClientesStats(),
    getServicos(),
  ]);

  return (
    <div className="w-full">
      <AdminClientsView clientes={clientes} servicos={servicos} />
    </div>
  );
}
