"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Phone, MessageCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { BarberLogo } from "@/components/icons/barber-logo";
import { ClientBottomNav } from "@/components/layout/client-bottom-nav";
import { formatPhone, getWhatsAppLink } from "@/lib/formatters";
import { loginCliente } from "@/actions/auth";

export default function LoginPage() {
  const router = useRouter();
  const [whatsapp, setWhatsapp] = useState("");
  const [senha, setSenha] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const res = await loginCliente(whatsapp, senha);
    setIsLoading(false);

    if (!res.success) {
      toast.error(res.error || "Dados de acesso incorretos.");
      return;
    }

    toast.success("Login efetuado com sucesso!");
    router.push("/meus-agendamentos");
    router.refresh();
  };

  const whatsAppLink = getWhatsAppLink(
    "32988714986",
    `Olá, Gilmar! Esqueci minha senha no app da GS Elétrica (meu WhatsApp: ${whatsapp}). Pode me ajudar a acessar?`
  );

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-bg-base text-text-main px-4 py-8 pb-24 md:pb-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block">
            <BarberLogo size={48} showText={true} className="justify-center" />
          </Link>
          <h1 className="text-xl font-bold font-heading text-text-main pt-2">
            Acessar Minha Conta
          </h1>
          <p className="text-xs text-text-muted">
            Informe seu e-mail, nome ou WhatsApp e sua senha
          </p>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6 shadow-xl space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs text-text-muted block mb-1">E-mail, Nome ou WhatsApp:</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Ex: Carlos, carlos@gmail.com ou 32999999999"
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl pl-10 pr-3.5 py-3 text-sm text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-gold"
                />
                <Phone className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-text-muted">Senha:</label>
                <button
                  type="button"
                  onClick={() => setShowForgot(!showForgot)}
                  className="text-[11px] text-gold hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Sua senha secreta"
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl pl-10 pr-3.5 py-3 text-sm text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-gold"
                />
                <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
              </div>
            </div>

            {showForgot && (
              <div className="bg-surface-2/70 border border-border-gold/40 rounded-xl p-3 text-xs space-y-2 animate-in fade-in duration-200">
                <p className="text-text-muted leading-relaxed">
                  Para sua segurança, a redefinição de senha é feita diretamente com o Luiz pelo WhatsApp:
                </p>
                <a
                  href={whatsAppLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-success/20 hover:bg-success/30 text-success font-medium px-3 py-1.5 rounded-lg transition-colors text-xs w-full justify-center"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Falar com o Luiz no WhatsApp</span>
                </a>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gold hover:bg-gold-hover text-bg-base font-bold text-sm py-3.5 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              {isLoading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="pt-2 border-t border-border-subtle text-center">
            <span className="text-xs text-text-muted">Ainda não tem conta? </span>
            <Link
              href="/cadastro"
              className="text-xs text-gold font-semibold hover:underline"
            >
              Cadastre-se agora
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
