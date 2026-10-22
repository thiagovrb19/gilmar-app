"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const BROADCAST_CHANNEL_NAME = "barbearia_sync_channel";

export interface SyncMessage {
  table: string;
  action?: string;
  timestamp: number;
}

/**
 * Notifica todas as abas abertas no navegador que os dados mudaram.
 * Funciona instantaneamente entre abas locais mesmo antes de o WebSocket propagar.
 */
export function broadcastSync(table: string = "agendamentos", action: string = "change") {
  try {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.postMessage({
        table,
        action,
        timestamp: Date.now(),
      } satisfies SyncMessage);
      channel.close();
    }
  } catch {
    // Silencioso se BroadcastChannel não estiver disponível
  }
}

interface UseRealtimeSyncOptions {
  tables?: string[];
  onSync?: () => void;
  pollIntervalMs?: number; // fallback inteligente
}

/**
 * Hook unificado de sincronização em tempo real:
 * 1. Supabase Realtime (Postgres Changes via WebSockets)
 * 2. BroadcastChannel para comunicação instantânea entre abas
 * 3. Janela em foco (focus / visibilitychange)
 * 4. Polling periódico de segurança (configurável, default 25s)
 */
export function useRealtimeSync({
  tables = ["agendamentos", "clientes", "lancamentos", "bloqueios", "horarios_fixos", "dias_excecao"],
  onSync,
  pollIntervalMs = 25000,
}: UseRealtimeSyncOptions = {}) {
  const router = useRouter();
  const lastSyncTimeRef = useRef<number>(Date.now());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerSync = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      lastSyncTimeRef.current = Date.now();
      if (onSync) {
        onSync();
      } else {
        router.refresh();
      }
    }, 250);
  }, [onSync, router]);

  useEffect(() => {
    // 1. Canal Broadcast local (entre abas)
    let broadcastChan: BroadcastChannel | null = null;
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        broadcastChan = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        broadcastChan.onmessage = (event) => {
          const msg = event.data as SyncMessage;
          if (msg && (!tables.length || tables.includes(msg.table) || msg.table === "*")) {
            triggerSync();
          }
        };
      }
    } catch {
      // ignora
    }

    // 2. Supabase Realtime (WebSockets)
    let supabaseChannel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    try {
      const supabase = createClient();
      const channelId = `realtime-sync-${Math.random().toString(36).substring(2, 8)}`;
      supabaseChannel = supabase.channel(channelId);

      for (const table of tables) {
        supabaseChannel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
          },
          () => {
            triggerSync();
          }
        );
      }

      supabaseChannel.subscribe();
    } catch {
      // ignora se Supabase Realtime falhar
    }

    // 3. Foco na janela / Retorno à aba
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const timeSinceLastSync = Date.now() - lastSyncTimeRef.current;
        if (timeSinceLastSync > 10000) {
          triggerSync();
        }
      }
    };

    const handleFocus = () => {
      const timeSinceLastSync = Date.now() - lastSyncTimeRef.current;
      if (timeSinceLastSync > 10000) {
        triggerSync();
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    // 4. Polling periódico de segurança para garantir integridade contínua
    let intervalTimer: NodeJS.Timeout | null = null;
    if (pollIntervalMs > 0) {
      intervalTimer = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          triggerSync();
        }
      }, pollIntervalMs);
    }

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (intervalTimer) clearInterval(intervalTimer);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);

      if (broadcastChan) {
        try {
          broadcastChan.close();
        } catch {
          // ignora
        }
      }

      if (supabaseChannel) {
        try {
          const supabase = createClient();
          supabase.removeChannel(supabaseChannel);
        } catch {
          // ignora
        }
      }
    };
  }, [tables, triggerSync, pollIntervalMs]);

  return { triggerSync };
}
