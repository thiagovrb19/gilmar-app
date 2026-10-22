# Variáveis de Ambiente e Segurança — Barbearia do Luiz

Este documento descreve todas as variáveis de ambiente utilizadas pelo sistema, sua finalidade, nível de sensibilidade e regras de segurança.

---

## 1. Tabela de Variáveis

| Variável | Escopo | Obrigatória em Produção | Descrição / Exemplo Seguro |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Público (Browser & Servidor) | Sim | URL base do projeto no Supabase (ex: `https://xyzproject.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Público (Browser & Servidor) | Sim | Chave pública anônima do Supabase para requisições seguras respeitando RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Privado (Apenas Servidor)** | Sim | Chave administrativa com privilégios de bypass de RLS para redefinição de senhas e sincronizações internas. **NUNCA exponha no frontend.** |
| `CRON_SECRET` | **Privado (Apenas Servidor)** | Recomendado | Chave secreta de autenticação do Bearer Token para validar as chamadas diárias do Vercel Cron em `/api/keepalive`. |

---

## 2. Exemplo de Arquivo `.env.local`

Para desenvolvimento em sua máquina com banco conectado, crie o arquivo `.env.local` na raiz:

```env
# Supabase - Conexão do Projeto
NEXT_PUBLIC_SUPABASE_URL=https://seu-id-de-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.exemplo_chave_publica_anonima
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.exemplo_chave_service_role_secreta

# Proteção da Rota de Keep-Alive Diário
CRON_SECRET=chave_secreta_longa_e_aleatoria_para_o_cron_diario_keepalive
```

> [!IMPORTANT]
> **Modo Local Sem Variáveis**: Se você iniciar o projeto sem o `.env.local`, a aplicação ativa automaticamente o **Mock Data Store**, permitindo testar agendamentos, login, perfil e painel financeiro localmente através de arquivos JSON em `.local-data/mock-db.json`.

---

## 3. Diretrizes de Segurança

1. **Proteção contra Exposição de Credenciais**:
   - O arquivo `.gitignore` bloqueia explicitamente todos os arquivos `.env*` (com exceção do `.env.example`).
   - A chave `SUPABASE_SERVICE_ROLE_KEY` não possui o prefixo `NEXT_PUBLIC_`, o que impede que o bundler do Next.js a inclua nos arquivos JavaScript enviados ao navegador.
2. **Políticas de Acesso ao Banco de Dados (Row Level Security - RLS)**:
   - Todas as tabelas do PostgreSQL possuem RLS ativado.
   - Clientes só podem ler e cancelar os seus próprios agendamentos.
   - Apenas o usuário com perfil `admin` pode visualizar dados financeiros globais, todos os clientes e editar serviços e configurações.
3. **Proteção de Rotas com Middleware**:
   - Qualquer tentativa de acesso a `/admin/*` por usuários não autorizados resulta em redirecionamento imediato para a página de login administrativo.
