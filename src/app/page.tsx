import React from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  MapPin,
  ShieldCheck,
  ChevronRight,
  Zap,
  Factory,
  Home,
  Wrench,
  Camera,
  CheckCircle2,
  AlertTriangle,
  MessageCircle,
} from "lucide-react";
import { ClientHeader } from "@/components/layout/client-header";
import { getServiceIcon, IconWhatsApp } from "@/components/icons/barber-icons";
import { getServicos, getConfiguracoes } from "@/actions/booking";
import { formatCurrency, getWhatsAppLink } from "@/lib/formatters";

export default async function HomePage() {
  const [servicos, config] = await Promise.all([
    getServicos(),
    getConfiguracoes(),
  ]);

  const whatsAppLink = getWhatsAppLink(
    config.whatsapp_contato || "32988714986",
    "Olá, Gilmar! Gostaria de fazer um orçamento de serviços elétricos com a GS Elétrica e Manutenção."
  );

  return (
    <div className="min-h-screen flex flex-col bg-bg-base text-text-main pb-10">
      <ClientHeader />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 pt-6 space-y-12">
        {/* BANNER OFICIAL HERO GS GILMAR SALES */}
        <section className="relative overflow-hidden rounded-3xl electric-glass border border-border-gold/40 shadow-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center gap-8">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-gold/15 rounded-full blur-3xl pointer-events-none" />

          {/* Logo Oficial Enviada pelo Cliente (gs-logo) */}
          <div className="relative shrink-0 w-full md:w-80 rounded-2xl overflow-hidden border-2 border-[#0084ff]/60 bg-gradient-to-br from-[#0c121d] via-[#06090f] to-[#121b2b] p-5 shadow-2xl flex flex-col items-center justify-center text-center group">
            <div className="relative w-36 h-36 rounded-2xl overflow-hidden border-2 border-[#ffe066]/60 shadow-[0_0_25px_rgba(0,132,255,0.4)] mb-3 bg-surface-2 p-1 transition-transform duration-300 group-hover:scale-105">
              <img
                src="/brand/gs-logo.jpeg"
                alt="GS Elétrica e Manutenção - Gilmar Sales"
                className="w-full h-full object-cover rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline justify-center gap-2">
                <span className="font-heading font-black text-3xl text-[#0084ff] tracking-tight drop-shadow-[0_0_15px_rgba(0,132,255,0.7)]">
                  GS
                </span>
                <span className="font-heading font-extrabold text-2xl text-[#ffe066] tracking-tight drop-shadow-[0_0_15px_rgba(255,224,102,0.6)]">
                  Gilmar Sales
                </span>
              </div>
              <p className="text-[11px] font-bold text-[#94a3b8] tracking-[0.22em] uppercase">
                Elétrica e Manutenção
              </p>
            </div>

            <div className="mt-3.5 w-full py-2 px-3 rounded-xl bg-black/60 border border-[#0084ff]/30 text-[11px] text-[#ffe066] font-semibold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#0084ff]" />
              <span>Industrial • Residencial • Padrão CEMIG</span>
            </div>
          </div>

          {/* Textos de Apresentação */}
          <div className="space-y-4 text-center md:text-left flex-1 z-10">
            <div className="inline-flex items-center gap-2 bg-surface-2/90 border border-border-gold/40 px-3 py-1 rounded-full text-xs text-gold">
              <Zap className="w-3.5 h-3.5 fill-gold animate-pulse" />
              <span>Qualidade, segurança e confiança para você!</span>
            </div>

            <div className="flex items-baseline justify-center md:justify-start gap-2 pt-1">
              <span className="font-heading font-black text-4xl sm:text-5xl text-[#0084ff] tracking-tight drop-shadow-[0_0_15px_rgba(0,132,255,0.6)]">
                GS
              </span>
              <span className="font-heading font-extrabold text-4xl sm:text-5xl text-[#ffe066] tracking-tight drop-shadow-[0_0_12px_rgba(255,224,102,0.5)]">
                Gilmar Sales
              </span>
            </div>

            <h1 className="text-lg sm:text-xl font-bold font-heading text-text-main tracking-wide">
              Elétrica e Manutenção Industrial e Residencial
            </h1>

            <p className="text-sm sm:text-base text-text-muted leading-relaxed">
              Serviços elétricos profissionais com segurança, qualidade e confiança. Atendimento especializado em Visconde do Rio Branco e região pelo eletricista <strong>Gilmar Sales</strong>.
            </p>

            {/* Destaque do recurso de anexar fotos */}
            <div className="bg-surface-2/70 border border-[#0084ff]/30 rounded-xl p-3 flex items-center gap-3 text-xs text-text-muted text-left">
              <div className="w-9 h-9 rounded-lg bg-gold/15 text-gold flex items-center justify-center shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <p className="text-[11px] leading-tight">
                <strong>Precisa de orçamento?</strong> Você pode anexar fotos do quadro, fiação ou aparelho diretamente ao solicitar seu atendimento!
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <Link
                href="/agendar"
                className="inline-flex items-center justify-center gap-2.5 bg-gold hover:bg-gold-hover text-bg-base font-bold text-base px-6 py-3.5 rounded-2xl shadow-lg shadow-gold/20 transition-all active:scale-[0.98]"
              >
                <Calendar className="w-5 h-5 stroke-[2.2]" />
                <span>Solicitar Orçamento</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>

              {config.whatsapp_contato && (
                <a
                  href={whatsAppLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2.5 bg-surface-2 hover:bg-surface-3 text-text-main border border-[#0084ff]/40 text-sm px-5 py-3.5 rounded-2xl transition-colors font-medium hover:border-gold/50"
                >
                  <IconWhatsApp size={20} />
                  <span>Falar com Gilmar</span>
                </a>
              )}
            </div>
          </div>
        </section>

        {/* 4 PILARES DE ATUAÇÃO COM EFEITO DE VIDRO E DEGRADÊ */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="electric-glass rounded-2xl p-4 text-center space-y-2 transition-transform hover:-translate-y-1">
            <div className="w-10 h-10 mx-auto rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <Factory className="w-5 h-5" />
            </div>
            <h3 className="font-heading font-bold text-sm text-text-main">Industrial</h3>
            <p className="text-[11px] text-text-muted">Motores, inversores e painéis industriais</p>
          </div>

          <div className="electric-glass rounded-2xl p-4 text-center space-y-2 transition-transform hover:-translate-y-1">
            <div className="w-10 h-10 mx-auto rounded-xl bg-gold/15 text-gold flex items-center justify-center">
              <Home className="w-5 h-5" />
            </div>
            <h3 className="font-heading font-bold text-sm text-text-main">Residencial</h3>
            <p className="text-[11px] text-text-muted">Instalação, luminárias e tomadas</p>
          </div>

          <div className="electric-glass rounded-2xl p-4 text-center space-y-2 transition-transform hover:-translate-y-1">
            <div className="w-10 h-10 mx-auto rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
            <h3 className="font-heading font-bold text-sm text-text-main">Manutenção</h3>
            <p className="text-[11px] text-text-muted">Preventiva e corretiva com diagnóstico</p>
          </div>

          <div className="electric-glass rounded-2xl p-4 text-center space-y-2 transition-transform hover:-translate-y-1">
            <div className="w-10 h-10 mx-auto rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-heading font-bold text-sm text-text-main">Segurança</h3>
            <p className="text-[11px] text-text-muted">Padrão CEMIG e quadros de disjuntores</p>
          </div>
        </section>

        {/* TABELA OFICIAL DE SERVIÇOS E PREÇOS */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-border-subtle pb-4 gap-2">
            <div>
              <span className="text-xs text-gold font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 fill-gold" />
                GS ELÉTRICA E MANUTENÇÃO
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-text-main mt-1">
                Tabela de Serviços e Preços
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Serviços com qualidade • Profissional qualificado • Compromisso e confiança
              </p>
            </div>
            <Link
              href="/agendar"
              className="text-xs text-gold hover:text-gold-hover font-semibold flex items-center gap-1 self-start sm:self-auto"
            >
              Ver agenda e solicitar &rarr;
            </Link>
          </div>

          {/* Grid de 12 Serviços Oficiais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {servicos.map((servico, index) => {
              const numFmt = String(index + 1).padStart(2, "0");
              const isIndustrialHora = servico.nome.toLowerCase().includes("industrial") && servico.preco === 60;

              return (
                <div
                  key={servico.id}
                  className="relative p-4 sm:p-5 rounded-2xl border border-border-subtle hover:border-[#0084ff]/60 bg-surface-1/90 transition-all hover:shadow-lg hover:shadow-blue-500/10 group"
                >
                  <div className="flex items-start gap-3.5">
                    {/* Número e Ícone */}
                    <div className="w-12 h-12 rounded-xl bg-surface-2 text-gold border border-border-subtle flex flex-col items-center justify-center shrink-0 group-hover:border-gold/40 group-hover:bg-[#0084ff]/10 transition-colors">
                      {getServiceIcon(servico.icone, 22)}
                      <span className="text-[9px] font-bold text-text-muted/80 mt-0.5">
                        Nº {numFmt}
                      </span>
                    </div>

                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-heading text-sm sm:text-base text-text-main font-semibold leading-snug">
                          {servico.nome}
                        </h3>
                        <span className="text-base font-bold font-heading text-gold whitespace-nowrap">
                          {isIndustrialHora ? "R$ 60,00/h" : formatCurrency(servico.preco)}
                        </span>
                      </div>

                      {servico.descricao && (
                        <p className="text-xs text-text-muted leading-relaxed">
                          {servico.descricao}
                        </p>
                      )}

                      <div className="pt-2 flex items-center justify-between text-[11px] text-text-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gold/80" />
                          Tempo médio: {servico.duracao_min} min
                        </span>
                        <Link
                          href="/agendar"
                          className="text-gold font-bold hover:underline inline-flex items-center gap-1 bg-gold/10 px-2.5 py-1 rounded-lg border border-gold/20 hover:bg-gold/20 transition-colors"
                        >
                          <span>Solicitar</span>
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* BLOCO IMPORTANTE & BLOCO FAÇA SEU ORÇAMENTO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            {/* Bloco Importante */}
            <div className="rounded-2xl p-5 border border-amber-500/30 bg-amber-500/10 space-y-3">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                <h4 className="font-heading text-sm font-bold tracking-wide uppercase">
                  IMPORTANTE
                </h4>
              </div>
              <ul className="text-xs text-text-main space-y-2 list-disc list-inside leading-relaxed">
                <li>O preço pode variar de acordo com a qualidade do serviço.</li>
                <li>Se for maior a quantidade, conseguimos fazer um melhor preço!</li>
                <li>Serviços realizados com segurança, responsabilidade e garantia.</li>
              </ul>
            </div>

            {/* Bloco Faça Seu Orçamento */}
            <div className="rounded-2xl p-5 border border-[#0084ff]/40 bg-gradient-to-br from-[#0c121d] to-[#121b2b] flex flex-col justify-between space-y-3 shadow-xl">
              <div>
                <span className="text-[10px] text-gold font-bold uppercase tracking-widest">
                  Atendimento Rápido e com Qualidade
                </span>
                <h4 className="font-heading text-lg font-extrabold text-text-main mt-0.5">
                  FAÇA SEU ORÇAMENTO!
                </h4>
                <p className="text-xs text-text-muted mt-1">
                  Entre em contato direto pelo WhatsApp para tirar dúvidas, agendar visitas ou enviar fotos do seu projeto.
                </p>
              </div>

              <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="text-text-muted block text-[10px]">WhatsApp Direto:</span>
                  <strong className="text-gold text-sm">(32) 98871-4986</strong>
                </div>

                <a
                  href={whatsAppLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-success hover:bg-success/90 text-bg-base font-bold text-xs shadow-md transition-all active:scale-95"
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
                  <span>Chamar no WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* INFORMAÇÕES DE ATENDIMENTO & REGIÃO */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Horários e Disponibilidade */}
          <div className="electric-glass rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-gold">
              <Clock className="w-6 h-6" />
              <h3 className="font-heading text-lg text-text-main font-semibold">
                Horário de Atendimento
              </h3>
            </div>
            <div className="space-y-2 text-sm text-text-muted divide-y divide-border-subtle/50">
              <div className="flex justify-between py-1.5">
                <span>Segunda a Sexta</span>
                <span className="font-semibold text-text-main">07:00 às 18:00</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span>Sábado</span>
                <span className="font-semibold text-text-main">07:00 às 13:00</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span>Emergências / Plantão</span>
                <span className="text-gold font-semibold">Consultar no WhatsApp</span>
              </div>
            </div>
            <p className="text-xs text-text-muted pt-2 border-t border-border-subtle">
              ⚡ Atendimento pontual com agendamento prévio e confirmação rápida.
            </p>
          </div>

          {/* Região e Contato */}
          <div className="electric-glass rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-gold">
              <MapPin className="w-6 h-6" />
              <h3 className="font-heading text-lg text-text-main font-semibold">
                Região de Atendimento
              </h3>
            </div>

            <p className="text-sm text-text-muted">
              Atendimento em <strong>Visconde do Rio Branco - MG</strong> e cidades vizinhas da região.
            </p>

            <div className="space-y-1.5 text-xs text-text-muted">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gold shrink-0" />
                <span>Instalações industriais, comerciais e residenciais</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gold shrink-0" />
                <span>Orçamentos rápidos com envio de fotos pelo aplicativo</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gold shrink-0" />
                <span>WhatsApp Direto: (32) 98871-4986</span>
              </div>
            </div>

            <div className="pt-2">
              <a
                href={whatsAppLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-success/20 hover:bg-success/30 text-success border border-success/40 text-xs font-semibold transition-colors"
              >
                <IconWhatsApp size={16} />
                <span>Chamar Gilmar no WhatsApp</span>
              </a>
            </div>
          </div>
        </section>

        {/* POLÍTICA E COMPROMISSO */}
        <section className="electric-glass rounded-2xl p-5 md:p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-gold/15 text-gold flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs sm:text-sm">
            <h4 className="font-heading text-text-main font-semibold">
              Compromisso com Segurança e Normas Técnicas
            </h4>
            <p className="text-text-muted leading-relaxed">
              Todos os serviços elétricos são executados seguindo as normas da ABNT e padrões da concessionária, utilizando ferramentas isoladas adequadas e materiais homologados para garantir a máxima segurança da sua família ou da sua empresa.
            </p>
          </div>
        </section>

        {/* RODAPÉ OFICIAL COM A LOGO ENVIADA PELO CLIENTE (GS-LOGO) */}
        <footer className="pt-8 border-t border-border-subtle text-center space-y-4">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="relative w-28 h-28 rounded-2xl overflow-hidden border-2 border-[#0084ff]/60 shadow-[0_0_20px_rgba(0,132,255,0.35)] bg-surface-2 p-1">
              <img
                src="/brand/gs-logo.jpeg"
                alt="GS Elétrica e Manutenção - Gilmar Sales"
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-heading font-black text-2xl text-[#0084ff] tracking-tight">
                GS
              </span>
              <span className="font-heading font-extrabold text-2xl text-[#ffe066] tracking-tight">
                Gilmar Sales
              </span>
            </div>
            <p className="text-xs text-text-muted">
              Elétrica e Manutenção Industrial e Residencial • Visconde do Rio Branco - MG
            </p>
          </div>
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} GS Elétrica e Manutenção. Todos os direitos reservados.
          </p>
        </footer>
      </main>
    </div>
  );
}
