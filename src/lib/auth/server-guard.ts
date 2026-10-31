import { createClient } from '@/lib/supabase/server'
import { HubRole, Permission, hasPermission } from './rbac'

export interface AuthContext {
  userId: string
  email: string
  role: HubRole
  aal: string
  isMfaVerified: boolean
}

/**
 * Validação compulsória no servidor para Server Actions e Server Components.
 * Exige autenticação válida, MFA verificado (AAL2) e autorização RBAC explícita.
 */
export async function assertServerAuth(requiredPermission?: Permission): Promise<AuthContext> {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('UNAUTHENTICATED: Sessão corporativa não encontrada ou inválida.')
  }

  // Obter nível de garantia do autenticador (AAL)
  const { data: mfaData, error: mfaError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  
  const currentAal = mfaData?.currentLevel ?? 'aal1'
  const isMfaVerified = currentAal === 'aal2'

  if (mfaError || !isMfaVerified) {
    throw new Error('MFA_REQUIRED: Acesso negado. Segundo fator de autenticação (AAL2) compulsório.')
  }

  // Resolução de Role EXCLUSIVAMENTE na tabela autoritativa hub_usuarios_perfis do banco
  // Jamais confia em user_metadata nem assume app_metadata como autoridade autônoma sem validação no banco
  const { data: profile, error: profileError } = await supabase
    .from('hub_usuarios_perfis')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    throw new Error('FORBIDDEN: Perfil corporativo não encontrado na base cadastral de usuários.')
  }

  if (!profile.is_active) {
    throw new Error('FORBIDDEN: Conta corporativa desativada.')
  }

  const role = profile.role as HubRole

  if (!role) {
    throw new Error('FORBIDDEN: Nenhuma role atribuída ao perfil do usuário.')
  }

  if (requiredPermission && !hasPermission(role, requiredPermission)) {
    throw new Error(`FORBIDDEN: Perfil [${role}] não possui permissão para [${requiredPermission}].`)
  }

  return {
    userId: user.id,
    email: user.email || '',
    role,
    aal: currentAal,
    isMfaVerified
  }
}
