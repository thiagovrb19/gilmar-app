import {
  format,
  parseISO,
  isBefore,
  differenceInHours,
  addMinutes,
  isSameDay,
  addDays,
} from "date-fns";
import { toZonedTime, format as formatZoned } from "date-fns-tz";
import { ptBR } from "date-fns/locale";

export const SAO_PAULO_TZ = "America/Sao_Paulo";

/** Retorna a data e hora atual no fuso America/Sao_Paulo */
export function getNowInSaoPaulo(): Date {
  return toZonedTime(new Date(), SAO_PAULO_TZ);
}

/** Converte uma data ou string ISO para o fuso America/Sao_Paulo */
export function toSaoPaulo(date: Date | string): Date {
  const d = typeof date === "string" ? parseISO(date) : date;
  return toZonedTime(d, SAO_PAULO_TZ);
}

/** Formata data no fuso de São Paulo com localização em português */
export function formatSaoPaulo(
  date: Date | string,
  pattern: string = "dd/MM/yyyy HH:mm"
): string {
  const zoned = toSaoPaulo(date);
  return formatZoned(zoned, pattern, {
    timeZone: SAO_PAULO_TZ,
    locale: ptBR,
  });
}

/** Formata apenas a hora (ex: "17:00") */
export function formatTimeSaoPaulo(date: Date | string): string {
  return formatSaoPaulo(date, "HH:mm");
}

/** Formata data amigável (ex: "Sexta-feira, 24 de Outubro") */
export function formatDateFriendly(date: Date | string): string {
  return formatSaoPaulo(date, "EEEE, dd 'de' MMMM");
}

/** Formata data curta (ex: "24/10") */
export function formatDateShort(date: Date | string): string {
  return formatSaoPaulo(date, "dd/MM");
}

/** Formata dia da semana abreviado (ex: "Sex") */
export function formatWeekDayShort(date: Date | string): string {
  return formatSaoPaulo(date, "EEE");
}

/** Verifica se um momento já passou no fuso de São Paulo */
export function isPastInSaoPaulo(date: Date | string): boolean {
  const target = toSaoPaulo(date);
  const now = getNowInSaoPaulo();
  return isBefore(target, now);
}

/** Retorna a diferença de horas entre duas datas */
export function getDiffHours(later: Date | string, earlier: Date | string): number {
  const dLater = toSaoPaulo(later);
  const dEarlier = toSaoPaulo(earlier);
  return differenceInHours(dLater, dEarlier);
}
