import React from "react";
import { ClientHeader } from "@/components/layout/client-header";
import { ClientBottomNav } from "@/components/layout/client-bottom-nav";
import { BookingFlow } from "@/components/booking/booking-flow";
import { getServicos, getConfiguracoes, getDiasExcecoesAction } from "@/actions/booking";
import { getCurrentUser } from "@/actions/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Solicitar Orçamento e Serviços | GS Elétrica e Manutenção",
  description: "Escolha seus serviços elétricos, data e anexe fotos para o Gilmar Sales da GS Elétrica e Manutenção.",
};

export default async function AgendarPage() {
  const hoje = new Date();
  const inicio = hoje.toISOString();
  const fim = new Date(hoje.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString();

  const [servicos, config, user, diasExcecoes] = await Promise.all([
    getServicos(),
    getConfiguracoes(),
    getCurrentUser(),
    getDiasExcecoesAction(inicio, fim),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-bg-base text-text-main pb-24 md:pb-12">
      <ClientHeader />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 space-y-6">
        <BookingFlow
          initialServices={servicos}
          config={config}
          initialDiasExcecao={diasExcecoes}
          initialUser={
            user
              ? {
                  id: user.id,
                  nome: user.cliente?.nome,
                  clienteId: user.clienteId || undefined,
                }
              : null
          }
        />
      </main>

      <ClientBottomNav />
    </div>
  );
}
