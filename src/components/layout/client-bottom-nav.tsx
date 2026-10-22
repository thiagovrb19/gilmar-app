"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function ClientBottomNav() {
  const pathname = usePathname();

  // Ocultar barra em rotas admin
  if (pathname.startsWith("/admin")) {
    return null;
  }

  const items = [
    { label: "Início", href: "/", icon: Home },
    { label: "Solicitar", href: "/agendar", icon: Calendar, highlight: true },
    { label: "Meus Pedidos", href: "/meus-agendamentos", icon: Clock },
    { label: "Perfil", href: "/perfil", icon: User },
  ];

  return (
    <nav
      aria-label="Navegação móvel do cliente"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border-subtle bg-surface-1/95 backdrop-blur-lg px-2 py-1 safe-bottom"
    >
      <div className="grid grid-cols-4 items-center">
        {items.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          if (item.highlight) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-4 group relative py-1 focus:outline-none"
              >
                <div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95",
                    isActive
                      ? "bg-gold text-bg-base ring-2 ring-gold/40"
                      : "bg-surface-2 border border-border-gold text-gold group-hover:bg-gold group-hover:text-bg-base"
                  )}
                >
                  <Icon className="w-5 h-5 stroke-[2.2]" />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium mt-1 transition-colors",
                    isActive ? "text-gold font-semibold" : "text-text-muted"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center py-2 min-h-[48px] rounded-lg transition-colors focus:outline-none active:bg-surface-2/60",
                isActive ? "text-gold" : "text-text-muted hover:text-text-main"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive ? "stroke-[2.2]" : "stroke-[1.75]")} />
              <span
                className={cn(
                  "text-[10px] mt-1 font-medium tracking-tight",
                  isActive ? "text-gold font-semibold" : "text-text-muted"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
