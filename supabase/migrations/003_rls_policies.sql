-- ==============================================================================
-- MIGRATION 003: ROW LEVEL SECURITY (RLS) E TRIGGERS DE AUTENTICAÇÃO
-- ==============================================================================

-- 1. Função auxiliar para testar se o usuário atual é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 2. Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horario_funcionamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloqueios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_fixos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamento_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creditos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- POLÍTICAS: PROFILES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Usuário lê próprio perfil ou admin lê todos" ON public.profiles;
CREATE POLICY "Usuário lê próprio perfil ou admin lê todos"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Usuário edita próprio perfil ou admin edita" ON public.profiles;
CREATE POLICY "Usuário edita próprio perfil ou admin edita"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------------------------
-- POLÍTICAS: CLIENTES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin tem acesso total aos clientes" ON public.clientes;
CREATE POLICY "Admin tem acesso total aos clientes"
  ON public.clientes FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "Cliente lê seus próprios dados" ON public.clientes;
CREATE POLICY "Cliente lê seus próprios dados"
  ON public.clientes FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Cliente atualiza seus próprios dados" ON public.clientes;
CREATE POLICY "Cliente atualiza seus próprios dados"
  ON public.clientes FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Permitir inserção de novo cliente durante cadastro" ON public.clientes;
CREATE POLICY "Permitir inserção de novo cliente durante cadastro"
  ON public.clientes FOR INSERT
  WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- POLÍTICAS: SERVIÇOS E COMBOS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Leitura pública de serviços ativos" ON public.servicos;
CREATE POLICY "Leitura pública de serviços ativos"
  ON public.servicos FOR SELECT
  USING (ativo = true OR public.is_admin());

DROP POLICY IF EXISTS "Admin gerencia serviços" ON public.servicos;
CREATE POLICY "Admin gerencia serviços"
  ON public.servicos FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "Leitura pública de combo_itens" ON public.combo_itens;
CREATE POLICY "Leitura pública de combo_itens"
  ON public.combo_itens FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin gerencia combo_itens" ON public.combo_itens;
CREATE POLICY "Admin gerencia combo_itens"
  ON public.combo_itens FOR ALL
  USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- POLÍTICAS: HORÁRIO DE FUNCIONAMENTO E BLOQUEIOS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Leitura pública de horário de funcionamento" ON public.horario_funcionamento;
CREATE POLICY "Leitura pública de horário de funcionamento"
  ON public.horario_funcionamento FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin gerencia horário de funcionamento" ON public.horario_funcionamento;
CREATE POLICY "Admin gerencia horário de funcionamento"
  ON public.horario_funcionamento FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin gerencia bloqueios" ON public.bloqueios;
CREATE POLICY "Admin gerencia bloqueios"
  ON public.bloqueios FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "Leitura pública de bloqueios" ON public.bloqueios;
CREATE POLICY "Leitura pública de bloqueios"
  ON public.bloqueios FOR SELECT
  USING (true);

-- ------------------------------------------------------------------------------
-- POLÍTICAS: HORÁRIOS FIXOS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin gerencia horários fixos" ON public.horarios_fixos;
CREATE POLICY "Admin gerencia horários fixos"
  ON public.horarios_fixos FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "Cliente lê seus próprios horários fixos" ON public.horarios_fixos;
CREATE POLICY "Cliente lê seus próprios horários fixos"
  ON public.horarios_fixos FOR SELECT
  USING (cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid()));

-- ------------------------------------------------------------------------------
-- POLÍTICAS: AGENDAMENTOS E SERVIÇOS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin tem acesso total aos agendamentos" ON public.agendamentos;
CREATE POLICY "Admin tem acesso total aos agendamentos"
  ON public.agendamentos FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "Cliente lê seus próprios agendamentos" ON public.agendamentos;
CREATE POLICY "Cliente lê seus próprios agendamentos"
  ON public.agendamentos FOR SELECT
  USING (cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admin tem acesso total a agendamento_servicos" ON public.agendamento_servicos;
CREATE POLICY "Admin tem acesso total a agendamento_servicos"
  ON public.agendamento_servicos FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "Cliente lê serviços do seu agendamento" ON public.agendamento_servicos;
CREATE POLICY "Cliente lê serviços do seu agendamento"
  ON public.agendamento_servicos FOR SELECT
  USING (agendamento_id IN (
    SELECT id FROM public.agendamentos 
    WHERE cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
  ));

-- ------------------------------------------------------------------------------
-- POLÍTICAS: MULTAS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin tem acesso total a multas" ON public.multas;
CREATE POLICY "Admin tem acesso total a multas"
  ON public.multas FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "Cliente visualiza suas próprias multas" ON public.multas;
CREATE POLICY "Cliente visualiza suas próprias multas"
  ON public.multas FOR SELECT
  USING (cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid()));

-- ------------------------------------------------------------------------------
-- POLÍTICAS: LANÇAMENTOS E CRÉDITOS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Apenas admin acessa lançamentos financeiros" ON public.lancamentos;
CREATE POLICY "Apenas admin acessa lançamentos financeiros"
  ON public.lancamentos FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin gerencia créditos" ON public.creditos;
CREATE POLICY "Admin gerencia créditos"
  ON public.creditos FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "Cliente consulta seu saldo de créditos" ON public.creditos;
CREATE POLICY "Cliente consulta seu saldo de créditos"
  ON public.creditos FOR SELECT
  USING (cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid()));

-- ------------------------------------------------------------------------------
-- POLÍTICAS: AVALIAÇÕES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Leitura pública de avaliações" ON public.avaliacoes;
CREATE POLICY "Leitura pública de avaliações"
  ON public.avaliacoes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Cliente cria ou edita sua própria avaliação" ON public.avaliacoes;
CREATE POLICY "Cliente cria ou edita sua própria avaliação"
  ON public.avaliacoes FOR ALL
  USING (cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid()));

-- ------------------------------------------------------------------------------
-- POLÍTICAS: CONFIGURAÇÕES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Leitura pública de configurações" ON public.configuracoes;
CREATE POLICY "Leitura pública de configurações"
  ON public.configuracoes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin atualiza configurações" ON public.configuracoes;
CREATE POLICY "Admin atualiza configurações"
  ON public.configuracoes FOR ALL
  USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- TRIGGER: CRIAÇÃO AUTOMÁTICA DE PERFIL E VÍNCULO AO AUTH SIGN-UP
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_phone TEXT;
  v_cliente_id UUID;
BEGIN
  -- Se o email for no formato sintético: 55DDDNUMERO@cliente...
  IF NEW.email LIKE '%@cliente.barbeariadoluiz.app' THEN
    v_phone := split_part(NEW.email, '@', 1);

    -- Verifica se já existe ficha de cliente com este whatsapp cadastrada previamente pelo Luiz
    SELECT id INTO v_cliente_id FROM public.clientes WHERE whatsapp = v_phone LIMIT 1;

    IF v_cliente_id IS NOT NULL THEN
      -- Vincula à ficha pré-existente e atualiza data de nascimento se informada
      UPDATE public.clientes 
      SET 
        user_id = NEW.id,
        nome = COALESCE(NEW.raw_user_meta_data->>'nome', nome),
        data_nascimento = COALESCE(NULLIF(NEW.raw_user_meta_data->>'data_nascimento', '')::DATE, data_nascimento)
      WHERE id = v_cliente_id;
    ELSE
      -- Cria nova ficha de cliente
      INSERT INTO public.clientes (nome, whatsapp, user_id, data_nascimento)
      VALUES (
        COALESCE(NEW.raw_user_meta_data->>'nome', 'Cliente'), 
        v_phone, 
        NEW.id,
        NULLIF(NEW.raw_user_meta_data->>'data_nascimento', '')::DATE
      )
      RETURNING id INTO v_cliente_id;
    END IF;

    -- Cria o profile como cliente
    INSERT INTO public.profiles (id, role, cliente_id)
    VALUES (NEW.id, 'cliente', v_cliente_id)
    ON CONFLICT (id) DO UPDATE SET cliente_id = v_cliente_id;
  ELSE
    -- Email convencional (admin)
    INSERT INTO public.profiles (id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Vincular trigger ao auth.users se ainda não existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
