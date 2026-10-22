# Guia de Desenvolvimento, Testes e Deploy — Barbearia do Luiz

Este documento fornece instruções práticas para executar, testar, manter e publicar o projeto no Supabase, GitHub e Vercel.

---

## 1. Comandos Disponíveis

| Comando | Finalidade |
|---|---|
| `npm run dev` | Inicia o servidor local de desenvolvimento em [http://localhost:3000](http://localhost:3000). |
| `npm test` | Executa a suíte de testes de validação das regras de negócio, persistência financeira e preservação cadastral. |
| `npm run test:pix` | Executa o teste unitário estrito de geração de Pix EMV e cálculo do checksum CRC16-CCITT. |
| `npm run build` | Compila o projeto em modo de produção otimizado com verificação estrita de tipagem TypeScript. |
| `npm run start` | Inicia o servidor em modo de produção após a execução do build. |
| `npm run lint` | Executa a análise estática com o ESLint. |

---

## 2. Como Testar Localmente

### Teste de Regras de Negócio e Persistência:
Execute:
```bash
npm test
```
Este comando valida automaticamente:
1. **Preservação da Data de Nascimento**: Garante que o login ou atualizações parciais não apaguem a data de nascimento do cliente.
2. **Conclusão de Atendimento**: Valida que marcar um atendimento como concluído gera imediatamente o lançamento financeiro de entrada correspondente.
3. **Cálculo de Total Gasto**: Verifica se a soma dos atendimentos concluídos de um cliente é refletida com precisão em sua ficha e no controle de clientes.

### Teste do Pix:
Execute:
```bash
npm run test:pix
```
Valida a geração da chave Pix, payload EMV e integridade do algoritmo de checksum CRC16.

---

## 3. Guia de Conexão com o Supabase

Quando estiver pronto para conectar o banco de dados oficial do Supabase:

1. Acesse seu painel no [supabase.com](https://supabase.com) e selecione o projeto desejado.
2. Acesse o **SQL Editor** do Supabase.
3. Execute, **na seguinte ordem**, os scripts SQL localizados na pasta `supabase/`:
   - `supabase/migrations/001_initial_schema.sql` (Criação das tabelas, extensões e restrições)
   - `supabase/migrations/002_views_and_rpc.sql` (Views analíticas e funções RPC)
   - `supabase/migrations/003_rls_policies.sql` (Políticas de segurança RLS e trigger de cadastro)
   - `supabase/migrations/004_dias_excecao.sql` (Tabela de horários excepcionais e feriados)
   - `supabase/seed.sql` (Carga inicial com os serviços do Luiz, horários de expediente e configurações)
4. Acesse **Authentication → Providers → Email**:
   - Mantenha o provedor de E-mail habilitado.
   - **Desative a opção "Confirm email"** (o sistema utiliza login por WhatsApp e senha direta).
5. Vá em **Project Settings → API** e colete a `URL`, a chave `anon` e a chave `service_role`.

---

## 4. Deploy no GitHub e Vercel

### Passo 1: Subir para o GitHub
```bash
git init
git add .
git commit -m "feat: barbearia do luiz - sistema completo e homologado"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/barbearia-do-luiz.git
git push -u origin main
```

### Passo 2: Importar e Publicar na Vercel
1. Acesse [vercel.com](https://vercel.com) e clique em **Add New → Project**.
2. Selecione o repositório importado do GitHub.
3. Na seção **Environment Variables**, configure as 4 chaves:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET`
4. Clique em **Deploy**. O deploy será realizado em menos de 2 minutos.
5. O Vercel Cron agendado em `vercel.json` chamará `/api/keepalive` diariamente às 08:00 UTC, impedindo a hibernação da instância gratuita do Supabase.

---

## 5. Solução de Problemas Comuns

- **Erro "Database already has table x"**: Certifique-se de executar as migrations na ordem numérica (001 a 004). Se o banco já tiver tabelas antigas, execute `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` antes de rodar os scripts caso deseje uma instalação limpa.
- **Data de nascimento não aparece no formulário**: O campo de data aceita o formato nativo `YYYY-MM-DD` do navegador. Verifique se o valor está preenchido corretamente no perfil do cliente.
- **Admin bloqueado em loop de login**: Certifique-se de utilizar a credencial master `luizfernando7722@gmail.com` com a senha `luizfg7` ou certifique-se de que a role `'admin'` está atribuída na tabela `public.profiles`.
