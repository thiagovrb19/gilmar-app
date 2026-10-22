import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Calendar,
  Clock,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { ClientHeader } from "@/components/layout/client-header";
import { ClientBottomNav } from "@/components/layout/client-bottom-nav";
import { BarberLogo } from "@/components/icons/barber-logo";
import { getServiceIcon, IconInstagram, IconWhatsApp } from "@/components/icons/barber-icons";
import { getServicos, getConfiguracoes } from "@/actions/booking";
import { formatCurrency, getWhatsAppLink } from "@/lib/formatters";

export default async function HomePage() {
  const [servicos, config] = await Promise.all([
    getServicos(),
    getConfiguracoes(),
  ]);

  const whatsAppLink = getWhatsAppLink(
    config.whatsapp_contato,
    "Olá, Luiz! Gostaria de tirar uma dúvida sobre os serviços da barbearia."
  );

  return (
    <div className="min-h-screen flex flex-col bg-bg-base text-text-main pb-24 md:pb-12">
      <ClientHeader />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 pt-6 space-y-12">
        {/* HERO SECTION COM FOTO DO LUIZ */}
        <section className="relative overflow-hidden rounded-3xl bg-surface-1 border border-border-gold/40 shadow-2xl p-6 sm:p-10 flex flex-col sm:flex-row items-center gap-8">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-gold/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-wood/20 rounded-full blur-3xl pointer-events-none" />

          {/* Foto do Luiz com borda dourada decorativa */}
          <div className="relative shrink-0 group">
            <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden ring-2 ring-gold/60 shadow-xl relative bg-surface-2">
              <Image
                src="/luiz.jpg"
                alt="Luiz Fernando Gouveia - Barbeiro"
                fill
                priority
                sizes="(max-width: 640px) 144px, 176px"
                className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          </div>

          {/* Textos de Apresentação */}
          <div className="space-y-4 text-center sm:text-left flex-1 z-10">
            <div className="inline-flex items-center gap-2 bg-surface-2/80 border border-border-gold/30 px-3 py-1 rounded-full text-xs text-gold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Atendimento exclusivo com hora marcada</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold font-heading text-text-main leading-tight">
              {config.nome_barbearia}
            </h1>

            <p className="text-sm sm:text-base text-text-muted leading-relaxed">
              Corte moderno e barba desenhada com precisão artesanal pelo Luiz Fernando. Pontualidade, ambiente acolhedor e sem fila de espera.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <Link
                href="/agendar"
                className="inline-flex items-center justify-center gap-2.5 bg-gold hover:bg-gold-hover text-bg-base font-bold text-base px-6 py-3.5 rounded-2xl shadow-lg shadow-gold/20 transition-all active:scale-[0.98]"
              >
                <Calendar className="w-5 h-5 stroke-[2.2]" />
                <span>Agendar Meu Horário</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>

              {config.whatsapp_contato && (
                <a
                  href={whatsAppLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2.5 bg-surface-2 hover:bg-surface-3 text-text-main border border-border-subtle text-sm px-5 py-3.5 rounded-2xl transition-colors font-medium"
                >
                  <IconWhatsApp size={20} />
                  <span>Falar no WhatsApp</span>
                </a>
              )}
            </div>
          </div>
        </section>

        {/* LISTA DE SERVIÇOS E COMBOS */}
        <section className="space-y-6">
          <div className="flex items-end justify-between border-b border-border-subtle pb-3">
            <div>
              <span className="text-xs text-gold font-semibold">
                Tabela de Valores
              </span>
              <h2 className="text-2xl font-bold font-heading text-text-main">
                Serviços & Combos
              </h2>
            </div>
            <Link
              href="/agendar"
              className="text-xs text-gold hover:text-gold-hover font-semibold flex items-center gap-1"
            >
              Ver agenda livre &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {servicos.map((servico) => {
              const isCombo = servico.tipo === "combo";
              return (
                <div
                  key={servico.id}
                  className={`relative p-5 rounded-2xl border transition-all ${
                    isCombo
                      ? "bg-surface-2/70 border-border-gold/60 shadow-md ring-1 ring-gold/20"
                      : "bg-surface-1 border-border-subtle hover:border-border-gold/30"
                  }`}
                >
                  {isCombo && (
                    <div className="absolute -top-2.5 right-4 bg-gold text-bg-base text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                      Mais Pedido &bull; Economia
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        isCombo
                          ? "bg-gold text-bg-base"
                          : "bg-surface-2 text-gold border border-border-subtle"
                      }`}
                    >
                      {getServiceIcon(servico.icone, 24)}
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-heading text-base text-text-main font-semibold leading-snug">
                          {servico.nome}
                        </h3>
                        <span className="text-base font-bold font-heading text-gold whitespace-nowrap">
                          {formatCurrency(servico.preco)}
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
                          {servico.duracao_min} minutos
                        </span>
                        <Link
                          href="/agendar"
                          className="text-gold font-medium hover:underline"
                        >
                          Selecionar &rarr;
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* INFORMAÇÕES DE FUNCIONAMENTO & LOCALIZAÇÃO */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Horários */}
          <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-gold">
              <Clock className="w-6 h-6" />
              <h3 className="font-heading text-lg text-text-main font-semibold">
                Horário de Atendimento
              </h3>
            </div>
            <div className="space-y-2 text-sm text-text-muted divide-y divide-border-subtle/50">
              <div className="flex justify-between py-1.5">
                <span>Segunda a Sexta</span>
                <span className="font-semibold text-text-main">17:00 às 21:00</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span>Sábado</span>
                <span className="font-semibold text-text-main">12:00 às 18:00</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span>Domingo</span>
                <span className="text-destructive font-medium">Fechado</span>
              </div>
            </div>
            <p className="text-xs text-text-muted pt-2 border-t border-border-subtle">
              &bull; Intervalos de 60 minutos por cliente com tolerância zero para atrasos.
            </p>
          </div>

          {/* Endereço e Contato */}
          <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-gold">
              <MapPin className="w-6 h-6" />
              <h3 className="font-heading text-lg text-text-main font-semibold">
                Localização & Contato
              </h3>
            </div>

            {config.endereco && (
              <p className="text-sm text-text-muted">
                {config.endereco}
              </p>
            )}

            <div className="flex flex-wrap gap-2.5 pt-2">
              {config.link_maps && (
                <a
                  href={config.link_maps}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-2 border border-border-subtle text-xs text-text-main hover:text-gold transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5 text-gold" />
                  Abrir no Google Maps
                </a>
              )}

              {config.instagram && (
                <a
                  href={`https://instagram.com/${config.instagram.replace("@", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-2 border border-border-subtle text-xs text-text-main hover:text-gold transition-colors"
                >
                  <IconInstagram size={14} className="text-gold" />
                  {config.instagram}
                </a>
              )}
            </div>
          </div>
        </section>

        {/* POLÍTICA DE CANCELAMENTO RESUMIDA */}
        <section className="bg-surface-1/60 border border-border-subtle rounded-2xl p-5 md:p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-gold/15 text-gold flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs sm:text-sm">
            <h4 className="font-heading text-text-main font-semibold">
              Política de Cancelamento Transparente
            </h4>
            <p className="text-text-muted leading-relaxed">
              Você pode cancelar ou reagendar sem nenhum custo com até <strong>{config.horas_cancelamento_gratis} horas de antecedência</strong>. Cancelamentos após esse prazo ou não comparecimento geram multa de {config.multa_percentual}% do valor agendado para cobrir o horário reservado.
            </p>
          </div>
        </section>

        {/* RODAPÉ */}
        <footer className="pt-6 border-t border-border-subtle text-center space-y-3">
          <BarberLogo size={32} showText={true} className="justify-center" />
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} {config.nome_barbearia}. Todos os direitos reservados.
          </p>
        </footer>
      </main>

      <ClientBottomNav />
    </div>
  );
}
