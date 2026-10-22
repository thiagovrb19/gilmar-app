import React from "react";
import { AdminFinanceView } from "@/components/admin/admin-finance-view";
import { getFinanceiroDados, getClientesStats } from "@/actions/admin";
import { getServicos } from "@/actions/booking";
import { Cliente } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Financeiro | Painel do Luiz",
};

export default async function AdminFinanceiroPage() {
  const [finData, servicos, clientesStats] = await Promise.all([
    getFinanceiroDados(),
    getServicos(),
    getClientesStats(),
  ]);

  const clientesList: Cliente[] = clientesStats.map((cs) => ({
    id: cs.id,
    nome: cs.nome,
    whatsapp: cs.whatsapp,
    data_nascimento: cs.data_nascimento,
    user_id: cs.user_id,
    observacoes: cs.observacoes,
    aceite_lgpd_em: null,
    criado_em: cs.criado_em,
  }));

  return (
    <div className="w-full">
      <AdminFinanceView
        lancamentos={finData.lancamentos}
        pendencias={finData.pendencias}
        multasPendentes={finData.multasPendentes}
        agendamentosPrevistos={finData.agendamentosPrevistos || []}
        faturamentoPrevistoTotal={finData.faturamentoPrevistoTotal || 0}
        servicos={servicos}
        clientes={clientesList}
      />
    </div>
  );
}
