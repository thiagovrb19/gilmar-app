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
  FileText,
  Plus,
  Trash2,
  MapPin,
  Printer,
  Send,
  Camera,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ImageAttachmentUploader, SelectedImage } from "./image-attachment-uploader";
import { Servico, Configuracao, PropostaItemDetalhe } from "@/lib/supabase/types";
import { getServiceIcon, IconWhatsApp } from "@/components/icons/barber-icons";
import { optimizeServicesWithCombos } from "@/lib/combos";
import { formatCurrency, formatPhone, normalizePhone } from "@/lib/formatters";
import {
  formatDateFriendly,
  formatDateShort,
  formatWeekDayShort,
} from "@/lib/date/tz";
import { getHorariosDisponiveis, criarAgendamentoAction, HorarioSlot } from "@/actions/booking";
import { loginCliente, cadastrarCliente } from "@/actions/auth";
import { abrirPropostaPDF, formatarDataBR, calcularValidadeBR, DadosPropostaPDF } from "@/lib/pdf/proposta-pdf";
import { linkWhatsAppPedido, WHATSAPP_GILMAR_DISPLAY } from "@/lib/whatsapp";

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
  const [authNome, setAuthNome] = useState(initialUser?.nome || "");
  const [authWhats, setAuthWhats] = useState("");
  const [authNascimento, setAuthNascimento] = useState("");
  const [authSenha, setAuthSenha] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Campos completos da Proposta Comercial (Modelo PDF Oficial do Gilmar)
  const [clienteNomeProposta, setClienteNomeProposta] = useState(initialUser?.nome || "");
  const [clienteLocalidade, setClienteLocalidade] = useState("Visconde do Rio Branco - MG");
  const [propostaSubtitulo, setPropostaSubtitulo] = useState(
    "Instalação de comandos elétricos, manutenção e dispositivos de segurança"
  );
  const [propostaObjetivo, setPropostaObjetivo] = useState("");
  const [propostaCondicoesPagamento, setPropostaCondicoesPagamento] = useState("");
  const [propostaItens, setPropostaItens] = useState<PropostaItemDetalhe[]>([]);
  const [pdfGerado, setPdfGerado] = useState(false);

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

  // Sincroniza nome do cliente entre auth e proposta
  useEffect(() => {
    if (currentUser?.nome && !clienteNomeProposta) {
      setClienteNomeProposta(currentUser.nome);
    }
  }, [currentUser?.nome, clienteNomeProposta]);

  // Atualiza automaticamente os itens da proposta, objetivo e condições de pagamento quando serviços ou fotos mudam
  useEffect(() => {
    if (selectedServices.length === 0) {
      setPropostaItens([]);
      return;
    }

    setPropostaItens((prev) => {
      return selectedServices.map((srv, idx) => {
        const num = String(idx + 1).padStart(2, "0");
        const existing = prev[idx];
        const isSameService = existing && existing.servicoNome === srv.nome;
        const isIndustrial =
          srv.icone === "industrial" ||
          srv.nome.toLowerCase().includes("industrial") ||
          srv.nome.toLowerCase().includes("motor") ||
          srv.nome.toLowerCase().includes("inversor");

        const defaultIdentificacao = isIndustrial ? `Máquina ${num}` : `Item ${num}`;
        const identificacao = isSameService ? existing.identificacao : defaultIdentificacao;

        return {
          numero: num,
          identificacao,
          servicoNome: srv.nome,
          escopo: isSameService
            ? existing.escopo
            : `Execução de ${srv.nome.toLowerCase()} em ${identificacao}.`,
          descricao: isSameService
            ? existing.descricao
            : `${srv.descricao || `Fornecimento e instalação de ${srv.nome.toLowerCase()}.`} Materiais e mão de obra inclusos.`,
          quantidade: isSameService ? existing.quantidade : 1,
          valorUnitario: srv.preco,
          valorTotal: (isSameService ? existing.quantidade : 1) * srv.preco,
          fotoUrl: existing?.fotoUrl || null,
          icone: srv.icone,
        };
      });
    });

    const nomes = selectedServices.map((s) => s.nome.toLowerCase()).join(", ");
    setPropostaObjetivo(
      `Executar instalações e adequações elétricas contemplando ${nomes}, conforme o escopo individual descrito nesta proposta.`
    );
  }, [selectedServices]);

  const totalPropostaCalculado =
    propostaItens.length > 0
      ? propostaItens.reduce((acc, item) => acc + item.valorTotal, 0)
      : optimization.finalTotal;

  useEffect(() => {
    const metade = totalPropostaCalculado / 2;
    setPropostaCondicoesPagamento(
      `Entrada de ${formatCurrency(metade)} (50%) na aprovação da proposta e saldo de ${formatCurrency(
        totalPropostaCalculado - metade
      )} (50%) após a conclusão dos serviços.`
    );
  }, [totalPropostaCalculado]);

  const handleUpdatePropostaItem = (
    idx: number,
    patch: Partial<PropostaItemDetalhe>
  ) => {
    setPropostaItens((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, ...patch };
        if (patch.quantidade !== undefined || patch.valorUnitario !== undefined) {
          updated.valorTotal = Math.max(1, updated.quantidade) * Math.max(0, updated.valorUnitario);
        }
        return updated;
      })
    );
  };

  const handleAddItemPersonalizado = () => {
    const nextIdx = propostaItens.length + 1;
    const num = String(nextIdx).padStart(2, "0");
    const baseSrv = selectedServices[0] || initialServices[0];

    setPropostaItens((prev) => [
      ...prev,
      {
        numero: num,
        identificacao: `Máquina ${num}`,
        servicoNome: baseSrv?.nome || "Instalação de painel completo com botão de emergência",
        escopo: `Instalação de ${baseSrv?.nome.toLowerCase() || "painel elétrico"} na Máquina ${num}.`,
        descricao: `${baseSrv?.descricao || "Fornecimento e instalação completa."} Materiais e mão de obra inclusos.`,
        quantidade: 1,
        valorUnitario: baseSrv?.preco || 450,
        valorTotal: baseSrv?.preco || 450,
        fotoUrl: null,
        icone: baseSrv?.icone || "industrial",
      },
    ]);
  };

  // Lê e otimiza a foto anexada especificamente para um item do orçamento (mantida apenas no dispositivo do cliente para o PDF)
  const handleSelectFotoItem = (idx: number, file: File | null) => {
    if (!file) {
      handleUpdatePropostaItem(idx, { fotoUrl: null });
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem válido (JPG, PNG ou WEBP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;

      // Redimensiona via canvas para manter o PDF leve e rápido no celular do cliente
      const img = new Image();
      img.onload = () => {
        const maxDim = 1000;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.82);
          handleUpdatePropostaItem(idx, { fotoUrl: compressedDataUrl });
        } else {
          handleUpdatePropostaItem(idx, { fotoUrl: dataUrl });
        }
      };
      img.onerror = () => {
        handleUpdatePropostaItem(idx, { fotoUrl: dataUrl });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePropostaItem = (idx: number) => {
    if (propostaItens.length <= 1) {
      toast.error("A proposta deve ter pelo menos 1 item no escopo.");
      return;
    }
    setPropostaItens((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((it, newIdx) => ({
          ...it,
          numero: String(newIdx + 1).padStart(2, "0"),
        }))
    );
  };

  // Monta dados consolidados para gerar o PDF
  const buildDadosPropostaPDF = (): DadosPropostaPDF => {
    const nomeFinal =
      clienteNomeProposta.trim() ||
      authNome.trim() ||
      currentUser?.nome ||
      "Cliente";

    return {
      clienteNome: nomeFinal,
      clienteLocalidade: clienteLocalidade.trim() || null,
      clienteWhatsapp: authWhats || null,
      dataProposta: formatarDataBR(new Date()),
      validadeProposta: calcularValidadeBR(new Date(), 10),
      subtitulo: propostaSubtitulo,
      objetivo: propostaObjetivo,
      condicoesPagamento: propostaCondicoesPagamento,
      observacaoCliente: observacao || null,
      itens: propostaItens.map((it) => ({
        ...it,
        fotoUrl: it.fotoUrl || null,
      })),
      valorTotal: totalPropostaCalculado,
    };
  };

  const handleGerarPDFOrcamento = () => {
    const nomeFinal =
      clienteNomeProposta.trim() || authNome.trim() || currentUser?.nome || "";
    if (!nomeFinal) {
      toast.error("Por favor, preencha o Nome do Cliente na seção de informações do orçamento.");
      return;
    }
    if (propostaItens.length === 0) {
      toast.error("Selecione pelo menos um serviço para gerar o orçamento em PDF.");
      return;
    }

    const ok = abrirPropostaPDF(buildDadosPropostaPDF());
    if (!ok) {
      toast.error("Permita pop-ups no seu navegador para visualizar e salvar o PDF da proposta.");
      return;
    }

    setPdfGerado(true);
    toast.success("Proposta Comercial em PDF gerada! Agora você já pode encaminhar para o WhatsApp do Gilmar.");
  };

  const getWhatsAppForwardUrl = () => {
    const nomeFinal =
      clienteNomeProposta.trim() ||
      authNome.trim() ||
      currentUser?.nome ||
      "Cliente";

    return linkWhatsAppPedido({
      id: "ORCAMENTO",
      numero: "#PROPOSTA",
      clienteNome: nomeFinal,
      clienteLocalidade: clienteLocalidade.trim() || null,
      inicio: selectedSlot?.inicio || null,
      itens: propostaItens.map((i) => ({
        nome: i.servicoNome,
        quantidade: i.quantidade,
        valorUnitario: i.valorUnitario,
        identificacao: i.identificacao,
        escopo: i.escopo,
      })),
      desconto: optimization.totalSavings || 0,
      valorTotal: totalPropostaCalculado,
      observacao: observacao || null,
      anexosCount: propostaItens.filter((i) => Boolean(i.fotoUrl)).length,
      subtitulo: propostaSubtitulo,
      objetivo: propostaObjetivo,
      condicoesPagamento: propostaCondicoesPagamento,
      pdfGerado: true,
    });
  };

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
      propostaSubtitulo,
      propostaObjetivo,
      propostaCondicoesPagamento,
      clienteLocalidade,
      propostaItensJson: propostaItens.map(({ fotoUrl, ...rest }) => rest),
      valorTotalOverride: totalPropostaCalculado,
    });

    if (!res.success || !res.agendamento_id) {
      setIsSubmitting(false);
      toast.error(res.error || "Não foi possível confirmar o agendamento.");
      return;
    }

    // Mantém as fotos dos itens apenas no navegador/celular do cliente para geração do PDF na tela de sucesso
    // (não armazena o PDF nem base64 no banco de dados)
    const qtdFotosItens = propostaItens.filter((i) => Boolean(i.fotoUrl)).length;
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          `proposta_fotos_${res.agendamento_id}`,
          JSON.stringify(propostaItens.map((i) => i.fotoUrl || null))
        );
      }
    } catch {
      // ignora se sessionStorage atingir limite
    }

    setIsSubmitting(false);
    setUploadProgress(null);
    setUploadStatusText("");

    toast.success("Solicitação confirmada com sucesso!");
    router.refresh();
    router.push(
      `/agendamento/sucesso?id=${res.agendamento_id}&valor=${res.valor_total}&inicio=${encodeURIComponent(
        selectedSlot.inicio
      )}&anexos=${qtdFotosItens}`
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
                      ? "date-card-selected text-white border-gold ring-2 ring-gold/60 shadow-xl scale-105"
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
                      isSelected ? "text-white font-bold" : "text-text-muted"
                    }`}
                  >
                    {formatWeekDayShort(dateObj)}
                  </span>
                  <span
                    className={`text-2xl font-bold font-heading leading-tight ${
                      isSelected ? "text-white font-extrabold" : isSpecial ? "text-gold" : "text-text-main"
                    }`}
                  >
                    {dateObj.getDate()}
                  </span>
                  <span
                    className={`text-[9px] font-medium truncate max-w-[65px] ${
                      isClosed
                        ? "text-destructive font-semibold"
                        : isSelected
                        ? "text-white font-bold"
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
                        ? "time-card-selected text-emerald-400 border-emerald-500 ring-2 ring-emerald-500/60 shadow-lg scale-[1.03] font-bold"
                        : "bg-surface-1 border-border-subtle text-text-main hover:border-gold/50 hover:bg-surface-2"
                    }`}
                  >
                    <span className={`text-lg font-heading tracking-wide ${isSelected ? "text-emerald-400 font-extrabold" : "text-text-main"}`}>
                      {slot.hora_formatada}
                    </span>
                    <span
                      className={`text-[10px] ${
                        isSelected ? "text-emerald-400/90 font-bold" : "text-text-muted"
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
      {/* PASSO 4: PREENCHIMENTO DA PROPOSTA, GERAÇÃO DO PDF E ENVIO AO WHATSAPP */}
      {/* ========================================================================= */}
      {step === 4 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold font-heading text-text-main">
                4. Dados do Orçamento, PDF e Confirmação
              </h2>
              <p className="text-xs text-text-muted">
                Preencha os detalhes abaixo para gerar sua Proposta Comercial em PDF e encaminhar ao Gilmar
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="text-xs text-gold flex items-center gap-1 hover:underline shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Voltar
            </button>
          </div>

          {/* 1. CABEÇALHO E DADOS DO CLIENTE NA PROPOSTA COMERCIAL */}
          <div className="bg-surface-1 border border-border-gold/40 rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gold" />
                <h3 className="font-heading text-sm text-text-main font-bold">
                  Informações para a Proposta Comercial (PDF)
                </h3>
              </div>
              <span className="text-[10px] bg-gold/15 text-gold border border-gold/30 font-bold px-2.5 py-0.5 rounded-full">
                Validade: 10 dias
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div>
                <label className="text-text-muted font-medium block mb-1">
                  Nome do Cliente / Empresa <span className="text-gold">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={clienteNomeProposta}
                  onChange={(e) => {
                    setClienteNomeProposta(e.target.value);
                    if (!authNome) setAuthNome(e.target.value);
                  }}
                  placeholder="Ex: Felipe / Empresa"
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="text-text-muted font-medium block mb-1">
                  Cidade / Setor / Localidade:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={clienteLocalidade}
                    onChange={(e) => setClienteLocalidade(e.target.value)}
                    placeholder="Ex: Visconde do Rio Branco - MG ou BC"
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-text-muted font-medium block mb-1">
                  Subtítulo da Proposta Comercial:
                </label>
                <input
                  type="text"
                  value={propostaSubtitulo}
                  onChange={(e) => setPropostaSubtitulo(e.target.value)}
                  placeholder="Ex: Instalação de comandos elétricos e dispositivos de segurança em máquinas"
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs text-text-main focus:outline-none focus:border-gold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-text-muted font-medium block mb-1">
                  Objetivo da Proposta:
                </label>
                <textarea
                  rows={2}
                  value={propostaObjetivo}
                  onChange={(e) => setPropostaObjetivo(e.target.value)}
                  placeholder="Descreva o objetivo geral das instalações ou manutenções..."
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-3 text-xs text-text-main focus:outline-none focus:border-gold resize-none"
                />
              </div>
            </div>
          </div>

          {/* 2. ESCOPO INDIVIDUAL DOS SERVIÇOS / MÁQUINAS (TABELA DO PDF) */}
          <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-subtle pb-3">
              <div>
                <h3 className="font-heading text-sm text-text-main font-bold">
                  Escopo dos Serviços e Máquinas / Locais ({propostaItens.length})
                </h3>
                <p className="text-[11px] text-text-muted">
                  Personalize o nome de cada máquina/ambiente e a descrição que sairá no PDF
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddItemPersonalizado}
                className="inline-flex items-center gap-1.5 bg-surface-2 hover:bg-surface-3 text-gold border border-border-gold/40 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Máquina / Item</span>
              </button>
            </div>

            <div className="space-y-3">
              {propostaItens.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-surface-2/60 border border-border-subtle rounded-xl p-3.5 space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-[#1b80c4] text-white font-bold flex items-center justify-center text-xs">
                        {item.numero}
                      </span>
                      <input
                        type="text"
                        value={item.identificacao}
                        onChange={(e) =>
                          handleUpdatePropostaItem(idx, { identificacao: e.target.value })
                        }
                        placeholder="Ex: Máquina 01 ou Quadro 01"
                        className="bg-surface-1 border border-border-subtle rounded-lg px-2.5 py-1 text-xs font-bold text-gold focus:outline-none focus:border-gold w-40 sm:w-48"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-sm text-gold">
                        {formatCurrency(item.valorTotal)}
                      </span>
                      {propostaItens.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePropostaItem(idx)}
                          className="p-1.5 rounded-lg bg-surface-1 hover:bg-destructive/20 text-text-muted hover:text-destructive transition-colors"
                          title="Remover item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-text-muted block mb-0.5">
                        Serviço:
                      </label>
                      <input
                        type="text"
                        value={item.servicoNome}
                        onChange={(e) =>
                          handleUpdatePropostaItem(idx, { servicoNome: e.target.value })
                        }
                        className="w-full bg-surface-1 border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:outline-none focus:border-gold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-text-muted block mb-0.5">
                        Qtd. Serviços:
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={item.quantidade}
                        onChange={(e) =>
                          handleUpdatePropostaItem(idx, {
                            quantidade: Math.max(1, parseInt(e.target.value, 10) || 1),
                          })
                        }
                        className="w-full bg-surface-1 border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:outline-none focus:border-gold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-text-muted block mb-0.5">
                        Valor Unit. (R$):
                      </label>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={item.valorUnitario}
                          readOnly
                          className="w-full bg-surface-2/60 border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-muted cursor-not-allowed focus:outline-none select-none"
                        />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-text-muted block mb-0.5">
                      Descrição no Escopo (Item {item.numero}):
                    </label>
                    <input
                      type="text"
                      value={item.escopo}
                      onChange={(e) =>
                        handleUpdatePropostaItem(idx, { escopo: e.target.value })
                      }
                      className="w-full bg-surface-1 border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:outline-none focus:border-gold"
                    />
                  </div>

                  {/* OPÇÃO DE FOTO INDIVIDUAL PARA ESTE ITEM DO ORÇAMENTO */}
                  <div className="pt-2 border-t border-border-subtle/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {item.fotoUrl ? (
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gold/50 bg-bg-base shrink-0">
                          <img
                            src={item.fotoUrl}
                            alt={item.identificacao}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/40 shrink-0">
                          <span className="text-red-500 font-extrabold text-xs uppercase tracking-wider">
                            SEM FOTO
                          </span>
                        </div>
                      )}

                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-text-main block">
                          Foto de {item.identificacao} (Opcional)
                        </span>
                        <span className="text-[11px] text-text-muted block">
                          {item.fotoUrl
                            ? "Foto anexada neste item para o PDF do orçamento."
                            : 'Se não anexar foto, sairá escrito "SEM FOTO" em vermelho no PDF.'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <label className="inline-flex items-center gap-1.5 bg-surface-1 hover:bg-surface-3 text-gold border border-border-gold/40 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors">
                        <Camera className="w-3.5 h-3.5" />
                        <span>{item.fotoUrl ? "Trocar Foto" : "Anexar Foto"}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            if (file) {
                              handleSelectFotoItem(idx, file);
                            }
                            e.target.value = "";
                          }}
                        />
                      </label>

                      {item.fotoUrl && (
                        <button
                          type="button"
                          onClick={() => handleSelectFotoItem(idx, null)}
                          className="inline-flex items-center gap-1 bg-surface-1 hover:bg-destructive/20 text-text-muted hover:text-destructive border border-border-subtle text-xs font-semibold px-2.5 py-2 rounded-xl transition-colors"
                          title="Remover foto deste item"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Remover</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-border-subtle grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <label className="text-[11px] text-text-muted block mb-1">
                  Condições de Pagamento na Proposta:
                </label>
                <input
                  type="text"
                  value={propostaCondicoesPagamento}
                  onChange={(e) => setPropostaCondicoesPagamento(e.target.value)}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-gold"
                />
              </div>
              <div className="flex sm: flex-col items-baseline sm:items-end justify-between">
                <span className="text-xs text-text-muted">Valor Total da Proposta:</span>
                <span className="text-2xl font-bold font-heading text-gold">
                  {formatCurrency(totalPropostaCalculado)}
                </span>
              </div>
            </div>
          </div>

          {/* 3. CAMPO DE OBSERVAÇÕES OPCIONAIS */}
          <div className="space-y-1.5">
            <label className="text-xs text-text-muted">
              Observações adicionais para o Gilmar (opcional):
            </label>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Quadro com disjuntores esquentando, urgência na Máquina 01..."
              className="w-full bg-surface-1 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-gold"
            />
          </div>

          {/* 5. CENTRAL DE GERAÇÃO DE ORÇAMENTO EM PDF + ENCAMINHAMENTO WHATSAPP */}
          <div className="bg-gradient-to-br from-[#0c1524] via-surface-1 to-[#111c2d] border-2 border-[#0284c7]/60 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#0284c7]/20 border border-[#0284c7]/40 text-[#38bdf8] flex items-center justify-center shrink-0">
                <Printer className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#38bdf8] bg-[#0284c7]/20 px-2 py-0.5 rounded-full">
                  Documento Oficial GS Elétrica
                </span>
                <h3 className="font-heading text-base font-bold text-text-main">
                  Gerar Orçamento Completo em PDF e Enviar para o Gilmar
                </h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  Gere sua <strong>Proposta Comercial de Serviços em PDF</strong> (com logo no topo, escopo numerado, referência visual e assinaturas com data) e encaminhe direto para o WhatsApp do Gilmar (<strong>{WHATSAPP_GILMAR_DISPLAY}</strong>).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleGerarPDFOrcamento}
                className="w-full inline-flex items-center justify-center gap-2.5 bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-sm py-3.5 px-4 rounded-xl shadow-lg shadow-sky-500/20 transition-all active:scale-[0.98] cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>{pdfGerado ? "Gerar / Baixar PDF Novamente" : "1º Gerar Orçamento em PDF"}</span>
              </button>

              <a
                href={getWhatsAppForwardUrl()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!pdfGerado) {
                    toast.info("Gerando o PDF primeiro para você anexar na conversa do WhatsApp!");
                    handleGerarPDFOrcamento();
                  }
                }}
                className={`w-full inline-flex items-center justify-center gap-2.5 font-bold text-sm py-3.5 px-4 rounded-xl shadow-lg transition-all active:scale-[0.98] cursor-pointer ${
                  pdfGerado
                    ? "bg-[#25D366] hover:bg-[#20bd5a] text-white ring-2 ring-[#25D366]/50 animate-pulse"
                    : "bg-success/90 hover:bg-success text-bg-base"
                }`}
              >
                <IconWhatsApp size={19} />
                <span>2º Enviar no WhatsApp ({WHATSAPP_GILMAR_DISPLAY})</span>
              </a>
            </div>

            {pdfGerado && (
              <div className="bg-success/15 border border-success/40 rounded-xl p-3 text-xs text-success flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 stroke-[3]" />
                <span>
                  <strong>PDF gerado com sucesso!</strong> Clique no botão verde acima para encaminhar ao Gilmar pelo WhatsApp ({WHATSAPP_GILMAR_DISPLAY}) e confirme abaixo para registrar no sistema.
                </span>
              </div>
            )}
          </div>

          {/* 6. POLÍTICA DE CANCELAMENTO COM CHECKBOX OBRIGATÓRIO */}
          <div className="bg-surface-2/60 border border-border-gold/40 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-gold shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <h4 className="font-heading text-text-main font-semibold">
                  Política de Cancelamento e Não Comparecimento
                </h4>
                <p className="text-text-muted leading-relaxed">
                  Cancelamento ou reagendamento gratuito até <strong>{config.horas_cancelamento_gratis} horas antes</strong> do horário marcado. Cancelamentos com menos de 3 horas ou ausência geram multa de <strong>{config.multa_percentual}% ({formatCurrency(totalPropostaCalculado * (config.multa_percentual / 100))})</strong>.
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
                Li e concordo com a política de atendimento e orçamento
              </span>
            </label>
          </div>

          {/* 7. VERIFICAÇÃO DE IDENTIFICAÇÃO DO CLIENTE E REGISTRO NO SISTEMA */}
          {!currentUser ? (
            <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <span className="text-xs text-gold font-semibold">
                  Identificação Rápida para Salvar no Sistema
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
                      onChange={(e) => {
                        setAuthNome(e.target.value);
                        setClienteNomeProposta(e.target.value);
                      }}
                      placeholder="Ex: Felipe / Carlos Eduardo"
                      className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-gold"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-text-muted block mb-1">WhatsApp (Telefone):</label>
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
                    {isAuthLoading ? "Salvando orçamento..." : "Cadastrar e Salvar Solicitação de Orçamento"}
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
                    {isAuthLoading ? "Conectando..." : "Entrar e Salvar Orçamento"}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-3.5 flex items-center justify-between text-xs">
                <span className="text-text-muted">Conectado como:</span>
                <span className="font-semibold text-gold">{currentUser.nome || clienteNomeProposta || "Cliente conectado"}</span>
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
