import React from "react";
import { AdminSettingsView } from "@/components/admin/admin-settings-view";
import { getConfiguracoes, getServicos, getHorariosFuncionamento } from "@/actions/booking";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Configurações | GS Gilmar Sales",
};

export default async function AdminConfiguracoesPage() {
  const [config, servicos, horarios] = await Promise.all([
    getConfiguracoes(),
    getServicos(),
    getHorariosFuncionamento(),
  ]);

  return (
    <div className="w-full">
      <AdminSettingsView
        initialConfig={config}
        servicos={servicos}
        initialHorarios={horarios}
      />
    </div>
  );
}
