"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  Plus,
  Search,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Edit2,
  Trash2,
  Download,
  Printer,
  RotateCcw,
  Minus,
  Check,
  X,
  FileSpreadsheet,
  Layers,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { EstoquePeca } from "@/lib/supabase/types";
import { ESTOQUE_CATEGORIAS } from "@/lib/estoque-seed";
import { formatCurrency } from "@/lib/formatters";
import {
  salvarEstoquePecaAction,
  ajustarQuantidadeEstoqueAction,
  excluirEstoquePecaAction,
  restaurarEstoquePadraoAction,
} from "@/actions/admin";
import { useRealtimeSync, broadcastSync } from "@/hooks/use-realtime-sync";

interface AdminStockViewProps {
  initialPecas: EstoquePeca[];
}

export function AdminStockView({ initialPecas }: AdminStockViewProps) {
  const router = useRouter();
  const [pecas, setPecas] = useState<EstoquePeca[]>(initialPecas);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");
  const [statusFiltro, setStatusFiltro] = useState<"todos" | "baixo" | "zerado" | "normal">("todos");
  const [ordenacao, setOrdenacao] = useState<"planilha" | "receita_desc" | "valor_desc" | "estoque_asc" | "nome_asc">("planilha");

  // Estados de edição / criação
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPeca, setEditingPeca] = useState<Partial<EstoquePeca> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Edição rápida de valor ou estoque direto na linha
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineValor, setInlineValor] = useState<string>("");
  const [inlineEstoque, setInlineEstoque] = useState<string>("");

  useRealtimeSync({
    tables: ["estoque_pecas"],
    onSync: () => router.refresh(),
  });

  // Métricas gerais calculadas sobre todo o estoque (fórmula da planilha Gilmar.xlsx: RECEITA = VALOR * ESTOQUE)
  const metricas = useMemo(() => {
    const totalItens = pecas.length;
    const totalUnidades = pecas.reduce((acc, p) => acc + Number(p.quantidade || 0), 0);
    const receitaTotalEstoque = pecas.reduce(
      (acc, p) => acc + Number(p.valor_unitario || 0) * Number(p.quantidade || 0),
      0
    );
    const somaValoresUnitarios = pecas.reduce((acc, p) => acc + Number(p.valor_unitario || 0), 0);
    const itensEstoqueBaixo = pecas.filter(
      (p) => Number(p.quantidade || 0) <= Number(p.estoque_minimo || 1)
    ).length;
    const itensZerados = pecas.filter((p) => Number(p.quantidade || 0) === 0).length;

    return {
      totalItens,
      totalUnidades,
      receitaTotalEstoque,
      somaValoresUnitarios,
      itensEstoqueBaixo,
      itensZerados,
    };
  }, [pecas]);

  // Lista filtrada e ordenada
  const pecasFiltradas = useMemo(() => {
    const filtradas = pecas.filter((p) => {
      const matchesSearch =
        p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.categoria || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.observacao || "").toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (categoriaFiltro !== "todas" && p.categoria !== categoriaFiltro) {
        return false;
      }

      const qtd = Number(p.quantidade || 0);
      const min = Number(p.estoque_minimo || 1);

      if (statusFiltro === "zerado" && qtd > 0) return false;
      if (statusFiltro === "baixo" && qtd > min) return false;
      if (statusFiltro === "normal" && qtd <= min) return false;

      return true;
    });

    return [...filtradas].sort((a, b) => {
      if (ordenacao === "receita_desc") {
        const recA = Number(a.valor_unitario || 0) * Number(a.quantidade || 0);
        const recB = Number(b.valor_unitario || 0) * Number(b.quantidade || 0);
        return recB - recA;
      }
      if (ordenacao === "valor_desc") {
        return Number(b.valor_unitario || 0) - Number(a.valor_unitario || 0);
      }
      if (ordenacao === "estoque_asc") {
        return Number(a.quantidade || 0) - Number(b.quantidade || 0);
      }
      if (ordenacao === "nome_asc") {
        return a.nome.localeCompare(b.nome, "pt-BR");
      }
      return (a.ordem ?? 99) - (b.ordem ?? 99);
    });
  }, [pecas, searchTerm, categoriaFiltro, statusFiltro, ordenacao]);

  // Totais da seleção filtrada
  const totaisFiltrados = useMemo(() => {
    const unidades = pecasFiltradas.reduce((acc, p) => acc + Number(p.quantidade || 0), 0);
    const receita = pecasFiltradas.reduce(
      (acc, p) => acc + Number(p.valor_unitario || 0) * Number(p.quantidade || 0),
      0
    );
    return { unidades, receita };
  }, [pecasFiltradas]);

  // Ajuste rápido +1 / -1
  const handleQuickAdjust = async (peca: EstoquePeca, delta: number) => {
    const novaQtd = Math.max(0, Number(peca.quantidade || 0) + delta);
    if (novaQtd === peca.quantidade) return;

    // Atualização otimista imediata
    setPecas((prev) =>
      prev.map((item) => (item.id === peca.id ? { ...item, quantidade: novaQtd } : item))
    );
    setUpdatingId(peca.id);

    const res = await ajustarQuantidadeEstoqueAction(peca.id, novaQtd);
    setUpdatingId(null);

    if (!res.success) {
      toast.error(res.error || "Erro ao atualizar quantidade.");
      setPecas(initialPecas);
      return;
    }

    broadcastSync("estoque_pecas");
  };

  // Iniciar edição inline na linha da tabela
  const handleStartInlineEdit = (peca: EstoquePeca) => {
    setInlineEditId(peca.id);
    setInlineValor(String(peca.valor_unitario));
    setInlineEstoque(String(peca.quantidade));
  };

  // Salvar edição inline na linha da tabela
  const handleSaveInlineEdit = async (peca: EstoquePeca) => {
    const novoValor = Math.max(0, Number(inlineValor.replace(",", ".")) || 0);
    const novoEstoque = Math.max(0, Math.round(Number(inlineEstoque) || 0));

    setUpdatingId(peca.id);
    setInlineEditId(null);

    setPecas((prev) =>
      prev.map((item) =>
        item.id === peca.id
          ? { ...item, valor_unitario: novoValor, quantidade: novoEstoque }
          : item
      )
    );

    const res = await salvarEstoquePecaAction({
      ...peca,
      valor_unitario: novoValor,
      quantidade: novoEstoque,
    });
    setUpdatingId(null);

    if (!res.success) {
      toast.error(res.error || "Erro ao atualizar item.");
      return;
    }

    toast.success(`${peca.nome} atualizado!`);
    broadcastSync("estoque_pecas");
  };

  // Abrir modal para criar ou editar peça
  const handleOpenModal = (peca?: EstoquePeca) => {
    if (peca) {
      setEditingPeca({ ...peca });
    } else {
      setEditingPeca({
        nome: "",
        categoria: "Material Elétrico",
        valor_unitario: 0,
        quantidade: 1,
        estoque_minimo: 1,
        unidade: "un",
        observacao: "",
        ordem: pecas.length + 1,
      });
    }
    setModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPeca || !editingPeca.nome?.trim()) {
      toast.error("Informe o nome da peça ou material.");
      return;
    }

    setIsSaving(true);
    const res = await salvarEstoquePecaAction(editingPeca);
    setIsSaving(false);

    if (!res.success || !res.peca) {
      toast.error(res.error || "Não foi possível salvar a peça.");
      return;
    }

    const saved = res.peca;
    setPecas((prev) => {
      const exists = prev.some((p) => p.id === saved.id);
      if (exists) {
        return prev.map((p) => (p.id === saved.id ? saved : p));
      }
      return [...prev, saved];
    });

    toast.success(editingPeca.id ? "Peça atualizada no estoque!" : "Nova peça adicionada ao estoque!");
    setModalOpen(false);
    setEditingPeca(null);
    broadcastSync("estoque_pecas");
    router.refresh();
  };

  const handleDelete = async (peca: EstoquePeca) => {
    if (!window.confirm(`Deseja realmente remover "${peca.nome}" da planilha de estoque?`)) {
      return;
    }

    setUpdatingId(peca.id);
    const res = await excluirEstoquePecaAction(peca.id);
    setUpdatingId(null);

    if (!res.success) {
      toast.error(res.error || "Erro ao remover item.");
      return;
    }

    setPecas((prev) => prev.filter((p) => p.id !== peca.id));
    toast.success(`"${peca.nome}" removido do estoque.`);
    broadcastSync("estoque_pecas");
  };

  const handleRestoreDefaults = async () => {
    if (
      !window.confirm(
        "Deseja restaurar os 44 itens originais da planilha Gilmar.xlsx? Isso redefinirá os valores e quantidades para o padrão inicial da planilha."
      )
    ) {
      return;
    }

    setIsRestoring(true);
    const res = await restaurarEstoquePadraoAction();
    setIsRestoring(false);

    if (!res.success || !res.pecas) {
      toast.error(res.error || "Erro ao restaurar planilha padrão.");
      return;
    }

    setPecas(res.pecas);
    toast.success("Planilha original do Gilmar (44 itens) restaurada com sucesso!");
    broadcastSync("estoque_pecas");
    router.refresh();
  };

  // Exportar para CSV compatível com Microsoft Excel (UTF-8 com BOM e separador ;)
  const handleExportCSV = () => {
    const headers = ["ITEM", "CATEGORIA", "VALOR (R$)", "ESTOQUE", "RECEITA (R$)", "OBSERVACAO"];
    const rows = pecasFiltradas.map((p) => {
      const valor = Number(p.valor_unitario || 0);
      const qtd = Number(p.quantidade || 0);
      const receita = valor * qtd;
      return [
        `"${p.nome.replace(/"/g, '""')}"`,
        `"${(p.categoria || "Material Elétrico").replace(/"/g, '""')}"`,
        valor.toFixed(2).replace(".", ","),
        String(qtd),
        receita.toFixed(2).replace(".", ","),
        `"${(p.observacao || "").replace(/"/g, '""')}"`,
      ].join(";");
    });

    // Linha final de totalização idêntica à planilha
    rows.push(
      [
        '"TOTAL GERAL"',
        '""',
        metricas.somaValoresUnitarios.toFixed(2).replace(".", ","),
        String(totaisFiltrados.unidades),
        totaisFiltrados.receita.toFixed(2).replace(".", ","),
        '""',
      ].join(";")
    );

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Estoque_Gilmar_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Planilha de estoque exportada para Excel (.CSV)!");
  };

  // Imprimir / Salvar Relatório de Estoque em PDF
  const handlePrintStockPDF = () => {
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Permita pop-ups para imprimir o relatório de estoque.");
      return;
    }

    const origin = window.location.origin;
    const dataHoje = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());

    const rowsHtml = pecasFiltradas
      .map((p, idx) => {
        const valor = Number(p.valor_unitario || 0);
        const qtd = Number(p.quantidade || 0);
        const receita = valor * qtd;
        const bgRow = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        const badgeColor =
          qtd === 0 ? "#fee2e2;color:#991b1b" : qtd <= 1 ? "#fef3c7;color:#92400e" : "#dcfce7;color:#166534";

        return `
          <tr style="background:${bgRow};">
            <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center;font-weight:700;color:#475569;">${idx + 1}</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;font-weight:700;color:#0f172a;">${p.nome}</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#475569;">${p.categoria || "Material Elétrico"}</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;text-align:right;font-weight:600;">${formatCurrency(valor)}</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;text-align:center;font-weight:700;background:${badgeColor};">${qtd}</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;text-align:right;font-weight:800;color:#0e74bc;">${formatCurrency(receita)}</td>
          </tr>
        `;
      })
      .join("");

    win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Controle de Estoque — GS Elétrica e Manutenção</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 0; padding: 0; font-size: 11px; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #0e74bc; padding-bottom: 10px; margin-bottom: 14px; }
    .title { font-size: 18px; font-weight: 900; color: #0e74bc; margin: 0; }
    .subtitle { font-size: 11px; color: #475569; margin: 3px 0 0 0; }
    .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
    .kpi { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; background: #f8fafc; }
    .kpi-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700; }
    .kpi-value { font-size: 15px; font-weight: 900; color: #0f172a; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #0e74bc; color: #fff; padding: 7px 8px; border: 1px solid #0c63a0; text-transform: uppercase; font-size: 9.5px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">CONTROLE DE ESTOQUE, PEÇAS E RECEITA</h1>
      <p class="subtitle">GS Elétrica e Manutenção — Gilmar Sales | Emitido em ${dataHoje}</p>
    </div>
    <img src="${origin}/brand/gs-logo.jpeg" alt="GS" style="height:48px;object-fit:contain;" />
  </div>
  <div class="kpis">
    <div class="kpi">
      <div class="kpi-label">Total de Itens (Peças)</div>
      <div class="kpi-value">${pecasFiltradas.length} itens</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Quantidade Total em Estoque</div>
      <div class="kpi-value">${totaisFiltrados.unidades} unidades</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Receita Total em Estoque (Valor × Estoque)</div>
      <div class="kpi-value" style="color:#0e74bc;">${formatCurrency(totaisFiltrados.receita)}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:36px;">#</th>
        <th style="text-align:left;">ITEM (PEÇA / MATERIAL)</th>
        <th style="text-align:left;">CATEGORIA</th>
        <th style="text-align:right;width:95px;">VALOR (R$)</th>
        <th style="text-align:center;width:75px;">ESTOQUE</th>
        <th style="text-align:right;width:110px;">RECEITA (R$)</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr style="background:#0f172a;color:#ffffff;font-weight:900;">
        <td colspan="4" style="padding:8px 10px;border:1px solid #0f172a;text-transform:uppercase;">TOTAL GERAL DO ESTOQUE</td>
        <td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;">${totaisFiltrados.unidades} un</td>
        <td style="padding:8px 10px;border:1px solid #0f172a;text-align:right;color:#38bdf8;font-size:12px;">${formatCurrency(totaisFiltrados.receita)}</td>
      </tr>
    </tbody>
  </table>
  <script>window.onload = function() { setTimeout(function(){ window.print(); }, 300); };</script>
</body>
</html>`);
    win.document.close();
  };

  return (
    <div className="space-y-6">
      {/* CABEÇALHO E AÇÕES RÁPIDAS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border-subtle pb-5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold bg-gold/10 border border-gold/30 px-3 py-1 rounded-full">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Planilha Oficial de Estoque &bull; Gilmar Sales</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-text-main">
            Controle de Peças, Valores, Estoque e Receita
          </h1>
          <p className="text-xs sm:text-sm text-text-muted">
            Gerencie todas as peças elétricas da planilha com cálculo automático de{" "}
            <strong className="text-text-main">Receita = Valor Unitário × Estoque</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 bg-surface-2 hover:bg-surface-3 text-text-main border border-border-subtle text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-colors"
            title="Baixar planilha atualizada para abrir no Excel"
          >
            <Download className="w-4 h-4 text-gold" />
            <span>Exportar Excel (.CSV)</span>
          </button>

          <button
            type="button"
            onClick={handlePrintStockPDF}
            className="inline-flex items-center gap-1.5 bg-surface-2 hover:bg-surface-3 text-text-main border border-border-subtle text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-colors"
            title="Imprimir ou Salvar PDF do Estoque"
          >
            <Printer className="w-4 h-4 text-gold" />
            <span>Relatório PDF</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-hover text-bg-base text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Adicionar Nova Peça</span>
          </button>
        </div>
      </div>

      {/* CARDS DE INDICADORES (KPIs DA PLANILHA) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Receita Total em Estoque */}
        <div className="bg-gradient-to-br from-surface-1 to-surface-2 border border-gold/40 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Receita Total em Estoque
            </span>
            <div className="w-9 h-9 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center text-gold">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-heading text-gold">
            {formatCurrency(metricas.receitaTotalEstoque)}
          </div>
          <p className="text-[11px] text-text-muted">
            Fórmula da planilha: <strong className="text-text-main">∑ (VALOR × ESTOQUE)</strong>
          </p>
        </div>

        {/* Card 2: Total de Unidades em Estoque */}
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 shadow-md space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Unidades em Estoque
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-heading text-text-main">
            {metricas.totalUnidades}{" "}
            <span className="text-sm font-normal text-text-muted">peças</span>
          </div>
          <p className="text-[11px] text-text-muted">
            Soma da coluna <strong className="text-text-main">ESTOQUE</strong> em todas as linhas
          </p>
        </div>

        {/* Card 3: Total de Itens Cadastrados */}
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 shadow-md space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Tipos de Peças (Itens)
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-heading text-text-main">
            {metricas.totalItens}{" "}
            <span className="text-sm font-normal text-text-muted">itens</span>
          </div>
          <p className="text-[11px] text-text-muted">
            Soma dos valores unitários:{" "}
            <strong className="text-text-main">{formatCurrency(metricas.somaValoresUnitarios)}</strong>
          </p>
        </div>

        {/* Card 4: Alerta de Reposição */}
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 shadow-md space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Atenção / Reposição
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-heading text-amber-400">
            {metricas.itensEstoqueBaixo}{" "}
            <span className="text-sm font-normal text-text-muted">
              ({metricas.itensZerados} zerados)
            </span>
          </div>
          <p className="text-[11px] text-text-muted">
            Itens com 1 unidade ou menos no estoque
          </p>
        </div>
      </div>

      {/* BARRA DE PESQUISA E FILTROS */}
      <div className="bg-surface-1 border border-border-subtle rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Busca por nome */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar peça na planilha (ex: REFLETOR, CONTATORA, DISJUNTOR, CABO...)"
              className="w-full bg-surface-2 border border-border-subtle rounded-xl pl-10 pr-4 py-2.5 text-xs text-text-main focus:outline-none focus:border-gold"
            />
          </div>

          {/* Filtro por Categoria */}
          <div className="md:col-span-3">
            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              aria-label="Filtrar por categoria"
              className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-text-main focus:outline-none focus:border-gold"
            >
              <option value="todas">Todas as Categorias ({pecas.length})</option>
              {ESTOQUE_CATEGORIAS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Nível de Estoque */}
          <div className="md:col-span-2">
            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value as any)}
              aria-label="Filtrar por nível de estoque"
              className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-text-main focus:outline-none focus:border-gold"
            >
              <option value="todos">Todos os Níveis</option>
              <option value="normal">Estoque Normal (&ge; 2)</option>
              <option value="baixo">Estoque Baixo (&le; 1)</option>
              <option value="zerado">Sem Estoque (0)</option>
            </select>
          </div>

          {/* Ordenação */}
          <div className="md:col-span-2">
            <select
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value as any)}
              aria-label="Ordenar planilha"
              className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-text-main focus:outline-none focus:border-gold"
            >
              <option value="planilha">Ordem da Planilha</option>
              <option value="receita_desc">Maior Receita (R$)</option>
              <option value="valor_desc">Maior Valor Unitário</option>
              <option value="estoque_asc">Menor Estoque</option>
              <option value="nome_asc">Ordem Alfabética (A-Z)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-text-muted">
          <span>
            Exibindo <strong className="text-text-main">{pecasFiltradas.length}</strong> de{" "}
            <strong className="text-text-main">{pecas.length}</strong> peças &bull; Dica: use os botões{" "}
            <strong className="text-gold">-</strong> e <strong className="text-gold">+</strong> na coluna{" "}
            <strong className="text-text-main">ESTOQUE</strong> para atualizar a quantidade e a receita em tempo real.
          </span>

          <button
            type="button"
            disabled={isRestoring}
            onClick={handleRestoreDefaults}
            className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-gold transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{isRestoring ? "Restaurando..." : "Restaurar planilha original (44 itens)"}</span>
          </button>
        </div>
      </div>

      {/* TABELA ESTILO PLANILHA GILMAR.XLSX */}
      <div className="bg-surface-1 border border-border-subtle rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2/90 border-b border-border-subtle text-[11px] font-bold uppercase tracking-wider text-text-muted">
                <th className="py-3.5 px-3 text-center w-12">#</th>
                <th className="py-3.5 px-4">ITEM (Peça / Material)</th>
                <th className="py-3.5 px-3 hidden md:table-cell">Categoria</th>
                <th className="py-3.5 px-4 text-right">VALOR (R$)</th>
                <th className="py-3.5 px-4 text-center">ESTOQUE</th>
                <th className="py-3.5 px-4 text-right">RECEITA (Valor × Estoque)</th>
                <th className="py-3.5 px-4 text-center w-28">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-xs">
              {pecasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-muted">
                    Nenhuma peça encontrada para o filtro selecionado.
                  </td>
                </tr>
              ) : (
                pecasFiltradas.map((peca, idx) => {
                  const valor = Number(peca.valor_unitario || 0);
                  const qtd = Number(peca.quantidade || 0);
                  const receita = valor * qtd;
                  const min = Number(peca.estoque_minimo ?? 1);
                  const isZero = qtd === 0;
                  const isLow = qtd > 0 && qtd <= min;
                  const isInlineEditing = inlineEditId === peca.id;

                  // Cores inspiradas na formatação condicional da planilha Gilmar.xlsx
                  const stockBadgeClass = isZero
                    ? "bg-red-500/20 text-red-300 border-red-500/40"
                    : isLow
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";

                  const receitaBadgeClass = isZero
                    ? "text-red-400"
                    : receita >= 200
                    ? "text-emerald-400 font-extrabold"
                    : "text-gold font-bold";

                  return (
                    <tr
                      key={peca.id}
                      className={`transition-colors hover:bg-surface-2/50 ${
                        updatingId === peca.id ? "opacity-60" : ""
                      }`}
                    >
                      {/* Nº da linha */}
                      <td className="py-3 px-3 text-center font-mono text-[11px] text-text-muted">
                        {String(idx + 1).padStart(2, "0")}
                      </td>

                      {/* ITEM */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-text-main text-xs sm:text-sm tracking-tight">
                          {peca.nome}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 md:hidden">
                          <span className="text-[10px] text-text-muted bg-surface-2 px-2 py-0.5 rounded">
                            {peca.categoria || "Material Elétrico"}
                          </span>
                        </div>
                        {peca.observacao && (
                          <p className="text-[11px] text-text-muted mt-0.5 line-clamp-1">
                            {peca.observacao}
                          </p>
                        )}
                      </td>

                      {/* CATEGORIA */}
                      <td className="py-3 px-3 hidden md:table-cell">
                        <span className="inline-flex items-center text-[11px] font-medium bg-surface-2 text-text-muted border border-border-subtle px-2.5 py-1 rounded-lg">
                          {peca.categoria || "Material Elétrico"}
                        </span>
                      </td>

                      {/* VALOR UNITÁRIO (R$) */}
                      <td className="py-3 px-4 text-right font-mono">
                        {isInlineEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={inlineValor}
                            onChange={(e) => setInlineValor(e.target.value)}
                            className="w-24 bg-bg-base border border-gold rounded-lg px-2 py-1 text-right text-xs text-text-main font-bold"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartInlineEdit(peca)}
                            title="Clique para editar o valor rapidamente"
                            className="font-semibold text-text-main hover:text-gold transition-colors"
                          >
                            {formatCurrency(valor)}
                          </button>
                        )}
                      </td>

                      {/* ESTOQUE COM BOTÕES - / + */}
                      <td className="py-3 px-4">
                        {isInlineEditing ? (
                          <div className="flex items-center justify-center">
                            <input
                              type="number"
                              min={0}
                              value={inlineEstoque}
                              onChange={(e) => setInlineEstoque(e.target.value)}
                              className="w-20 bg-bg-base border border-gold rounded-lg px-2 py-1 text-center text-xs text-text-main font-bold"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleQuickAdjust(peca, -1)}
                              disabled={qtd <= 0 || updatingId === peca.id}
                              aria-label={`Diminuir estoque de ${peca.nome}`}
                              className="w-7 h-7 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border-subtle flex items-center justify-center text-text-muted hover:text-text-main disabled:opacity-30 transition-colors active:scale-90"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleStartInlineEdit(peca)}
                              title="Clique para digitar a quantidade exata"
                              className={`min-w-[44px] px-2.5 py-1 rounded-lg border text-center font-mono text-xs font-extrabold transition-all ${stockBadgeClass}`}
                            >
                              {qtd}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleQuickAdjust(peca, 1)}
                              disabled={updatingId === peca.id}
                              aria-label={`Aumentar estoque de ${peca.nome}`}
                              className="w-7 h-7 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border-subtle flex items-center justify-center text-text-muted hover:text-gold transition-colors active:scale-90"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* RECEITA = VALOR * ESTOQUE */}
                      <td className="py-3 px-4 text-right font-mono">
                        <span className={`text-xs sm:text-sm ${receitaBadgeClass}`}>
                          {formatCurrency(receita)}
                        </span>
                      </td>

                      {/* AÇÕES */}
                      <td className="py-3 px-4 text-center">
                        {isInlineEditing ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSaveInlineEdit(peca)}
                              className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40"
                              title="Confirmar alteração"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setInlineEditId(null)}
                              className="p-1.5 rounded-lg bg-surface-2 text-text-muted hover:text-text-main border border-border-subtle"
                              title="Cancelar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenModal(peca)}
                              className="p-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-text-muted hover:text-gold border border-border-subtle transition-colors"
                              title="Editar peça completa"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(peca)}
                              className="p-1.5 rounded-lg bg-surface-2 hover:bg-destructive/20 text-text-muted hover:text-destructive border border-border-subtle transition-colors"
                              title="Excluir peça"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* RODAPÉ DE SOMA DA PLANILHA */}
            <tfoot>
              <tr className="bg-surface-2 border-t-2 border-gold/40 font-heading text-xs sm:text-sm font-bold">
                <td colSpan={3} className="py-4 px-4 text-text-main uppercase tracking-wider">
                  Total Consolidado ({pecasFiltradas.length} itens listados)
                </td>
                <td className="py-4 px-4 text-right font-mono text-text-muted hidden md:table-cell">
                  —
                </td>
                <td className="py-4 px-4 text-center font-mono text-text-main">
                  <span className="bg-surface-1 border border-border-subtle px-3 py-1 rounded-lg">
                    {totaisFiltrados.unidades} un
                  </span>
                </td>
                <td className="py-4 px-4 text-right font-mono text-base sm:text-lg text-gold">
                  {formatCurrency(totaisFiltrados.receita)}
                </td>
                <td className="py-4 px-4" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* MODAL DE CRIAR / EDITAR PEÇA */}
      {modalOpen && editingPeca && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-surface-1 border border-border-gold/60 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div>
                <h2 className="font-heading text-lg font-bold text-text-main">
                  {editingPeca.id ? "Editar Peça do Estoque" : "Adicionar Nova Peça na Planilha"}
                </h2>
                <p className="text-xs text-text-muted">
                  A receita em estoque é calculada automaticamente (Valor × Quantidade).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-2 text-text-muted hover:text-text-main flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Nome do Item / Peça *
                </label>
                <input
                  type="text"
                  required
                  value={editingPeca.nome || ""}
                  onChange={(e) =>
                    setEditingPeca({ ...editingPeca, nome: e.target.value.toUpperCase() })
                  }
                  placeholder="Ex: DISJUNTOR TRIPOLAR WEG C63"
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-gold uppercase"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">
                    Categoria
                  </label>
                  <select
                    value={editingPeca.categoria || "Material Elétrico"}
                    onChange={(e) =>
                      setEditingPeca({ ...editingPeca, categoria: e.target.value })
                    }
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs text-text-main focus:outline-none focus:border-gold"
                  >
                    {ESTOQUE_CATEGORIAS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">
                    Unidade de Medida
                  </label>
                  <select
                    value={editingPeca.unidade || "un"}
                    onChange={(e) =>
                      setEditingPeca({ ...editingPeca, unidade: e.target.value })
                    }
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs text-text-main focus:outline-none focus:border-gold"
                  >
                    <option value="un">Unidade (un)</option>
                    <option value="m">Metro (m)</option>
                    <option value="par">Par</option>
                    <option value="kit">Kit / Jogo</option>
                    <option value="cx">Caixa / Rolo</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">
                    Valor Unitário (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={editingPeca.valor_unitario ?? 0}
                    onChange={(e) =>
                      setEditingPeca({
                        ...editingPeca,
                        valor_unitario: Number(e.target.value),
                      })
                    }
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm font-bold text-gold focus:outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">
                    Quantidade em Estoque *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editingPeca.quantidade ?? 0}
                    onChange={(e) =>
                      setEditingPeca({
                        ...editingPeca,
                        quantidade: Math.max(0, Math.round(Number(e.target.value))),
                      })
                    }
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm font-bold text-text-main focus:outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">
                    Alerta Mínimo
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editingPeca.estoque_minimo ?? 1}
                    onChange={(e) =>
                      setEditingPeca({
                        ...editingPeca,
                        estoque_minimo: Math.max(0, Math.round(Number(e.target.value))),
                      })
                    }
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-gold"
                  />
                </div>
              </div>

              {/* Prévia da Receita da Linha (=B*C) */}
              <div className="bg-surface-2/80 border border-gold/30 rounded-xl p-3.5 flex items-center justify-between">
                <span className="text-xs text-text-muted">
                  Receita Calculada (<strong className="text-text-main">VALOR × ESTOQUE</strong>):
                </span>
                <span className="text-base font-extrabold font-heading text-gold">
                  {formatCurrency(
                    Number(editingPeca.valor_unitario || 0) *
                      Number(editingPeca.quantidade || 0)
                  )}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Observações da Peça (opcional)
                </label>
                <input
                  type="text"
                  value={editingPeca.observacao || ""}
                  onChange={(e) =>
                    setEditingPeca({ ...editingPeca, observacao: e.target.value })
                  }
                  placeholder="Ex: Marca WEG, fornecedor, gaveta / prateleira..."
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2 text-xs text-text-main focus:outline-none focus:border-gold"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-gold hover:bg-gold-hover text-bg-base font-bold text-xs py-3 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? "Salvando..." : "Salvar Peça na Planilha"}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-3 rounded-xl bg-surface-2 text-text-muted hover:text-text-main text-xs font-semibold border border-border-subtle"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

