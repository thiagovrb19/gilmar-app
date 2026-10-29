"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CalendarCheck,
  Users,
  DollarSign,
  Zap,
  Package,
  Settings,
  ExternalLink,
  LogOut,
} from "lucide-react";
import { BarberLogo } from "@/components/icons/barber-logo";
import { cn } from "@/lib/utils";

export function AdminSidebar() {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return null;
  }

  const navItems = [
    { label: "Hoje (Dashboard)", href: "/admin", icon: CalendarDays, exact: true },
    { label: "Agenda de Serviços", href: "/admin/agenda", icon: CalendarCheck },
    { label: "Clientes", href: "/admin/clientes", icon: Users },
    { label: "Financeiro", href: "/admin/financeiro", icon: DollarSign },
    { label: "Controle de Estoque", href: "/admin/estoque", icon: Package },
    { label: "Serviços Elétricos", href: "/admin/servicos", icon: Zap },
    { label: "Configurações", href: "/admin/configuracoes", icon: Settings },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-border-subtle bg-surface-1 min-h-screen p-4 justify-between shrink-0">
      <div className="space-y-6">
        <div className="px-2 pt-2 pb-4 border-b border-border-subtle">
          <Link href="/admin">
            <BarberLogo size={40} showText={true} />
          </Link>
          <div className="mt-3 px-2 py-1 bg-surface-2 rounded-lg border border-border-subtle flex items-center justify-between">
            <span className="text-xs font-semibold text-gold">Painel do Gilmar</span>
            <span className="text-[10px] text-text-muted bg-bg-base px-2 py-0.5 rounded">Admin</span>
          </div>
        </div>

        <nav aria-label="Navegação administrativa" className="space-y-1.5">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                  isActive
                    ? "bg-gold text-bg-base font-semibold shadow-sm"
                    : "text-text-muted hover:text-text-main hover:bg-surface-2"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 transition-colors",
                    isActive ? "text-bg-base" : "text-gold/80 group-hover:text-gold"
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-border-subtle space-y-2">
        <Link
          href="/"
          target="_blank"
          className="flex items-center justify-between px-3 py-2 text-xs text-text-muted hover:text-text-main hover:bg-surface-2 rounded-lg transition-colors"
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            Ver Área do Cliente
          </span>
          <span className="text-[10px] bg-surface-2 px-1.5 py-0.5 rounded">Abrir</span>
        </Link>
      </div>
    </aside>
  );
}
