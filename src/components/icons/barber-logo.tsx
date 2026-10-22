import React from "react";
import { Zap } from "lucide-react";

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  subtitle?: string;
}

export function GSLogo({
  size = 42,
  showText = true,
  className = "",
  subtitle = "ELÉTRICA E MANUTENÇÃO",
}: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`} suppressHydrationWarning>
      {/* Emblema Elétrico GS */}
      <div
        className="relative shrink-0 rounded-2xl bg-gradient-to-br from-[#0c1629] via-[#06090f] to-[#121c30] border border-[#0084ff]/60 shadow-[0_0_15px_rgba(0,132,255,0.3)] flex items-center justify-center p-1 group transition-all"
        style={{ width: size, height: size }}
      >
        <div className="flex items-center justify-center relative w-full h-full">
          {/* Fundo sutil de raio */}
          <Zap className="w-5 h-5 text-[#ffe066] fill-[#ffe066] drop-shadow-[0_0_8px_rgba(255,224,102,0.8)]" />
        </div>
      </div>

      {showText && (
        <div className="flex flex-col text-left leading-none select-none" suppressHydrationWarning>
          <div className="flex items-baseline gap-1.5">
            <span className="font-heading font-black text-xl sm:text-2xl text-[#0084ff] tracking-tight drop-shadow-[0_0_10px_rgba(0,132,255,0.5)]">
              GS
            </span>
            <span className="font-heading font-extrabold text-xl sm:text-2xl text-[#ffe066] tracking-tight drop-shadow-[0_0_8px_rgba(255,224,102,0.4)]">
              Gilmar Sales
            </span>
          </div>
          <span className="text-[9px] sm:text-[10px] text-[#94a3b8] font-bold tracking-[0.2em] uppercase mt-0.5">
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
}

/** Alias para compatibilidade com os imports existentes */
export const BarberLogo = GSLogo;
