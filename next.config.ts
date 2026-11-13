import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // O orçamento trafega as fotos dos itens (JPEG comprimido em base64) dentro da Server Action.
      // O padrão do Next é 1 MB: com 4-5 fotos o envio era recusado e a proposta chegava sem imagem.
      // 4 MB fica abaixo do limite de 4,5 MB por requisição da Vercel.
      bodySizeLimit: "4mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
