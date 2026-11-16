import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/auth";
import { listarCertificadosAdminAction } from "@/actions/certificados";
import { AdminCertificadosView } from "@/components/admin/admin-certificados-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Certificados e NRs | Painel do Gilmar",
};

export default async function AdminCertificadosPage() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") {
    redirect("/admin/login");
  }

  const res = await listarCertificadosAdminAction();

  return (
    <div className="w-full pb-10">
      <AdminCertificadosView
        certificados={res.success ? res.certificados : []}
        erro={res.success ? null : res.error}
      />
    </div>
  );
}
