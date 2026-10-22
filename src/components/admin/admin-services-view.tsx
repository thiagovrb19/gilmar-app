"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Scissors,
  Plus,
  Edit2,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Servico, ServicoTipo } from "@/lib/supabase/types";
import { getServiceIcon } from "@/components/icons/barber-icons";
import { formatCurrency } from "@/lib/formatters";
import { salvarServicoAction, excluirServicoAction } from "@/actions/admin";

interface AdminServicesViewProps {
  servicos: Servico[];
}

export function AdminServicesView({ servicos }: AdminServicesViewProps) {
  const router = useRouter();
  const [servicosList, setServicosList] = useState<Servico[]>(servicos);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingServico, setEditingServico] = useState<Partial<Servico> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sincroniza estado com dados vindos do servidor
  useEffect(() => {
    setServicosList(servicos);
  }, [servicos]);

  // Campos do formulário
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [duracaoMin, setDuracaoMin] = useState("60");
  const [icone, setIcone] = useState("corte");
  const [tipo, setTipo] = useState<ServicoTipo>("avulso");
  const [ativo, setAtivo] = useState(true);
  const [ordem, setOrdem] = useState(0);

  const handleOpenEdit = (servico: Servico) => {
    setEditingServico(servico);
    setNome(servico.nome || "");
    setDescricao(servico.descricao || "");
    setPreco((servico.preco ?? 25).toString());
    setDuracaoMin((servico.duracao_min || 60).toString());
    setIcone(servico.icone || "corte");
    setTipo(servico.tipo || "avulso");
    setAtivo(servico.ativo ?? true);
    setOrdem(servico.ordem || 0);
    setModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingServico(null);
    setNome("");
    setDescricao("");
    setPreco("25.00");
    setDuracaoMin("60");
    setIcone("corte");
    setTipo("avulso");
    setAtivo(true);
    setOrdem(servicosList.length + 1);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Informe o nome do serviço.");
      return;
    }

    const valorNum = parseFloat(preco);
    if (isNaN(valorNum) || valorNum < 0) {
      toast.error("Informe um preço válido.");
      return;
    }

    const duracaoNum = parseInt(duracaoMin, 10);
    if (isNaN(duracaoNum) || duracaoNum <= 0) {
      toast.error("Informe uma duração válida em minutos (ex: 30, 45, 60).");
      return;
    }

    setIsSaving(true);
    const dadosSalvar = {
      id: editingServico?.id,
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      preco: valorNum,
      duracao_min: duracaoNum,
      icone,
      tipo,
      ativo,
      ordem: Number(ordem) || 0,
    };

    const res = await salvarServicoAction(dadosSalvar);
    setIsSaving(false);

    if (!res.success) {
      toast.error(res.error || "Erro ao salvar serviço.");
      return;
    }

    // Atualização otimista imediata na interface
    if (editingServico && editingServico.id) {
      setServicosList((prev) =>
        prev.map((s) => (s.id === editingServico.id ? { ...s, ...dadosSalvar } as Servico : s))
      );
    } else if (res.servico) {
      setServicosList((prev) => [...prev, res.servico!]);
    }

    toast.success(editingServico ? "Serviço atualizado com sucesso!" : "Novo serviço criado com sucesso!");
    setModalOpen(false);
    router.refresh();
  };

  const handleExcluir = async (id: string, nomeServico: string) => {
    if (!confirm(`Tem certeza que deseja excluir o serviço "${nomeServico}"? Esta ação removerá o serviço do catálogo.`)) {
      return;
    }

    setIsDeleting(true);
    setServicosList((prev) => prev.filter((s) => s.id !== id));
    const res = await excluirServicoAction(id);
    setIsDeleting(false);

    if (!res.success) {
      toast.error(res.error || "Erro ao excluir serviço.");
      router.refresh();
      return;
    }

    toast.success("Serviço excluído com sucesso!");
    if (modalOpen && editingServico?.id === id) {
      setModalOpen(false);
    }
    router.refresh();
  };

  const handleToggleAtivo = async (servico: Servico) => {
    setServicosList((prev) =>
      prev.map((s) => (s.id === servico.id ? { ...s, ativo: !s.ativo } : s))
    );
    const res = await salvarServicoAction({
      id: servico.id,
      ativo: !servico.ativo,
    });
    if (res.success) {
      toast.success(servico.ativo ? "Serviço desativado!" : "Serviço ativado!");
      router.refresh();
    } else {
      toast.error(res.error || "Erro ao alterar status.");
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <span className="text-xs text-gold font-semibold">
            Catálogo & Preços
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-text-main">
            Serviços & Combos
          </h1>
          <p className="text-xs text-text-muted">
            Cadastre novos serviços (ex: limpeza de orelha, cera de nariz) e combos
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-hover text-bg-base font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Novo Serviço</span>
        </button>
      </div>

      {/* LISTAGEM DE SERVIÇOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {servicosList.map((s) => {
          const isCombo = s.tipo === "combo";

          return (
            <div
              key={s.id}
              className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                s.ativo
                  ? isCombo
                    ? "bg-surface-2/60 border-border-gold/50 shadow-md"
                    : "bg-surface-1 border-border-subtle hover:border-border-gold/40"
                  : "bg-surface-1/40 border-border-subtle/40 opacity-50"
              }`}
            >
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-surface-2 text-gold border border-border-subtle flex items-center justify-center shrink-0">
                  {getServiceIcon(s.icone, 20)}
                </div>

                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading text-sm font-bold text-text-main truncate">
                      {s.nome}
                    </h3>
                    <span
                      className={`text-[9px] font-bold capitalize px-2 py-0.5 rounded-full ${
                        isCombo ? "bg-gold/20 text-gold" : "bg-surface-2 text-text-muted"
                      }`}
                    >
                      {s.tipo}
                    </span>
                  </div>

                  {s.descricao && (
                    <p className="text-[11px] text-text-muted line-clamp-1">
                      {s.descricao}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-1 text-xs">
                    <span className="font-heading font-bold text-gold text-base">
                      {formatCurrency(s.preco)}
                    </span>
                    <span className="text-[11px] text-text-muted">&bull; {s.duracao_min} min</span>
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleAtivo(s)}
                  className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-muted hover:text-text-main transition-colors"
                  title={s.ativo ? "Desativar serviço" : "Ativar serviço"}
                >
                  {s.ativo ? <Eye className="w-4 h-4 text-success" /> : <EyeOff className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEdit(s)}
                  className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-gold transition-colors"
                  title="Editar serviço"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleExcluir(s.id, s.nome)}
                  disabled={isDeleting}
                  className="p-2 rounded-xl bg-surface-2 hover:bg-destructive/20 text-text-muted hover:text-destructive transition-colors disabled:opacity-50"
                  title="Excluir serviço"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
      {modalOpen && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-surface-1 border border-border-gold/60 rounded-3xl p-6 max-w-md w-full space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="font-heading text-lg font-bold text-text-main">
                {editingServico ? "Editar Serviço" : "Novo Serviço"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-text-muted hover:text-text-main text-xs px-2.5 py-1 rounded-lg bg-surface-2"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="text-text-muted block mb-1">Nome do Serviço:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Instalação de Ventilador de Teto"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="text-text-muted block mb-1">Descrição Curta:</label>
                <input
                  type="text"
                  placeholder="Ex: Montagem, fixação segura e ligação no interruptor"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-text-muted block mb-1">Preço (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={preco}
                    onChange={(e) => setPreco(e.target.value)}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="text-text-muted block mb-1">Duração (minutos):</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    placeholder="Ex: 30, 45, 60"
                    value={duracaoMin}
                    onChange={(e) => setDuracaoMin(e.target.value)}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-text-muted block mb-1">Tipo:</label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as ServicoTipo)}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                  >
                    <option value="avulso">Avulso</option>
                    <option value="combo">Combo</option>
                  </select>
                </div>

                <div>
                  <label className="text-text-muted block mb-1">Ícone:</label>
                  <select
                    value={icone}
                    onChange={(e) => setIcone(e.target.value)}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                  >
                    <option value="raio">Energia / Raio</option>
                    <option value="quadro">Quadro de Distribuição (QDF)</option>
                    <option value="chuveiro">Chuveiro / Aquecedor</option>
                    <option value="lampada">Iluminação / Spots LED</option>
                    <option value="tomada">Tomadas e Interruptores</option>
                    <option value="industrial">Industrial / Motores</option>
                    <option value="ferramentas">Manutenção / Diagnóstico</option>
                    <option value="padrao">Padrão CEMIG</option>
                    <option value="combo">Pacote / Combo</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 items-center pt-1">
                <div>
                  <label className="text-text-muted block mb-1">Ordem de Exibição:</label>
                  <input
                    type="number"
                    value={ordem}
                    onChange={(e) => setOrdem(parseInt(e.target.value) || 0)}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                  />
                </div>

                <label className="flex items-center gap-2 pt-4 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={ativo}
                    onChange={(e) => setAtivo(e.target.checked)}
                    className="w-4 h-4 rounded border-border-subtle accent-gold"
                  />
                  <span className="text-text-main font-medium">Serviço Ativo</span>
                </label>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-gold hover:bg-gold-hover text-bg-base font-bold text-xs py-3 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? "Salvando..." : "Salvar Alterações"}
                </button>

                {editingServico && editingServico.id && (
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => handleExcluir(editingServico.id!, editingServico.nome || "este serviço")}
                    className="w-full bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 font-bold text-xs py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir este Serviço</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
