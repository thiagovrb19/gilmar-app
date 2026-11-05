# Instruções para o Supabase — GS Elétrica (gilmar-app)

**Para:** quem tem acesso ao painel do Supabase (projeto `kiyjiefcnaafeufnbxbi`)
**Tempo estimado:** 10 minutos
**Arquivo a executar:** `supabase/migrations/008_correcoes_gerais.sql` (anexo / no repositório)

---

## 1. Por que isso é necessário

Ao analisar o banco de produção, encontramos:

| # | Problema | Efeito |
|---|---|---|
| 1 | Tabelas `configuracoes` e `horario_funcionamento` **estão vazias** | A agenda não tem grade oficial; o sistema usa valores "de emergência" do código |
| 2 | O script `upgrade_estoque_e_orcamento.sql` falha com *"no unique constraint matching ON CONFLICT"* e **desfaz tudo** | Colunas da proposta/estoque podem não ter sido criadas; origem dos "muitos erros de banco" |
| 3 | Fuso horário errado (3h) em `horarios_disponiveis` e `cancelar_agendamento` | Horários próximos aparecem livres indevidamente; multa de cancelamento não é gerada quando deveria |
| 4 | **Grave:** o trigger `handle_new_auth_user` transforma **qualquer e-mail comum cadastrado em ADMIN** | Qualquer pessoa poderia se cadastrar pelo Auth do Supabase e ler/alterar todo o banco |
| 5 | O papel público (`anon`) tinha `GRANT ALL` em todas as tabelas e execução de todas as funções | Qualquer pessoa com a chave pública podia criar/cancelar agendamentos e gerar multas de outros clientes |
| 6 | Views `v_clientes_estatisticas` e `v_estoque_receita` ignoravam o RLS | Nome/telefone dos clientes e estoque legíveis publicamente |
| 7 | Seed antigo criava um "combo" fantasma (resquício de barbearia) | Dados incorretos em `combo_itens` |

## 2. Passo a passo

1. Abra o Supabase → projeto → **SQL Editor** → **New query**.
2. Cole **todo** o conteúdo de `008_correcoes_gerais.sql` e clique em **Run**.
   - É seguro rodar mais de uma vez (idempotente) e **não apaga** clientes, agendamentos ou serviços.
   - Roda em uma única transação: se algo falhar, nada é alterado. Se der erro, envie a mensagem completa.
   - Pré-requisito: as migrations 001 a 005 já aplicadas (as tabelas e funções já existem no projeto).
3. Rode as **consultas de verificação** (estão comentadas no fim do arquivo):
   - `SELECT * FROM public.horario_funcionamento ORDER BY dia_semana;` → 7 linhas
   - `SELECT id, whatsapp_contato, janela_dias FROM public.configuracoes;` → 1 linha
   - `SELECT * FROM public.horarios_disponiveis(CURRENT_DATE + 2);` → lista de horários (se o dia não for domingo)

## 3. ⚠️ Conferir quem é admin (importante)

Rode:

```sql
SELECT p.id, u.email, p.role, p.criado_em
FROM public.profiles p JOIN auth.users u ON u.id = p.id
WHERE p.role = 'admin';
```

Devem aparecer **somente** pessoas esperadas (Gilmar/equipe). Se aparecer alguém desconhecido:

```sql
UPDATE public.profiles SET role = 'cliente' WHERE id = '<id-do-usuario>';
```

Para criar/promover um admin legítimo (a partir de agora isso é manual):

```sql
UPDATE public.profiles SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'email-do-admin@exemplo.com');
```

## 4. Configurações no Supabase (Authentication)

- **Authentication → Providers → Email:** se o site só usa e-mails sintéticos (`...@cliente.gseletrica.app`), considere **desativar "Confirm email"** apenas se já estiver assim; não habilite novos provedores.
- Confirme que **`SUPABASE_SERVICE_ROLE_KEY`** (Settings → API → `service_role`) está cadastrada na Vercel. **Sem ela o app cai na chave pública e o RLS bloqueia salvamento de orçamentos** — causa provável de o formulário de orçamento falhar.

## 5. Variáveis de ambiente na Vercel (quem administra a Vercel)

| Variável | Valor | Obrigatória |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kiyjiefcnaafeufnbxbi.supabase.co` | Sim |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave publishable do projeto | Sim |
| `SUPABASE_SERVICE_ROLE_KEY` | chave `service_role` (secreta, nunca no GitHub) | **Sim** |
| `AUTH_SESSION_SECRET` | texto aleatório longo (`openssl rand -hex 32`) | **Sim** (assina a sessão do admin) |
| `ADMIN_PASSWORD` | senha forte do login mestre do Gilmar | **Sim** (sem ela vale a senha antiga, que está pública no GitHub) |
| `CRON_SECRET` | segredo do keep-alive | Recomendado |

Após cadastrar, faça **Redeploy**. Depois disso, a senha antiga `gilmar2026` deixa de funcionar (se `ADMIN_PASSWORD` estiver definida) — avise o Gilmar da nova senha.

## 6. Scripts antigos — NÃO RODAR

`upgrade_estoque_e_orcamento.sql`, `fix_permissions_and_cache.sql` e `fix_horarios_e_servicos.sql` foram marcados como obsoletos: falham ou **reabrem** as permissões que o 008 fecha.

## 7. Teste final

1. Abrir o site → **Solicitar orçamento** → escolher serviço, data e horário → preencher Nome e WhatsApp → **Confirmar**.
2. Entrar em `/admin` e verificar que o orçamento apareceu na agenda/clientes.
3. Se algo falhar, enviar o erro exibido (ou o log em Vercel → Logs).
