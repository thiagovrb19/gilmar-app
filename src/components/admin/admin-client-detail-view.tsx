"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Phone,
  Calendar,
  DollarSign,
  Clock,
  MessageCircle,
  KeyRound,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Pin,
  Trash2,
  Plus,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Cliente,
  ClienteEstatistica,
  Agendamento,
  Multa,
  Credito,
  HorarioFixo,
  Servico,
} from "@/lib/supabase/types";
import { formatCurrency, formatPhone, getWhatsAppLink } from "@/lib/formatters";
import { formatDateFriendly, formatTimeSaoPaulo } from "@/lib/date/tz";
import { adminResetClientPassword } from "@/actions/auth";
import {
  atualizarStatusMultaAction,
  criarHorarioFixoAction,
  desativarHorarioFixoAction,
  excluirClienteAction,
} from "@/actions/admin";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { AdminAppointmentDetailModal } from "./admin-appointment-detail-modal";

const DIAS_NOMES: Record<number, string> = {
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado",
  0: "Domingo",
};

interface AdminClientDetailViewProps {
  cliente: Cliente;
  estatisticas?: ClienteEstatistica;
  agendamentos: Agendamento[];
  multas: Multa[];
  creditos?: Credito[];
  horariosFixos?: HorarioFixo[];
  servicos?: Servico[];
}

export function AdminClientDetailView({
  cliente,
  estatisticas,
  agendamentos,
  multas,
  creditos = [],
  horariosFixos = [],
  servicos = [],
}: AdminClientDetailViewProps) {
  const router = useRouter();
  const [novaSenha, setNovaSenha] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [detailModalAg, setDetailModalAg] = useState<Agendamento | null>(null);

  const handleExcluirCliente = async () => {
    if (
      !confirm(
        `Tem certeza que deseja apagar o cliente "${cliente.nome}"?\n\nEsta ação excluirá permanentemente o cliente e todos os seus agendamentos.`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    const res = await excluirClienteAction(cliente.id);
    setIsDeleting(false);

    if (!res.success) {
      toast.error(res.error || "Erro ao excluir cliente.");
      return;
    }

    toast.success(`Cliente "${cliente.nome}" apagado com sucesso!`);
    router.push("/admin/clientes");
  };

  // Estado do Modal de Horário Fixo
  const [openFixoModal, setOpenFixoModal] = useState(false);
  const [fixoDiaSemana, setFixoDiaSemana] = useState(5); // Sexta-feira padrão
  const [fixoHora, setFixoHora] = useState("17:00");
  const [fixoServicoId, setFixoServicoId] = useState(servicos[0]?.id || "");
  const [isSubmittingFixo, setIsSubmittingFixo] = useState(false);

  const handleSalvarFixo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingFixo(true);

    const servId = fixoServicoId || servicos[0]?.id || "";
    const res = await criarHorarioFixoAction(
      cliente.id,
      fixoDiaSemana,
      fixoHora,
      servId
    );
    setIsSubmittingFixo(false);

    if (!res.success) {
      toast.error(res.error || "Erro ao definir horário fixo");
      return;
    }

    toast.success(
      `Horário fixo definido! ${DIAS_NOMES[fixoDiaSemana]} às ${fixoHora} está bloqueado na agenda para outros clientes.`
    );
    setOpenFixoModal(false);
    router.refresh();
  };

  const handleDesativarFixo = async (fixoId: string) => {
    const res = await desativarHorarioFixoAction(fixoId);
    if (!res.success) {
      toast.error(res.error || "Erro ao desativar horário fixo");
      return;
    }

    toast.success("Horário fixo liberado com sucesso na agenda.");
    router.refresh();
  };

  const waLink = getWhatsAppLink(
    cliente.whatsapp,
    `Fala, ${cliente.nome}! Luiz da barbearia aqui.`
  );

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente.user_id) {
      toast.error("Este cliente ainda não criou senha de acesso pelo app.");
      return;
    }

    setIsResetting(true);
    const res = await adminResetClientPassword(cliente.user_id, novaSenha);
    setIsResetting(false);

    if (!res.success) {
      toast.error(res.error || "Erro ao redefinir senha.");
      return;
    }

    toast.success(`Senha de ${cliente.nome} redefinida com sucesso!`);
    setNovaSenha("");
  };

  const handleBaixarMulta = async (multaId: string, novoStatus: "paga" | "perdoada") => {
    const res = await atualizarStatusMultaAction(multaId, novoStatus);
    if (!res.success) {
      toast.error(res.error || "Erro ao processar multa");
      return;
    }
    toast.success(novoStatus === "paga" ? "Multa baixada como paga!" : "Multa perdoada.");
    router.refresh();
  };

  // Cálculo de frequência média (dias entre visitas)
  const concluidos = agendamentos.filter((a) => a.status === "concluido");
  let freqMediaDias: number | null = null;
  if (concluidos.length >= 2) {
    const primeira = new Date(concluidos[concluidos.length - 1].inicio).getTime();
    const ultima = new Date(concluidos[0].inicio).getTime();
    const diffDias = (ultima - primeira) / (1000 * 60 * 60 * 24);
    freqMediaDias = Math.round(diffDias / (concluidos.length - 1));
  }

  return (
    <div className="space-y-6">
      {/* NAVEGAÇÃO DE VOLTA */}
      <Link
        href="/admin/clientes"
        className="inline-flex items-center gap-1.5 text-xs text-gold hover:underline"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Voltar para lista de clientes</span>
      </Link>

      {/* CABEÇALHO DA FICHA */}
      <div className="bg-surface-1 border border-border-subtle rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-border-gold/40 flex items-center justify-center text-gold font-heading text-xl font-bold shrink-0">
            {cliente.nome.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold font-heading text-text-main">
                {cliente.nome}
              </h1>
              {cliente.user_id ? (
                <span className="text-[10px] bg-success/20 text-success px-2 py-0.5 rounded font-bold">
                  App Ativo
                </span>
              ) : (
                <span className="text-[10px] bg-surface-2 text-text-muted px-2 py-0.5 rounded">
                  Manual
                </span>
              )}
              {horariosFixos.length > 0 && (
                <span className="text-[10px] bg-gold/20 text-gold border border-gold/40 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  <Pin className="w-2.5 h-2.5" />
                  Cliente Fixo
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted pt-0.5">
              WhatsApp: {formatPhone(cliente.whatsapp)}
            </p>
            {cliente.data_nascimento && (
              <p className="text-xs text-gold pt-0.5">
                🎂 Aniversário: {cliente.data_nascimento.split("-").reverse().join("/")}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-success/20 hover:bg-success/30 text-success border border-success/40 font-semibold px-4 py-3 rounded-xl transition-colors text-xs"
          >
            <WhatsAppIcon className="w-4 h-4 fill-current shrink-0" />
            <span>Conversar no WhatsApp</span>
          </a>

          <button
            type="button"
            onClick={handleExcluirCliente}
            disabled={isDeleting}
            title={`Apagar cliente ${cliente.nome}`}
            className="inline-flex items-center justify-center gap-1.5 bg-surface-2 hover:bg-destructive/20 text-text-muted hover:text-destructive border border-border-subtle hover:border-destructive/40 font-semibold px-3.5 py-3 rounded-xl transition-colors text-xs disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">{isDeleting ? "Apagando..." : "Apagar"}</span>
          </button>
        </div>
      </div>

      {/* MÉTRICAS DA FICHA */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-4 space-y-1">
          <span className="text-xs text-text-muted block">Total de Visitas</span>
          <span className="text-2xl font-bold font-heading text-text-main">
            {estatisticas?.visitas || concluidos.length}
          </span>
          <span className="text-[10px] text-text-muted block">Atendimentos concluídos</span>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-4 space-y-1">
          <span className="text-xs text-text-muted block">Total Gasto</span>
          <span className="text-2xl font-bold font-heading text-gold">
            {formatCurrency(estatisticas?.total_gasto || 0)}
          </span>
          <span className="text-[10px] text-text-muted block">Receita gerada</span>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-4 space-y-1">
          <span className="text-xs text-text-muted block">Dias Sem Vir</span>
          <span
            className={`text-2xl font-bold font-heading ${
              estatisticas?.dias_sem_vir && estatisticas.dias_sem_vir >= 15
                ? "text-warning"
                : "text-text-main"
            }`}
          >
            {estatisticas?.dias_sem_vir !== null ? `${estatisticas?.dias_sem_vir}d` : "—"}
          </span>
          <span className="text-[10px] text-text-muted block">Desde o último corte</span>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-4 space-y-1">
          <span className="text-xs text-text-muted block">Frequência Média</span>
          <span className="text-2xl font-bold font-heading text-text-main">
            {freqMediaDias ? `${freqMediaDias} dias` : "—"}
          </span>
          <span className="text-[10px] text-text-muted block">Intervalo entre visitas</span>
        </div>
      </div>

      {/* SEÇÃO: HORÁRIO FIXO SEMANAL (BLOQUEIO NA AGENDA) */}
      <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Pin className="w-4 h-4 text-gold" />
              <h2 className="font-heading text-base font-bold text-text-main">
                Horário Fixo Semanal (Cliente Fixo)
              </h2>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Ao marcar o cliente como fixo, este horário fica bloqueado para qualquer outro cliente na agenda.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setOpenFixoModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gold hover:bg-gold-hover text-bg-base font-bold text-xs shadow-md transition-all self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Definir Horário Fixo</span>
          </button>
        </div>

        {horariosFixos.length === 0 ? (
          <p className="text-xs text-text-muted italic">
            Este cliente ainda não possui horário fixo semanal cadastrado.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {horariosFixos.map((fx) => (
              <div
                key={fx.id}
                className="bg-surface-2 border border-border-gold/30 rounded-xl p-3.5 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gold">
                      Toda {DIAS_NOMES[fx.dia_semana]}
                    </span>
                    <span className="text-xs font-bold text-text-main">
                      às {fx.hora.substring(0, 5)}
                    </span>
                  </div>
                  <span className="text-[11px] text-text-muted block mt-0.5">
                    Serviço: {fx.servico?.nome || "Corte"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDesativarFixo(fx.id)}
                  title="Liberar horário fixo"
                  className="p-2 text-text-muted hover:text-destructive hover:bg-surface-1 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CRÉDITOS PRÉ-PAGOS & MULTAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Créditos */}
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 space-y-3">
          <span className="text-xs text-gold font-semibold block">
            Saldo de Créditos Pré-pagos
          </span>
          {creditos.length === 0 ? (
            <p className="text-xs text-text-muted italic">Nenhum crédito ativo para este cliente.</p>
          ) : (
            <div className="space-y-2">
              {creditos.map((cr) => (
                <div
                  key={cr.id}
                  className="bg-surface-2 p-3 rounded-xl flex justify-between items-center text-xs"
                >
                  <div>
                    <span className="font-semibold text-text-main">{cr.servico?.nome}</span>
                    <span className="text-[10px] text-text-muted block">
                      Pago: {formatCurrency(cr.valor_pago)}
                    </span>
                  </div>
                  <span className="text-base font-bold font-heading text-gold">
                    {cr.saldo} restante(s)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Multas */}
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 space-y-3">
          <span className="text-xs text-destructive font-semibold block">
            Histórico de Multas
          </span>
          {multas.length === 0 ? (
            <p className="text-xs text-text-muted italic">Nenhuma multa registrada.</p>
          ) : (
            <div className="space-y-2">
              {multas.map((m) => (
                <div
                  key={m.id}
                  className="bg-surface-2 p-3 rounded-xl flex justify-between items-center text-xs"
                >
                  <div>
                    <span className="font-bold text-destructive">
                      {formatCurrency(m.valor)}
                    </span>
                    <span className="text-[10px] text-text-muted block capitalize">
                      Status: {m.status}
                    </span>
                  </div>
                  {m.status === "pendente" && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleBaixarMulta(m.id, "paga")}
                        className="bg-success/20 text-success text-[10px] font-bold px-2 py-1 rounded"
                      >
                        Baixar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBaixarMulta(m.id, "perdoada")}
                        className="text-text-muted text-[10px] px-2 py-1"
                      >
                        Perdoar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* REDEFINIR SENHA DO CLIENTE */}
      {cliente.user_id && (
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-gold">
            <KeyRound className="w-4 h-4" />
            <h3 className="font-heading text-sm font-bold text-text-main">
              Redefinir Senha do Cliente
            </h3>
          </div>
          <p className="text-xs text-text-muted">
            Caso o cliente tenha esquecido a senha, defina uma nova senha provisória para ele:
          </p>

          <form onSubmit={handleResetPassword} className="flex gap-2 max-w-sm">
            <input
              type="password"
              required
              minLength={6}
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Nova senha (min. 6 dígitos)"
              className="bg-surface-2 border border-border-subtle text-xs text-text-main px-3 py-2 rounded-xl focus:outline-none focus:border-gold flex-1"
            />
            <button
              type="submit"
              disabled={isResetting}
              className="bg-gold hover:bg-gold-hover text-bg-base font-bold text-xs px-4 py-2 rounded-xl transition-all disabled:opacity-50"
            >
              {isResetting ? "Salvando..." : "Redefinir"}
            </button>
          </form>
        </div>
      )}

      {/* HISTÓRICO DE ATENDIMENTOS DO CLIENTE */}
      <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 space-y-4">
        <h3 className="font-heading text-base font-bold text-text-main">
          Histórico de Atendimentos
        </h3>

        {agendamentos.length === 0 ? (
          <p className="text-xs text-text-muted italic">Nenhum atendimento registrado.</p>
        ) : (
          <div className="space-y-2.5">
            {agendamentos.map((ag) => (
              <div
                key={ag.id}
                className="bg-surface-2/60 border border-border-subtle rounded-xl p-3 flex justify-between items-center text-xs"
              >
                <div>
                  <span className="font-bold text-text-main block">
                    {formatDateFriendly(ag.inicio)} às {formatTimeSaoPaulo(ag.inicio)}
                  </span>
                  <span className="text-text-muted capitalize">
                    Status: {ag.status.replace("_", " ")} &bull; {formatCurrency(ag.valor_total)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailModalAg(ag)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-1 hover:bg-gold/15 text-gold border border-border-gold/30 text-[11px] font-semibold transition-colors"
                    title="Ver detalhes e fotos anexadas"
                  >
                    <ImageIcon className="w-3 h-3" />
                    <span>Fotos / Detalhes</span>
                  </button>
                  <span className="text-[11px] text-gold font-semibold">
                    {ag.pago ? "Pago" : "Pendente"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL HORÁRIO FIXO */}
      {openFixoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-1 border border-border-subtle rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2 text-gold">
                <Pin className="w-5 h-5" />
                <h3 className="font-heading text-lg text-text-main font-bold">
                  Definir Cliente Fixo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpenFixoModal(false)}
                className="text-text-muted hover:text-text-main p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-text-muted">
              Ao cadastrar, esse dia e horário serão automaticamente reservados toda semana para <strong>{cliente.nome}</strong> e ficarão permanentemente indisponíveis para outros clientes na agenda.
            </p>

            <form onSubmit={handleSalvarFixo} className="space-y-3.5 text-xs">
              <div>
                <label className="text-text-muted block mb-1">Dia da Semana:</label>
                <select
                  value={fixoDiaSemana}
                  onChange={(e) => setFixoDiaSemana(parseInt(e.target.value))}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
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
                <label className="text-text-muted block mb-1">Horário:</label>
                <input
                  type="time"
                  required
                  value={fixoHora}
                  onChange={(e) => setFixoHora(e.target.value)}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="text-text-muted block mb-1">Serviço Padrão:</label>
                <select
                  value={fixoServicoId}
                  onChange={(e) => setFixoServicoId(e.target.value)}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                >
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome} ({formatCurrency(s.preco)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setOpenFixoModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-surface-2 text-text-muted hover:text-text-main font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFixo}
                  className="px-5 py-2.5 rounded-xl bg-gold hover:bg-gold-hover text-bg-base font-bold shadow-md disabled:opacity-50"
                >
                  {isSubmittingFixo ? "Salvando..." : "Bloquear na Agenda"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALHES DO PEDIDO / FOTOS ANEXADAS */}
      {detailModalAg && (
        <AdminAppointmentDetailModal
          agendamento={detailModalAg}
          onClose={() => setDetailModalAg(null)}
          onRefresh={() => router.refresh()}
        />
      )}
    </div>
  );
}
