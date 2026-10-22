"use client";

import React from "react";
import Link from "next/link";
import { BarberLogo } from "@/components/icons/barber-logo";

export function ClientHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border-subtle bg-surface-1/95 backdrop-blur-md px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group transition-opacity hover:opacity-90">
          <BarberLogo size={36} showText={true} />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/agendar"
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-bg-base bg-gold hover:bg-gold-hover transition-colors rounded-xl shadow-sm"
          >
            Solicitar Orçamento
          </Link>
        </div>
      </div>
    </header>
  );
}
