import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  ANEXOS_BUCKET,
  ANEXO_MAX_BYTES,
  ANEXO_MAX_POR_PEDIDO,
  ANEXO_SIGNED_URL_TTL,
  detectarMimePorAssinatura,
  extensaoDoMime,
  sanitizarNomeArquivo,
} from "@/lib/anexos/config";
import { AgendamentoAnexo, AnexoVisualizacao } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Sessão expirada. Por favor, conecte-se novamente." },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const agendamentoId = (formData.get("agendamentoId") as string)?.trim();

    if (!agendamentoId) {
      return NextResponse.json(
        { error: "Identificador da solicitação não fornecido." },
        { status: 400 }
      );
    }

    // Coleta arquivos enviados
    const files: File[] = [];
    const entries = formData.getAll("files");
    for (const entry of entries) {
      if (entry instanceof File && entry.size > 0) {
        files.push(entry);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma imagem foi enviada." },
        { status: 400 }
      );
    }

    // 1. Validação de propriedade e contagem atual
    let clienteIdReal: string;

    if (!isSupabaseConfigured()) {
      const { loadStore } = await import("@/lib/mock-store");
      const store = loadStore();
      const ag = store.agendamentos.find((a) => a.id === agendamentoId);

      if (!ag) {
        return NextResponse.json(
          { error: "Solicitação não encontrada." },
          { status: 404 }
        );
      }

      const ehDono =
        user.role === "admin" ||
        ag.cliente_id === user.clienteId ||
        ag.cliente_id === user.id ||
        ag.cliente?.whatsapp === user.cliente?.whatsapp;

      if (!ehDono) {
        return NextResponse.json(
          { error: "Você não tem autorização para anexar imagens a esta solicitação." },
          { status: 403 }
        );
      }

      clienteIdReal = ag.cliente_id;
      const anexosExistentes = (store.anexos || []).filter(
        (a) => a.agendamento_id === agendamentoId && a.status === "enviado"
      );

      if (anexosExistentes.length + files.length > ANEXO_MAX_POR_PEDIDO) {
        return NextResponse.json(
          {
            error: `O limite máximo é de ${ANEXO_MAX_POR_PEDIDO} imagens por solicitação. Você já possui ${anexosExistentes.length} enviada(s).`,
          },
          { status: 400 }
        );
      }

      // Processa cada arquivo para o mock store
      const visualizacoes: AnexoVisualizacao[] = [];
      const { mockSalvarAnexo } = await import("@/lib/mock-store");

      for (const file of files) {
        if (file.size > ANEXO_MAX_BYTES) {
          return NextResponse.json(
            { error: `O arquivo "${file.name}" excede o limite máximo permitido de 5 MB.` },
            { status: 400 }
          );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const uint8 = new Uint8Array(buffer);
        const mimeConfirmado = detectarMimePorAssinatura(uint8);

        if (!mimeConfirmado) {
          return NextResponse.json(
            {
              error: `O arquivo "${file.name}" não é uma imagem válida (JPG, PNG ou WebP).`,
            },
            { status: 400 }
          );
        }

        const anexoId = crypto.randomUUID();
        const base64Url = `data:${mimeConfirmado};base64,${buffer.toString("base64")}`;
        const nomeLimpo = sanitizarNomeArquivo(file.name);

        const novoAnexo: AgendamentoAnexo = {
          id: anexoId,
          agendamento_id: agendamentoId,
          cliente_id: clienteIdReal,
          bucket: ANEXOS_BUCKET,
          storage_path: base64Url,
          nome_original: nomeLimpo,
          mime_type: mimeConfirmado,
          tamanho_bytes: file.size,
          status: "enviado",
          criado_em: new Date().toISOString(),
          enviado_em: new Date().toISOString(),
        };

        mockSalvarAnexo(novoAnexo);

        visualizacoes.push({
          id: anexoId,
          nome_original: nomeLimpo,
          mime_type: mimeConfirmado,
          tamanho_bytes: file.size,
          criado_em: novoAnexo.criado_em,
          url: base64Url,
        });
      }

      return NextResponse.json({
        success: true,
        anexos: visualizacoes,
        mensagem: `${visualizacoes.length} imagem(ns) anexada(s) com sucesso!`,
      });
    }

    // Modo Supabase Conectado
    const supabase = createAdminClient();

    const { data: ag, error: agErr } = await supabase
      .from("agendamentos")
      .select("id, cliente_id, cliente:clientes(user_id, whatsapp)")
      .eq("id", agendamentoId)
      .maybeSingle();

    if (agErr || !ag) {
      return NextResponse.json(
        { error: "Solicitação não encontrada." },
        { status: 404 }
      );
    }

    const ehDono =
      user.role === "admin" ||
      ag.cliente_id === user.clienteId ||
      ag.cliente_id === user.id ||
      (ag.cliente as any)?.user_id === user.id ||
      (ag.cliente as any)?.whatsapp === user.cliente?.whatsapp;

    if (!ehDono) {
      return NextResponse.json(
        { error: "Você não tem autorização para anexar imagens a esta solicitação." },
        { status: 403 }
      );
    }

    clienteIdReal = ag.cliente_id;

    // Contagem de anexos existentes
    const { count: anexosExistentesCount, error: countErr } = await supabase
      .from("agendamento_anexos")
      .select("*", { count: "exact", head: true })
      .eq("agendamento_id", agendamentoId)
      .eq("status", "enviado");

    const totalAtual = anexosExistentesCount || 0;
    if (totalAtual + files.length > ANEXO_MAX_POR_PEDIDO) {
      return NextResponse.json(
        {
          error: `O limite máximo é de ${ANEXO_MAX_POR_PEDIDO} imagens por solicitação. Você já possui ${totalAtual} enviada(s).`,
        },
        { status: 400 }
      );
    }

    // Validação prévia de todos os arquivos antes de gravar qualquer um
    interface ArquivoValidado {
      file: File;
      buffer: Buffer;
      mime: "image/jpeg" | "image/png" | "image/webp";
      nomeLimpo: string;
      anexoId: string;
      storagePath: string;
    }

    const arquivosValidados: ArquivoValidado[] = [];

    for (const file of files) {
      if (file.size > ANEXO_MAX_BYTES) {
        return NextResponse.json(
          { error: `O arquivo "${file.name}" excede o tamanho máximo de 5 MB.` },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const uint8 = new Uint8Array(buffer);
      const mimeConfirmado = detectarMimePorAssinatura(uint8);

      if (!mimeConfirmado) {
        return NextResponse.json(
          {
            error: `O arquivo "${file.name}" não possui assinatura de imagem válida (JPEG, PNG ou WebP).`,
          },
          { status: 400 }
        );
      }

      const anexoId = crypto.randomUUID();
      const ext = extensaoDoMime(mimeConfirmado);
      const storagePath = `agendamentos/${agendamentoId}/${anexoId}.${ext}`;
      const nomeLimpo = sanitizarNomeArquivo(file.name);

      arquivosValidados.push({
        file,
        buffer,
        mime: mimeConfirmado,
        nomeLimpo,
        anexoId,
        storagePath,
      });
    }

    // Upload seguro para o bucket privado do Supabase Storage
    const visualizacoes: AnexoVisualizacao[] = [];
    const pathsGravados: string[] = [];

    for (const item of arquivosValidados) {
      // 1. Grava no Storage PRIMEIRO
      const { error: uploadErr } = await supabase.storage
        .from(ANEXOS_BUCKET)
        .upload(item.storagePath, item.buffer, {
          contentType: item.mime,
          upsert: false,
        });

      if (uploadErr) {
        console.error("Falha no upload para Supabase Storage:", uploadErr);
        // Rollback dos arquivos gravados anteriormente neste lote
        if (pathsGravados.length > 0) {
          await supabase.storage.from(ANEXOS_BUCKET).remove(pathsGravados);
        }
        return NextResponse.json(
          {
            error: `Falha ao armazenar o arquivo "${item.file.name}". Nenhuma imagem com falha foi registrada. Tente novamente.`,
          },
          { status: 502 }
        );
      }

      pathsGravados.push(item.storagePath);

      // 2. Registra referência no PostgreSQL SOMENTE após confirmação do Storage
      const { data: dbAnexo, error: dbErr } = await supabase
        .from("agendamento_anexos")
        .insert({
          id: item.anexoId,
          agendamento_id: agendamentoId,
          cliente_id: clienteIdReal,
          bucket: ANEXOS_BUCKET,
          storage_path: item.storagePath,
          nome_original: item.nomeLimpo,
          mime_type: item.mime,
          tamanho_bytes: item.file.size,
          status: "enviado",
          enviado_em: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (dbErr || !dbAnexo) {
        console.error("Falha ao registrar anexo no banco:", dbErr);
        // Remove do Storage já que o banco falhou
        await supabase.storage.from(ANEXOS_BUCKET).remove([item.storagePath]);
        return NextResponse.json(
          {
            error: `Erro ao vincular anexo à solicitação. Tente novamente.`,
          },
          { status: 500 }
        );
      }

      // 3. Gera URL assinada de visualização imediata
      const { data: signedData } = await supabase.storage
        .from(ANEXOS_BUCKET)
        .createSignedUrl(item.storagePath, ANEXO_SIGNED_URL_TTL);

      visualizacoes.push({
        id: item.anexoId,
        nome_original: item.nomeLimpo,
        mime_type: item.mime,
        tamanho_bytes: item.file.size,
        criado_em: dbAnexo.criado_em,
        url: signedData?.signedUrl || "",
      });
    }

    return NextResponse.json({
      success: true,
      anexos: visualizacoes,
      mensagem: `${visualizacoes.length} imagem(ns) anexada(s) com sucesso!`,
    });
  } catch (err: unknown) {
    console.error("Erro na rota de upload de anexos:", err);
    const msg = err instanceof Error ? err.message : "Erro interno no servidor ao processar imagens";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
