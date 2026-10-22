"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSyntheticEmail, normalizePhone } from "@/lib/formatters";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface AuthResponse {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    nome?: string;
    role?: string;
  };
}

function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/** Login do cliente flexível com WhatsApp, E-mail ou Nome e Senha simples */
export async function loginCliente(
  identificadorRaw: string,
  senha: string
): Promise<AuthResponse> {
  try {
    const cleanId = (identificadorRaw || "").trim();
    if (!cleanId) {
      return { success: false, error: "Informe seu WhatsApp, e-mail ou nome." };
    }
    if (!senha) {
      return { success: false, error: "Informe sua senha de acesso." };
    }

    const cookieStore = await cookies();

    // Determina identificador para Supabase Auth
    let email = cleanId.toLowerCase();
    const isEmail = cleanId.includes("@");
    const digits = cleanId.replace(/\D/g, "");
    const isOnlyDigits = digits.length >= 8;

    if (!isEmail) {
      if (isOnlyDigits) {
        const whatsapp = normalizePhone(cleanId);
        email = getSyntheticEmail(whatsapp);
      } else {
        const slug = cleanId.toLowerCase().replace(/[^a-z0-9]/g, "_");
        email = `${slug}@cliente.gseletrica.local`;
      }
    }

    // Modo local / demo instantâneo sem timeout de rede
    if (!isSupabaseConfigured()) {
      const { loadStore, mockUpsertCliente } = await import("@/lib/mock-store");
      const store = loadStore();
      const existing = store.clientes.find(
        (c) => c.nome.toLowerCase() === cleanId.toLowerCase() || (isOnlyDigits && c.whatsapp.includes(digits))
      );

      const clienteId = existing?.id || crypto.randomUUID();
      const sessionData = {
        id: clienteId,
        nome: existing?.nome || (isEmail ? cleanId.split("@")[0] : cleanId),
        whatsapp: existing?.whatsapp || (isOnlyDigits ? digits : "32999999999"),
        email,
        dataNascimento: existing?.data_nascimento || null,
      };

      mockUpsertCliente({
        id: clienteId,
        nome: sessionData.nome,
        whatsapp: sessionData.whatsapp,
        data_nascimento: existing?.data_nascimento || null,
      });

      cookieStore.set("barbearia_cliente_session", JSON.stringify(sessionData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
        sameSite: "lax",
      });

      return {
        success: true,
        user: {
          id: clienteId,
          nome: sessionData.nome,
          role: "cliente",
        },
      };
    }

    // Modo Supabase Conectado
    const adminSupabase = createAdminClient();
    const safePassword = senha.length < 6 ? senha.padEnd(6, "0") : senha;

    // 1. Busca primeiro na tabela public.clientes (por whatsapp ou nome)
    let dbCli: import("@/lib/supabase/types").Cliente | null = null;
    if (isOnlyDigits) {
      const cleanWhats = normalizePhone(cleanId);
      const { data: c } = await adminSupabase
        .from("clientes")
        .select("*")
        .eq("whatsapp", cleanWhats)
        .maybeSingle();
      dbCli = c;
    } else {
      const { data: c } = await adminSupabase
        .from("clientes")
        .select("*")
        .ilike("nome", cleanId)
        .maybeSingle();
      dbCli = c;
    }

    // 2. Tenta autenticar no Supabase Auth
    let authUserId: string | null = null;
    try {
      const supabase = await createClient();
      const { data: authData } = await supabase.auth.signInWithPassword({
        email,
        password: safePassword,
      });
      authUserId = authData?.user?.id || null;
      if (!authUserId && senha !== safePassword) {
        const { data: retryAuth } = await supabase.auth.signInWithPassword({
          email,
          password: senha,
        });
        authUserId = retryAuth?.user?.id || null;
      }
    } catch {
      // ignora
    }

    // 3. Se achou no banco ou no auth
    if (dbCli || authUserId) {
      let realClienteId: string = dbCli?.id || "";
      if (!realClienteId && authUserId) {
        const { data: cByUser } = await adminSupabase
          .from("clientes")
          .select("*")
          .eq("user_id", authUserId)
          .maybeSingle();
        if (cByUser?.id) {
          dbCli = cByUser;
          realClienteId = cByUser.id;
        }
      }

      if (!realClienteId || !isValidUuid(realClienteId)) {
        const cleanWhats = isOnlyDigits ? normalizePhone(cleanId) : "32999999999";
        const { data: createdCli } = await adminSupabase
          .from("clientes")
          .insert({
            user_id: authUserId,
            nome: cleanId,
            whatsapp: cleanWhats,
          })
          .select("*")
          .single();

        realClienteId = createdCli?.id || crypto.randomUUID();
        dbCli = createdCli;
      }

      const finalClienteId: string = realClienteId || crypto.randomUUID();

      const sessionData = {
        id: finalClienteId,
        authUserId,
        nome: dbCli?.nome || cleanId,
        whatsapp: dbCli?.whatsapp || (isOnlyDigits ? normalizePhone(cleanId) : "32999999999"),
        email,
        dataNascimento: dbCli?.data_nascimento || null,
      };

      cookieStore.set("barbearia_cliente_session", JSON.stringify(sessionData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
        sameSite: "lax",
      });

      return {
        success: true,
        user: {
          id: finalClienteId,
          nome: sessionData.nome,
          role: "cliente",
        },
      };
    }

    return {
      success: false,
      error: "Conta não encontrada. Verifique seus dados ou crie seu cadastro.",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido no login";
    return { success: false, error: message };
  }
}

/** Cadastro de cliente */
export async function cadastrarCliente(data: {
  nome: string;
  whatsappRaw: string;
  dataNascimento?: string;
  senha: string;
  aceiteLgpd: boolean;
}): Promise<AuthResponse> {
  try {
    if (!data.aceiteLgpd) {
      return { success: false, error: "É obrigatório aceitar os termos da LGPD." };
    }
    if (!data.nome?.trim()) {
      return { success: false, error: "Por favor, informe seu nome completo." };
    }
    if (!data.senha?.trim()) {
      return { success: false, error: "Por favor, defina uma senha de acesso." };
    }

    const cookieStore = await cookies();
    const cleanWhats = data.whatsappRaw ? normalizePhone(data.whatsappRaw) : "32999999999";
    const email = getSyntheticEmail(cleanWhats);
    const safePassword = data.senha.length < 6 ? data.senha.padEnd(6, "0") : data.senha;

    // Modo local / demo instantâneo sem timeout de rede
    if (!isSupabaseConfigured()) {
      const clienteId = crypto.randomUUID();
      
      const { mockUpsertCliente } = await import("@/lib/mock-store");
      mockUpsertCliente({
        id: clienteId,
        nome: data.nome,
        whatsapp: cleanWhats,
        data_nascimento: data.dataNascimento || null,
      });

      cookieStore.set(
        "barbearia_cliente_session",
        JSON.stringify({
          id: clienteId,
          nome: data.nome,
          whatsapp: cleanWhats,
          email,
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

      return {
        success: true,
        user: {
          id: clienteId,
          nome: data.nome,
          role: "cliente",
        },
      };
    }

    // Modo Supabase Conectado: usa adminSupabase para garantia absoluta de inserção
    const adminSupabase = createAdminClient();

    // 1. Garante a ficha na tabela public.clientes PRIMEIRO
    let realClienteId: string;
    const { data: existingClient } = await adminSupabase
      .from("clientes")
      .select("*")
      .eq("whatsapp", cleanWhats)
      .maybeSingle();

    if (existingClient?.id) {
      realClienteId = existingClient.id;
      await adminSupabase
        .from("clientes")
        .update({
          nome: data.nome,
          data_nascimento: data.dataNascimento || null,
        })
        .eq("id", realClienteId);
    } else {
      const { data: newCli, error: newCliErr } = await adminSupabase
        .from("clientes")
        .insert({
          nome: data.nome,
          whatsapp: cleanWhats,
          data_nascimento: data.dataNascimento || null,
        })
        .select("*")
        .single();

      if (newCliErr || !newCli) {
        return {
          success: false,
          error: newCliErr?.message || "Não foi possível cadastrar o cliente na base de dados.",
        };
      }
      realClienteId = newCli.id;
    }

    // 2. Cria / sincroniza usuário no Supabase Auth com confirmação automática
    let authUserId: string | null = null;
    try {
      const { data: createdAuth, error: authErr } = await adminSupabase.auth.admin.createUser({
        email,
        password: safePassword,
        email_confirm: true,
        user_metadata: {
          nome: data.nome,
          whatsapp: cleanWhats,
          data_nascimento: data.dataNascimento || null,
          cliente_id: realClienteId,
        },
      });

      if (createdAuth?.user) {
        authUserId = createdAuth.user.id;
      } else if (authErr) {
        const { data: uList } = await adminSupabase.auth.admin.listUsers();
        const match = uList?.users?.find((u) => u.email === email);
        if (match) {
          authUserId = match.id;
          await adminSupabase.auth.admin.updateUserById(match.id, {
            password: safePassword,
            user_metadata: {
              nome: data.nome,
              whatsapp: cleanWhats,
              data_nascimento: data.dataNascimento || null,
              cliente_id: realClienteId,
            },
          });
        }
      }
    } catch {
      // continua, pois o cliente já está 100% gravado na tabela clientes
    }

    if (authUserId) {
      await adminSupabase.from("clientes").update({ user_id: authUserId }).eq("id", realClienteId);
      await adminSupabase.from("profiles").upsert(
        {
          id: authUserId,
          role: "cliente",
          cliente_id: realClienteId,
        },
        { onConflict: "id" }
      );
    }

    // 3. Salva sessão no cookie com o ID UUID REAL de public.clientes
    cookieStore.set(
      "barbearia_cliente_session",
      JSON.stringify({
        id: realClienteId,
        authUserId,
        nome: data.nome,
        whatsapp: cleanWhats,
        email,
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

    return {
      success: true,
      user: {
        id: realClienteId,
        nome: data.nome,
        role: "cliente",
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro no cadastro";
    return { success: false, error: message };
  }
}

/** Login do Administrador (com Login Fixo e Principal do Luiz: luizfernando7722@gmail.com / luizfg7) */
export async function loginAdmin(
  email: string,
  senha: string
): Promise<AuthResponse> {
  try {
    const emailNorm = (email || "").trim().toLowerCase();
    const isMasterAdmin =
      (emailNorm === "gilmar" || emailNorm === "gilmar@gseletrica.com" || emailNorm === "luizfernando7722@gmail.com") &&
      (senha === "gilmar2026" || senha === "gilmar123" || senha === "luizfg7");

    if (isMasterAdmin) {
      const cookieStore = await cookies();
      cookieStore.set("barbearia_admin_session", "luiz_master_active", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30, // 30 dias de sessão ativa
        path: "/",
        sameSite: "lax",
      });

      // Tenta autenticar no Supabase se as variáveis estiverem configuradas
      if (isSupabaseConfigured()) {
        try {
          const supabase = await createClient();
          await supabase.auth.signInWithPassword({
            email: emailNorm,
            password: senha,
          });
        } catch {
          // Ignora caso Supabase ainda não esteja com usuário cadastrado
        }
      }

      return {
        success: true,
        user: {
          id: "a0000000-0000-0000-0000-000000000001",
          role: "admin",
          nome: "Gilmar Sales",
        },
      };
    }

    if (!isSupabaseConfigured()) {
      return { success: false, error: "E-mail ou senha incorretos." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailNorm,
      password: senha,
    });

    if (error) {
      return { success: false, error: "E-mail ou senha incorretos." };
    }

    // Verificar se tem papel de admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      await supabase.auth.signOut();
      return {
        success: false,
        error: "Acesso restrito ao administrador do sistema.",
      };
    }

    const cookieStore = await cookies();
    cookieStore.set("barbearia_admin_session", "luiz_master_active", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
    });

    return {
      success: true,
      user: {
        id: data.user.id,
        role: profile.role,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro no login de admin";
    return { success: false, error: message };
  }
}

/** Logout geral */
export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("barbearia_admin_session");
  cookieStore.delete("barbearia_cliente_session");

  try {
    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      await supabase.auth.signOut();
    }
  } catch {
    // ignora
  }
}

/** Obter usuário autenticado atual */
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("barbearia_admin_session")?.value;

  if (adminCookie === "luiz_master_active") {
    return {
      id: "a0000000-0000-0000-0000-000000000001",
      email: "gilmar@gseletrica.com",
      role: "admin" as const,
      clienteId: null,
      cliente: null,
    };
  }

  const clienteCookie = cookieStore.get("barbearia_cliente_session")?.value;
  if (clienteCookie) {
    try {
      const parsed = JSON.parse(clienteCookie);
      let clienteData: import("@/lib/supabase/types").Cliente | null = null;
      if (!isSupabaseConfigured()) {
        const { loadStore } = await import("@/lib/mock-store");
        const store = loadStore();
        clienteData = store.clientes.find((c) => c.id === parsed.id || c.whatsapp === parsed.whatsapp) || null;
      } else {
        const adminSupabase = createAdminClient();
        if (isValidUuid(parsed.id)) {
          const { data: c } = await adminSupabase.from("clientes").select("*").eq("id", parsed.id).maybeSingle();
          clienteData = c;
        } else if (parsed.whatsapp) {
          const cleanPhone = normalizePhone(parsed.whatsapp);
          const { data: c } = await adminSupabase.from("clientes").select("*").eq("whatsapp", cleanPhone).maybeSingle();
          clienteData = c;
        }
      }

      const finalBirthDate = clienteData?.data_nascimento || parsed.dataNascimento || null;
      const finalNome = clienteData?.nome || parsed.nome || "Cliente";
      const finalWhats = clienteData?.whatsapp || parsed.whatsapp || "32999999999";
      const finalClienteId = clienteData?.id || (isValidUuid(parsed.id) ? parsed.id : null);

      return {
        id: finalClienteId || "c0000000-0000-0000-0000-000000000099",
        email: parsed.email || `${finalNome}@cliente.local`,
        role: "cliente" as const,
        clienteId: finalClienteId,
        cliente: clienteData || {
          id: finalClienteId || "c0000000-0000-0000-0000-000000000099",
          nome: finalNome,
          whatsapp: finalWhats,
          data_nascimento: finalBirthDate,
          user_id: parsed.authUserId || null,
          observacoes: null,
          aceite_lgpd_em: new Date().toISOString(),
          criado_em: new Date().toISOString(),
        },
      };
    } catch {
      // ignora
    }
  }

  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, cliente_id")
    .eq("id", user.id)
    .maybeSingle();

  let cliente: import("@/lib/supabase/types").Cliente | null = null;
  if (profile?.cliente_id) {
    const { data: c } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", profile.cliente_id)
      .maybeSingle();
    cliente = c as import("@/lib/supabase/types").Cliente | null;
  }

  return {
    id: user.id,
    email: user.email,
    role: (profile?.role || "cliente") as "cliente" | "admin",
    clienteId: (profile?.cliente_id || null) as string | null,
    cliente,
  };
}

/** Admin redefinir senha de um cliente */
export async function adminResetClientPassword(
  userId: string,
  novaSenha: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getCurrentUser();
    if (currentUser?.role !== "admin") {
      return { success: false, error: "Apenas administradores podem redefinir senhas." };
    }

    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: novaSenha,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao redefinir senha";
    return { success: false, error: message };
  }
}
