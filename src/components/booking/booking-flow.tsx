"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar as CalendarIcon,
  Clock,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  User,
  Lock,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { ImageAttachmentUploader, SelectedImage } from "./image-attachment-uploader";
import { Servico, Configuracao } from "@/lib/supabase/types";
import { getServiceIcon } from "@/components/icons/barber-icons";
import { optimizeServicesWithCombos } from "@/lib/combos";
import { formatCurrency, formatPhone, normalizePhone } from "@/lib/formatters";
import {
  formatDateFriendly,
  formatDateShort,
  formatWeekDayShort,
} from "@/lib/date/tz";
import { getHorariosDisponiveis, criarAgendamentoAction, HorarioSlot } from "@/actions/booking";
import { loginCliente, cadastrarCliente } from "@/actions/auth";

interface BookingFlowProps {
  initialServices: Servico[];
  config: Configuracao;
  initialUser: { id: string; nome?: string; clienteId?: string } | null;
  initialDiasExcecao?: import("@/lib/supabase/types").DiaExcecao[];
}

export function BookingFlow({
  initialServices,
  config,
  initialUser,
  initialDiasExcecao = [],
}: BookingFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Estado do passo 1: Serviços selecionados
  const [selectedServices, setSelectedServices] = useState<Servico[]>([]);

  // Estado do passo 2: Data selecionada
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Estado do passo 3: Horário selecionado
  const [availableSlots, setAvailableSlots] = useState<HorarioSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<HorarioSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Estado do passo 4: Confirmação, Anexos e Auth
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatusText, setUploadStatusText] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(initialUser);

  // Formulário de Auth rápido embutido caso deslogado
  const [authMode, setAuthMode] = useState<"login" | "cadastro">("cadastro");
  const [authNome, setAuthNome] = useState("");
  const [authWhats, setAuthWhats] = useState("");
  const [authNascimento, setAuthNascimento] = useState("");
  const [authSenha, setAuthSenha] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Gera as datas para o carrossel (hoje + 30 dias)
  useEffect(() => {
    const dates: Date[] = [];
    const today = new Date();
    for (let i = 0; i <= config.janela_dias; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d);
    }
    setAvailableDates(dates);
    if (dates.length > 0) {
      // Pré-selecionar o primeiro dia útil que não seja domingo nem esteja fechado
      const firstValid = dates.find((d) => {
        if (d.getDay() === 0) return false;
        const dStr = d.toISOString().split("T")[0];
        const exc = initialDiasExcecao.find((e) => e.data === dStr);
        return exc?.tipo !== "fechado";
      }) || dates[0];
      setSelectedDate(firstValid.toISOString().split("T")[0]);
    }
  }, [config.janela_dias, initialDiasExcecao]);

  // Carrega horários disponíveis quando a data muda
  useEffect(() => {
    if (!selectedDate) return;
    setLoadingSlots(true);
    setSelectedSlot(null);

    getHorariosDisponiveis(selectedDate)
      .then((slots) => {
        setAvailableSlots(slots);
      })
      .catch((err) => {
        console.error("Erro ao buscar horários:", err);
        setAvailableSlots([]);
      })
      .finally(() => {
        setLoadingSlots(false);
      });
  }, [selectedDate]);

  // Cálculo e otimização de combos em tempo real
  const optimization = optimizeServicesWithCombos(selectedServices, initialServices);

  const toggleService = (servico: Servico) => {
    const exists = selectedServices.some((s) => s.id === servico.id);
    if (exists) {
      setSelectedServices(selectedServices.filter((s) => s.id !== servico.id));
    } else {
      setSelectedServices([...selectedServices, servico]);
    }
  };

  // Login rápido durante o fluxo
  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    const res = await loginCliente(authWhats, authSenha);
    setIsAuthLoading(false);

    if (!res.success) {
      toast.error(res.error || "Erro ao conectar.");
      return;
    }

    toast.success("Login realizado!");
    setCurrentUser({ id: res.user!.id, clienteId: res.user!.id });
    if (selectedSlot && selectedServices.length > 0) {
      await executeBooking(res.user!.id);
    }
  };

  const executeBooking = async (targetClienteId?: string) => {
    if (!acceptedPolicy) {
      toast.error("Você precisa concordar com a política de cancelamento.");
      return;
    }
    if (!selectedSlot) {
      toast.error("Selecione um horário.");
      return;
    }
    if (selectedServices.length === 0) {
      toast.error("Selecione pelo menos um serviço.");
      return;
    }

    setIsSubmitting(true);
    const serviceIdsToBook = [
      ...optimization.appliedCombos.map((c) => c.combo.id),
      ...optimization.residualServices.map((s) => s.id),
    ];

    const res = await criarAgendamentoAction({
      servicosIds: serviceIdsToBook.length > 0 ? serviceIdsToBook : selectedServices.map((s) => s.id),
      inicio: selectedSlot.inicio,
      observacao,
      clienteId: targetClienteId || currentUser?.clienteId,
    });

    if (!res.success || !res.agendamento_id) {
      setIsSubmitting(false);
      toast.error(res.error || "Não foi possível confirmar o agendamento.");
      return;
    }

    // Se houver imagens selecionadas, realiza o upload com acompanhamento de progresso
    let anexosEnviadosQtd = 0;
    if (selectedImages.length > 0) {
      setUploadStatusText(`Enviando ${selectedImages.length} foto(s) anexada(s)...`);
      setUploadProgress(10);

      try {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/orcamento/anexos");

          xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
              const pct = Math.min(95, Math.round((evt.loaded / evt.total) * 100));
              setUploadProgress(pct);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              setUploadProgress(100);
              anexosEnviadosQtd = selectedImages.length;
              resolve();
            } else {
              let msg = "Falha ao enviar fotos anexadas";
              try {
                const parsed = JSON.parse(xhr.responseText);
                if (parsed.error) msg = parsed.error;
              } catch {
                // ignora
              }
              reject(new Error(msg));
            }
          };

          xhr.onerror = () => {
            reject(new Error("Erro de conexão ao enviar anexos."));
          };

          const fd = new FormData();
          fd.append("agendamentoId", res.agendamento_id!);
          selectedImages.forEach((img) => fd.append("files", img.file));
          xhr.send(fd);
        });
      } catch (uploadErr) {
        const errorMsg = uploadErr instanceof Error ? uploadErr.message : "Erro no upload das imagens";
        console.error("Falha no upload de anexos:", uploadErr);
        toast.warning(
          `Seu agendamento foi registrado, porém houve uma falha nas fotos: ${errorMsg}. Você poderá enviá-las diretamente pelo WhatsApp ao Gilmar.`
        );
      }
    }

    setIsSubmitting(false);
    setUploadProgress(null);
    setUploadStatusText("");

    toast.success("Solicitação confirmada com sucesso!");
    router.refresh();
    router.push(
      `/agendamento/sucesso?id=${res.agendamento_id}&valor=${res.valor_total}&inicio=${encodeURIComponent(
        selectedSlot.inicio
      )}&anexos=${anexosEnviadosQtd}`
    );
  };

  // Cadastro rápido durante o fluxo
  const handleQuickCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedPolicy) {
      toast.error("Por favor, aceite os termos da política de cancelamento.");
      return;
    }
    setIsAuthLoading(true);
    const res = await cadastrarCliente({
      nome: authNome,
      whatsappRaw: authWhats,
      dataNascimento: authNascimento || undefined,
      senha: authSenha,
      aceiteLgpd: true,
    });
    setIsAuthLoading(false);

    if (!res.success) {
      toast.error(res.error || "Erro no cadastro.");
      return;
    }

    toast.success("Conta criada com sucesso!");
    setCurrentUser({ id: res.user!.id, nome: authNome, clienteId: res.user!.id });
    await executeBooking(res.user!.id);
  };

  // Confirmação final do agendamento
  const handleConfirmBooking = async () => {
    await executeBooking();
  };

  return (
    <div className="space-y-6">
      {/* STEPPER HEADER (Otimizado para mobile) */}
      <div className="bg-surface-1 border border-border-subtle rounded-2xl p-4">
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { num: 1, label: "Serviços" },
            { num: 2, label: "Data" },
            { num: 3, label: "Horário" },
            { num: 4, label: "Confirmar" },
          ].map((item) => {
            const isCurrent = step === item.num;
            const isPast = step > item.num;

            return (
              <button
                key={item.num}
                type="button"
                onClick={() => {
                  if (item.num === 1) setStep(1);
                  if (item.num === 2 && selectedServices.length > 0) setStep(2);
                  if (item.num === 3 && selectedServices.length > 0 && selectedDate) setStep(3);
                }}
                disabled={item.num > step}
                className={`flex flex-col items-center gap-1 group transition-all ${
                  item.num > step ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCurrent
                      ? "bg-gold text-bg-base ring-4 ring-gold/20"
                      : isPast
                      ? "bg-surface-2 text-gold border border-border-gold"
                      : "bg-surface-2 text-text-muted"
                  }`}
                >
                  {isPast ? <Check className="w-4 h-4 stroke-[3]" /> : item.num}
                </div>
                <span
                  className={`text-[11px] font-medium tracking-tight ${
                    isCurrent ? "text-gold font-semibold" : "text-text-muted"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PASSO 1: SELEÇÃO DE SERVIÇOS & COMBOS AUTOMÁTICOS */}
      {/* ========================================================================= */}
      {step === 1 && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-heading text-text-main">
              1. Escolha seus serviços
            </h2>
            <span className="text-xs text-text-muted">
              {selectedServices.length} selecionado(s)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {initialServices.map((servico) => {
              const isSelected = selectedServices.some((s) => s.id === servico.id);
              const isCombo = servico.tipo === "combo";

              return (
                <div
                  key={servico.id}
                  onClick={() => toggleService(servico)}
                  className={`p-4 rounded-2xl border cursor-pointer select-none transition-all flex items-start gap-3.5 relative active:scale-[0.99] ${
                    isSelected
                      ? "metallic-card-selected ring-1 ring-gold shadow-lg"
                      : isCombo
                      ? "metallic-combo-card hover:border-gold/60 hover:shadow-md"
                      : "bg-surface-1 border-border-subtle hover:border-gold/40 hover:bg-surface-2/60"
                  }`}
                >
                  {isCombo && (
                    <span className="absolute -top-2.5 right-3 metallic-badge text-[9px] font-bold px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>Combo</span>
                    </span>
                  )}

                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                      isSelected
                        ? "metallic-icon-frame-active text-bg-base"
                        : "metallic-icon-frame text-gold"
                    }`}
                  >
                    {getServiceIcon(servico.icone, 22)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1.5">
                      <h3 className="font-heading text-sm font-semibold text-text-main leading-snug break-words">
                        {servico.nome}
                      </h3>
                      <span className="text-sm font-bold font-heading text-gold whitespace-nowrap">
                        {formatCurrency(servico.preco)}
                      </span>
                    </div>

                    {servico.descricao && (
                      <p className="text-[11px] text-text-muted line-clamp-2 mt-0.5">
                        {servico.descricao}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] text-text-muted font-medium bg-surface-2/80 px-2 py-0.5 rounded-md border border-border-subtle/50">
                        <Clock className="w-3 h-3 text-gold" />
                        <span>{servico.duracao_min || 60} min</span>
                      </span>
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-1 transition-all ${
                      isSelected
                        ? "bg-gold border-gold text-bg-base shadow-sm scale-110"
                        : "border-border-subtle bg-bg-base text-transparent"
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* ALERTA DE COMBO AUTOMÁTICO E ECONOMIA */}
          {optimization.appliedCombos.length > 0 && (
            <div className="bg-success/10 border border-success/30 rounded-2xl p-4 flex items-center gap-3 animate-in zoom-in-95 duration-200 metallic-shimmer shadow-lg">
              <div className="w-9 h-9 rounded-xl bg-success/20 text-success flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="text-xs space-y-0.5 flex-1">
                <p className="font-semibold text-text-main">
                  🎉 Combo Automático Aplicado!
                </p>
                <p className="text-text-muted">
                  Identificamos seus serviços e aplicamos o desconto.{" "}
                  <strong className="text-success">
                    Você economizou {formatCurrency(optimization.totalSavings)}!
                  </strong>
                </p>
              </div>
            </div>
          )}

          {/* BARRA FIXA DE RESUMO INFERIOR (Thumb-friendly) */}
          <div className="sticky bottom-16 md:bottom-4 bg-surface-1/95 backdrop-blur-md border border-border-gold/30 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] text-text-muted block font-medium">
                Total Previsto
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold font-heading text-gold">
                  {formatCurrency(optimization.finalTotal)}
                </span>
                {optimization.totalSavings > 0 && (
                  <span className="text-xs text-text-muted line-through">
                    {formatCurrency(optimization.originalTotal)}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              disabled={selectedServices.length === 0}
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 metallic-gold-btn disabled:opacity-40 disabled:cursor-not-allowed font-bold text-sm px-6 py-3 rounded-xl shadow-lg transition-all"
            >
              <span>Escolher Data</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASSO 2: SELEÇÃO DE DATA (Carrossel Horizontal) */}
      {/* ========================================================================= */}
      {step === 2 && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-heading text-text-main">
              2. Escolha o dia
            </h2>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-gold flex items-center gap-1 hover:underline"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Voltar
            </button>
          </div>

          <p className="text-xs text-text-muted">
            Selecione uma data nos próximos 30 dias. Atendimento de Segunda a Sábado.
          </p>

          {/* Carrossel de Dias com Scroll Horizontal Otimizado */}
          <div className="flex gap-2.5 overflow-x-auto pb-4 pt-1 no-scrollbar touch-pan-x">
            {availableDates.map((dateObj) => {
              const dateStr = dateObj.toISOString().split("T")[0];
              const dayOfWeek = dateObj.getDay();
              const excecao = initialDiasExcecao.find((e) => e.data === dateStr);
              const isClosed = dayOfWeek === 0 || excecao?.tipo === "fechado";
              const isSpecial = excecao?.tipo === "personalizado";
              const isSelected = selectedDate === dateStr;

              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={isClosed}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`flex flex-col items-center justify-center min-w-[72px] h-[96px] rounded-2xl border p-2 shrink-0 transition-all active:scale-95 relative ${
                    isClosed
                      ? "opacity-35 bg-surface-1/40 border-border-subtle cursor-not-allowed"
                      : isSelected
                      ? "metallic-card-selected text-bg-base border-gold ring-2 ring-gold/40 shadow-xl scale-105"
                      : isSpecial
                      ? "bg-gold/10 border-gold/50 text-text-main hover:border-gold hover:bg-gold/15"
                      : "bg-surface-1 border-border-subtle text-text-main hover:border-gold/50 hover:bg-surface-2"
                  }`}
                >
                  {isSpecial && !isSelected && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gold text-bg-base text-[8px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-tighter shadow-sm">
                      Especial
                    </span>
                  )}

                  <span
                    className={`text-[11px] font-medium capitalize ${
                      isSelected ? "text-bg-base/80 font-bold" : "text-text-muted"
                    }`}
                  >
                    {formatWeekDayShort(dateObj)}
                  </span>
                  <span
                    className={`text-2xl font-bold font-heading leading-tight ${
                      isSelected ? "text-bg-base" : isSpecial ? "text-gold" : "text-text-main"
                    }`}
                  >
                    {dateObj.getDate()}
                  </span>
                  <span
                    className={`text-[9px] font-medium truncate max-w-[65px] ${
                      isClosed
                        ? "text-destructive font-semibold"
                        : isSelected
                        ? "text-bg-base/90 font-bold"
                        : isSpecial
                        ? "text-gold font-bold"
                        : "text-text-muted"
                    }`}
                  >
                    {isClosed
                      ? excecao?.motivo
                        ? excecao.motivo.length > 8
                          ? excecao.motivo.slice(0, 7) + "…"
                          : excecao.motivo
                        : "Fechado"
                      : isSpecial
                      ? "Horário Esp."
                      : formatDateShort(dateObj)}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedDate && (
            <div className="bg-surface-1 border border-border-gold/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl metallic-icon-frame text-gold flex items-center justify-center shrink-0">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted block">Data Selecionada</span>
                    {initialDiasExcecao.some((e) => e.data === selectedDate && e.tipo === "personalizado") && (
                      <span className="bg-gold/20 text-gold border border-gold/40 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                        ✨ Horário Especial Ativo
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-text-main capitalize">
                    {formatDateFriendly(`${selectedDate}T12:00:00`)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex items-center justify-center gap-2 metallic-gold-btn font-bold text-sm px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
              >
                <span>Ver Horários</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASSO 3: GRADE DE HORÁRIOS DISPONÍVEIS */}
      {/* ========================================================================= */}
      {step === 3 && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-heading text-text-main">
              3. Escolha o horário
            </h2>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-xs text-gold flex items-center gap-1 hover:underline"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Mudar data
            </button>
          </div>

          <div className="bg-surface-1 border border-border-subtle rounded-2xl p-3.5 flex items-center justify-between text-xs">
            <span className="text-text-muted">Dia do atendimento:</span>
            <span className="font-semibold text-gold capitalize">
              {formatDateFriendly(`${selectedDate}T12:00:00`)}
            </span>
          </div>

          {loadingSlots ? (
            <div className="py-12 text-center space-y-3">
              <Clock className="w-8 h-8 mx-auto text-gold animate-spin" />
              <p className="text-xs text-text-muted">Buscando horários livres na agenda...</p>
            </div>
          ) : availableSlots.length === 0 ? (
            <div className="bg-surface-1 border border-border-subtle rounded-2xl p-8 text-center space-y-3">
              <Clock className="w-10 h-10 mx-auto text-text-muted/60" />
              <h3 className="font-heading text-base text-text-main">
                Nenhum horário disponível nesta data
              </h3>
              <p className="text-xs text-text-muted max-w-xs mx-auto">
                {initialDiasExcecao.some((e) => e.data === selectedDate && e.tipo === "fechado")
                  ? "Não haverá atendimentos externos nesta data por motivo de feriado ou compromisso agendado."
                  : "Todos os horários desta data já foram preenchidos ou não há vagas disponíveis. Por favor, escolha outro dia."}
              </p>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="bg-surface-2 border border-border-gold/40 text-gold text-xs font-semibold px-4 py-2 rounded-xl"
              >
                Escolher outro dia
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {availableSlots.map((slot) => {
                const isSelected = selectedSlot?.inicio === slot.inicio;
                return (
                  <button
                    key={slot.inicio}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={`py-3.5 px-4 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 active:scale-95 ${
                      isSelected
                        ? "metallic-card-selected text-bg-base border-gold ring-2 ring-gold/40 shadow-lg scale-[1.03] font-bold"
                        : "bg-surface-1 border-border-subtle text-text-main hover:border-gold/50 hover:bg-surface-2"
                    }`}
                  >
                    <span className="text-lg font-heading tracking-wide">
                      {slot.hora_formatada}
                    </span>
                    <span
                      className={`text-[10px] ${
                        isSelected ? "text-bg-base/80 font-bold" : "text-text-muted"
                      }`}
                    >
                      60 min
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {selectedSlot && (
            <div className="sticky bottom-16 md:bottom-4 bg-surface-1/95 backdrop-blur-md border border-border-gold/30 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] text-text-muted block font-medium">
                  Horário Escolhido
                </span>
                <span className="text-base font-bold font-heading text-gold">
                  {selectedSlot.hora_formatada} ({formatDateShort(`${selectedDate}T12:00:00`)})
                </span>
              </div>

              <button
                type="button"
                onClick={() => setStep(4)}
                className="inline-flex items-center gap-2 metallic-gold-btn font-bold text-sm px-6 py-3 rounded-xl shadow-lg transition-all active:scale-95"
              >
                <span>Revisar e Confirmar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASSO 4: CONFIRMAÇÃO, POLÍTICA E AUTH RÁPIDO */}
      {/* ========================================================================= */}
      {step === 4 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-heading text-text-main">
              4. Confirme seu agendamento
            </h2>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="text-xs text-gold flex items-center gap-1 hover:underline"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Voltar
            </button>
          </div>

          {/* RESUMO DO AGENDAMENTO */}
          <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 space-y-4">
            <h3 className="font-heading text-sm text-text-muted font-medium border-b border-border-subtle pb-2">
              Resumo do Atendimento
            </h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Data & Horário:</span>
                <span className="font-semibold text-text-main">
                  {formatDateFriendly(`${selectedDate}T12:00:00`)}, às {selectedSlot?.hora_formatada}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-text-muted">Profissional:</span>
                <span className="font-semibold text-text-main">Gilmar Sales (GS Elétrica)</span>
              </div>

              <div className="pt-2 border-t border-border-subtle/50 space-y-1">
                <span className="text-xs text-text-muted block mb-1">Serviços:</span>
                {optimization.appliedCombos.map((c) => (
                  <div key={c.combo.id} className="flex justify-between text-xs">
                    <span className="text-text-main font-medium">
                      ✨ {c.combo.nome} <span className="text-text-muted font-normal">({c.combo.duracao_min || 60} min)</span>
                    </span>
                    <span className="text-gold font-semibold">{formatCurrency(c.combo.preco)}</span>
                  </div>
                ))}
                {optimization.residualServices.map((s) => (
                  <div key={s.id} className="flex justify-between text-xs">
                    <span className="text-text-muted">
                      &bull; {s.nome} <span className="text-text-muted/70 text-[11px]">({s.duracao_min || 60} min)</span>
                    </span>
                    <span className="text-text-main">{formatCurrency(s.preco)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-border-subtle flex items-baseline justify-between">
                <span className="font-semibold text-text-main">Total a pagar:</span>
                <div className="text-right">
                  <span className="text-2xl font-bold font-heading text-gold">
                    {formatCurrency(optimization.finalTotal)}
                  </span>
                  {optimization.totalSavings > 0 && (
                    <span className="text-xs text-success block">
                      Economia de {formatCurrency(optimization.totalSavings)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ANEXAR IMAGENS DO SERVIÇO / ORÇAMENTO (OPCIONAL) */}
          <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5">
            <ImageAttachmentUploader
              images={selectedImages}
              onChange={setSelectedImages}
              disabled={isSubmitting}
            />
          </div>

          {/* CAMPO DE OBSERVAÇÕES OPCIONAIS */}
          <div className="space-y-1.5">
            <label className="text-xs text-text-muted">
              Observações para o Gilmar (opcional):
            </label>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Quadro com disjuntores esquentando, tomada com faísca..."
              className="w-full bg-surface-1 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-gold"
            />
          </div>

          {/* POLÍTICA DE CANCELAMENTO COM CHECKBOX OBRIGATÓRIO */}
          <div className="bg-surface-2/60 border border-border-gold/40 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-gold shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <h4 className="font-heading text-text-main font-semibold">
                  Política de Cancelamento e Não Comparecimento
                </h4>
                <p className="text-text-muted leading-relaxed">
                  Cancelamento ou reagendamento gratuito até <strong>{config.horas_cancelamento_gratis} horas antes</strong> do horário marcado. Cancelamentos com menos de 3 horas ou ausência geram multa de <strong>{config.multa_percentual}% ({formatCurrency(optimization.finalTotal * (config.multa_percentual / 100))})</strong>.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-3 pt-2 border-t border-border-subtle/60 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptedPolicy}
                onChange={(e) => setAcceptedPolicy(e.target.checked)}
                className="w-5 h-5 rounded border-border-subtle text-gold accent-gold cursor-pointer"
              />
              <span className="text-xs font-medium text-text-main">
                Li e concordo com a política de cancelamento
              </span>
            </label>
          </div>

          {/* VERIFICAÇÃO DE IDENTIFICAÇÃO DO CLIENTE */}
          {!currentUser ? (
            <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <span className="text-xs text-gold font-semibold">
                  Identificação do Cliente
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAuthMode("cadastro")}
                    className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                      authMode === "cadastro"
                        ? "bg-gold text-bg-base font-semibold"
                        : "text-text-muted hover:text-text-main"
                    }`}
                  >
                    Primeira vez
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode("login")}
                    className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                      authMode === "login"
                        ? "bg-gold text-bg-base font-semibold"
                        : "text-text-muted hover:text-text-main"
                    }`}
                  >
                    Já sou cliente
                  </button>
                </div>
              </div>

              {authMode === "cadastro" ? (
                <form onSubmit={handleQuickCadastro} className="space-y-3">
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Seu Nome Completo:</label>
                    <input
                      type="text"
                      required
                      value={authNome}
                      onChange={(e) => setAuthNome(e.target.value)}
                      placeholder="Ex: Carlos Eduardo"
                      className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-gold"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-text-muted block mb-1">WhatsApp:</label>
                      <input
                        type="tel"
                        required
                        value={authWhats}
                        onChange={(e) => setAuthWhats(formatPhone(e.target.value))}
                        placeholder="(32) 99999-9999"
                        className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-gold"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-text-muted block mb-1">Data de Nascimento (Aniversário):</label>
                      <input
                        type="date"
                        value={authNascimento}
                        onChange={(e) => setAuthNascimento(e.target.value)}
                        className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-gold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-text-muted block mb-1">Crie uma Senha Simples:</label>
                    <input
                      type="password"
                      required
                      minLength={4}
                      value={authSenha}
                      onChange={(e) => setAuthSenha(e.target.value)}
                      placeholder="Sua senha (ex: 123456)"
                      className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-gold"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isAuthLoading || !acceptedPolicy}
                    className="w-full metallic-gold-btn disabled:opacity-40 font-bold text-sm py-3.5 rounded-xl transition-all shadow-md active:scale-95"
                  >
                    {isAuthLoading ? "Criando cadastro..." : "Cadastrar e Confirmar Agendamento"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleQuickLogin} className="space-y-3">
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Seu E-mail, Nome ou WhatsApp:</label>
                    <input
                      type="text"
                      required
                      value={authWhats}
                      onChange={(e) => setAuthWhats(e.target.value)}
                      placeholder="Ex: Carlos, carlos@gmail.com ou 32999999999"
                      className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-gold"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-text-muted block mb-1">Sua Senha:</label>
                    <input
                      type="password"
                      required
                      value={authSenha}
                      onChange={(e) => setAuthSenha(e.target.value)}
                      placeholder="Sua senha de acesso"
                      className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-gold"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isAuthLoading}
                    className="w-full metallic-gold-btn disabled:opacity-40 font-bold text-sm py-3.5 rounded-xl transition-all shadow-md active:scale-95"
                  >
                    {isAuthLoading ? "Conectando..." : "Entrar na Minha Conta"}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-3.5 flex items-center justify-between text-xs">
                <span className="text-text-muted">Conectado como:</span>
                <span className="font-semibold text-gold">{currentUser.nome || "Cliente conectado"}</span>
              </div>

              {/* BARRA DE PROGRESSO DE UPLOAD */}
              {isSubmitting && uploadProgress !== null && (
                <div className="bg-surface-2 border border-border-gold/40 rounded-xl p-3.5 space-y-2 animate-in fade-in">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-text-main flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-gold" />
                      <span>{uploadStatusText || "Enviando imagens anexadas..."}</span>
                    </span>
                    <span className="font-bold text-gold">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-surface-3 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gold h-full transition-all duration-200 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={isSubmitting || !acceptedPolicy}
                onClick={handleConfirmBooking}
                className="w-full metallic-gold-btn disabled:opacity-40 text-bg-base font-bold text-base py-4 rounded-2xl shadow-xl shadow-gold/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Clock className="w-5 h-5 animate-spin" />
                    <span>
                      {uploadProgress !== null
                        ? `Enviando fotos (${uploadProgress}%)...`
                        : "Confirmando no sistema..."}
                    </span>
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 stroke-[2.5]" />
                    <span>Confirmar Solicitação de Orçamento</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
