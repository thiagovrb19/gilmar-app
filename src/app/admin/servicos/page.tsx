import React from "react";
import { AdminServicesView } from "@/components/admin/admin-services-view";
import { getServicosAdmin } from "@/actions/admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Serviços Elétricos | Painel do Gilmar",
};

export default async function AdminServicosPage() {
  const servicos = await getServicosAdmin();

  return (
    <div className="w-full">
      <AdminServicesView servicos={servicos} />
    </div>
  );
}
