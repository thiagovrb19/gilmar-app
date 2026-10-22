import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientHeader } from "@/components/layout/client-header";
import { ClientBottomNav } from "@/components/layout/client-bottom-nav";
import { ClientBookingsView } from "@/components/booking/client-bookings-view";
import {
  getMeusAgendamentos,
  getMinhasMultas,
  getConfiguracoes,
} from "@/actions/booking";
import { getCurrentUser } from "@/actions/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Meus Orçamentos e Serviços | GS Elétrica e Manutenção",
};

export default async function MeusAgendamentosPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const [bookings, multas, config] = await Promise.all([
    getMeusAgendamentos(),
    getMinhasMultas(),
    getConfiguracoes(),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-bg-base text-text-main pb-24 md:pb-12">
      <ClientHeader />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 space-y-6">
        <ClientBookingsView
          proximos={bookings.proximos}
          historico={bookings.historico}
          multas={multas}
          config={config}
        />
      </main>

      <ClientBottomNav />
    </div>
  );
}
