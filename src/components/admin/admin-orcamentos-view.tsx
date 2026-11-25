"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, FileText, Loader2, Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { OrcamentoAdmin, OrcamentoAdminResumo, Servico, StatusOrcamentoAdmin } from "@/lib/supabase/types";
import { formatCurrency, formatPhone } from "@/lib/formatters";
import {
  alterarStatusOrcamentoAdminAction,
  excluirOrcamentoAdminAction,
  obterOrcamentoAdminAction,
} from "@/actions/orcamentos";
import { AdminOrcamentoEditor, ClienteOpcao, rotuloOrcamento } from "./admin-orcamento-editor";

const STATUS: { id: StatusOrcamentoAdmin; label: string; cor: string }[] = [
  { id: "rascunho", label: "Rascunho", cor: "bg-surface-2 text-text-muted border-border-subtle" },
  { id: "enviado", label: "Enviado", cor: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  { id: "aprovado", label: "Aprovado", cor: "bg-success/15 text-success border-success/30" },
  { id: "recusado", label: "Recusado", cor: "bg-destructive/15 text-destructive border-destructive/30" },
];

interface Props {
  orcamentos: OrcamentoAdminResumo[];
  clientes: ClienteOpcao[];
  servicos: Servico[];
  erro?: string | null;
}

export function AdminOrcamentosView({ orcamentos, clientes, servicos, erro }: Props) {
  const router = useRouter();
  const [lista, setLista] = useState<OrcamentoAdminResumo[]>(orcamentos);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<StatusOrcamentoAdmin | "todos">("todos");
  const [editor, setEditor] = useState<{ inicial: OrcamentoAdmin | null } | null>(null);
  const [abrindoId, setAbrindoId] = useState<string | null>(null);

  // sincroniza quando o servidor manda uma lista nova (router.refresh)
  const [listaServidor, setListaServidor] = useState(orcamentos);
  if (orcamentos !== listaServidor) {
    setListaServidor(orcamentos);
    setLista(orcamentos);
  }

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return lista.filter(
      (o) =>
        (filtro === "todos" || o.status === filtro) &&
        (!q || o.cliente_nome.toLowerCase().includes(q) || rotuloOrcamento(o.numero).toLowerCase().includes(q))
    );
  }, [lista, busca, filtro]);

  const abrir = async (id: string) => {
    setAbrindoId(id);
    const res = await obterOrcamentoAdminAction(id);
    setAbrindoId(null);
    if (!res.success) return toast.error(res.error);
    setEditor({ inicial: res.orcamento });
  };

  const aoSalvar = (resumo: OrcamentoAdminResumo) => {
    setLista((prev) => (prev.some((o) => o.id === resumo.id) ? prev.map((o) => (o.id === resumo.id ? resumo : o)) : [resumo, ...prev]));
    router.refresh();
  };

  const mudarStatus = async (o: OrcamentoAdminResumo, status: StatusOrcamentoAdmin) => {
    const anterior = o.status;
    setLista((prev) => prev.map((x) => (x.id === o.id ? { ...x, status } : x)));
    const res = await alterarStatusOrcamentoAdminAction(o.id, status);
    if (!res.success) {
      toast.error(res.error);
      setLista((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: anterior } : x)));
    }
  };

  const excluir = async (o: OrcamentoAdminResumo) => {
    if (!window.confirm(`Excluir o orçamento ${rotuloOrcamento(o.numero)} de ${o.cliente_nome}? Não dá para desfazer.`)) return;
    const res = await excluirOrcamentoAdminAction(o.id);
    if (!res.success) return toast.error(res.error);
    setLista((prev) => prev.filter((x) => x.id !== o.id));
    toast.success("Orçamento excluído.");
    router.refresh();
  };

  const valorTexto = (o: OrcamentoAdminResumo) =>
    o.modo_valores === "a_combinar" ? "A combinar" : o.valor_total != null ? formatCurrency(Number(o.valor_total)) : "—";

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <span className="text-xs text-gold font-semibold flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Exclusivo do Gilmar
          </span>
          <h1 className="text-2xl font-bold font-heading text-text-main mt-1">Orçamentos</h1>
          <p className="text-xs text-text-muted mt-1">
            Monte orçamentos com o preço que você quiser, em cada serviço ou só no final. Não ocupam a agenda e não mudam os preços do catálogo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditor({ inicial: null })}
          className="inline-flex items-center justify-center gap-2 metallic-gold-btn font-bold text-sm px-5 py-3 rounded-xl shadow-lg shrink-0"
        >
          <FilePlus2 className="w-4 h-4" /> Novo orçamento
        </button>
      </div>

      {erro && (
        <div className="bg-destructive/10 border border-destructive/40 text-destructive text-xs rounded-xl p-3.5 leading-relaxed">{erro}</div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            className="w-full bg-surface-1 border border-border-subtle rounded-xl pl-9 pr-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-gold"
            placeholder="Buscar por cliente ou número..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {[{ id: "todos" as const, label: "Todos" }, ...STATUS].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setFiltro(s.id)}
              className={`shrink-0 text-xs font-semibold px-3 py-2 rounded-xl border ${
                filtro === s.id ? "bg-gold/20 text-gold border-gold/50" : "bg-surface-1 text-text-muted border-border-subtle"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {filtrada.length === 0 ? (
        <p className="text-xs text-text-muted bg-surface-1 border border-border-subtle rounded-2xl p-6 text-center">
          {lista.length === 0 ? "Nenhum orçamento ainda. Toque em “Novo orçamento” para criar o primeiro." : "Nenhum orçamento encontrado."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtrada.map((o) => {
            const st = STATUS.find((s) => s.id === o.status) || STATUS[0];
            return (
              <div key={o.id} className="bg-surface-1 border border-border-subtle rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] bg-gold/15 text-gold border border-gold/40 px-2 py-0.5 rounded-full font-bold">
                        {rotuloOrcamento(o.numero)}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.cor}`}>{st.label}</span>
                    </div>
                    <h3 className="font-heading font-bold text-sm text-text-main mt-1.5 break-words">{o.cliente_nome}</h3>
                    <p className="text-[11px] text-text-muted">
                      {o.cliente_whatsapp ? `${formatPhone(o.cliente_whatsapp)} · ` : ""}
                      {new Date(o.criado_em).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <span className="font-heading font-bold text-lg text-gold whitespace-nowrap">{valorTexto(o)}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-subtle/60">
                  <button
                    type="button"
                    disabled={abrindoId === o.id}
                    onClick={() => abrir(o.id)}
                    className="inline-flex items-center gap-1.5 bg-[#0e74bc] hover:bg-[#0c63a0] text-white font-bold text-xs px-3.5 py-2 rounded-xl"
                  >
                    {abrindoId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pencil className="w-3.5 h-3.5" />}
                    Abrir / Editar / PDF
                  </button>

                  <select
                    value={o.status}
                    onChange={(e) => mudarStatus(o, e.target.value as StatusOrcamentoAdmin)}
                    className="bg-surface-2 border border-border-subtle text-text-main text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:border-gold"
                    aria-label="Status do orçamento"
                  >
                    {STATUS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => excluir(o)}
                    className="inline-flex items-center gap-1.5 bg-surface-2 hover:bg-destructive/20 text-text-muted hover:text-destructive border border-border-subtle text-xs font-semibold px-3 py-2 rounded-xl ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editor && (
        <AdminOrcamentoEditor
          inicial={editor.inicial}
          servicos={servicos}
          clientes={clientes}
          onClose={() => setEditor(null)}
          onSaved={aoSalvar}
        />
      )}
    </div>
  );
}
