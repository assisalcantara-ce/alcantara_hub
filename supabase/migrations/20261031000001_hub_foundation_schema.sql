-- ==============================================================================
-- MIGRATION 001: FUNDAÇÃO CORPORATIVA DO ALCÂNTARA HUB
-- ATENÇÃO: ARQUIVO PREPARADO PARA REVISÃO — NÃO EXECUTAR AUTOMATICAMENTE
-- ==============================================================================

-- 1. ENUMS CORPORATIVOS
CREATE TYPE hub_role_enum AS ENUM (
  'super_admin',
  'executivo',
  'financeiro',
  'suporte_n3',
  'auditor'
);

CREATE TYPE hub_tipo_pessoa_enum AS ENUM ('PJ', 'PF');

CREATE TYPE hub_receita_modelo_enum AS ENUM (
  'saas_recorrente',
  'taxa_transacional',
  'hibrido'
);

CREATE TYPE hub_status_contrato_enum AS ENUM (
  'vigente',
  'suspenso',
  'cancelado'
);

-- 2. TABELA DE PRODUTOS DA HOLDING (10 SISTEMAS)
CREATE TABLE IF NOT EXISTS hub_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  modelo_receita hub_receita_modelo_enum NOT NULL DEFAULT 'saas_recorrente',
  endpoint_telemetria TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. CADASTRO CORPORATIVO DE CLIENTES (PF / PJ)
-- Trata dados cadastrais corporativos dos contratantes sob LGPD (Zero PII dos clientes finais dos produtos)
CREATE TABLE IF NOT EXISTS hub_empresas_cli (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_pessoa hub_tipo_pessoa_enum NOT NULL DEFAULT 'PJ',
  documento TEXT NOT NULL UNIQUE, -- CNPJ ou CPF higienizado
  razao_social_ou_nome TEXT NOT NULL,
  nome_fantasia TEXT,
  email_corporativo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. CONTRATOS CORPORATIVOS (REGRAS DE FATURAMENTO E RECEITA)
CREATE TABLE IF NOT EXISTS hub_contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES hub_empresas_cli(id) ON DELETE RESTRICT,
  produto_id UUID NOT NULL REFERENCES hub_produtos(id) ON DELETE RESTRICT,
  numero_contrato TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_renovacao DATE,
  status hub_status_contrato_enum NOT NULL DEFAULT 'vigente',
  mrr_base_contratado NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  taxa_transacional_pct NUMERIC(5,4) NOT NULL DEFAULT 0.0000, -- Ex: 0.0350 = 3.5% (CongregaPay)
  taxa_fixa_por_transacao NUMERIC(8,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. MAPEAMENTO MULTI-TENANT DESACOPLADO
-- Permite que uma empresa possua tenants em múltiplos produtos sem alterar os bancos originais
CREATE TABLE IF NOT EXISTS hub_tenant_mapeamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES hub_contratos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES hub_produtos(id) ON DELETE RESTRICT,
  external_tenant_id TEXT NOT NULL, -- ID original no Zelunia, CongregaPay, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_produto_tenant UNIQUE (produto_id, external_tenant_id)
);

-- 6. SNAPSHOTS HISTÓRICOS DE TELEMETRIA E FATURAMENTO
CREATE TABLE IF NOT EXISTS hub_telemetria_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES hub_produtos(id) ON DELETE RESTRICT,
  external_tenant_id TEXT NOT NULL,
  data_referencia DATE NOT NULL,
  mrr_reportado NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  faturado_periodo NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  recebido_periodo NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  inadimplente_acumulado NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  tpv_transacionado NUMERIC(14,2) NOT NULL DEFAULT 0.00, -- Para bilhetagem (CongregaPay)
  receita_taxas_apurada NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  contadores_operacionais JSONB NOT NULL DEFAULT '{}'::jsonb, -- Contadores inteiros agregados
  custo_ia_periodo_usd NUMERIC(10,4) NOT NULL DEFAULT 0.0000,
  tokens_ia_consumidos BIGINT NOT NULL DEFAULT 0,
  coletado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_snapshot_data UNIQUE (produto_id, external_tenant_id, data_referencia)
);

-- 7. PERFIS DE USUÁRIOS E RBAC
CREATE TABLE IF NOT EXISTS hub_usuarios_perfis (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role hub_role_enum NOT NULL DEFAULT 'executivo',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. TRILHA DE AUDITORIA IMUTÁVEL
CREATE TABLE IF NOT EXISTS hub_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  origem TEXT NOT NULL, -- 'painel_web', 'server_action', 'job_m2m'
  action TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  diff_payload JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. ÍNDICES DE PERFORMANCE E INTEGRIDADE REFERENCIAL
CREATE INDEX IF NOT EXISTS idx_hub_contratos_empresa_id ON hub_contratos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_hub_contratos_produto_id ON hub_contratos(produto_id);
CREATE INDEX IF NOT EXISTS idx_hub_tenant_mapeamento_contrato_id ON hub_tenant_mapeamento(contrato_id);
CREATE INDEX IF NOT EXISTS idx_hub_tenant_mapeamento_produto_id ON hub_tenant_mapeamento(produto_id);
CREATE INDEX IF NOT EXISTS idx_hub_telemetria_snapshot_produto_id ON hub_telemetria_snapshot(produto_id);
CREATE INDEX IF NOT EXISTS idx_hub_telemetria_snapshot_referencia ON hub_telemetria_snapshot(data_referencia);
CREATE INDEX IF NOT EXISTS idx_hub_audit_logs_actor_id ON hub_audit_logs(actor_id);
-- 10. SEGURANÇA E IMUTABILIDADE DA AUDITORIA
CREATE OR REPLACE FUNCTION hub_prevent_audit_tampering()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'VIOLAÇÃO DE SEGURANÇA: Logs de auditoria do Alcântara Hub são estritamente imutáveis.';
END;
$$;

DROP TRIGGER IF EXISTS trg_hub_audit_immutable ON hub_audit_logs;
CREATE TRIGGER trg_hub_audit_immutable
BEFORE UPDATE OR DELETE ON hub_audit_logs
FOR EACH ROW EXECUTE FUNCTION hub_prevent_audit_tampering();


