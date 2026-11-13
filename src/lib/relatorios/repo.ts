/**
 * Acesso a dados dos Relatórios de Serviço — SOMENTE SERVIDOR.
 * Esconde a diferença entre o modo demonstração (arquivo local) e o Supabase.
 * Quem chama (Server Actions / rota de upload) é responsável por validar que o usuário é admin.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { RelatorioFoto, RelatorioFotoVisualizacao, RelatorioServico } from "@/lib/supabase/types";
import {
  RELATORIOS_BUCKET,
  RELATORIO_MSG_MIGRATION,
  RELATORIO_SIGNED_URL_TTL,
} from "./config";

const TABELA = "relatorios_servico";

/** Erro com mensagem pronta para ser exibida ao Gilmar */
export class RelatorioErro extends Error {}

function traduzirErro(err: { code?: string; message?: string } | null | undefined): RelatorioErro {
  const code = err?.code || "";
  const msg = err?.message || "";
  const tabelaAusente =
    code === "PGRST205" ||
    code === "42P01" ||
    /relatorios_servico/.test(msg) && /(schema cache|does not exist|not find)/i.test(msg);
  const bucketAusente = /bucket not found/i.test(msg);
  if (tabelaAusente || bucketAusente) return new RelatorioErro(RELATORIO_MSG_MIGRATION);
  return new RelatorioErro(msg || "Erro ao acessar os relatórios.");
}

function normalizar(row: Record<string, unknown>): RelatorioServico {
  const fotosBrutas = Array.isArray(row.fotos) ? (row.fotos as Record<string, unknown>[]) : [];
  const fotos: RelatorioFoto[] = fotosBrutas
    .filter((f) => f && typeof f.id === "string" && typeof f.path === "string")
    .map((f) => ({
      id: String(f.id),
      tipo: f.tipo === "depois" ? "depois" : "antes",
      legenda: typeof f.legenda === "string" ? f.legenda : "",
      path: String(f.path),
    }));
  return {
    id: String(row.id),
    agendamento_id: (row.agendamento_id as string | null) ?? null,
    cliente_id: (row.cliente_id as string | null) ?? null,
    cliente_nome: String(row.cliente_nome ?? ""),
    cliente_whatsapp: (row.cliente_whatsapp as string | null) ?? null,
    cliente_localidade: (row.cliente_localidade as string | null) ?? null,
    titulo: String(row.titulo ?? ""),
    descricao: (row.descricao as string | null) ?? null,
    observacoes: (row.observacoes as string | null) ?? null,
    data_servico: String(row.data_servico ?? "").slice(0, 10),
    fotos,
    criado_em: String(row.criado_em ?? ""),
    atualizado_em: String(row.atualizado_em ?? ""),
  };
}

async function mock() {
  const { loadStore, saveStore } = await import("@/lib/mock-store");
  const store = loadStore();
  if (!store.relatorios) store.relatorios = [];
  return { store, relatorios: store.relatorios, salvar: () => saveStore(store) };
}

export async function repoListar(): Promise<RelatorioServico[]> {
  if (!isSupabaseConfigured()) {
    const { relatorios } = await mock();
    return [...relatorios].sort((a, b) =>
      (b.data_servico + b.criado_em).localeCompare(a.data_servico + a.criado_em)
    );
  }
  const { data, error } = await createAdminClient()
    .from(TABELA)
    .select("*")
    .order("data_servico", { ascending: false })
    .order("criado_em", { ascending: false });
  if (error) throw traduzirErro(error);
  return (data || []).map(normalizar);
}

export async function repoObter(id: string): Promise<RelatorioServico | null> {
  if (!id) return null;
  if (!isSupabaseConfigured()) {
    const { relatorios } = await mock();
    return relatorios.find((r) => r.id === id) || null;
  }
  const { data, error } = await createAdminClient().from(TABELA).select("*").eq("id", id).maybeSingle();
  if (error) throw traduzirErro(error);
  return data ? normalizar(data) : null;
}

/** Relatório mais recente vinculado a um orçamento/agendamento */
export async function repoObterPorAgendamento(agendamentoId: string): Promise<RelatorioServico | null> {
  if (!agendamentoId) return null;
  if (!isSupabaseConfigured()) {
    const { relatorios } = await mock();
    const lista = relatorios
      .filter((r) => r.agendamento_id === agendamentoId)
      .sort((a, b) => b.criado_em.localeCompare(a.criado_em));
    return lista[0] || null;
  }
  const { data, error } = await createAdminClient()
    .from(TABELA)
    .select("*")
    .eq("agendamento_id", agendamentoId)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw traduzirErro(error);
  return data ? normalizar(data) : null;
}

export type RelatorioCampos = Omit<RelatorioServico, "id" | "criado_em" | "atualizado_em">;

export async function repoCriar(id: string, campos: RelatorioCampos): Promise<RelatorioServico> {
  const agora = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    const { relatorios, salvar } = await mock();
    const novo: RelatorioServico = { id, ...campos, criado_em: agora, atualizado_em: agora };
    relatorios.push(novo);
    salvar();
    return novo;
  }
  const { data, error } = await createAdminClient()
    .from(TABELA)
    .insert({ id, ...campos })
    .select("*")
    .single();
  if (error || !data) throw traduzirErro(error);
  return normalizar(data);
}

export async function repoAtualizar(id: string, campos: Partial<RelatorioCampos>): Promise<RelatorioServico> {
  const agora = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    const { relatorios, salvar } = await mock();
    const alvo = relatorios.find((r) => r.id === id);
    if (!alvo) throw new RelatorioErro("Relatório não encontrado.");
    Object.assign(alvo, campos, { atualizado_em: agora });
    salvar();
    return alvo;
  }
  const { data, error } = await createAdminClient()
    .from(TABELA)
    .update({ ...campos, atualizado_em: agora })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw traduzirErro(error);
  if (!data) throw new RelatorioErro("Relatório não encontrado.");
  return normalizar(data);
}

export async function repoExcluir(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const { store, salvar } = await mock();
    store.relatorios = (store.relatorios || []).filter((r) => r.id !== id);
    salvar();
    return;
  }
  const { error } = await createAdminClient().from(TABELA).delete().eq("id", id);
  if (error) throw traduzirErro(error);
}

/**
 * Grava o arquivo da foto e devolve o `path` a guardar no relatório.
 * No modo demonstração não há Storage: o próprio data URL vira o path.
 */
export async function repoGravarArquivo(
  relatorioId: string,
  fotoId: string,
  buffer: Buffer,
  mime: "image/jpeg" | "image/png" | "image/webp",
  extensao: string
): Promise<string> {
  if (!isSupabaseConfigured()) {
    return `data:${mime};base64,${buffer.toString("base64")}`;
  }
  const path = `relatorios/${relatorioId}/${fotoId}.${extensao}`;
  const { error } = await createAdminClient()
    .storage.from(RELATORIOS_BUCKET)
    .upload(path, buffer, { contentType: mime, upsert: false });
  if (error) throw traduzirErro(error);
  return path;
}

/** Remove arquivos do Storage (ignora falhas: o registro no banco é a fonte da verdade) */
export async function repoRemoverArquivos(paths: string[]): Promise<void> {
  const reais = paths.filter((p) => p && !p.startsWith("data:"));
  if (reais.length === 0 || !isSupabaseConfigured()) return;
  try {
    await createAdminClient().storage.from(RELATORIOS_BUCKET).remove(reais);
  } catch (e) {
    console.error("Falha ao remover fotos de relatório do Storage:", e);
  }
}

/** Converte as fotos gravadas em fotos exibíveis (URL assinada temporária) */
export async function repoAssinarFotos(fotos: RelatorioFoto[]): Promise<RelatorioFotoVisualizacao[]> {
  if (fotos.length === 0) return [];
  if (!isSupabaseConfigured()) {
    return fotos.map((f) => ({ id: f.id, tipo: f.tipo, legenda: f.legenda, url: f.path }));
  }
  const { data, error } = await createAdminClient()
    .storage.from(RELATORIOS_BUCKET)
    .createSignedUrls(
      fotos.map((f) => f.path),
      RELATORIO_SIGNED_URL_TTL
    );
  if (error) throw traduzirErro(error);
  const porPath = new Map<string, string>();
  (data || []).forEach((d) => {
    if (d.path && d.signedUrl) porPath.set(d.path, d.signedUrl);
  });
  return fotos.map((f) => ({ id: f.id, tipo: f.tipo, legenda: f.legenda, url: porPath.get(f.path) || "" }));
}
