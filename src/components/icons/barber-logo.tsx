import React from "react";
import Image from "next/image";

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export function BarberLogo({
  size = 40,
  showText = false,
  className = "",
}: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`} suppressHydrationWarning>
      <div
        className="relative shrink-0 rounded-full overflow-hidden shadow-md ring-1 ring-gold/40 bg-surface-1"
        style={{ width: size, height: size }}
      >
        <Image
          src="/brand/logo.png"
          alt="Barbearia do Luiz Logo"
          width={size * 2}
          height={size * 2}
          className="w-full h-full object-cover"
          priority
        />
      </div>

      {showText && (
        <div className="flex flex-col leading-tight" suppressHydrationWarning>
          <span className="font-heading text-gold font-bold text-lg">
            Barbearia do Luiz
          </span>
          <span className="text-[11px] text-text-muted font-medium">
            Agendamento &bull; Gestão
          </span>
        </div>
      )}
    </div>
  );
}
