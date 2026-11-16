import React from "react";
import Link from "next/link";
import { ArrowLeft, Award } from "lucide-react";
import { ClientHeader } from "@/components/layout/client-header";
import { ClientBottomNav } from "@/components/layout/client-bottom-nav";
import { CertificadosCliente } from "@/components/certificados/certificados-cliente";
import { listarCertificadosPublicosAction } from "@/actions/certificados";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Certificados e NRs | GS Elétrica e Manutenção",
  description: "Confira todas as certificações e NRs do Gilmar Sales, profissional habilitado.",
};

export default async function CertificadosPage() {
  const certificados = await listarCertificadosPublicosAction();

  return (
    <div className="min-h-screen flex flex-col bg-bg-base text-text-main pb-24 md:pb-12">
      <ClientHeader />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 space-y-5">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-gold hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar para o início
        </Link>

        <div className="space-y-1.5">
          <span className="text-xs text-gold font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5" /> Profissional certificado
          </span>
          <h1 className="text-2xl font-extrabold font-heading text-text-main">Certificados e NRs</h1>
          <p className="text-xs text-text-muted leading-relaxed">
            Confira as certificações e normas regulamentadoras do Gilmar Sales. Segurança e qualificação comprovadas
            em documento.
          </p>
        </div>

        <CertificadosCliente certificados={certificados} />

        <Link
          href="/agendar"
          className="w-full inline-flex items-center justify-center gap-2 metallic-gold-btn font-bold text-sm py-3.5 rounded-xl shadow-lg"
        >
          Solicitar orçamento
        </Link>
      </main>

      <ClientBottomNav />
    </div>
  );
}
