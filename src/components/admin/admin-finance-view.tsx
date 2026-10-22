"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Download,
  CreditCard,
  AlertCircle,
  FileText,
  CalendarCheck,
  Clock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { toast } from "sonner";
import { Lancamento, Agendamento, Multa, Servico, Cliente } from "@/lib/supabase/types";
import { formatCurrency, formatPhone } from "@/lib/formatters";
import { formatDateShort } from "@/lib/date/tz";
import { criarLancamentoAction } from "@/actions/admin";
import { useRealtimeSync, broadcastSync } from "@/hooks/use-realtime-sync";

interface AdminFinanceViewProps {
  lancamentos: Lancamento[];
  pendencias: Agendamento[];
  multasPendentes: Multa[];
  agendamentosPrevistos?: Agendamento[];
  faturamentoPrevistoTotal?: number;
  servicos: Servico[];
  clientes: Cliente[];
}

export function AdminFinanceView({
  lancamentos,
  pendencias,
  multasPendentes,
  agendamentosPrevistos = [],
  faturamentoPrevistoTotal = 0,
  servicos,
  clientes,
}: AdminFinanceViewProps) {
  const router = useRouter();

  // Sincronização em tempo real (WebSockets + BroadcastChannel + foco)
  useRealtimeSync({
    tables: ["lancamentos", "agendamentos", "multas"],
    onSync: () => router.refresh(),
  });

  const [periodo, setPeriodo] = useState<"hoje" | "semana" | "mes" | "tudo">("mes");

  // Modais
  const [openNovoLancamento, setOpenNovoLancamento] = useState(false);

  // Formulário de Lançamento Manual
  const [tipo, setTipo] = useState<"entrada" | "saida">("saida");
  const [categoria, setCategoria] = useState("Produtos");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [dataLancamento, setDataLancamento] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [formaPagamento, setFormaPagamento] = useState<string>("dinheiro");
  const [isSubmittingLancamento, setIsSubmittingLancamento] = useState(false);

  const hoje = new Date().toISOString().split("T")[0];

  // Filtragem por período
  const filteredLancamentos = lancamentos.filter((l) => {
    if (periodo === "hoje") return l.data === hoje;
    if (periodo === "semana") {
      const diffDias =
        (new Date().getTime() - new Date(l.data).getTime()) / (1000 * 60 * 60 * 24);
      return diffDias <= 7;
    }
    if (periodo === "mes") {
      const mesAtual = new Date().getMonth();
      const anoAtual = new Date().getFullYear();
      const lancDate = new Date(l.data);
      return lancDate.getMonth() === mesAtual && lancDate.getFullYear() === anoAtual;
    }
    return true;
  });

  // Filtragem de agendamentos previstos por período (apenas agendados/confirmados, excluindo cancelados)
  const filteredAgendamentosPrevistos = agendamentosPrevistos.filter((ag) => {
    const dataStr = ag.inicio ? ag.inicio.split("T")[0] : "";
    if (periodo === "hoje") return dataStr === hoje;
    if (periodo === "semana") {
      const diffDias = (new Date(dataStr).getTime() - new Date(hoje).getTime()) / (1000 * 60 * 60 * 24);
      return Math.abs(diffDias) <= 7;
    }
    if (periodo === "mes") {
      const mesAtual = new Date().getMonth();
      const anoAtual = new Date().getFullYear();
      const agDate = new Date(ag.inicio);
      return agDate.getMonth() === mesAtual && agDate.getFullYear() === anoAtual;
    }
    return true;
  });

  const totalPrevistoPeriodo = filteredAgendamentosPrevistos.reduce(
    (acc, ag) => acc + Number(ag.valor_total || 0),
    0
  );

  // Cálculos Financeiros
  const totalEntradas = filteredLancamentos
    .filter((l) => l.tipo === "entrada")
    .reduce((acc, l) => acc + Number(l.valor), 0);

  const totalSaidas = filteredLancamentos
    .filter((l) => l.tipo === "saida")
    .reduce((acc, l) => acc + Number(l.valor), 0);

  const lucroLiquido = totalEntradas - totalSaidas;

  const entradasCount = filteredLancamentos.filter((l) => l.tipo === "entrada").length;
  const ticketMedio = entradasCount > 0 ? totalEntradas / entradasCount : 0;

  const totalPendencias = pendencias.reduce((acc, p) => acc + Number(p.valor_total), 0);

  // Dados para Gráficos
  const paymentMethodsData = [
    { name: "Pix", value: 0 },
    { name: "Dinheiro", value: 0 },
    { name: "Débito", value: 0 },
    { name: "Crédito", value: 0 },
  ];

  filteredLancamentos
    .filter((l) => l.tipo === "entrada")
    .forEach((l) => {
      const forma = l.forma_pagamento?.toLowerCase();
      if (forma === "pix") paymentMethodsData[0].value += Number(l.valor);
      else if (forma === "dinheiro") paymentMethodsData[1].value += Number(l.valor);
      else if (forma === "debito") paymentMethodsData[2].value += Number(l.valor);
      else if (forma === "credito") paymentMethodsData[3].value += Number(l.valor);
    });

  const COLORS = ["#C9A24A", "#4CAF7A", "#3B82F6", "#8A5A36"];

  const handleSalvarLancamento = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(valor);
    if (!num || num <= 0) {
      toast.error("Informe um valor válido maior que zero.");
      return;
    }

    setIsSubmittingLancamento(true);
    const res = await criarLancamentoAction({
      tipo,
      categoria,
      descricao,
      valor: num,
      data: dataLancamento,
      formaPagamento: formaPagamento as any,
    });
    setIsSubmittingLancamento(false);

    if (!res.success) {
      toast.error(res.error || "Erro ao registrar lançamento");
      return;
    }

    toast.success("Lançamento adicionado com sucesso!");
    broadcastSync("lancamentos");
    setOpenNovoLancamento(false);
    setDescricao("");
    setValor("");
    router.refresh();
  };

  // Exportar Relatório em PDF
  const handleExportPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Permita pop-ups no navegador para gerar o PDF.");
      return;
    }

    const periodoLabels: Record<string, string> = {
      hoje: "Hoje",
      semana: "Últimos 7 Dias",
      mes: "Mês Atual",
      tudo: "Todo o Período",
    };
    const periodoLabel = periodoLabels[periodo] || "Geral";

    const rowsHtml = filteredLancamentos
      .map(
        (l) => `
        <tr>
          <td style="padding: 9px 12px; border-bottom: 1px solid #e5e7eb; font-size: 12px; white-space: nowrap;">${formatDateShort(l.data)}</td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #e5e7eb; font-size: 11px; font-weight: 700; text-transform: uppercase; color: ${
            l.tipo === "entrada" ? "#16a34a" : "#dc2626"
          };">${l.tipo}</td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #e5e7eb; font-size: 12px;">${l.categoria || "-"}</td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #e5e7eb; font-size: 12px;">${l.descricao}</td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #e5e7eb; font-size: 12px; text-transform: capitalize;">${l.forma_pagamento || "-"}</td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #e5e7eb; font-size: 12px; font-weight: 700; text-align: right; color: ${
            l.tipo === "entrada" ? "#16a34a" : "#dc2626"
          };">
            ${l.tipo === "entrada" ? "+" : "-"} ${formatCurrency(Number(l.valor))}
          </td>
        </tr>
      `
      )
      .join("");

    const nowFormatted = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Relatório Financeiro - Barbearia do Luiz</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 32px 40px;
            color: #111827;
            background: #ffffff;
            line-height: 1.4;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #C9A24A;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .brand-title {
            font-size: 24px;
            font-weight: 800;
            color: #111827;
            letter-spacing: -0.5px;
            margin: 0;
          }
          .brand-sub {
            font-size: 13px;
            color: #6b7280;
            margin-top: 4px;
          }
          .badge {
            background: #fdf8eb;
            color: #C9A24A;
            font-weight: 700;
            font-size: 11px;
            padding: 6px 12px;
            border-radius: 6px;
            border: 1px solid #e8d7a7;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .cards {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 28px;
          }
          .card {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 12px 14px;
          }
          .card-title {
            font-size: 11px;
            text-transform: uppercase;
            font-weight: 600;
            color: #6b7280;
          }
          .card-value {
            font-size: 18px;
            font-weight: 800;
            margin-top: 4px;
          }
          .table-title {
            font-size: 14px;
            font-weight: 700;
            margin-bottom: 10px;
            color: #374151;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
          }
          th {
            background: #f3f4f6;
            text-align: left;
            padding: 10px 12px;
            font-size: 11px;
            font-weight: 700;
            color: #4b5563;
            text-transform: uppercase;
            border-top: 1px solid #e5e7eb;
            border-bottom: 2px solid #e5e7eb;
          }
          .footer {
            margin-top: 40px;
            font-size: 11px;
            color: #9ca3af;
            text-align: center;
            border-top: 1px solid #e5e7eb;
            padding-top: 16px;
          }
          @media print {
            body { margin: 15px; }
            @page { margin: 1.5cm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="brand-title">Barbearia do Luiz</h1>
            <div class="brand-sub">
              Relatório Financeiro &bull; Período: <strong>${periodoLabel}</strong> &bull; Gerado em: ${nowFormatted}
            </div>
          </div>
          <div>
            <span class="badge">Relatório Oficial</span>
          </div>
        </div>

        <div class="cards">
          <div class="card">
            <div class="card-title">Recebido (Entradas)</div>
            <div class="card-value" style="color: #16a34a;">${formatCurrency(totalEntradas)}</div>
          </div>
          <div class="card">
            <div class="card-title">Previsto (Agendamentos)</div>
            <div class="card-value" style="color: #3b82f6;">${formatCurrency(totalPrevistoPeriodo)}</div>
          </div>
          <div class="card">
            <div class="card-title">Total Saídas</div>
            <div class="card-value" style="color: #dc2626;">${formatCurrency(totalSaidas)}</div>
          </div>
          <div class="card">
            <div class="card-title">Lucro Líquido</div>
            <div class="card-value" style="color: ${lucroLiquido >= 0 ? "#16a34a" : "#dc2626"};">${formatCurrency(lucroLiquido)}</div>
          </div>
          <div class="card">
            <div class="card-title">Ticket Médio</div>
            <div class="card-value" style="color: #C9A24A;">${formatCurrency(ticketMedio)}</div>
          </div>
        </div>

        <div class="table-title">Detalhamento dos Lançamentos (${filteredLancamentos.length})</div>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Categoria</th>
              <th>Descrição</th>
              <th>Forma Pgto</th>
              <th style="text-align: right;">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${
              rowsHtml ||
              '<tr><td colspan="6" style="padding: 24px; text-align: center; color: #9ca3af; font-size: 12px;">Nenhum lançamento no período selecionado.</td></tr>'
            }
          </tbody>
        </table>

        <div class="footer">
          Barbearia do Luiz &bull; Gestão Financeira &bull; Visconde do Rio Branco - MG
        </div>

        <script>
          window.onload = function() {
            window.focus();
            window.print();
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
    toast.success("Relatório financeiro gerado para visualização e impressão em PDF!");
  };

  return (
    <div className="space-y-6">
      {/* CABEÇALHO E AÇÕES */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <span className="text-xs text-gold font-semibold">
            Controle de Caixa
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-text-main">
            Gestão Financeira
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOpenNovoLancamento(true)}
            className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-hover text-bg-base font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Novo Lançamento</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 bg-surface-2 hover:bg-surface-3 text-text-main border border-border-subtle text-xs px-3.5 py-2.5 rounded-xl transition-colors shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 text-gold" />
            <span>Gerar Relatório PDF</span>
          </button>
        </div>
      </div>

      {/* FILTROS DE PERÍODO */}
      <div className="flex gap-2 bg-surface-1 p-1.5 rounded-2xl border border-border-subtle w-fit">
        {[
          { id: "hoje", label: "Hoje" },
          { id: "semana", label: "7 Dias" },
          { id: "mes", label: "Este Mês" },
          { id: "tudo", label: "Tudo" },
        ].map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriodo(p.id as typeof periodo)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              periodo === p.id
                ? "bg-gold text-bg-base shadow-sm"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* CARDS DE RESUMO FINANCEIRO */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-success">
            <span className="text-xs text-text-muted">Total Entradas (Pago)</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <span className="text-2xl font-bold font-heading text-success block">
            {formatCurrency(totalEntradas)}
          </span>
          <span className="text-[10px] text-text-muted">{entradasCount} recebimento(s)</span>
        </div>

        <div className="bg-surface-1 border border-blue-500/30 rounded-2xl p-4 space-y-1 bg-gradient-to-b from-surface-1 to-surface-2">
          <div className="flex items-center justify-between text-blue-400">
            <span className="text-xs text-text-muted">Faturamento Previsto</span>
            <CalendarCheck className="w-4 h-4" />
          </div>
          <span className="text-2xl font-bold font-heading text-blue-400 block">
            {formatCurrency(totalPrevistoPeriodo)}
          </span>
          <span className="text-[10px] text-text-muted">
            {filteredAgendamentosPrevistos.length} agendamento(s) ativo(s)
          </span>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-destructive">
            <span className="text-xs text-text-muted">Total Saídas</span>
            <TrendingDown className="w-4 h-4" />
          </div>
          <span className="text-2xl font-bold font-heading text-destructive block">
            {formatCurrency(totalSaidas)}
          </span>
          <span className="text-[10px] text-text-muted">Despesas operacionais</span>
        </div>

        <div className="bg-surface-1 border border-border-gold/40 rounded-2xl p-4 space-y-1 bg-gradient-to-b from-surface-1 to-surface-2">
          <div className="flex items-center justify-between text-gold">
            <span className="text-xs text-text-muted">Lucro Líquido</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <span className="text-2xl font-bold font-heading text-gold block">
            {formatCurrency(lucroLiquido)}
          </span>
          <span className="text-[10px] text-text-muted">
            Ticket médio: {formatCurrency(ticketMedio)}
          </span>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-4 space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-warning">
            <span className="text-xs text-text-muted">A Receber</span>
            <AlertCircle className="w-4 h-4" />
          </div>
          <span className="text-2xl font-bold font-heading text-warning block">
            {formatCurrency(totalPendencias)}
          </span>
          <span className="text-[10px] text-text-muted">
            {pendencias.length} atendimento(s) em aberto
          </span>
        </div>
      </div>

      {/* GRÁFICOS INTERATIVOS RECHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico 1: Faturamento por Forma de Pagamento */}
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 space-y-3">
          <h3 className="font-heading text-sm font-bold text-text-main">
            Faturamento por Forma de Pagamento
          </h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentMethodsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#A39C8E" fontSize={11} tickLine={false} />
                <YAxis stroke="#A39C8E" fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(val: unknown) => [formatCurrency(Number(Array.isArray(val) ? val[0] : val || 0)), "Total"]}
                  contentStyle={{
                    backgroundColor: "#181612",
                    borderColor: "#2E2A22",
                    borderRadius: "12px",
                    color: "#F3EEE4",
                  }}
                />
                <Bar dataKey="value" fill="#C9A24A" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Composição Entradas vs Saídas */}
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 space-y-3">
          <h3 className="font-heading text-sm font-bold text-text-main">
            Entradas vs Saídas
          </h3>
          <div className="h-56 w-full flex items-center justify-center">
            {totalEntradas === 0 && totalSaidas === 0 ? (
              <p className="text-xs text-text-muted italic">Sem movimentações no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Entradas", value: totalEntradas },
                      { name: "Saídas", value: totalSaidas },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    <Cell fill="#4CAF7A" />
                    <Cell fill="#D9534F" />
                  </Pie>
                  <Tooltip
                    formatter={(val: unknown) => [formatCurrency(Number(Array.isArray(val) ? val[0] : val || 0)), "Total"]}
                    contentStyle={{
                      backgroundColor: "#181612",
                      borderColor: "#2E2A22",
                      borderRadius: "12px",
                      color: "#F3EEE4",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* TABELA DE LANÇAMENTOS */}
      <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base font-bold text-text-main">
            Extrato de Lançamentos
          </h3>
          <span className="text-xs text-text-muted">
            {filteredLancamentos.length} registro(s)
          </span>
        </div>

        {filteredLancamentos.length === 0 ? (
          <p className="text-xs text-text-muted italic">Nenhum lançamento no período.</p>
        ) : (
          <div className="space-y-2">
            {filteredLancamentos.map((l) => (
              <div
                key={l.id}
                className="bg-surface-2/60 border border-border-subtle rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] font-bold capitalize px-2 py-0.5 rounded-full ${
                        l.tipo === "entrada"
                          ? "bg-success/20 text-success"
                          : "bg-destructive/20 text-destructive"
                      }`}
                    >
                      {l.tipo}
                    </span>
                    <span className="font-semibold text-text-main">{l.categoria}</span>
                  </div>
                  <p className="text-text-muted text-[11px]">{l.descricao}</p>
                  <span className="text-[10px] text-text-muted block">
                    {formatDateShort(l.data)} &bull; {l.forma_pagamento || "Não especificado"}
                  </span>
                </div>

                <span
                  className={`text-base font-bold font-heading ${
                    l.tipo === "entrada" ? "text-success" : "text-destructive"
                  }`}
                >
                  {l.tipo === "entrada" ? "+" : "-"} {formatCurrency(l.valor)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL 1: NOVO LANÇAMENTO MANUAL */}
      {openNovoLancamento && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setOpenNovoLancamento(false)}
        >
          <div
            className="bg-surface-1 border border-border-gold/60 rounded-3xl p-6 max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="font-heading text-lg font-bold text-text-main">
                Novo Lançamento
              </h3>
              <button
                type="button"
                onClick={() => setOpenNovoLancamento(false)}
                className="text-text-muted hover:text-text-main"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSalvarLancamento} className="space-y-3 text-xs">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTipo("entrada")}
                  className={`flex-1 py-2 rounded-xl font-bold border transition-all ${
                    tipo === "entrada"
                      ? "bg-success/20 text-success border-success"
                      : "bg-surface-2 border-border-subtle text-text-muted"
                  }`}
                >
                  Entrada (Receita)
                </button>
                <button
                  type="button"
                  onClick={() => setTipo("saida")}
                  className={`flex-1 py-2 rounded-xl font-bold border transition-all ${
                    tipo === "saida"
                      ? "bg-destructive/20 text-destructive border-destructive"
                      : "bg-surface-2 border-border-subtle text-text-muted"
                  }`}
                >
                  Saída (Despesa)
                </button>
              </div>

              <div>
                <label className="text-text-muted block mb-1">Categoria:</label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                >
                  {tipo === "entrada" ? (
                    <>
                      <option value="Atendimento">Atendimento</option>
                      <option value="Venda de Produto">Venda de Produto (pomada, etc)</option>
                      <option value="Crédito Pré-Pago">Crédito Pré-Pago</option>
                      <option value="Multa">Multa Recebida</option>
                      <option value="Outros">Outras Entradas</option>
                    </>
                  ) : (
                    <>
                      <option value="Produtos">Produtos e Cosméticos</option>
                      <option value="Equipamentos">Equipamentos e Lâminas</option>
                      <option value="Aluguel">Aluguel do Ponto</option>
                      <option value="Contas">Contas (Luz, Água, Internet)</option>
                      <option value="Marketing">Marketing / Divulgação</option>
                      <option value="Outros">Outras Despesas</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="text-text-muted block mb-1">Descrição:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Compra de toalhas novas"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-text-muted block mb-1">Valor (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="text-text-muted block mb-1">Data:</label>
                  <input
                    type="date"
                    required
                    value={dataLancamento}
                    onChange={(e) => setDataLancamento(e.target.value)}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div>
                <label className="text-text-muted block mb-1">Forma de Pagamento:</label>
                <select
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value)}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                >
                  <option value="pix">Pix</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="debito">Cartão de Débito</option>
                  <option value="credito">Cartão de Crédito</option>
                  <option value="outro">Outro</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmittingLancamento}
                className="w-full bg-gold hover:bg-gold-hover text-bg-base font-bold text-xs py-3 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {isSubmittingLancamento ? "Salvando..." : "Registrar Lançamento"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
