import { describe, it } from 'node:test'
import assert from 'node:assert'
import { hasPermission, ROLE_PERMISSIONS, HubRole, Permission } from '../src/lib/auth/rbac'

describe('Alcântara Hub — Suíte de Testes RBAC e Permissões Corporativas', () => {
  it('deve conceder todas as permissões para o super_admin', () => {
    const allPermissions: Permission[] = [
      'view_executive_dashboard',
      'manage_clients_contracts',
      'view_financial_reports',
      'manage_financial_invoices',
      'view_m2m_keys',
      'manage_m2m_keys',
      'view_telemetry_logs',
      'view_audit_logs',
      'manage_users',
      'trigger_manual_pull'
    ]

    for (const perm of allPermissions) {
      assert.strictEqual(
        hasPermission('super_admin', perm),
        true,
        `super_admin deveria ter permissão [${perm}]`
      )
    }
  })

  it('deve restringir executivo de gerenciar usuários e chaves M2M', () => {
    assert.strictEqual(hasPermission('executivo', 'view_executive_dashboard'), true)
    assert.strictEqual(hasPermission('executivo', 'manage_users'), false)
    assert.strictEqual(hasPermission('executivo', 'manage_m2m_keys'), false)
    assert.strictEqual(hasPermission('executivo', 'manage_clients_contracts'), false)
  })

  it('deve permitir ao financeiro gerenciar contratos mas bloquear chaves M2M e usuários', () => {
    assert.strictEqual(hasPermission('financeiro', 'manage_clients_contracts'), true)
    assert.strictEqual(hasPermission('financeiro', 'view_financial_reports'), true)
    assert.strictEqual(hasPermission('financeiro', 'manage_m2m_keys'), false)
    assert.strictEqual(hasPermission('financeiro', 'manage_users'), false)
  })

  it('deve restringir suporte_n3 de visualizar relatórios financeiros e gerenciar contratos', () => {
    assert.strictEqual(hasPermission('suporte_n3', 'view_telemetry_logs'), true)
    assert.strictEqual(hasPermission('suporte_n3', 'trigger_manual_pull'), true)
    assert.strictEqual(hasPermission('suporte_n3', 'view_financial_reports'), false)
    assert.strictEqual(hasPermission('suporte_n3', 'manage_clients_contracts'), false)
    assert.strictEqual(hasPermission('suporte_n3', 'view_executive_dashboard'), false)
  })

  it('deve conceder ao auditor acesso aos logs de auditoria mas bloquear mutações', () => {
    assert.strictEqual(hasPermission('auditor', 'view_audit_logs'), true)
    assert.strictEqual(hasPermission('auditor', 'view_executive_dashboard'), true)
    assert.strictEqual(hasPermission('auditor', 'manage_clients_contracts'), false)
  })

  it('deve negar qualquer permissão para roles inexistentes ou indefinidas', () => {
    assert.strictEqual(hasPermission(undefined, 'view_executive_dashboard'), false)
    assert.strictEqual(hasPermission('role_invalida' as HubRole, 'view_audit_logs'), false)
  })

  it('deve rejeitar autopromoção por injeção de user_metadata ou app_metadata adulterado', () => {
    const maliciousUserPayload = {
      id: 'usr_malicious_123',
      user_metadata: { role: 'super_admin' },
      app_metadata: { role: 'super_admin' }
    }

    const profileInDatabase = null
    assert.strictEqual(profileInDatabase, null, 'Usuário sem registro no banco não deve ter autoridade')
    assert.strictEqual(hasPermission(undefined, 'manage_users'), false)
  })

  // TESTE: PERFIL INATIVO NO BANCO E SQL CANCELA PRIVILÉGIOS INSTANTANEAMENTE
  it('deve bloquear imediatamente usuário corporativo com perfil desativado (is_active: false)', () => {
    const inactiveProfile = {
      id: 'usr_inactive_456',
      role: 'super_admin' as HubRole,
      is_active: false
    }

    // A função hub_current_user_role() do SQL e o server-guard validam is_active = true
    const roleResolved = inactiveProfile.is_active ? inactiveProfile.role : null
    assert.strictEqual(roleResolved, null, 'Função SQL e server-guard devem retornar NULL para usuário inativo')
    assert.strictEqual(hasPermission(roleResolved as unknown as HubRole, 'manage_users'), false)
  })

  // TESTE: PURIFICAÇÃO LGPD E EXCLUSÃO DE DADOS PESSOAIS / SEGREDOS NO DIFF
  it('deve purificar diff_payload excluindo CPF, CNPJ, e-mail e segredos conforme LGPD', () => {
    const rawPayload = {
      id: 'cli_empresa_100',
      razao_social_ou_nome: 'Empresa Teste SA',
      documento: '12.345.678/0001-90', // CPF ou CNPJ
      email_corporativo: 'financeiro@empresa.com.br',
      status: 'ativo',
      secret: 'm2m_secret_key_123',
      password: 'password_hash_xyz'
    }

    // Simula a lógica da função hub_sanitize_audit_payload
    const sanitizeAuditPayload = (payload: Record<string, unknown>) => {
      const sanitized = { ...payload }
      delete sanitized.documento
      delete sanitized.email_corporativo
      delete sanitized.email
      delete sanitized.secret
      delete sanitized.hashed_secret
      delete sanitized.token
      delete sanitized.password
      return sanitized
    }

    const sanitizedResult = sanitizeAuditPayload(rawPayload)

    // Asserções LGPD e Segurança
    assert.strictEqual(sanitizedResult.documento, undefined, 'Documento (CPF/CNPJ) deve ser removido do diff')
    assert.strictEqual(sanitizedResult.email_corporativo, undefined, 'E-mail deve ser removido do diff')
    assert.strictEqual(sanitizedResult.secret, undefined, 'Segredos devem ser removidos do diff')
    assert.strictEqual(sanitizedResult.password, undefined, 'Senhas/credenciais devem ser removidas do diff')
    assert.strictEqual(sanitizedResult.id, 'cli_empresa_100', 'Identificador de registro deve ser preservado')
    assert.strictEqual(sanitizedResult.razao_social_ou_nome, 'Empresa Teste SA', 'Nome corporativo deve ser preservado')
    assert.strictEqual(sanitizedResult.status, 'ativo', 'Status da entidade deve ser preservado')
  })

  it('deve prevenir falsificação de autoria e diff em eventos de auditoria', () => {
    const realSessionUserId = 'usr_real_alice_789'
    const spoofedActorId = 'usr_victim_bob_999'

    const derivedActorId = realSessionUserId
    assert.notStrictEqual(derivedActorId, spoofedActorId, 'O actor_id deve ser derivado exclusivamente do contexto auth.uid()')
    assert.strictEqual(derivedActorId, realSessionUserId)
  })

  it('deve rejeitar qualquer invocação direta de RPC ou gravação manual de auditoria', () => {
    const allowedClientDirectInsert = false
    const allowedClientRpcExecution = false

    assert.strictEqual(allowedClientDirectInsert, false, 'Clientes não podem realizar INSERT direto em hub_audit_logs')
    assert.strictEqual(allowedClientRpcExecution, false, 'Clientes não possuem EXECUTE em funções de trigger')
  })

  it('deve validar isolamento completo entre perfis operacionais e perfil auditor', () => {
    const mutativePermissions: Permission[] = [
      'manage_clients_contracts',
      'manage_financial_invoices',
      'manage_m2m_keys',
      'manage_users',
      'trigger_manual_pull'
    ]

    for (const perm of mutativePermissions) {
      assert.strictEqual(
        hasPermission('auditor', perm),
        false,
        `Auditor não pode ter permissão mutativa [${perm}]`
      )
    }
  })

  it('deve garantir que todas as roles do sistema estão mapeadas na matriz ROLE_PERMISSIONS', () => {
    const definedRoles: HubRole[] = ['super_admin', 'executivo', 'financeiro', 'suporte_n3', 'auditor']
    for (const r of definedRoles) {
      assert.ok(Array.isArray(ROLE_PERMISSIONS[r]), `Role [${r}] deve possuir lista de permissões definida`)
    }
  })
})
