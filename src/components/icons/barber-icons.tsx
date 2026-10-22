import React from "react";
import {
  Zap,
  Wrench,
  Lightbulb,
  Plug,
  Factory,
  Home,
  ShieldCheck,
  Cpu,
  Flame,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

/** 1. Raio / Energia Elétrica */
export function IconRaio({ size = 24, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}

/** 2. Quadro de Distribuição / Disjuntor */
export function IconQuadro({ size = 24, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <rect x="5.5" y="6" width="3" height="5" rx="1" fill="currentColor" fillOpacity="0.2" />
      <rect x="5.5" y="13" width="3" height="5" rx="1" fill="currentColor" fillOpacity="0.2" />
      <rect x="15.5" y="6" width="3" height="5" rx="1" fill="currentColor" fillOpacity="0.2" />
      <rect x="15.5" y="13" width="3" height="5" rx="1" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}

/** 3. Chuveiro / Aquecimento Elétrico */
export function IconChuveiro({ size = 24, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M4 4h7a4 4 0 0 1 4 4v2" />
      <path d="M12 10h6a2 2 0 0 1 2 2v1H10v-1a2 2 0 0 1 2-2z" fill="currentColor" fillOpacity="0.2" />
      <line x1="11" y1="16" x2="11" y2="17" />
      <line x1="15" y1="16" x2="15" y2="17" />
      <line x1="19" y1="16" x2="19" y2="17" />
      <line x1="13" y1="19" x2="13" y2="20" />
      <line x1="17" y1="19" x2="17" y2="20" />
    </svg>
  );
}

/** 4. Iluminação / Lâmpada LED */
export function IconLampada({ size = 24, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5z" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}

/** 5. Tomada / Conexão */
export function IconTomada({ size = 24, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="8.5" cy="12" r="1.5" fill="currentColor" />
      <circle cx="15.5" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

/** 6. Manutenção Industrial / Motores / Indústria */
export function IconIndustrial({ size = 24, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M2 20h20" />
      <path d="M5 20V8l4 4V8l4 4V4h7v16H5z" fill="currentColor" fillOpacity="0.15" />
      <circle cx="16" cy="9" r="1.5" />
      <circle cx="16" cy="14" r="1.5" />
    </svg>
  );
}

/** 7. Ferramentas / Manutenção Geral */
export function IconFerramentas({ size = 24, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" fill="currentColor" fillOpacity="0.15" />
    </svg>
  );
}

/** 8. Padrão CEMIG / Entrada de Energia */
export function IconPadrao({ size = 24, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="4" y="3" width="16" height="12" rx="2" />
      <line x1="8" y1="15" x2="8" y2="21" />
      <line x1="16" y1="15" x2="16" y2="21" />
      <circle cx="12" cy="8" r="3" fill="currentColor" fillOpacity="0.2" />
      <line x1="12" y1="8" x2="13.5" y2="6.5" strokeWidth="2" />
    </svg>
  );
}

/** 9. Combo / Pacote Completo */
export function IconCombo({ size = 24, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}

/** Aliases para compatibilidade */
export const IconCorte = IconRaio;
export const IconBarba = IconQuadro;
export const IconPezinho = IconTomada;
export const IconSobrancelha = IconLampada;
export const IconCavanhaque = IconChuveiro;
export const IconPigmentacao = IconIndustrial;
export const IconFidelidade = IconCombo;
export const IconAniversario = IconCombo;
export const IconClienteSumido = IconFerramentas;
export const IconMulta = IconFerramentas;

/** Pix Estilizado */
export function IconPix({ size = 24, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M12 2l8 10-8 10-8-10L12 2z" />
      <path d="M7 12l5-5 5 5-5 5-5-5z" fill="currentColor" fillOpacity="0.2" />
      <line x1="12" y1="7" x2="12" y2="17" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

/** Helper de seleção de ícone por nome de serviço */
export function getServiceIcon(iconeName: string, size = 22, className = "") {
  const chave = (iconeName || "").toLowerCase().trim();
  switch (chave) {
    case "raio":
    case "eletrica":
    case "fiação":
    case "fiacao":
    case "corte":
      return <IconRaio size={size} className={className} />;
    case "quadro":
    case "qdf":
    case "disjuntor":
    case "barba":
      return <IconQuadro size={size} className={className} />;
    case "chuveiro":
    case "aquecedor":
    case "cavanhaque":
      return <IconChuveiro size={size} className={className} />;
    case "lampada":
    case "iluminacao":
    case "iluminação":
    case "spot":
    case "sobrancelha":
      return <IconLampada size={size} className={className} />;
    case "tomada":
    case "interruptor":
    case "pezinho":
      return <IconTomada size={size} className={className} />;
    case "industrial":
    case "motor":
    case "bomba":
    case "fabrica":
    case "pigmentacao":
    case "pigmentação":
      return <IconIndustrial size={size} className={className} />;
    case "ferramentas":
    case "manutencao":
    case "manutenção":
    case "diagnostico":
    case "vistoria":
      return <IconFerramentas size={size} className={className} />;
    case "padrao":
    case "cemig":
      return <IconPadrao size={size} className={className} />;
    case "combo":
    case "pacote":
    case "checkup":
      return <IconCombo size={size} className={className} />;
    default:
      return <IconRaio size={size} className={className} />;
  }
}

/** Ícone de Instagram SVG */
export function IconInstagram({ size = 24, className = "", ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

/** Ícone Oficial do WhatsApp */
export function IconWhatsApp({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src="/brand/whatsapp.png"
      alt="WhatsApp"
      width={size}
      height={size}
      className={`inline-block shrink-0 object-contain ${className}`}
    />
  );
}
