"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  Save,
  Clock,
  ShieldAlert,
  Gift,
  Award,
  DollarSign,
  MapPin,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Configuracao, Servico, HorarioFuncionamento } from "@/lib/supabase/types";
import {
  salvarConfiguracoesAction,
  salvarHorariosFuncionamentoAction,
} from "@/actions/admin";

const DIAS_NOMES: Record<number, string> = {
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado",
  0: "Domingo",
};

const DIAS_ORDENADOS = [1, 2, 3, 4, 5, 6, 0];

interface AdminSettingsViewProps {
  initialConfig: Configuracao;
  servicos: Servico[];
  initialHorarios?: HorarioFuncionamento[];
}

export function AdminSettingsView({
  initialConfig,
  servicos,
  initialHorarios = [],
}: AdminSettingsViewProps) {
  const router = useRouter();
  const [config, setConfig] = useState<Configuracao>(initialConfig);

  // Inicializa horários garantindo todos os 7 dias (com Sábado ativo das 09h às 18h)
  const [horarios, setHorarios] = useState<HorarioFuncionamento[]>(() => {
    const padrao: HorarioFuncionamento[] = [
      { dia_semana: 1, abre: "17:00:00", fecha: "21:00:00", ativo: true },
      { dia_semana: 2, abre: "17:00:00", fecha: "21:00:00", ativo: true },
      { dia_semana: 3, abre: "17:00:00", fecha: "21:00:00", ativo: true },
      { dia_semana: 4, abre: "17:00:00", fecha: "21:00:00", ativo: true },
      { dia_semana: 5, abre: "17:00:00", fecha: "21:00:00", ativo: true },
      { dia_semana: 6, abre: "12:00:00", fecha: "18:00:00", ativo: true },
      { dia_semana: 0, abre: "09:00:00", fecha: "18:00:00", ativo: false },
    ];

    if (!initialHorarios || initialHorarios.length === 0) return padrao;

    return padrao.map((p) => {
      const match = initialHorarios.find((h) => h.dia_semana === p.dia_semana);
      return match || p;
    });
  });

  const [isSaving, setIsSaving] = useState(false);

  const updateHorario = (
    dia_semana: number,
    field: "abre" | "fecha" | "ativo",
    value: string | boolean
  ) => {
    setHorarios((prev) =>
      prev.map((h) => {
        if (h.dia_semana !== dia_semana) return h;
        if (field === "ativo") {
          return { ...h, ativo: Boolean(value) };
        }
        const timeVal =
          typeof value === "string" && value.length === 5
            ? `${value}:00`
            : (value as string);
        return { ...h, [field]: timeVal };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const [resConfig, resHorarios] = await Promise.all([
      salvarConfiguracoesAction(config),
      salvarHorariosFuncionamentoAction(horarios),
    ]);
    setIsSaving(false);

    if (!resConfig.success) {
      toast.error(resConfig.error || "Erro ao salvar configurações.");
      return;
    }

    if (!resHorarios.success) {
      toast.error(resHorarios.error || "Erro ao salvar horários de atendimento.");
      return;
    }

    toast.success("Configurações e horários de funcionamento salvos com sucesso!");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <span className="text-xs text-gold font-semibold">
            Parâmetros do Negócio
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-text-main">
            Configurações
          </h1>
          <p className="text-xs text-text-muted">
            Ajuste horários, regras de cancelamento, chave Pix e programas de fidelidade
          </p>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 bg-gold hover:bg-gold-hover text-bg-base font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
        >
          <Save className="w-4 h-4 stroke-[2.5]" />
          <span>{isSaving ? "Salvando..." : "Salvar Alterações"}</span>
        </button>
      </div>

      {/* SEÇÃO 1: DADOS DA EMPRESA & CONTATO */}
      <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 md:p-6 space-y-4">
        <h2 className="font-heading text-base font-bold text-text-main border-b border-border-subtle pb-2">
          1. Dados da Empresa & Contato
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-text-muted block mb-1">Nome do Estabelecimento:</label>
            <input
              type="text"
              required
              value={config.nome_barbearia}
              onChange={(e) => setConfig({ ...config, nome_barbearia: e.target.value })}
              className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
            />
          </div>

          <div>
            <label className="text-text-muted block mb-1">WhatsApp de Contato (com DDD):</label>
            <input
              type="text"
              required
              value={config.whatsapp_contato}
              onChange={(e) => setConfig({ ...config, whatsapp_contato: e.target.value })}
              className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
            />
          </div>

          <div>
            <label className="text-text-muted block mb-1">Endereço Físico:</label>
            <input
              type="text"
              value={config.endereco || ""}
              onChange={(e) => setConfig({ ...config, endereco: e.target.value })}
              placeholder="Rua, Número, Bairro, Cidade - MG"
              className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
            />
          </div>

          <div>
            <label className="text-text-muted block mb-1">Link Google Maps:</label>
            <input
              type="text"
              value={config.link_maps || ""}
              onChange={(e) => setConfig({ ...config, link_maps: e.target.value })}
              placeholder="https://maps.google.com/..."
              className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
            />
          </div>

          <div>
            <label className="text-text-muted block mb-1">Instagram (@):</label>
            <input
              type="text"
              value={config.instagram || ""}
              onChange={(e) => setConfig({ ...config, instagram: e.target.value })}
              placeholder="@gseletricaemanutencao"
              className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
            />
          </div>
        </div>
      </div>

      {/* SEÇÃO 2: DADOS DO PIX */}
      <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 md:p-6 space-y-4">
        <h2 className="font-heading text-base font-bold text-text-main border-b border-border-subtle pb-2 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-gold" />
          <span>2. Configurações do Pix (BR Code EMV)</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="text-text-muted block mb-1">Chave Pix (Celular no padrão +55):</label>
            <input
              type="text"
              required
              value={config.pix_chave}
              onChange={(e) => setConfig({ ...config, pix_chave: e.target.value })}
              className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
            />
            <span className="text-[10px] text-text-muted block mt-1">Ex: +5532999311712</span>
          </div>

          <div>
            <label className="text-text-muted block mb-1">Nome do Recebedor:</label>
            <input
              type="text"
              required
              value={config.pix_nome}
              onChange={(e) => setConfig({ ...config, pix_nome: e.target.value })}
              className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
            />
            <span className="text-[10px] text-text-muted block mt-1">GILMAR SALES</span>
          </div>

          <div>
            <label className="text-text-muted block mb-1">Cidade do Recebedor (sem acento, máx. 15 car.):</label>
            <input
              type="text"
              required
              maxLength={15}
              value={config.pix_cidade}
              onChange={(e) => setConfig({ ...config, pix_cidade: e.target.value.toUpperCase() })}
              className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
            />
            <span className="text-[10px] text-text-muted block mt-1">Ex: VISCONDE DO RIO BRANCO</span>
          </div>
        </div>
      </div>

      {/* SEÇÃO 3: HORÁRIOS DE ATENDIMENTO (SEGUNDA A SÁBADO) */}
      <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 md:p-6 space-y-4">
        <div className="border-b border-border-subtle pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-heading text-base font-bold text-text-main flex items-center gap-2">
              <Clock className="w-4 h-4 text-gold" />
              <span>3. Horários de Atendimento (Segunda a Sábado)</span>
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Configure os dias de atendimento e os horários de início e término para cada dia da semana.
            </p>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gold/15 text-gold border border-gold/30 self-start sm:self-auto">
            Sábado Habilitado
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {DIAS_ORDENADOS.map((dia) => {
            const h = horarios.find((item) => item.dia_semana === dia) || {
              dia_semana: dia,
              abre: "17:00:00",
              fecha: "21:00:00",
              ativo: dia !== 0,
            };

            const abreFormatado = h.abre.substring(0, 5);
            const fechaFormatado = h.fecha.substring(0, 5);

            return (
              <div
                key={dia}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                  h.ativo
                    ? "bg-surface-2/60 border-border-subtle"
                    : "bg-surface-2/20 border-border-subtle/50 opacity-60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`dia-${dia}`}
                    checked={h.ativo}
                    onChange={(e) => updateHorario(dia, "ativo", e.target.checked)}
                    className="w-4 h-4 rounded border-border-subtle accent-gold cursor-pointer"
                  />
                  <label
                    htmlFor={`dia-${dia}`}
                    className="text-xs font-semibold text-text-main cursor-pointer min-w-[120px]"
                  >
                    {DIAS_NOMES[dia]}
                  </label>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                      h.ativo
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-destructive/15 text-destructive border border-destructive/30"
                    }`}
                  >
                    {h.ativo ? "Aberto" : "Fechado"}
                  </span>
                </div>

                {h.ativo ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-text-muted">Abertura:</span>
                    <input
                      type="time"
                      value={abreFormatado}
                      onChange={(e) => updateHorario(dia, "abre", e.target.value)}
                      className="bg-surface-1 border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-main text-xs focus:outline-none focus:border-gold"
                    />
                    <span className="text-text-muted ml-1">Fechamento:</span>
                    <input
                      type="time"
                      value={fechaFormatado}
                      onChange={(e) => updateHorario(dia, "fecha", e.target.value)}
                      className="bg-surface-1 border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-main text-xs focus:outline-none focus:border-gold"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-text-muted italic">
                    Sem atendimentos neste dia
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SEÇÃO 4: REGRAS DE AGENDAMENTO & CANCELAMENTO COM MULTA */}
      <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 md:p-6 space-y-4">
        <h2 className="font-heading text-base font-bold text-text-main border-b border-border-subtle pb-2 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-gold" />
          <span>4. Regras de Agendamento, Tolerâncias e Multas</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="text-text-muted block mb-1">Duração Padrão do Horário (minutos):</label>
            <input
              type="number"
              min={15}
              step={15}
              value={config.duracao_horario_min}
              onChange={(e) => setConfig({ ...config, duracao_horario_min: parseInt(e.target.value) || 60 })}
              className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
            />
          </div>

          <div>
            <label className="text-text-muted block mb-1">Antecedência Mínima para Agendar (horas):</label>
            <input
              type="number"
              min={0}
              value={config.antecedencia_minima_horas}
              onChange={(e) => setConfig({ ...config, antecedencia_minima_horas: parseInt(e.target.value) || 1 })}
              className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
            />
          </div>

          <div>
            <label className="text-text-muted block mb-1">Janela de Dias Liberados à Frente:</label>
            <input
              type="number"
              min={1}
              value={config.janela_dias}
              onChange={(e) => setConfig({ ...config, janela_dias: parseInt(e.target.value) || 30 })}
              className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
            />
          </div>

          <div>
            <label className="text-text-muted block mb-1">Prazo para Cancelamento Grátis (horas antes):</label>
            <input
              type="number"
              min={1}
              value={config.horas_cancelamento_gratis}
              onChange={(e) => setConfig({ ...config, horas_cancelamento_gratis: parseInt(e.target.value) || 3 })}
              className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
            />
          </div>

          <div>
            <label className="text-text-muted block mb-1">Percentual da Multa (%):</label>
            <input
              type="number"
              min={0}
              max={100}
              value={config.multa_percentual}
              onChange={(e) => setConfig({ ...config, multa_percentual: parseFloat(e.target.value) || 50 })}
              className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
            />
          </div>

          <div>
            <label className="text-text-muted block mb-1">Dias para Considerar Cliente Sumido:</label>
            <input
              type="number"
              min={5}
              value={config.dias_cliente_sumido}
              onChange={(e) => setConfig({ ...config, dias_cliente_sumido: parseInt(e.target.value) || 15 })}
              className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
            />
          </div>
        </div>

        <label className="flex items-center gap-3 pt-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={config.bloquear_se_multa_pendente}
            onChange={(e) => setConfig({ ...config, bloquear_se_multa_pendente: e.target.checked })}
            className="w-4 h-4 rounded border-border-subtle accent-gold"
          />
          <span className="text-xs text-text-main font-medium">
            Bloquear novos agendamentos enquanto houver multa pendente
          </span>
        </label>
      </div>

      {/* SEÇÃO 5: BENEFÍCIOS, ANIVERSÁRIO & FIDELIDADE */}
      <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 md:p-6 space-y-4">
        <h2 className="font-heading text-base font-bold text-text-main border-b border-border-subtle pb-2 flex items-center gap-2">
          <Gift className="w-4 h-4 text-gold" />
          <span>5. Aniversário & Programa de Fidelidade</span>
        </h2>

        {/* Aniversário */}
        <div className="space-y-3 bg-surface-2/40 p-4 rounded-xl border border-border-subtle">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.desconto_aniversario_ativo}
              onChange={(e) => setConfig({ ...config, desconto_aniversario_ativo: e.target.checked })}
              className="w-4 h-4 rounded border-border-subtle accent-gold"
            />
            <span className="text-xs text-text-main font-bold">
              Ativar Desconto de Aniversário
            </span>
          </label>

          {config.desconto_aniversario_ativo && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <label className="text-text-muted block mb-1">Percentual de Desconto (%):</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={config.desconto_aniversario_percentual}
                  onChange={(e) => setConfig({ ...config, desconto_aniversario_percentual: parseFloat(e.target.value) || 10 })}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="text-text-muted block mb-1">Regra de Validade:</label>
                <select
                  value={config.desconto_aniversario_regra}
                  onChange={(e) => setConfig({ ...config, desconto_aniversario_regra: e.target.value as any })}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                >
                  <option value="dia">Apenas no dia do aniversário</option>
                  <option value="semana">Na semana do aniversário (+/- 3 dias)</option>
                  <option value="mes">Durante todo o mês de aniversário</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Fidelidade */}
        <div className="space-y-3 bg-surface-2/40 p-4 rounded-xl border border-border-subtle">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.fidelidade_ativo}
              onChange={(e) => setConfig({ ...config, fidelidade_ativo: e.target.checked })}
              className="w-4 h-4 rounded border-border-subtle accent-gold"
            />
            <span className="text-xs text-text-main font-bold">
              Ativar Programa de Fidelidade
            </span>
          </label>

          {config.fidelidade_ativo && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <label className="text-text-muted block mb-1">A cada quantos cortes concluídos ganha cortesia:</label>
                <input
                  type="number"
                  min={3}
                  value={config.fidelidade_a_cada_visitas}
                  onChange={(e) => setConfig({ ...config, fidelidade_a_cada_visitas: parseInt(e.target.value) || 10 })}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="text-text-muted block mb-1">Serviço de Cortesia:</label>
                <select
                  value={config.fidelidade_servico_premio_id || ""}
                  onChange={(e) => setConfig({ ...config, fidelidade_servico_premio_id: e.target.value || null })}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                >
                  <option value="">-- Selecione o serviço prêmio --</option>
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 bg-gold hover:bg-gold-hover text-bg-base font-bold text-sm px-6 py-3 rounded-xl shadow-lg shadow-gold/20 transition-all active:scale-95 disabled:opacity-50"
        >
          <Save className="w-4 h-4 stroke-[2.5]" />
          <span>{isSaving ? "Salvando..." : "Salvar Configurações"}</span>
        </button>
      </div>
    </form>
  );
}
