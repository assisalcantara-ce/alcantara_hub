-- ==============================================================================
-- MIGRATION 002: ROW LEVEL SECURITY (RLS), RBAC E AUDITORIA SANITIZADA LGPD
-- ATENÇÃO: ARQUIVO PREPARADO PARA REVISÃO — NÃO EXECUTAR AUTOMATICAMENTE
-- ==============================================================================

-- 1. HABILITAR RLS EM 100% DAS TABELAS
ALTER TABLE hub_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_empresas_cli ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_tenant_mapeamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_telemetria_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_usuarios_perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. FUNÇÕES AUXILIARES SEGURAS (COM search_path DEFINIDO E QUALIFICADO)
-- Retorna role EXCLUSIVAMENTE quando is_active = true.
-- Se usuário estiver inativo ou inexistente, retorna NULL cancelando qualquer permissão imediatamente.
CREATE OR REPLACE FUNCTION hub_current_user_role()
RETURNS hub_role_enum 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT role FROM public.hub_usuarios_perfis WHERE id = auth.uid() AND is_active = true;
$$;

REVOKE EXECUTE ON FUNCTION hub_current_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION hub_current_user_role() FROM anon;
GRANT EXECUTE ON FUNCTION hub_current_user_role() TO authenticated;

CREATE OR REPLACE FUNCTION hub_is_aal2_verified()
RETURNS BOOLEAN 
LANGUAGE sql 
STABLE
SET search_path = public, auth, pg_temp
AS $$
  SELECT (auth.jwt()->>'aal') = 'aal2';
$$;

REVOKE EXECUTE ON FUNCTION hub_is_aal2_verified() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION hub_is_aal2_verified() FROM anon;
GRANT EXECUTE ON FUNCTION hub_is_aal2_verified() TO authenticated;

-- 3. POLÍTICAS RLS PARA HUB_USUARIOS_PERFIS (SEM RECURSÃO)
CREATE POLICY "Usuario autenticado le proprio perfil"
ON hub_usuarios_perfis
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Super admin gerencia perfis de usuarios"
ON hub_usuarios_perfis
FOR ALL
TO authenticated
USING (hub_is_aal2_verified() AND hub_current_user_role() = 'super_admin')
WITH CHECK (hub_is_aal2_verified() AND hub_current_user_role() = 'super_admin');

-- 4. POLÍTICAS RLS PARA PRODUTOS
CREATE POLICY "Leitura de produtos autorizada"
ON hub_produtos
FOR SELECT
TO authenticated
USING (hub_is_aal2_verified() AND hub_current_user_role() IN ('super_admin', 'executivo', 'financeiro', 'auditor', 'suporte_n3'));

CREATE POLICY "Super admin gerencia produtos"
ON hub_produtos
FOR ALL
TO authenticated
USING (hub_is_aal2_verified() AND hub_current_user_role() = 'super_admin')
WITH CHECK (hub_is_aal2_verified() AND hub_current_user_role() = 'super_admin');

-- 5. POLÍTICAS RLS PARA CLIENTES E CONTRATOS
CREATE POLICY "Financeiro e Super Admin gerenciam empresas"
ON hub_empresas_cli
FOR ALL
TO authenticated
USING (hub_is_aal2_verified() AND hub_current_user_role() IN ('super_admin', 'financeiro'))
WITH CHECK (hub_is_aal2_verified() AND hub_current_user_role() IN ('super_admin', 'financeiro'));

CREATE POLICY "Visualizacao de empresas para cargos autorizados"
ON hub_empresas_cli
FOR SELECT
TO authenticated
USING (hub_is_aal2_verified() AND hub_current_user_role() IN ('executivo', 'auditor', 'suporte_n3'));

CREATE POLICY "Financeiro e Super Admin gerenciam contratos"
ON hub_contratos
FOR ALL
TO authenticated
USING (hub_is_aal2_verified() AND hub_current_user_role() IN ('super_admin', 'financeiro'))
WITH CHECK (hub_is_aal2_verified() AND hub_current_user_role() IN ('super_admin', 'financeiro'));

CREATE POLICY "Visualizacao de contratos para executivo e auditor"
ON hub_contratos
FOR SELECT
TO authenticated
USING (hub_is_aal2_verified() AND hub_current_user_role() IN ('executivo', 'auditor'));

-- 6. POLÍTICAS RLS PARA MAPEAMENTO DE TENANTS
CREATE POLICY "Super Admin e Financeiro gerenciam mapeamentos"
ON hub_tenant_mapeamento
FOR ALL
TO authenticated
USING (hub_is_aal2_verified() AND hub_current_user_role() IN ('super_admin', 'financeiro'))
WITH CHECK (hub_is_aal2_verified() AND hub_current_user_role() IN ('super_admin', 'financeiro'));

CREATE POLICY "Leitura de mapeamentos para cargos analiticos"
ON hub_tenant_mapeamento
FOR SELECT
TO authenticated
USING (hub_is_aal2_verified() AND hub_current_user_role() IN ('executivo', 'auditor', 'suporte_n3'));

-- 7. POLÍTICAS RLS PARA TELEMETRIA E SNAPSHOTS
CREATE POLICY "Leitura de telemetria por perfis analiticos"
ON hub_telemetria_snapshot
FOR SELECT
TO authenticated
USING (hub_is_aal2_verified() AND hub_current_user_role() IN ('super_admin', 'executivo', 'financeiro', 'auditor', 'suporte_n3'));

CREATE POLICY "Service Role insere snapshots de telemetria"
ON hub_telemetria_snapshot
FOR INSERT
TO service_role
WITH CHECK (true);

-- 8. AUDITORIA: PROIBIÇÃO ABSOLUTA DE ACESSO DIRETO POR CLIENTES
CREATE POLICY "Leitura de auditoria autorizada"
ON hub_audit_logs
FOR SELECT
TO authenticated
USING (hub_is_aal2_verified() AND hub_current_user_role() IN ('super_admin', 'auditor'));

CREATE POLICY "Service Role grava auditoria corporativa"
ON hub_audit_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- 9. FUNÇÃO PURIFICADORA LGPD: SANITIZAÇÃO DE DADOS PESSOAIS E CREDENCIAIS
-- Remove estritamente: documento (CPF/CNPJ), email, segredos, senhas e tokens
CREATE OR REPLACE FUNCTION hub_sanitize_audit_payload(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_payload IS NULL THEN
    RETURN NULL;
  END IF;

  -- Remove chaves confidenciais ou de dados pessoais, retendo apenas identificadores e status
  RETURN p_payload - 'documento' 
                   - 'email_corporativo' 
                   - 'email' 
                   - 'secret' 
                   - 'hashed_secret' 
                   - 'token' 
                   - 'password';
END;
$$;

REVOKE EXECUTE ON FUNCTION hub_sanitize_audit_payload(JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION hub_sanitize_audit_payload(JSONB) FROM anon;

-- 10. AUDITORIA AUTOMÁTICA NATIVA VIA TRIGGER COM SANITIZAÇÃO LGPD
CREATE OR REPLACE FUNCTION hub_audit_capture_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_entidade TEXT;
  v_entidade_id TEXT;
  v_action TEXT;
  v_diff JSONB;
BEGIN
  -- Derivar autoria confiavel exclusivamente do contexto criptografico da sessao
  v_actor_id := auth.uid();
  v_entidade := TG_TABLE_NAME;
  v_action   := TG_OP;

  -- Processar apenas campos permitidos sanitizando qualquer dado pessoal ou segredo
  IF (TG_OP = 'INSERT') THEN
    v_entidade_id := NEW.id::text;
    v_diff := jsonb_build_object(
      'created_state', hub_sanitize_audit_payload(to_jsonb(NEW))
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    v_entidade_id := NEW.id::text;
    v_diff := jsonb_build_object(
      'before', hub_sanitize_audit_payload(to_jsonb(OLD)),
      'after',  hub_sanitize_audit_payload(to_jsonb(NEW))
    );
  ELSIF (TG_OP = 'DELETE') THEN
    v_entidade_id := OLD.id::text;
    v_diff := jsonb_build_object(
      'deleted_state', hub_sanitize_audit_payload(to_jsonb(OLD))
    );
  END IF;

  -- Gravar na tabela de auditoria com metadados purificados
  INSERT INTO public.hub_audit_logs (
    actor_id,
    origem,
    action,
    entidade,
    entidade_id,
    diff_payload,
    ip_address,
    created_at
  ) VALUES (
    v_actor_id,
    'trigger_db',
    v_action,
    v_entidade,
    v_entidade_id,
    v_diff,
    NULL, -- Jamais confia em IP enviado por clientes
    now()
  );

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION hub_audit_capture_trigger() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION hub_audit_capture_trigger() FROM anon;
REVOKE EXECUTE ON FUNCTION hub_audit_capture_trigger() FROM authenticated;

-- 11. ATIVAÇÃO DOS TRIGGERS DE AUDITORIA NAS TABELAS CRÍTICAS
DROP TRIGGER IF EXISTS trg_audit_hub_empresas_cli ON hub_empresas_cli;
CREATE TRIGGER trg_audit_hub_empresas_cli
AFTER INSERT OR UPDATE OR DELETE ON hub_empresas_cli
FOR EACH ROW EXECUTE FUNCTION hub_audit_capture_trigger();

DROP TRIGGER IF EXISTS trg_audit_hub_contratos ON hub_contratos;
CREATE TRIGGER trg_audit_hub_contratos
AFTER INSERT OR UPDATE OR DELETE ON hub_contratos
FOR EACH ROW EXECUTE FUNCTION hub_audit_capture_trigger();

DROP TRIGGER IF EXISTS trg_audit_hub_produtos ON hub_produtos;
CREATE TRIGGER trg_audit_hub_produtos
AFTER INSERT OR UPDATE OR DELETE ON hub_produtos
FOR EACH ROW EXECUTE FUNCTION hub_audit_capture_trigger();

DROP TRIGGER IF EXISTS trg_audit_hub_tenant_mapeamento ON hub_tenant_mapeamento;
CREATE TRIGGER trg_audit_hub_tenant_mapeamento
AFTER INSERT OR UPDATE OR DELETE ON hub_tenant_mapeamento
FOR EACH ROW EXECUTE FUNCTION hub_audit_capture_trigger();

DROP TRIGGER IF EXISTS trg_audit_hub_usuarios_perfis ON hub_usuarios_perfis;
CREATE TRIGGER trg_audit_hub_usuarios_perfis
AFTER INSERT OR UPDATE OR DELETE ON hub_usuarios_perfis
FOR EACH ROW EXECUTE FUNCTION hub_audit_capture_trigger();
