# Arquitetura do Sistema — Barbearia do Luiz

Este documento descreve a arquitetura técnica, fluxo de dados, modelo de segurança e padrões de projeto implementados na aplicação web da **Barbearia do Luiz**.

---

## 1. Visão Geral da Arquitetura

A aplicação foi desenvolvida sob o paradigma **Mobile-First Jamstack / Modern Server-Rendered**, utilizando o **Next.js 16** com **App Router** e **Server Actions**, com suporte para execução tanto em **modo conectado (Supabase Postgres + Auth + RLS)** quanto em **modo offline/demonstração local (Mock Data Store em JSON)**.

```mermaid
graph TD
    Client[Cliente / Navegador / PWA] -->|Requisições HTTP / Server Actions| NextApp[Next.js 16 App Router]
    
    subgraph "Camada de Aplicação (Next.js)"
        Middleware[Proxy / Middleware de Autenticação]
        AppRouter[Rotas / Páginas: /agendar, /admin, /perfil...]
        ServerActions[Server Actions: auth, booking, admin, profile]
        HybridLayer{isSupabaseConfigured?}
    end

    subgraph "Camada de Dados & Backend"
        MockStore[MockDataStore: .local-data/mock-db.json]
        SupabaseDB[(Supabase PostgreSQL)]
        SupabaseAuth[Supabase GoTrue Auth]
        SupabaseRPC[RPC Functions & Triggers]
    end

    Client --> Middleware
    Middleware --> AppRouter
    AppRouter --> ServerActions
    ServerActions --> HybridLayer
    HybridLayer -->|false (Local/Demo)| MockStore
    HybridLayer -->|true (Produção)| SupabaseDB
    HybridLayer -->|true (Produção)| SupabaseAuth
    SupabaseDB --> SupabaseRPC
```

---

## 2. Princípios e Decisões de Design

1. **Zero Downtime & Modo Híbrido**:
   - Através de `isSupabaseConfigured()`, a aplicação opera perfeitamente sem variáveis de ambiente ou com variáveis reais conectadas.
   - Ideal para testes locais instantâneos e homologação antes da migração para o banco de dados oficial.
2. **Server Actions First**:
   - Todas as mutações (`criarAgendamentoAction`, `concluirAtendimentoAction`, `cadastrarCliente`, `loginCliente`, etc.) utilizam `use server` do Next.js, eliminando APIs REST manuais redundantes e garantindo tipagem TypeScript estrita de ponta a ponta.
3. **Resolução de Horários e Fuso Horário Estrito**:
   - Todo o cálculo de datas e horas opera no fuso horário canônico `America/Sao_Paulo` (Horário de Brasília), via biblioteca `date-fns-tz`.
4. **Reserva Atômica e Anti-Conflito**:
   - No PostgreSQL, exclusão temporal via extensão `btree_gist` com restrição `EXCLUDE USING gist (tstzrange(inicio, fim) WITH &&)`.
   - No Mock Store, verificação com algoritmo de colisão de intervalos `[inicio, fim)` e verificação de bloqueios e horários fixos.

---

## 3. Fluxo de Autenticação e Sessão

A aplicação adota um modelo de autenticação sem atrito para clientes (login com WhatsApp ou Nome + Senha de 6 dígitos) e autenticação protegida para o administrador:

### Fluxo do Cliente:
1. Cliente cadastra seu número de WhatsApp e senha simples.
2. É gerado um e-mail sintético determinístico: `55{DDD}{NUMERO}@cliente.barbeariadoluiz.app`.
3. No modo Supabase, um usuário é criado no Supabase Auth e o trigger `handle_new_auth_user()` sincroniza automaticamente o perfil em `public.profiles` e `public.clientes`, persistindo nome, WhatsApp e data de nascimento.
4. É emitido um cookie `barbearia_cliente_session` (`httpOnly`, `secure`, `sameSite: lax`) com os dados essenciais para identificação rápida.

### Fluxo do Administrador (Barbeiro Luiz):
1. O administrador possui credencial master dedicada (`luizfernando7722@gmail.com`).
2. Ao realizar login com sucesso, é emitido o cookie protegido `barbearia_admin_session`.
3. O `src/middleware.ts` intercepta qualquer rota iniciando por `/admin/*` e redireciona automaticamente para `/admin/login` caso o usuário não possua privilégios administrativos.

---

## 4. Otimização Automática de Combos

O módulo [combos.ts](file:///src/lib/combos.ts) implementa um algoritmo guloso (*greedy matching*) que analisa a cesta de serviços avulsos do cliente:
- Se o cliente selecionar serviços avulsos que correspondem a um combo (exemplo: *Corte* + *Sobrancelha* + *Cavanhaque*), o sistema automaticamente agrupa esses itens em um combo especial com desconto de R$ 5,00.
- O tempo total de atendimento é mantido e o valor líquido é recalculado com transparência, mostrando o selo de economia.

---

## 5. Módulo de Pagamento Pix (EMV BR Code)

O módulo [pix-generator.ts](file:///src/lib/pix/pix-generator.ts) constrói strings de pagamento no formato estático padrão do Banco Central:
- Payload Format Indicator (00)
- Merchant Account Information com chave Pix do Luiz (26)
- Código de Moeda BRL (53 = 986)
- Valor da Transação formatado (54)
- Código do País BR (58)
- Nome do Recebedor sanitizado sem acentos (59)
- Cidade sanitizada sem acentos (60)
- Informação Adicional / TXID (62)
- Checksum CRC16-CCITT calculado sobre o payload completo (63)
- Renderização visual através do componente QRCode SVG e botão "Copiar Código Pix" com feedback tátil.

---

## 6. Personalização de Dias Especiais e Feriados

Para garantir que o Barbeiro Luiz gerencie sua rotina em dias atípicos:
- Entidade `dias_excecao`:
  - `tipo: 'fechado'`: A barbearia fica indisponível nessa data (feriado, folga ou imprevisto).
  - `tipo: 'personalizado'`: Permite definir horários específicos (ex: das 17:00 às 18:00 ou apenas turno da manhã).
- O motor de agendamento em [booking.ts](file:///src/actions/booking.ts) consulta exceções antes de aplicar os horários da semana padrão, garantindo precisão em tempo real.
