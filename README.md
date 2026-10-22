# ⚡ GS Elétrica e Manutenção — Gilmar Sales

> Sistema completo de agendamento de serviços, solicitações de orçamentos com upload de imagens, painel administrativo e integração direta via WhatsApp para a **GS Elétrica e Manutenção**.

---

## 📌 Sumário
- [Sobre o Projeto](#-sobre-o-projeto)
- [Tecnologias Utilizadas](#-tecnologias-utilizadas)
- [Funcionalidades Principais](#-funcionalidades-principais)
- [Credenciais de Acesso (Admin)](#-credenciais-de-acesso-admin)
- [Como Rodar o Projeto Localmente](#-como-rodar-o-projeto-localmente)
- [Configuração do Banco de Dados (Supabase)](#-configuração-do-banco-de-dados-supabase)
- [Estrutura de Diretórios](#-estrutura-de-diretórios)
- [Scripts Disponíveis](#-scripts-disponíveis)
- [Boas Práticas e Fluxo de Trabalho](#-boas-práticas-e-fluxo-de-trabalho)

---

## 📖 Sobre o Projeto

A **GS Elétrica e Manutenção** (liderada pelo profissional Gilmar Sales) atua em serviços elétricos residenciais, industriais e padrão CEMIG. 

Este sistema foi desenvolvido para:
1. Facilitar o **agendamento online** de serviços elétricos e manutenções com cálculo automático de tempo e horários disponíveis.
2. Permitir o envio de **solicitações de orçamento personalizadas**, incluindo o envio de múltiplas fotos/imagens do local ou problema via Supabase Storage.
3. Notificar e conectar clientes diretamente ao **WhatsApp comercial** do Gilmar.
4. Fornecer um **Painel de Controle Administrativo** para gerenciar serviços, preços, agenda, bloqueios de dias, clientes e relatórios financeiros.

---

## 🚀 Tecnologias Utilizadas

- **Framework Web:** [Next.js 16](https://nextjs.org/) (com Turbopack e App Router)
- **Biblioteca de Interface:** [React 19](https://react.dev/)
- **Linguagem:** [TypeScript 5](https://www.typescriptlang.org/)
- **Estilização:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Ícones:** [Lucide React](https://lucide.dev/)
- **Banco de Dados & Storage:** [Supabase](https://supabase.com/) (PostgreSQL, Storage, Auth e RLS)
- **Formulários e Validação:** React Hook Form + Zod
- **Notificações:** Sonner
- **QR Code & Gráficos:** qrcode, Recharts, date-fns

---

## ✨ Funcionalidades Principais

### Área do Cliente
- **Visualização de Serviços:** Lista de serviços elétricos atualizada (troca de disjuntor, chuveiro, fiação, padrão CEMIG, etc.).
- **Agendamento em Tempo Real:** Verificação automática de slots de horários vagos e regras de antecedência/duração.
- **Solicitação de Orçamento com Anexo de Imagens:** Upload de fotos (JPEG, PNG, WEBP) armazenadas com segurança no Supabase Storage (bucket `orcamento-anexos`) e vinculadas ao orçamento.
- **Integração WhatsApp:** Redirecionamento com mensagem estruturada contendo detalhes do serviço, endereço e links de anexos.

### Painel Administrativo (`/admin`)
- **Dashboard:** Métricas diárias/mensais de receita, agendamentos e orçamentos.
- **Gestão de Agendamentos:** Visualização de atendimentos, alteração de status (confirmado, concluído, cancelado).
- **Gestão de Serviços:** Edição dinâmica de preços, tempos estimados e descrição de cada serviço.
- **Configuração de Horários & Exceções:** Definição da jornada de trabalho (dias da semana) e bloqueio de feriados ou dias pontuais.
- **Clientes:** Histórico de clientes atendidos e dados de contato.

---

## 🔑 Credenciais de Acesso (Admin)

Para acessar o painel administrativo:
- **URL:** `http://localhost:3000/admin/login` (ou `/admin`)
- **Login / Usuário:** `gilmar` *(ou `gilmar@gseletrica.com`)*
- **Senha:** `gilmar2026`

---

## 💻 Como Rodar o Projeto Localmente

### 1. Pré-requisitos
- Node.js instalado (versão 20 LTS ou superior recomendada)
- Gerenciador de pacotes `npm` ou `yarn`

### 2. Clonar o repositório
```bash
git clone https://github.com/thiagovrb19/gilmar-app.git
cd gilmar-app
```

### 3. Instalar as dependências
```bash
npm install
```

### 4. Configurar as variáveis de ambiente
Crie um arquivo `.env.local` na raiz do projeto (use o `.env.example` como base):

```bash
cp .env.example .env.local
```

Preencha as variáveis com suas credenciais do Supabase:
```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
NEXT_PUBLIC_WHATSAPP_COMERCIAL=32988714986
```

> **Nota:** Caso o Supabase não esteja conectado de imediato, o projeto conta com um mecanismo de fallback local (`.local-data/`) para você poder navegar e testar a UI localmente.

### 5. Iniciar o servidor de desenvolvimento
```bash
npm run dev
```
Acesse `http://localhost:3000` no seu navegador.

---

## 🗄️ Configuração do Banco de Dados (Supabase)

Para configurar uma nova instância do banco no Supabase, acesse o **SQL Editor** do seu projeto no painel do Supabase e execute as migrations na seguinte ordem:

1. **`supabase/migrations/001_initial_schema.sql`**:
   - Cria as tabelas base (`profissionais`, `servicos`, `horarios_trabalho`, `agendamentos`, `usuarios`, `orçamentos`).
   - Insere os dados padrão do profissional Gilmar Sales e a tabela de serviços elétricos.
2. **`supabase/migrations/002_views_and_rpc.sql`**:
   - Views analíticas de receita, ocupação de agenda e funções RPC para cálculo de slots disponíveis.
3. **`supabase/migrations/003_rls_policies.sql`**:
   - Políticas de segurança por linha (Row Level Security) e controle de acesso a dados públicos e administrativos.
4. **`supabase/migrations/004_dias_excecao.sql`**:
   - Tabela de exceções de calendário (bloqueio de datas específicas e feriados).
5. **`supabase/migrations/005_anexos_orcamento.sql`**:
   - Tabela `orcamento_anexos` e criação das políticas de armazenamento para o bucket `orcamento-anexos`.

> 💡 **Script Consolidado:** O arquivo `supabase/fix_horarios_e_servicos.sql` contém a consolidação dos serviços de elétrica e horários da semana atualizados para rápida aplicação.

---

## 📂 Estrutura de Diretórios

```text
projeto-gs/
├── public/                 # Imagens estáticas, logotipos e manifestos
├── src/
│   ├── actions/            # Server Actions (auth, agendamentos, orçamentos, storage)
│   ├── app/                # Rotas do Next.js (App Router)
│   │   ├── (public)/       # Páginas públicas: home, agendamento, orçamento
│   │   ├── admin/          # Rotas protegidas da área administrativa
│   │   └── api/            # Endpoints de API internos
│   ├── components/         # Componentes React reutilizáveis
│   │   ├── admin/          # Componentes específicos do painel admin
│   │   ├── booking/        # Fluxo de agendamento passo a passo
│   │   ├── budget/         # Formulário de orçamento com upload de imagens
│   │   ├── layout/         # Header, Footer, Sidebar admin e BottomNav
│   │   └── ui/             # Componentes de UI base (botões, inputs, cards)
│   ├── lib/                # Utilitários, hooks, client do Supabase e WhatsApp
│   └── types/              # Definições de tipagem TypeScript
├── supabase/
│   └── migrations/         # Migrations SQL organizadas por ordem cronológica
├── docs/                   # Documentações detalhadas de arquitetura e API
├── .env.example            # Exemplo de variáveis de ambiente necessárias
└── package.json            # Dependências e scripts do projeto
```

---

## 📜 Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor Next.js em modo desenvolvimento (com Turbopack) |
| `npm run build` | Compila o projeto para produção |
| `npm run start` | Inicia o servidor em modo produção após o build |
| `npm run lint` | Executa o linter ESLint |
| `npm test` | Executa a suíte de testes de validação |

---

## 🤝 Boas Práticas e Fluxo de Trabalho

- **Novas Branches:** Crie branches temáticas (`feat/nome-da-feature`, `fix/nome-do-bug`) antes de abrir Pull Requests.
- **Cache do Turbopack:** Se ocorrer algum aviso de módulo antigo no cliente após alterações de bibliotecas, basta limpar a pasta `.next/` e reiniciar com `npm run dev`.
- **Identidade Visual:** Mantenha a paleta de cores institucional da GS Elétrica (azul marinho, amarelo elétrico/âmbar, preto e branco) e respeite a tipografia moderna do Tailwind.

---

Feito com ⚡ para a **GS Elétrica e Manutenção**.
