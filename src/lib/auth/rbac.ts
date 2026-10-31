export type HubRole = 
  | 'super_admin' 
  | 'executivo' 
  | 'financeiro' 
  | 'suporte_n3' 
  | 'auditor'

export interface HubUserProfile {
  id: string
  email: string
  role: HubRole
  full_name: string
  is_active: boolean
  mfa_enabled: boolean
}

export type Permission = 
  | 'view_executive_dashboard'
  | 'manage_clients_contracts'
  | 'view_financial_reports'
  | 'manage_financial_invoices'
  | 'view_m2m_keys'
  | 'manage_m2m_keys'
  | 'view_telemetry_logs'
  | 'view_audit_logs'
  | 'manage_users'
  | 'trigger_manual_pull'

// Matriz de permissões estrita para autorização no servidor
export const ROLE_PERMISSIONS: Record<HubRole, Permission[]> = {
  super_admin: [
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
  ],
  executivo: [
    'view_executive_dashboard',
    'view_financial_reports',
    'view_telemetry_logs'
  ],
  financeiro: [
    'view_executive_dashboard',
    'manage_clients_contracts',
    'view_financial_reports',
    'manage_financial_invoices',
    'view_telemetry_logs'
  ],
  suporte_n3: [
    'view_telemetry_logs',
    'trigger_manual_pull'
  ],
  auditor: [
    'view_executive_dashboard',
    'view_financial_reports',
    'view_telemetry_logs',
    'view_audit_logs'
  ]
}

export function hasPermission(role: HubRole | undefined, permission: Permission): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}
