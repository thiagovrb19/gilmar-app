import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/auth";
import { detectarMimePorAssinatura, extensaoDoMime } from "@/lib/anexos/config";
import { RELATORIO_FOTO_MAX_BYTES, RELATORIO_MAX_FOTOS } from "@/lib/relatorios/config";
import {
  repoAssinarFotos,
  repoAtualizar,
  repoGravarArquivo,
  repoObter,
  repoRemoverArquivos,
} from "@/lib/relatorios/repo";
import { RelatorioFoto } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/**
 * Envia UMA foto (antes ou depois) para um relatório já salvo. Somente admin.
 * Uma foto por requisição mantém cada envio bem abaixo do limite de 4,5 MB da Vercel.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (user?.role !== "admin") {
      return NextResponse.json({ error: "Sessão expirada. Entre novamente no painel." }, { status: 401 });
    }

    const formData = await req.formData();
    const relatorioId = String(formData.get("relatorioId") || "").trim();
    const tipo = formData.get("tipo") === "depois" ? "depois" : "antes";
    const legenda = String(formData.get("legenda") || "")
      .replace(/\u0000/g, "")
      .trim()
      .slice(0, 200);
    const file = formData.get("file");

    if (!relatorioId) {
      return NextResponse.json({ error: "Relatório não informado." }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Nenhuma foto foi enviada." }, { status: 400 });
    }
    if (file.size > RELATORIO_FOTO_MAX_BYTES) {
      return NextResponse.json({ error: "A foto excede o limite de 5 MB." }, { status: 400 });
    }

    const relatorio = await repoObter(relatorioId);
    if (!relatorio) {
      return NextResponse.json({ error: "Relatório não encontrado. Salve o relatório e tente de novo." }, { status: 404 });
    }
    if (relatorio.fotos.length >= RELATORIO_MAX_FOTOS) {
      return NextResponse.json(
        { error: `O relatório já tem o máximo de ${RELATORIO_MAX_FOTOS} fotos.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = detectarMimePorAssinatura(new Uint8Array(buffer));
    if (!mime) {
      return NextResponse.json(
        { error: "O arquivo não é uma imagem válida (JPG, PNG ou WebP)." },
        { status: 400 }
      );
    }

    const fotoId = crypto.randomUUID();
    const path = await repoGravarArquivo(relatorioId, fotoId, buffer, mime, extensaoDoMime(mime));
    const nova: RelatorioFoto = { id: fotoId, tipo, legenda, path };

    try {
      await repoAtualizar(relatorioId, { fotos: [...relatorio.fotos, nova] });
    } catch (e) {
      // O banco falhou: não deixa arquivo órfão no Storage
      await repoRemoverArquivos([path]);
      throw e;
    }

    const [foto] = await repoAssinarFotos([nova]);
    return NextResponse.json({ success: true, foto });
  } catch (err: unknown) {
    console.error("Erro no envio de foto de relatório:", err);
    const msg = err instanceof Error && err.message ? err.message : "Erro ao enviar a foto.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
