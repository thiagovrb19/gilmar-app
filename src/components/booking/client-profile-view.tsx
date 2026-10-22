"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Phone, Calendar, Lock, LogOut, Check } from "lucide-react";
import { toast } from "sonner";
import { formatPhone } from "@/lib/formatters";
import { atualizarPerfilAction } from "@/actions/profile";
import { logoutAction } from "@/actions/auth";

interface ClientProfileViewProps {
  user: {
    id: string;
    nome: string;
    whatsapp: string;
    dataNascimento?: string;
  };
}

export function ClientProfileView({ user }: ClientProfileViewProps) {
  const router = useRouter();
  const [nome, setNome] = useState(user.nome);
  const [dataNascimento, setDataNascimento] = useState(user.dataNascimento || "");
  const [novaSenha, setNovaSenha] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const res = await atualizarPerfilAction({
      nome,
      dataNascimento: dataNascimento || undefined,
      novaSenha: novaSenha ? novaSenha : undefined,
    });

    setIsSaving(false);

    if (!res.success) {
      toast.error(res.error || "Erro ao salvar alterações.");
      return;
    }

    toast.success("Perfil atualizado com sucesso!");
    setNovaSenha("");
    router.refresh();
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logoutAction();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface-1 border border-border-subtle rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex items-center gap-3.5 border-b border-border-subtle pb-4">
          <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-border-gold/40 flex items-center justify-center text-gold">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-heading text-lg font-bold text-text-main">
              Meu Perfil
            </h1>
            <span className="text-xs text-text-muted">
              {formatPhone(user.whatsapp)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-xs text-text-muted block mb-1">Nome Completo:</label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-gold"
            />
          </div>

          <div>
            <label className="text-xs text-text-muted block mb-1">WhatsApp (Número de Acesso):</label>
            <input
              type="text"
              disabled
              value={formatPhone(user.whatsapp)}
              className="w-full bg-surface-2/40 border border-border-subtle/50 rounded-xl px-3.5 py-2.5 text-sm text-text-muted cursor-not-allowed"
            />
            <span className="text-[10px] text-text-muted block mt-0.5">
              O número de telefone é a chave da sua conta e não pode ser alterado diretamente.
            </span>
          </div>

          <div>
            <label className="text-xs text-text-muted block mb-1">Data de Aniversário:</label>
            <input
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-gold"
            />
          </div>

          <div className="pt-2 border-t border-border-subtle/60">
            <label className="text-xs text-text-muted block mb-1">Alterar Senha (opcional):</label>
            <input
              type="password"
              minLength={6}
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Digite a nova senha se desejar trocar"
              className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-gold"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-gold hover:bg-gold-hover text-bg-base font-bold text-sm py-3 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>{isSaving ? "Salvando..." : "Salvar Alterações"}</span>
          </button>
        </form>

        <div className="pt-2 border-t border-border-subtle">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full bg-surface-2 hover:bg-surface-3 text-destructive border border-border-subtle font-semibold text-xs py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>{isLoggingOut ? "Saindo..." : "Sair da Minha Conta"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
