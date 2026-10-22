# Estrutura de Diretórios e Arquivos — Barbearia do Luiz

Este documento detalha a organização física e lógica de pastas e arquivos da aplicação.

---

## Visão Geral da Árvore de Diretórios

```
system-t/
├── .env.example                # Exemplo das variáveis de ambiente necessárias
├── .gitignore                  # Arquivos e pastas ignorados pelo controle de versão
├── .local-data/                # Banco de dados simulado em JSON para testes locais offline
├── AGENTS.md                   # Diretrizes técnicas do agente para Next.js 16
├── package.json                # Scripts npm e manifesto de dependências
├── tsconfig.json               # Configurações do compilador TypeScript
├── next.config.ts              # Configuração do Next.js
├── vercel.json                 # Configuração de cron diário do Vercel
├── public/                     # Ativos estáticos públicos servidos na raiz
│   ├── brand/                  # Logotipo principal e ícones de marca
│   ├── icons/                  # Ícones para PWA e atalhos de tela
│   ├── manifest.webmanifest    # Manifesto para instalação como PWA
│   └── luiz.jpg                # Foto de perfil do barbeiro
├── docs/                       # Documentação técnica aprofundada
│   ├── ARCHITECTURE.md         # Arquitetura e fluxo de dados
│   ├── PROJECT_STRUCTURE.md    # Estrutura detalhada de diretórios (este documento)
│   ├── ENVIRONMENT.md          # Configurações de ambiente e segurança
│   ├── API.md                  # Contratos de Server Actions e RPC
│   └── DEVELOPMENT.md          # Guia de desenvolvimento e testes
├── scripts/                    # Scripts utilitários de teste e validação
│   ├── test-pix.mjs            # Teste unitário de geração do Pix EMV e CRC16
│   └── test-corrections.mjs    # Teste de validação das correções financeiras e cadastrais
├── supabase/                   # Scripts de banco de dados e migrações SQL
│   ├── migrations/
│   │   ├── 001_initial_schema.sql  # Tabelas, tipos e restrições anti-conflito
│   │   ├── 002_views_and_rpc.sql   # Views estatísticas e procedures RPC
│   │   ├── 003_rls_policies.sql    # Políticas de segurança em nível de linha (RLS)
│   │   └── 004_dias_excecao.sql    # Tabela e índices para horários excepcionais
│   └── seed.sql                    # Carga inicial de serviços, horários e configurações
└── src/                        # Código-fonte principal da aplicação
    ├── actions/                # Server Actions do Next.js (Mutações de negócio)
    │   ├── admin.ts            # Ações administrativas (agenda, financeiro, clientes, bloqueios)
    │   ├── auth.ts             # Ações de autenticação de cliente e administrador
    │   ├── booking.ts          # Motor de cálculo e agendamento de atendimentos
    │   └── profile.ts          # Gestão do perfil do cliente autenticado
    ├── app/                    # Rotas e páginas do Next.js App Router
    │   ├── (public)/           # Páginas públicas do cliente
    │   │   ├── page.tsx        # Landing page de apresentação e boas-vindas
    │   │   ├── agendar/        # Fluxo interativo de agendamento em 4 etapas
    │   │   ├── login/          # Login de clientes
    │   │   ├── cadastro/       # Cadastro de novos clientes com WhatsApp
    │   │   ├── perfil/         # Perfil do cliente e histórico
    │   │   └── meus-agendamentos/ # Gestão e cancelamento de agendamentos futuros
    │   ├── admin/              # Painel de controle restrito do Barbeiro Luiz
    │   │   ├── page.tsx        # Dashboard diário (Linha do tempo de hoje, métricas rápidas)
    │   │   ├── agenda/         # Visão de calendário semanal/mensal e bloqueios
    │   │   ├── clientes/       # Gestão da base de clientes, ranking e fichas
    │   │   ├── financeiro/     # DRE diária/mensal, lançamentos manuais e pendências
    │   │   ├── servicos/       # Catálogo de serviços e combos
    │   │   ├── configuracoes/  # Ajustes de horário, chave Pix e políticas de cancelamento
    │   │   └── login/          # Portal de acesso restrito ao admin
    │   ├── api/
    │   │   └── keepalive/      # Endpoint cron para manter o Supabase ativo
    │   ├── globals.css         # Estilos globais e tokens visuais (ouro, metálicos, tema escuro)
    │   └── layout.tsx          # Layout raiz da aplicação
    ├── components/             # Componentes React reutilizáveis
    │   ├── admin/              # Componentes de interface do painel administrativo
    │   ├── booking/            # Componentes do fluxo de agendamento e perfil do cliente
    │   ├── icons/              # Componentes de ícones SVG estilizados
    │   ├── layout/             # Cabeçalhos, navegações inferiores (bottom nav) e barras
    │   └── pix/                # Componentes visuais do Pix e QR Code
    ├── lib/                    # Bibliotecas, utilitários e clientes de infraestrutura
    │   ├── calendar/           # Utilitários de exportação de calendário (Google, ICS)
    │   ├── date/               # Tratamento de datas e fuso America/Sao_Paulo
    │   ├── pix/                # Gerador Pix BR Code e algoritmo CRC16-CCITT
    │   ├── supabase/           # Configuração de clientes Supabase (browser, server, admin)
    │   ├── combos.ts           # Mapeamento e otimização automática de combos
    │   ├── formatters.ts       # Formatadores de moeda, telefone e WhatsApp
    │   ├── mock-store.ts       # Banco de dados simulado para desenvolvimento local
    │   └── utils.ts            # Utilitários de composição de classes CSS
    └── middleware.ts           # Interceptador de rotas e segurança de sessão
```

---

## Critérios de Coesão e Separação de Responsabilidades

1. **`src/actions/`**:
   - Cada arquivo de ação agrupa funções relacionadas a um domínio específico (`admin`, `auth`, `booking`, `profile`).
   - Nenhuma lógica de UI ou manipulação de DOM é permitida nessa camada.
2. **`src/components/`**:
   - Dividido logicamente por contexto de uso (`admin`, `booking`, `layout`, `icons`, `pix`).
   - Os componentes recebem dados prontos ou acionam Server Actions, priorizando renderização rápida e responsiva.
3. **`src/lib/`**:
   - Funções puras e utilitários que não dependem do ciclo de vida dos componentes React.
   - Fácil de testar isoladamente via scripts ou testes automatizados.
