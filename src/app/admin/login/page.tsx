"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { BarberLogo } from "@/components/icons/barber-logo";
import { loginAdmin } from "@/actions/auth";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("luizfernando7722@gmail.com");
  const [senha, setSenha] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const res = await loginAdmin(email, senha);
    setIsLoading(false);

    if (!res.success) {
      toast.error(res.error || "Acesso negado.");
      return;
    }

    toast.success("Bem-vindo de volta, Gilmar!");
    router.push("/admin");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-bg-base text-text-main px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block">
            <BarberLogo size={52} showText={true} className="justify-center" />
          </Link>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-2 border border-border-gold/40 text-gold text-xs font-semibold mt-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Painel Administrativo Restrito</span>
          </div>
          <p className="text-xs text-text-muted">
            Área de gestão e controle exclusiva do Gilmar Sales
          </p>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6 shadow-2xl space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs text-text-muted block mb-1">E-mail do Administrador:</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="luizfernando7722@gmail.com"
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl pl-10 pr-3.5 py-3 text-sm text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-gold"
                />
                <Mail className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="text-xs text-text-muted block mb-1">Senha:</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl pl-10 pr-3.5 py-3 text-sm text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-gold"
                />
                <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-3.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gold hover:bg-gold-hover text-bg-base font-bold text-sm py-3.5 rounded-xl shadow-lg shadow-gold/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {isLoading ? "Validando permissões..." : "Acessar Painel"}
            </button>
          </form>
        </div>

        <div className="text-center">
          <Link
            href="/"
            className="text-xs text-text-muted hover:text-text-main transition-colors"
          >
            &larr; Voltar para a área do cliente
          </Link>
        </div>
      </div>
    </div>
  );
}
