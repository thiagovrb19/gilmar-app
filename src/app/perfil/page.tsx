import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientHeader } from "@/components/layout/client-header";
import { ClientBottomNav } from "@/components/layout/client-bottom-nav";
import { ClientProfileView } from "@/components/booking/client-profile-view";
import { getCurrentUser } from "@/actions/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Meu Perfil | Barbearia do Luiz",
};

export default async function PerfilPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-base text-text-main pb-24 md:pb-12">
      <ClientHeader />

      <main className="flex-1 max-w-md mx-auto w-full px-4 pt-6 space-y-6">
        <ClientProfileView
          user={{
            id: user.id,
            nome: user.cliente?.nome || "",
            whatsapp: user.cliente?.whatsapp || "",
            dataNascimento: user.cliente?.data_nascimento || "",
          }}
        />
      </main>

      <ClientBottomNav />
    </div>
  );
}
