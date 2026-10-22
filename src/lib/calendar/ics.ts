import { toSaoPaulo } from "@/lib/date/tz";

interface CalendarEventOptions {
  title: string;
  description: string;
  location?: string;
  startDate: string | Date; // ISO string ou Date
  endDate: string | Date;
}

/** Formata data para formato ICS UTC: YYYYMMDDTHHMMSSZ */
function formatICSDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/** Gera conteúdo de arquivo .ics RFC 5545 */
export function generateICSContent({
  title,
  description,
  location = "Barbearia do Luiz",
  startDate,
  endDate,
}: CalendarEventOptions): string {
  const startStr = formatICSDate(startDate);
  const endStr = formatICSDate(endDate);
  const stampStr = formatICSDate(new Date());

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Barbearia do Luiz//Agendamento//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:barbearia-luiz-${Date.now()}@barbeariadoluiz.app`,
    `DTSTAMP:${stampStr}`,
    `DTSTART:${startStr}`,
    `DTEND:${endStr}`,
    `SUMMARY:${title.replace(/\n/g, " ")}`,
    `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
    `LOCATION:${location.replace(/\n/g, " ")}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Dispara o download do arquivo .ics no navegador do cliente */
export function downloadICSFile(options: CalendarEventOptions, filename = "agendamento-barbearia-luiz.ics") {
  const content = generateICSContent(options);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
