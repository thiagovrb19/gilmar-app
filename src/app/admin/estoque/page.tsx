import React from "react";
import { getEstoquePecasAction } from "@/actions/admin";
import { AdminStockView } from "@/components/admin/admin-stock-view";

export const dynamic = "force-dynamic";

export default async function AdminEstoquePage() {
  const pecas = await getEstoquePecasAction();

  return (
    <div className="space-y-6 pb-10">
      <AdminStockView initialPecas={pecas} />
    </div>
  );
}

