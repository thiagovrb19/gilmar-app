"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CalendarCheck,
  Users,
  DollarSign,
  MoreHorizontal,
  Zap,
  Settings,
  LogOut,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // Não exibir no login de admin
  if (pathname === "/admin/login") {
    return null;
  }

  const items = [
    { label: "Hoje", href: "/admin", icon: CalendarDays, exact: true },
    { label: "Agenda", href: "/admin/agenda", icon: CalendarCheck },
    { label: "Clientes", href: "/admin/clientes", icon: Users },
    { label: "Financeiro", href: "/admin/financeiro", icon: DollarSign },
  ];

  const isMoreActive =
    pathname.startsWith("/admin/servicos") ||
    pathname.startsWith("/admin/configuracoes");

  return (
    <>
      {/* Modal / Sheet simplificado de opções extras mobile */}
      {moreOpen && (
        <div
          role="dialog"
          aria-label="Menu Mais Opções"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col justify-end md:hidden animate-in fade-in duration-200"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="bg-surface-1 border-t border-border-subtle rounded-t-2xl p-5 space-y-3 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <span className="font-heading text-sm text-text-muted font-medium">
                Mais opções de gestão
              </span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="p-1 text-text-muted hover:text-text-main"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <Link
              href="/admin/servicos"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3.5 p-3 rounded-xl hover:bg-surface-2 transition-colors text-text-main"
            >
              <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center text-gold">
                <Zap className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-sm">Serviços Elétricos</span>
                <span className="text-xs text-text-muted">Preços, itens e ordem</span>
              </div>
            </Link>

            <Link
              href="/admin/configuracoes"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3.5 p-3 rounded-xl hover:bg-surface-2 transition-colors text-text-main"
            >
              <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center text-gold">
                <Settings className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-sm">Configurações</span>
                <span className="text-xs text-text-muted">Pix, funcionamento e regras</span>
              </div>
            </Link>

            <Link
              href="/"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3.5 p-3 rounded-xl hover:bg-surface-2 transition-colors text-text-muted"
            >
              <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center text-text-muted">
                <LogOut className="w-5 h-5" />
              </div>
              <span className="font-medium text-sm">Ver Área do Cliente</span>
            </Link>
          </div>
        </div>
      )}

      {/* Barra de Navegação Inferior Fixa */}
      <nav
        aria-label="Navegação móvel do admin"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border-subtle bg-surface-1/95 backdrop-blur-lg px-2 py-1"
      >
        <div className="grid grid-cols-5 items-center">
          {items.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center py-2 min-h-[48px] rounded-lg transition-colors focus:outline-none",
                  isActive ? "text-gold" : "text-text-muted hover:text-text-main"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive ? "stroke-[2.2]" : "stroke-[1.75]")} />
                <span
                  className={cn(
                    "text-[10px] mt-1 font-medium",
                    isActive ? "text-gold font-semibold" : "text-text-muted"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            className={cn(
              "flex flex-col items-center justify-center py-2 min-h-[48px] rounded-lg transition-colors focus:outline-none",
              isMoreActive ? "text-gold" : "text-text-muted hover:text-text-main"
            )}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span
              className={cn(
                "text-[10px] mt-1 font-medium",
                isMoreActive ? "text-gold font-semibold" : "text-text-muted"
              )}
            >
              Mais
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
