"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Calendar, ClipboardCheck, MapPin, Plus, Search, User } from "lucide-react";
import { RelatorioServicoResumo } from "@/lib/supabase/types";
import { RelatorioEditorModal } from "@/components/relatorio/relatorio-editor-modal";
import { numeroDoPedido } from "@/lib/whatsapp";

interface Props {
  relatorios: RelatorioServicoResumo[];
  erro?: string | null;
}

function dataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}

export function AdminReportsView({ relatorios, erro }: Props) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  // null = fechado | "novo" = relatório em branco | objeto = relatório existente
  const [aberto, setAberto] = useState<RelatorioServicoResumo | "novo" | null>(null);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return relatorios;
    return relatorios.filter((r) =>
      [r.cliente_nome, r.titulo, r.cliente_localidade || "", r.descricao || ""]
        .join(" ")
        .toLowerCase()
        .includes(termo)
    );
  }, [busca, relatorios]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-main flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-gold" />
            Relatórios de Serviço
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Monte o relatório com as fotos de antes e depois e envie o PDF para o cliente ao finalizar o serviço.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAberto("novo")}
          disabled={Boolean(erro)}
          className="inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold/90 disabled:opacity-50 text-bg-base font-bold text-sm px-4 py-3 rounded-xl shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo relatório
        </button>
      </div>

      {erro && (
        <div className="flex items-start gap-2.5 bg-destructive/15 border border-destructive/40 text-destructive text-sm p-4 rounded-2xl">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="leading-snug">{erro}</p>
        </div>
      )}

      {!erro && relatorios.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, serviço ou cidade"
            aria-label="Buscar relatórios"
            className="w-full bg-surface-1 border border-border-subtle rounded-xl pl-9 pr-3 py-2.5 text-sm text-text-main focus:outline-none focus:border-gold"
          />
        </div>
      )}

      {!erro && relatorios.length === 0 && (
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-8 text-center space-y-2">
          <ClipboardCheck className="w-9 h-9 mx-auto text-text-muted/60" />
          <p className="text-sm font-semibold text-text-main">Nenhum relatório criado ainda</p>
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            Clique em &ldquo;Novo relatório&rdquo; para um serviço avulso, ou abra um orçamento na Agenda e use o botão
            &ldquo;Relatório Antes e Depois&rdquo; para já vir com os dados do cliente.
          </p>
        </div>
      )}

      {!erro && relatorios.length > 0 && filtrados.length === 0 && (
        <p className="text-sm text-text-muted text-center py-6">Nenhum relatório encontrado para &ldquo;{busca}&rdquo;.</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filtrados.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setAberto(r)}
            className="text-left bg-surface-1 hover:bg-surface-2 border border-border-subtle hover:border-gold/60 rounded-2xl p-4 space-y-2.5 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-heading font-bold text-sm text-text-main leading-snug">{r.titulo}</h2>
              {r.agendamento_id && (
                <span className="font-mono text-[10px] bg-gold/15 text-gold border border-gold/40 px-2 py-0.5 rounded-full font-bold shrink-0">
                  {numeroDoPedido(r.agendamento_id)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
              <span className="inline-flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-gold" />
                {r.cliente_nome}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gold" />
                {dataBR(r.data_servico)}
              </span>
              {r.cliente_localidade && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-gold" />
                  {r.cliente_localidade}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] font-bold">
              <span className="bg-red-700/20 text-red-400 border border-red-700/40 px-2 py-0.5 rounded-md">
                {r.qtd_antes} antes
              </span>
              <span className="bg-green-700/20 text-green-400 border border-green-700/40 px-2 py-0.5 rounded-md">
                {r.qtd_depois} depois
              </span>
            </div>
          </button>
        ))}
      </div>

      {aberto && (
        <RelatorioEditorModal
          key={aberto === "novo" ? "novo" : aberto.id}
          relatorioId={aberto === "novo" ? null : aberto.id}
          prefill={
            aberto !== "novo" && aberto.agendamento_id
              ? { referencia: numeroDoPedido(aberto.agendamento_id) }
              : undefined
          }
          onClose={() => setAberto(null)}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}
