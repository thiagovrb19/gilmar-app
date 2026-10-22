"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Phone, User, Calendar, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { BarberLogo } from "@/components/icons/barber-logo";
import { ClientBottomNav } from "@/components/layout/client-bottom-nav";
import { formatPhone } from "@/lib/formatters";
import { cadastrarCliente } from "@/actions/auth";

export default function CadastroPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [senha, setSenha] = useState("");
  const [aceiteLgpd, setAceiteLgpd] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aceiteLgpd) {
      toast.error("É necessário concordar com os termos de privacidade (LGPD).");
      return;
    }

    setIsLoading(true);
    const res = await cadastrarCliente({
      nome,
      whatsappRaw: whatsapp,
      dataNascimento: dataNascimento || undefined,
      senha,
      aceiteLgpd: true,
    });
    setIsLoading(false);

    if (!res.success) {
      toast.error(res.error || "Não foi possível realizar o cadastro.");
      return;
    }

    toast.success("Conta criada com sucesso! Seja bem-vindo à Barbearia do Luiz.");
    router.push("/agendar");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-bg-base text-text-main px-4 py-8 pb-24 md:pb-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block">
            <BarberLogo size={48} showText={true} className="justify-center" />
          </Link>
          <h1 className="text-xl font-bold font-heading text-text-main pt-2">
            Criar Minha Conta
          </h1>
          <p className="text-xs text-text-muted">
            Cadastre-se para agendar em poucos toques
          </p>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6 shadow-xl space-y-4">
          <form onSubmit={handleCadastro} className="space-y-4">
            <div>
              <label className="text-xs text-text-muted block mb-1">Nome Completo:</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Carlos Eduardo"
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl pl-10 pr-3.5 py-3 text-sm text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-gold"
                />
                <User className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="text-xs text-text-muted block mb-1">WhatsApp:</label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
                  placeholder="(32) 99999-9999"
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl pl-10 pr-3.5 py-3 text-sm text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-gold"
                />
                <Phone className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="text-xs text-text-muted block mb-1">Data de Aniversário (Opcional):</label>
              <div className="relative">
                <input
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl pl-10 pr-3.5 py-3 text-sm text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-gold"
                />
                <Calendar className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
              </div>
              <span className="text-[10px] text-text-muted block mt-1">
                Usado para vantagens e descontos de aniversário quando ativos.
              </span>
            </div>

            <div>
              <label className="text-xs text-text-muted block mb-1">Crie sua Senha:</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  minLength={6}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Mínimo 6 dígitos"
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl pl-10 pr-3.5 py-3 text-sm text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-gold"
                />
                <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
              </div>
            </div>

            <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                required
                checked={aceiteLgpd}
                onChange={(e) => setAceiteLgpd(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-border-subtle text-gold accent-gold cursor-pointer"
              />
              <span className="text-[11px] text-text-muted leading-tight">
                Autorizo o uso do meu WhatsApp e dados cadastrais exclusivamente para confirmações de agendamento e avisos da barbearia (LGPD).
              </span>
            </label>

            <button
              type="submit"
              disabled={isLoading || !aceiteLgpd}
              className="w-full bg-gold hover:bg-gold-hover text-bg-base font-bold text-sm py-3.5 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              {isLoading ? "Criando conta..." : "Concluir Cadastro"}
            </button>
          </form>

          <div className="pt-2 border-t border-border-subtle text-center">
            <span className="text-xs text-text-muted">Já possui conta? </span>
            <Link
              href="/login"
              className="text-xs text-gold font-semibold hover:underline"
            >
              Fazer login
            </Link>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/"
            className="text-xs text-text-muted hover:text-text-main transition-colors"
          >
            &larr; Voltar para a página inicial
          </Link>
        </div>
      </div>

      <ClientBottomNav />
    </div>
  );
}
