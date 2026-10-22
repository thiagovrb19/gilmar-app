import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "GS Elétrica e Manutenção | Gilmar Sales",
  description: "Eletricista profissional em Visconde do Rio Branco - MG e região. Instalações industriais e residenciais, manutenção preventiva e corretiva com segurança, qualidade e confiança.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/brand/gs-logo.jpg",
    apple: "/brand/gs-logo.jpg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GS Elétrica",
  },
};

export const viewport: Viewport = {
  themeColor: "#06090F",
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
              background: "#0C121D",
              border: "1px solid #1E293B",
              color: "#F8FAFC",
            },
          }}
        />
      </body>
    </html>
  );
}
