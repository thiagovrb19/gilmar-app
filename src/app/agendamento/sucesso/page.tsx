import React from "react";
import { ClientHeader } from "@/components/layout/client-header";
import { ClientBottomNav } from "@/components/layout/client-bottom-nav";
import { BookingSuccessView } from "@/components/booking/booking-success-view";
import { getConfiguracoes, getAgendamentoResumoAction } from "@/actions/booking";

interface PageProps {
  searchParams: Promise<{
    id?: string;
    valor?: string;
    inicio?: string;
    anexos?: string;
  }>;
}

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Orçamento Confirmado | GS Elétrica e Manutenção",
};

export default async function AgendamentoSucessoPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const agendamentoId = params.id || "";

  const [config, resumo] = await Promise.all([
    getConfiguracoes(),
    agendamentoId ? getAgendamentoResumoAction(agendamentoId) : null,
  ]);

  const valorTotal = resumo?.valorTotal ?? (params.valor ? parseFloat(params.valor) : 0);
  const inicioIso = resumo?.inicio ?? (params.inicio ? decodeURIComponent(params.inicio) : new Date().toISOString());
  const anexosCount = resumo?.anexosCount ?? (params.anexos ? parseInt(params.anexos, 10) : 0);

  return (
    <div className="min-h-screen flex flex-col bg-bg-base text-text-main pb-24 md:pb-12">
      <ClientHeader />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 pt-6 space-y-6">
        <BookingSuccessView
          agendamentoId={agendamentoId}
          valorTotal={valorTotal}
          inicioIso={inicioIso}
          config={config}
          resumo={resumo}
          anexosCount={anexosCount}
        />
      </main>

      <ClientBottomNav />
    </div>
  );
}
