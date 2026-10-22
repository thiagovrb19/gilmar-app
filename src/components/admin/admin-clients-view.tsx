"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  Trophy,
  AlertTriangle,
  Gift,
  ShieldAlert,
  Repeat,
  Trash2,
  Calendar,
  Clock,
  Sparkles,
  CheckCircle2,
  X,
  PauseCircle,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { ClienteEstatistica, Servico } from "@/lib/supabase/types";
import { formatCurrency, formatPhone, getWhatsAppLink } from "@/lib/formatters";
import { formatDateShort } from "@/lib/date/tz";
import {
  excluirClienteAction,
  salvarHorarioFixoAction,
  pausarHorarioFixoAction,
  excluirHorarioFixoAction,
} from "@/actions/admin";
import { useRealtimeSync, broadcastSync } from "@/hooks/use-realtime-sync";
import { toast } from "sonner";

const DIAS_NOMES: Record<number, string> = {
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado",
  0: "Domingo",
};

interface AdminClientsViewProps {
  clientes: ClienteEstatistica[];
  servicos?: Servico[];
}

export function AdminClientsView({
  clientes,
  servicos = [],
}: AdminClientsViewProps) {
  const router = useRouter();

  // Sincronização em tempo real (WebSockets + BroadcastChannel + foco)
  useRealtimeSync({
    tables: ["clientes", "agendamentos", "horarios_fixos", "multas"],
    onSync: () => router.refresh(),
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<
    "todos" | "sumidos" | "ranking" | "aniversariantes" | "multas"
  >("todos");
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  // Estados do Modal de Horário Fixo / Recorrente (Substituto oficial do botão Ficha)
  const [modalRecorrenciaOpen, setModalRecorrenciaOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<ClienteEstatistica | null>(null);
  const [fixoDiaSemana, setFixoDiaSemana] = useState(5); // Sexta-feira padrão
  const [fixoHora, setFixoHora] = useState("17:00");
  const [fixoServicoId, setFixoServicoId] = useState(servicos[0]?.id || "");
  const [fixoRecorrencia, setFixoRecorrencia] = useState<"semanal" | "quinzenal" | "mensal">("semanal");
  const [fixoSemanas, setFixoSemanas] = useState(8);
  const [fixoDataInicio, setFixoDataInicio] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isSubmittingFixo, setIsSubmittingFixo] = useState(false);

  const handleOpenRecorrencia = (c: ClienteEstatistica) => {
    setSelectedCliente(c);
    setFixoServicoId(servicos[0]?.id || "");
    setFixoDataInicio(new Date().toISOString().split("T")[0]);
    setModalRecorrenciaOpen(true);
  };

  const handleSalvarRecorrencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCliente) return;

    setIsSubmittingFixo(true);
    const res = await salvarHorarioFixoAction({
      clienteId: selectedCliente.id,
      diaSemana: fixoDiaSemana,
      hora: fixoHora,
      servicoId: fixoServicoId || servicos[0]?.id || "",
      recorrencia: fixoRecorrencia,
      dataInicio: fixoDataInicio,
      semanas: fixoSemanas,
    });
    setIsSubmittingFixo(false);

    if (!res.success) {
      toast.error(res.error || "Erro ao salvar recorrência fixa.");
      return;
    }

    toast.success(
      `Recorrência ${fixoRecorrencia} definida para ${selectedCliente.nome}! ${res.agendamentos_gerados || 0} horário(s) reservados na agenda.`
    );
    setModalRecorrenciaOpen(false);
    broadcastSync("agendamentos");
    broadcastSync("horarios_fixos");
    router.refresh();
  };

  const handleExcluirCliente = async (id: string, nome: string) => {
    if (
      !confirm(
        `Tem certeza que deseja apagar o cliente "${nome}"?\n\nEsta ação excluirá o cliente e seus agendamentos do sistema.`
      )
    ) {
      return;
    }

    setExcluindoId(id);
    const res = await excluirClienteAction(id);
    setExcluindoId(null);

    if (!res.success) {
      toast.error(res.error || "Erro ao excluir cliente.");
      return;
    }

    toast.success(`Cliente "${nome}" apagado com sucesso!`);
    broadcastSync("clientes");
    broadcastSync("agendamentos");
    router.refresh();
  };

  const mesAtual = new Date().getMonth() + 1;

  // Filtragem
  const filtered = clientes
    .filter((c) => {
      const matchSearch =
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.whatsapp.includes(searchTerm.replace(/\D/g, ""));
      if (!matchSearch) return false;

      if (filter === "sumidos") {
        return c.dias_sem_vir !== null && c.dias_sem_vir >= 15;
      }
      if (filter === "aniversariantes") {
        if (!c.data_nascimento) return false;
        const mes = new Date(c.data_nascimento).getUTCMonth() + 1;
        return mes === mesAtual;
      }
      if (filter === "multas") {
        return c.multas_pendentes_qtd > 0;
      }
      return true;
    })
    .sort((a, b) => {
      if (filter === "ranking") {
        return (b.visitas || 0) - (a.visitas || 0);
      }
      if (filter === "sumidos") {
        return (b.dias_sem_vir || 0) - (a.dias_sem_vir || 0);
      }
      return a.nome.localeCompare(b.nome);
    });

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <span className="text-xs text-gold font-semibold">
            Base de Clientes
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-text-main">
            Controle de Clientes
          </h1>
          <p className="text-xs text-text-muted">
            {clientes.length} cliente(s) cadastrado(s)
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => {
              if (clientes.length > 0) handleOpenRecorrencia(clientes[0]);
            }}
            className="inline-flex items-center gap-2 bg-gold hover:bg-gold-hover text-bg-base font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
          >
            <Repeat className="w-4 h-4 stroke-[2.5]" />
            <span>Cadastrar Cliente Fixo</span>
          </button>
        </div>
      </div>

      {/* BUSCA E FILTROS */}
      <div className="space-y-3">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar cliente por nome ou WhatsApp..."
            className="w-full bg-surface-1 border border-border-subtle rounded-2xl pl-10 pr-4 py-3 text-sm text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-gold"
          />
          <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
        </div>

        {/* Chips de filtro */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: "todos", label: "Todos", count: clientes.length },
            {
              id: "ranking",
              label: "Ranking de Fidelidade",
              icon: Trophy,
              count: clientes.filter((c) => c.visitas > 0).length,
            },
            {
              id: "sumidos",
              label: "Sumidos (15d+)",
              icon: AlertTriangle,
              count: clientes.filter((c) => c.dias_sem_vir && c.dias_sem_vir >= 15).length,
            },
            {
              id: "aniversariantes",
              label: "Aniversariantes do Mês",
              icon: Gift,
              count: clientes.filter((c) => {
                if (!c.data_nascimento) return false;
                return new Date(c.data_nascimento).getUTCMonth() + 1 === mesAtual;
              }).length,
            },
            {
              id: "multas",
              label: "Com Multa",
              icon: ShieldAlert,
              count: clientes.filter((c) => c.multas_pendentes_qtd > 0).length,
            },
          ].map((item) => {
            const isActive = filter === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id as typeof filter)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-gold text-bg-base shadow-sm"
                    : "bg-surface-1 text-text-muted hover:text-text-main border border-border-subtle"
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{item.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? "bg-bg-base/20 text-bg-base" : "bg-surface-2 text-text-muted"
                  }`}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* LISTA DE CLIENTES */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-surface-1 border border-border-subtle rounded-2xl p-8 text-center space-y-2">
            <Users className="w-8 h-8 mx-auto text-text-muted/60" />
            <p className="text-xs text-text-muted">Nenhum cliente encontrado com os filtros selecionados.</p>
          </div>
        ) : (
          filtered.map((c, index) => {
            const isTopRank = filter === "ranking" && index < 3;
            const isSumido = c.dias_sem_vir !== null && c.dias_sem_vir >= 15;

            // Mensagens contextuais para o WhatsApp
            let waMsg = `Olá, ${c.nome}! Tudo bem? Gilmar da GS Elétrica e Manutenção aqui.`;
            if (isSumido) {
              waMsg = `Fala, ${c.nome}! Tudo bem? Gilmar da GS Elétrica por aqui. Passando para saber se precisa de alguma revisão ou serviço elétrico por aí!`;
            } else if (filter === "aniversariantes") {
              waMsg = `Parabéns pelo seu aniversário, ${c.nome}! O Gilmar da GS Elétrica te deseja muitas felicidades, saúde e sucesso!`;
            }

            const waLink = getWhatsAppLink(c.whatsapp, waMsg);

            return (
              <div
                key={c.id}
                className="bg-surface-1 border border-border-subtle hover:border-border-gold/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-heading font-bold text-sm shrink-0 ${
                      isTopRank
                        ? "bg-gold text-bg-base shadow-sm"
                        : "bg-surface-2 text-gold border border-border-subtle"
                    }`}
                  >
                    {filter === "ranking" ? `#${index + 1}` : c.nome.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading text-base font-bold text-text-main">
                        {c.nome}
                      </span>

                      {isSumido && (
                        <span className="text-[10px] bg-warning/15 text-warning px-2 py-0.5 rounded-full font-bold">
                          Sumido ({c.dias_sem_vir}d)
                        </span>
                      )}

                      {c.multas_pendentes_qtd > 0 && (
                        <span className="text-[10px] bg-destructive/15 text-destructive px-2 py-0.5 rounded-full font-bold">
                          Multa ({formatCurrency(c.multas_pendentes_valor)})
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-text-muted">
                      {formatPhone(c.whatsapp)}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-text-muted pt-1">
                      <span>
                        <strong className="text-text-main">{c.visitas}</strong> visita(s)
                      </span>
                      <span>&bull;</span>
                      <span>
                        Total Gasto: <strong className="text-gold">{formatCurrency(c.total_gasto)}</strong>
                      </span>
                      {c.servico_mais_usado && (
                        <>
                          <span>&bull;</span>
                          <span className="text-text-muted truncate max-w-[140px] bg-surface-2 px-1.5 py-0.5 rounded">
                            {c.servico_mais_usado}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ações Rápidas: WhatsApp, Horário Fixo Recorrente, e Excluir */}
                <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-subtle">
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-success/20 hover:bg-success/30 text-success text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                  >
                    <WhatsAppIcon className="w-4 h-4 fill-current shrink-0" />
                    <span>WhatsApp</span>
                  </a>

                  {/* NOVO ÍCONE FIXO DE AGENDAMENTO RECORRENTE (Substituto Oficial do botão Ficha) */}
                  <button
                    type="button"
                    onClick={() => handleOpenRecorrencia(c)}
                    title={`Configurar horário fixo semanal/mensal para ${c.nome}`}
                    className="inline-flex items-center gap-1.5 bg-gold/15 hover:bg-gold/25 text-gold border border-gold/40 text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-sm active:scale-95"
                  >
                    <Repeat className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Horário Fixo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExcluirCliente(c.id, c.nome)}
                    disabled={excluindoId === c.id}
                    title={`Apagar cliente ${c.nome}`}
                    className="inline-flex items-center justify-center p-2 rounded-xl bg-surface-2 hover:bg-destructive/20 text-text-muted hover:text-destructive border border-border-subtle transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL OFICIAL DE AGENDAMENTO RECORRENTE FIXO */}
      {modalRecorrenciaOpen && selectedCliente && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setModalRecorrenciaOpen(false)}
        >
          <div
            className="bg-surface-1 border border-border-gold/60 rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2 text-gold">
                <Repeat className="w-5 h-5 stroke-[2.5]" />
                <h3 className="font-heading text-lg font-bold text-text-main">
                  Agendamento Fixo Recorrente
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalRecorrenciaOpen(false)}
                className="text-text-muted hover:text-text-main"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarRecorrencia} className="space-y-3.5 text-xs">
              {/* Cliente */}
              <div>
                <label className="text-text-muted block mb-1 font-semibold">Cliente:</label>
                <select
                  value={selectedCliente.id}
                  onChange={(e) => {
                    const match = clientes.find((cli) => cli.id === e.target.value);
                    if (match) setSelectedCliente(match);
                  }}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main font-medium focus:outline-none focus:border-gold"
                >
                  {clientes.map((cli) => (
                    <option key={cli.id} value={cli.id}>
                      {cli.nome} ({formatPhone(cli.whatsapp)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Serviço */}
              <div>
                <label className="text-text-muted block mb-1 font-semibold">Serviço Selecionado:</label>
                <select
                  value={fixoServicoId}
                  onChange={(e) => setFixoServicoId(e.target.value)}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main font-medium focus:outline-none focus:border-gold"
                >
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome} — {formatCurrency(s.preco)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dia da Semana e Horário */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-text-muted block mb-1 font-semibold">Dia da Semana:</label>
                  <select
                    value={fixoDiaSemana}
                    onChange={(e) => setFixoDiaSemana(Number(e.target.value))}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main font-medium focus:outline-none focus:border-gold"
                  >
                    <option value={1}>Segunda-feira</option>
                    <option value={2}>Terça-feira</option>
                    <option value={3}>Quarta-feira</option>
                    <option value={4}>Quinta-feira</option>
                    <option value={5}>Sexta-feira</option>
                    <option value={6}>Sábado</option>
                  </select>
                </div>

                <div>
                  <label className="text-text-muted block mb-1 font-semibold">Horário Fixo:</label>
                  <input
                    type="time"
                    required
                    value={fixoHora}
                    onChange={(e) => setFixoHora(e.target.value)}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main font-medium focus:outline-none focus:border-gold"
                  />
                </div>
              </div>

              {/* Frequência da Recorrência e Duração */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-text-muted block mb-1 font-semibold">Frequência:</label>
                  <select
                    value={fixoRecorrencia}
                    onChange={(e) => setFixoRecorrencia(e.target.value as any)}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main font-medium focus:outline-none focus:border-gold"
                  >
                    <option value="semanal">Semanal (Toda semana)</option>
                    <option value="quinzenal">Quinzenal (A cada 2 semanas)</option>
                    <option value="mensal">Mensal (A cada 4 semanas)</option>
                  </select>
                </div>

                <div>
                  <label className="text-text-muted block mb-1 font-semibold">Duração / Semanas:</label>
                  <select
                    value={fixoSemanas}
                    onChange={(e) => setFixoSemanas(Number(e.target.value))}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main font-medium focus:outline-none focus:border-gold"
                  >
                    <option value={4}>4 Semanas (1 mês)</option>
                    <option value={8}>8 Semanas (2 meses)</option>
                    <option value={12}>12 Semanas (3 meses)</option>
                    <option value={16}>16 Semanas (4 meses)</option>
                  </select>
                </div>
              </div>

              {/* Data de Início */}
              <div>
                <label className="text-text-muted block mb-1 font-semibold">Data de Início:</label>
                <input
                  type="date"
                  required
                  value={fixoDataInicio}
                  onChange={(e) => setFixoDataInicio(e.target.value)}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main font-medium focus:outline-none focus:border-gold"
                />
              </div>

              {/* Aviso anti-conflito */}
              <div className="bg-surface-2/60 border border-border-gold/30 p-3 rounded-xl space-y-1">
                <span className="font-bold text-gold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Sincronização com a Agenda do Gilmar
                </span>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Os horários serão reservados e bloqueados para novos clientes públicos. Conflitos de agenda são verificados automaticamente antes de cada inserção.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingFixo}
                  className="w-full bg-gold hover:bg-gold-hover text-bg-base font-bold text-xs py-3.5 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isSubmittingFixo ? "Verificando e salvando..." : "Confirmar e Agendar Horários Fixos"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
