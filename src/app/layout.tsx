import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Barbearia do Luiz | Agendamento e Gestão",
  description: "Agende seu horário na Barbearia do Luiz com rapidez, sem espera e sem complicação. Atendimento exclusivo com hora marcada.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/brand/logo.png",
    apple: "/brand/logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Barbearia do Luiz",
  },
};

export const viewport: Viewport = {
  themeColor: "#0E0D0B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark antialiased" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.cdnfonts.com" />
        <link rel="stylesheet" href="https://fonts.cdnfonts.com/css/sf-pro-display" />
      </head>
      <body className="min-h-[100dvh] flex flex-col bg-bg-base text-text-main selection:bg-gold/30 selection:text-gold pb-16 md:pb-0">
        {children}
        <Toaster
          position="top-center"
          richColors
          toastOptions={{
            style: {
              background: "#181612",
              border: "1px solid #2E2A22",
              color: "#F3EEE4",
            },
          }}
        />
      </body>
    </html>
  );
}
