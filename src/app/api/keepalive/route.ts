import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, getSanitizedSupabaseUrl, getSanitizedAnonKey } from "@/lib/supabase/config";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Validação de segurança via Bearer Token do Vercel Cron
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { message: "Keep-alive disparado, variáveis Supabase não configuradas em ambiente local." },
      { status: 200 }
    );
  }

  const supabaseUrl = getSanitizedSupabaseUrl();
  const anonKey = getSanitizedAnonKey();

  try {
    const supabase = createClient(supabaseUrl, anonKey);
    // Consulta ultraleve para manter a instância do banco ativa
    const { data, error } = await supabase
      .from("configuracoes")
      .select("id")
      .limit(1);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Keep-alive executado com sucesso no Supabase",
      timestamp: new Date().toISOString(),
      data,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
