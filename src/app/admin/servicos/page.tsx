import React from "react";
import { AdminServicesView } from "@/components/admin/admin-services-view";
import { getServicos } from "@/actions/booking";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Serviços & Combos | Painel do Luiz",
};

export default async function AdminServicosPage() {
  const servicos = await getServicos(false);

  return (
    <div className="w-full">
      <AdminServicesView servicos={servicos} />
    </div>
  );
}
