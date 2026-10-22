import React from "react";
import { AdminTodayDashboard } from "@/components/admin/admin-today-dashboard";
import { getDashboardHoje } from "@/actions/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Hoje | GS Gilmar Sales",
};

export default async function AdminHojePage() {
  const dados = await getDashboardHoje();

  return (
    <div className="w-full">
      <AdminTodayDashboard
        agendamentosHoje={dados.agendamentosHoje}
        metricas={dados.metricas}
        alertas={dados.alertas}
      />
    </div>
  );
}
