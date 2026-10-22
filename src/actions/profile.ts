"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "./auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function atualizarPerfilAction(data: {
  nome: string;
  dataNascimento?: string;
  novaSenha?: string;
}) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.clienteId) {
      return { success: false, error: "Usuário não autenticado." };
    }

    const cookieStore = await cookies();

    if (!isSupabaseConfigured()) {
      const { mockUpsertCliente } = await import("@/lib/mock-store");
      mockUpsertCliente({
        id: user.clienteId,
        nome: data.nome,
        whatsapp: user.cliente?.whatsapp || "32999999999",
        data_nascimento: data.dataNascimento || null,
      });

      cookieStore.set(
        "barbearia_cliente_session",
        JSON.stringify({
          id: user.clienteId,
          nome: data.nome,
          whatsapp: user.cliente?.whatsapp || "32999999999",
          email: user.email,
          dataNascimento: data.dataNascimento || null,
        }),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: 60 * 60 * 24 * 30,
          path: "/",
          sameSite: "lax",
        }
      );

      revalidatePath("/perfil");
      revalidatePath("/admin/clientes");
      revalidatePath("/admin");
      return { success: true };
    }

    const supabase = await createClient();

    // Atualiza nome e data de nascimento na ficha
    const { error: cliErr } = await supabase
      .from("clientes")
      .update({
        nome: data.nome,
        data_nascimento: data.dataNascimento || null,
      })
      .eq("id", user.clienteId);

    if (cliErr) return { success: false, error: cliErr.message };

    // Sincroniza sessão no cookie
    cookieStore.set(
      "barbearia_cliente_session",
      JSON.stringify({
        id: user.clienteId,
        nome: data.nome,
        whatsapp: user.cliente?.whatsapp || "32999999999",
        email: user.email,
        dataNascimento: data.dataNascimento || null,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
        sameSite: "lax",
      }
    );

    // Se informou nova senha
    if (data.novaSenha && data.novaSenha.trim().length >= 6) {
      const { error: passErr } = await supabase.auth.updateUser({
        password: data.novaSenha,
      });
      if (passErr) return { success: false, error: passErr.message };
    }

    revalidatePath("/perfil");
    revalidatePath("/admin/clientes");
    revalidatePath("/admin");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao atualizar perfil";
    return { success: false, error: msg };
  }
}
