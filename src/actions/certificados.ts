"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "./auth";
import { Certificado, CertificadoView } from "@/lib/supabase/types";
import {
  CERTIFICADOS_BUCKET,
  CERTIFICADO_MAX_BYTES,
  CERTIFICADO_MSG_MIGRATION,
  CERTIFICADO_PATH_REGEX,
  certificadoUrlPublica,
} from "@/lib/certificados/config";

const TABELA = "certificados";
const MSG_SEM_SUPABASE =
  "Os certificados só funcionam com o Supabase conectado (variáveis de ambiente configuradas).";

type Resultado<T = object> = ({ success: true } & T) | { success: false; error: string };

function comUrl(c: Certificado): CertificadoView {
  return { ...c, url: certificadoUrlPublica(c.arquivo_path) };
}

function erroAmigavel(err: { code?: string; message?: string } | null | undefined): string {
  const code = err?.code || "";
  const msg = err?.message || "";
  if (
    code === "PGRST205" ||
    code === "42P01" ||
    /bucket not found/i.test(msg) ||
    (/certificados/.test(msg) && /schema cache|does not exist/i.test(msg))
  ) {
    return CERTIFICADO_MSG_MIGRATION;
  }
  return msg || "Erro ao acessar os certificados.";
}

async function exigirAdmin(): Promise<string | null> {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return "Sessão expirada. Entre novamente no painel.";
  if (!isSupabaseConfigured()) return MSG_SEM_SUPABASE;
  return null;
}

function limpar(v: unknown, max: number): string {
  return String(v ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}

function revalidar() {
  revalidatePath("/certificados");
  revalidatePath("/admin/certificados");
}

/** PÚBLICO: certificados ativos para a área do cliente */
export async function listarCertificadosPublicosAction(): Promise<CertificadoView[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from(TABELA)
      .select("*")
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .order("criado_em", { ascending: false });
    if (error) {
      console.error("Erro ao listar certificados:", error.message);
      return [];
    }
    return ((data || []) as Certificado[]).map(comUrl);
  } catch {
    return [];
  }
}

/** ADMIN: todos os certificados (ativos e ocultos) */
export async function listarCertificadosAdminAction(): Promise<Resultado<{ certificados: CertificadoView[] }>> {
  const negado = await exigirAdmin();
  if (negado) return { success: false, error: negado };

  const { data, error } = await createAdminClient()
    .from(TABELA)
    .select("*")
    .order("ordem", { ascending: true })
    .order("criado_em", { ascending: false });
  if (error) return { success: false, error: erroAmigavel(error) };
  return { success: true, certificados: ((data || []) as Certificado[]).map(comUrl) };
}

/**
 * Passo 1 do envio: valida e devolve um endereço de upload de uso único.
 * O navegador envia o PDF direto ao Supabase (sem passar pelo limite de 4,5 MB da Vercel).
 */
export async function iniciarUploadCertificadoAction(params: {
  nomeArquivo: string;
  tamanho: number;
}): Promise<Resultado<{ path: string; token: string }>> {
  const negado = await exigirAdmin();
  if (negado) return { success: false, error: negado };

  if (!/\.pdf$/i.test(params.nomeArquivo || "")) {
    return { success: false, error: "Envie um arquivo PDF (.pdf)." };
  }
  if (!params.tamanho || params.tamanho <= 0) return { success: false, error: "Arquivo vazio." };
  if (params.tamanho > CERTIFICADO_MAX_BYTES) {
    return { success: false, error: "O PDF excede o limite de 20 MB." };
  }

  const path = `${crypto.randomUUID()}.pdf`;
  const { data, error } = await createAdminClient().storage.from(CERTIFICADOS_BUCKET).createSignedUploadUrl(path);
  if (error || !data?.token) return { success: false, error: erroAmigavel(error) };
  return { success: true, path, token: data.token };
}

/** Passo 2: confere que o arquivo enviado é mesmo um PDF e cadastra o certificado */
export async function registrarCertificadoAction(params: {
  path: string;
  titulo: string;
  descricao?: string;
  nomeArquivo: string;
}): Promise<Resultado<{ certificado: CertificadoView }>> {
  const negado = await exigirAdmin();
  if (negado) return { success: false, error: negado };

  const titulo = limpar(params.titulo, 160);
  if (titulo.length < 2) return { success: false, error: "Informe o nome do certificado." };
  if (!CERTIFICADO_PATH_REGEX.test(params.path || "")) return { success: false, error: "Arquivo inválido." };

  const supabase = createAdminClient();

  // Lê só os primeiros bytes do arquivo enviado: tem que começar com "%PDF-"
  let tamanho = 0;
  try {
    const resp = await fetch(certificadoUrlPublica(params.path), {
      headers: { Range: "bytes=0-4" },
      cache: "no-store",
    });
    if (!resp.ok && resp.status !== 206) {
      return { success: false, error: "O envio do PDF não foi concluído. Tente novamente." };
    }
    const cabecalho = new TextDecoder().decode(new Uint8Array(await resp.arrayBuffer()).slice(0, 5));
    if (cabecalho !== "%PDF-") {
      await supabase.storage.from(CERTIFICADOS_BUCKET).remove([params.path]);
      return { success: false, error: "O arquivo enviado não é um PDF válido." };
    }
    const total = /\/(\d+)$/.exec(resp.headers.get("content-range") || "");
    tamanho = total ? Number(total[1]) : Number(resp.headers.get("content-length") || 0);
  } catch {
    return { success: false, error: "Não foi possível conferir o PDF enviado. Tente novamente." };
  }
  if (!tamanho || tamanho > CERTIFICADO_MAX_BYTES) {
    await supabase.storage.from(CERTIFICADOS_BUCKET).remove([params.path]);
    return { success: false, error: "O PDF está vazio ou excede 20 MB." };
  }

  const { data, error } = await supabase
    .from(TABELA)
    .insert({
      titulo,
      descricao: limpar(params.descricao, 600) || null,
      arquivo_path: params.path,
      arquivo_nome: limpar(params.nomeArquivo, 200) || "certificado.pdf",
      tamanho_bytes: tamanho,
    })
    .select("*")
    .single();

  if (error || !data) {
    await supabase.storage.from(CERTIFICADOS_BUCKET).remove([params.path]); // não deixa arquivo órfão
    return { success: false, error: erroAmigavel(error) };
  }

  revalidar();
  return { success: true, certificado: comUrl(data as Certificado) };
}

export async function atualizarCertificadoAction(params: {
  id: string;
  titulo?: string;
  descricao?: string | null;
  ativo?: boolean;
  ordem?: number;
}): Promise<Resultado> {
  const negado = await exigirAdmin();
  if (negado) return { success: false, error: negado };

  const campos: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (params.titulo !== undefined) {
    const t = limpar(params.titulo, 160);
    if (t.length < 2) return { success: false, error: "Informe o nome do certificado." };
    campos.titulo = t;
  }
  if (params.descricao !== undefined) campos.descricao = limpar(params.descricao, 600) || null;
  if (params.ativo !== undefined) campos.ativo = !!params.ativo;
  if (params.ordem !== undefined) {
    campos.ordem = Math.max(-9999, Math.min(9999, Math.floor(Number(params.ordem) || 0)));
  }

  const { error } = await createAdminClient().from(TABELA).update(campos).eq("id", params.id);
  if (error) return { success: false, error: erroAmigavel(error) };
  revalidar();
  return { success: true };
}

export async function excluirCertificadoAction(id: string): Promise<Resultado> {
  const negado = await exigirAdmin();
  if (negado) return { success: false, error: negado };

  const supabase = createAdminClient();
  const { data: cert } = await supabase.from(TABELA).select("arquivo_path").eq("id", id).maybeSingle();
  if (!cert) return { success: false, error: "Certificado não encontrado." };

  const { error } = await supabase.from(TABELA).delete().eq("id", id);
  if (error) return { success: false, error: erroAmigavel(error) };

  await supabase.storage.from(CERTIFICADOS_BUCKET).remove([cert.arquivo_path as string]);
  revalidar();
  return { success: true };
}
