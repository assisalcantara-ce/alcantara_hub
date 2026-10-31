import React from 'react'
import Link from 'next/link'
import { 
  LayoutDashboard, 
  Layers, 
  Building2, 
  DollarSign, 
  Headphones, 
  Activity, 
  ShieldAlert, 
  Settings, 
  LogOut,
  HeartPulse
} from 'lucide-react'

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  badge?: string
  status?: 'active' | 'pending'
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Visão Geral Executiva', href: '/hub/dashboard', icon: LayoutDashboard, status: 'active' },
  { name: 'Zelunia (1ª Integração)', href: '/hub/produtos/zelunia', icon: HeartPulse, badge: 'Fase 2', status: 'pending' },
  { name: 'Produtos (10 Sistemas)', href: '/hub/produtos', icon: Layers, badge: 'Fase 4', status: 'pending' },
  { name: 'Clientes & Contratos', href: '/hub/clientes', icon: Building2, badge: 'Fase 3', status: 'pending' },
  { name: 'Financeiro & MRR', href: '/hub/financeiro', icon: DollarSign, badge: 'Fase 3', status: 'pending' },
  { name: 'CRM & Suporte N2/N3', href: '/hub/crm-suporte', icon: Headphones, badge: 'Fase 3', status: 'pending' },
  { name: 'Conectores & Telemetria', href: '/hub/telemetria', icon: Activity, badge: 'Fase 2', status: 'pending' },
  { name: 'Trilha de Auditoria', href: '/hub/auditoria', icon: ShieldAlert, badge: 'Fase 1', status: 'pending' },
  { name: 'Configurações & RBAC', href: '/hub/configuracoes', icon: Settings, badge: 'Fase 1', status: 'pending' },
]

export default function HubLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      {/* Sidebar Corporativa */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/60 flex flex-col justify-between">
        <div>
          {/* Header Marca */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-blue-400 tracking-wider uppercase block">Holding</span>
              <span className="text-lg font-bold text-white tracking-tight">ALCÂNTARA HUB</span>
            </div>
            <span className="text-[10px] bg-blue-950 border border-blue-800/80 text-blue-300 font-mono px-2 py-0.5 rounded">
              v1.1
            </span>
          </div>

          {/* Navegação */}
          <nav className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isPending = item.status === 'pending'

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isPending
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                      : 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Rodapé Usuário e Segurança */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-mono text-emerald-400">MFA AAL2 Ativo</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">RBAC Protegido</span>
          </div>

          <Link
            href="/auth/login"
            className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-950/20 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Encerrar Sessão</span>
          </Link>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 border-b border-slate-800 bg-slate-900/30 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Ambiente:</span>
            <span className="font-semibold text-slate-200">Produção / Staging Fundacional</span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/80 text-slate-300 font-mono">
              Role: <span className="text-amber-400 font-bold">super_admin</span>
            </div>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
