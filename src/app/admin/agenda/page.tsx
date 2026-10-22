import React from "react";
import { AdminCalendarView } from "@/components/admin/admin-calendar-view";
import { getAgendaPeriodo, getClientesStats } from "@/actions/admin";
import { getServicos } from "@/actions/booking";
import { Cliente } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Agenda de Serviços | GS Gilmar Sales",
};

export default async function AdminAgendaPage() {
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 2, 0).toISOString();

  const [agenda, servicos, clientesStats] = await Promise.all([
    getAgendaPeriodo(inicioMes, fimMes),
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
      <AdminCalendarView
        initialAgendamentos={agenda.agendamentos}
        initialBloqueios={agenda.bloqueios}
        initialHorariosFixos={agenda.horariosFixos}
        initialDiasExcecao={agenda.diasExcecao || []}
        servicos={servicos}
        clientes={clientesList}
      />
    </div>
  );
}
