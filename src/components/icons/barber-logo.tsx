import React from "react";
import Image from "next/image";
import { Zap } from "lucide-react";

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  subtitle?: string;
}

export function GSLogo({
  size = 40,
  showText = false,
  className = "",
  subtitle = "Elétrica & Manutenção",
}: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`} suppressHydrationWarning>
      <div
        className="relative shrink-0 rounded-2xl overflow-hidden shadow-lg ring-1 ring-gold/50 bg-gradient-to-br from-blue-950 via-slate-900 to-amber-950 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Image
          src="/brand/gs-logo.jpg"
          alt="GS Elétrica e Manutenção - Gilmar Sales"
          width={size * 2}
          height={size * 2}
          className="w-full h-full object-cover"
          priority
        />
        {/* Fallback overlay glow */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
      </div>

      {showText && (
        <div className="flex flex-col leading-tight" suppressHydrationWarning>
          <div className="flex items-center gap-1">
            <span className="font-heading text-blue-400 font-extrabold text-lg tracking-wider">
              GS
            </span>
            <span className="font-heading text-gold font-bold text-lg">
              Gilmar Sales
            </span>
            <Zap className="w-3.5 h-3.5 text-gold fill-gold shrink-0 animate-pulse" />
          </div>
          <span className="text-[10px] text-text-muted font-semibold tracking-wide uppercase">
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
}

/** Alias para compatibilidade com os imports existentes */
export const BarberLogo = GSLogo;
