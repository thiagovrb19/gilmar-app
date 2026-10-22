import React from "react";
import { notFound } from "next/navigation";
import { AdminClientDetailView } from "@/components/admin/admin-client-detail-view";
import { getClienteDetalhes } from "@/actions/admin";
import { getServicos } from "@/actions/booking";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ficha do Cliente | Painel do Luiz",
};

export default async function AdminClienteDetalhePage({ params }: PageProps) {
  const { id } = await params;
  const [dados, servicos] = await Promise.all([
    getClienteDetalhes(id),
    getServicos(),
  ]);

  if (!dados.cliente) {
    notFound();
  }

  return (
    <div className="w-full">
      <AdminClientDetailView
        cliente={dados.cliente}
        estatisticas={dados.estatisticas}
        agendamentos={dados.agendamentos}
        multas={dados.multas}
        creditos={dados.creditos || []}
        horariosFixos={dados.horariosFixos || []}
        servicos={servicos}
      />
    </div>
  );
}
