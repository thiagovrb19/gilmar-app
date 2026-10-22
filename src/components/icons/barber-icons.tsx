import React from "react";

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

/** 1. Corte (Tesoura aberta de barbeiro) */
export function IconCorte({ size = 24, className = "", ...props }: IconProps) {
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
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  );
}

/** 2. Barba (Navalha de barbear clássica aberta) */
export function IconBarba({ size = 24, className = "", ...props }: IconProps) {
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
      {/* Cabo da navalha */}
      <path d="M3 21l8-8" />
      <path d="M4 17l4 4" />
      {/* Lâmina aberta */}
      <path d="M11 13l7-7a2.5 2.5 0 0 1 3.5 0l0 0a2.5 2.5 0 0 1 0 3.5l-7 7" />
      <path d="M15 8l2 2" />
      <circle cx="11" cy="13" r="1.5" fill="currentColor" />
    </svg>
  );
}

/** 3. Combo (Tesoura e Navalha cruzadas com laço premium) */
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
      {/* Lâmina cruzada */}
      <path d="M4 4l16 16" />
      <path d="M15 4l5 5-2 2-5-5z" />
      {/* Tesoura cruzada */}
      <circle cx="5" cy="19" r="2.5" />
      <path d="M7 17l13-13" />
      {/* Estrela de destaque de combo */}
      <path d="M12 2l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 4. Pezinho (Máquina de acabamento / Clipper) */
export function IconPezinho({ size = 24, className = "", ...props }: IconProps) {
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
      {/* Corpo da máquina */}
      <rect x="7" y="7" width="10" height="14" rx="3" />
      {/* Cabeça de lâmina / dentes de corte */}
      <path d="M7 7l1-4h8l1 4" />
      <line x1="9" y1="3" x2="9" y2="5" />
      <line x1="12" y1="3" x2="12" y2="5" />
      <line x1="15" y1="3" x2="15" y2="5" />
      {/* Chave de força / design */}
      <line x1="12" y1="11" x2="12" y2="15" />
    </svg>
  );
}

/** 5. Sobrancelha (Arco estético com pinça) */
export function IconSobrancelha({ size = 24, className = "", ...props }: IconProps) {
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
      {/* Arco da sobrancelha */}
      <path d="M3 13c3-5 8-6 13-3 2 1 4 3 5 4" strokeWidth="2.2" />
      {/* Pinça de precisão */}
      <path d="M16 4l4 4-7 11-2-2z" />
      <line x1="14" y1="9" x2="19" y2="14" />
    </svg>
  );
}

/** 6. Cavanhaque (Contorno de queixo estilizado com cavanhaque) */
export function IconCavanhaque({ size = 24, className = "", ...props }: IconProps) {
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
      {/* Contorno facial/queixo */}
      <path d="M5 8c0 7 3 12 7 13 4-1 7-6 7-13" />
      {/* Bigode e cavanhaque fechado */}
      <path d="M8 10c2-1 4-1 4 1 0-2 2-1 4-1" />
      <path d="M9 13h6c-0.5 4-2 6-3 6s-2.5-2-3-6z" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}

/** 7. Pigmentação (Pincel de precisão com gota de pigmento) */
export function IconPigmentacao({ size = 24, className = "", ...props }: IconProps) {
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
      {/* Pincel */}
      <path d="M18 3l3 3-9 9-4 1 1-4 9-9z" />
      <path d="M14 7l3 3" />
      {/* Gota de pigmento */}
      <path d="M6 16c0-2 3-5 3-5s3 3 3 5a3 3 0 0 1-6 0z" fill="currentColor" fillOpacity="0.25" />
    </svg>
  );
}

/** 8. Fidelidade (Selo/Distintivo de Honra com Estrela) */
export function IconFidelidade({ size = 24, className = "", ...props }: IconProps) {
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
      <circle cx="12" cy="9" r="6" />
      <path d="M12 6.5l1 1.8 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2-1.5-1.4 2-.3z" fill="currentColor" stroke="none" />
      <path d="M8.2 14.5L7 22l5-2.5 5 2.5-1.2-7.5" />
    </svg>
  );
}

/** 9. Aniversário (Bolo com vela e chama acesa) */
export function IconAniversario({ size = 24, className = "", ...props }: IconProps) {
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
      {/* Bolo */}
      <path d="M4 14h16v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6z" />
      <path d="M4 14c1.5 1 2.5 1 4 0s2.5-1 4 0 2.5 1 4 0 2.5-1 4 0" />
      <path d="M6 10h12v4H6z" />
      {/* Vela */}
      <line x1="12" y1="6" x2="12" y2="10" />
      {/* Chama */}
      <path d="M12 3a1.5 1.5 0 0 1 1.5 1.5c0 .8-.8 1.5-1.5 2.5-.7-1-1.5-1.7-1.5-2.5A1.5 1.5 0 0 1 12 3z" fill="currentColor" />
    </svg>
  );
}

/** 10. Cliente Sumido (Relógio com Seta de Retorno / Chamar de volta) */
export function IconClienteSumido({ size = 24, className = "", ...props }: IconProps) {
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
      <circle cx="12" cy="13" r="8" />
      <polyline points="12 9 12 13 15 15" />
      {/* Seta de retorno no topo */}
      <path d="M8 5L4 5 4 9" />
      <path d="M4 5a9 9 0 0 1 15 3.5" />
    </svg>
  );
}

/** 11. Multa (Ampulheta com Cifrão de Taxa / Pendência) */
export function IconMulta({ size = 24, className = "", ...props }: IconProps) {
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
      <path d="M6 2h12v4a6 6 0 0 1-6 6 6 6 0 0 1-6-6V2z" />
      <path d="M6 22h12v-4a6 6 0 0 0-6-6 6 6 0 0 0-6 6v4z" />
      {/* Cifrão central */}
      <path d="M12 9v6" />
      <path d="M10.5 10.5c.5-.5 2-.5 2.5 0s0 1.2-1 1.5 0 1.5 1 1.5" strokeWidth="1.5" />
    </svg>
  );
}

/** 12. Pix Estilizado (Losango facetado geométrico exclusivo — não copia oficial) */
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
  switch (iconeName?.toLowerCase()) {
    case "corte":
      return <IconCorte size={size} className={className} />;
    case "barba":
      return <IconBarba size={size} className={className} />;
    case "combo":
      return <IconCombo size={size} className={className} />;
    case "pezinho":
      return <IconPezinho size={size} className={className} />;
    case "sobrancelha":
      return <IconSobrancelha size={size} className={className} />;
    case "cavanhaque":
      return <IconCavanhaque size={size} className={className} />;
    case "pigmentacao":
    case "pigmentação":
      return <IconPigmentacao size={size} className={className} />;
    default:
      return <IconCorte size={size} className={className} />;
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

/** Ícone Oficial do WhatsApp fornecido pelo Luiz */
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
