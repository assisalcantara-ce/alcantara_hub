import React from 'react'
import { 
  ShieldCheck, 
  Layers, 
  HeartPulse, 
  TrendingUp, 
  AlertTriangle, 
  Server,
  Lock
} from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="space-y-6 max-w-7xl">
      {/* Banner Informativo de Fundação */}
      <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-950/20 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-sm font-semibold text-blue-200">
            Fase 1.1 Concluída — Fundação e Segurança
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            A estrutura base do Hub, autenticação Supabase SSR, enforcement de MFA TOTP (AAL2), RBAC em dois níveis e migrations SQL foram preparadas. Os módulos de integração com produtos (iniciando por Zelunia) aguardam a Fase 2.
          </p>
        </div>
      </div>

      {/* Grid de Métricas Principais (Indicadores Executivos) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">MRR Consolidado</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">R$ 0,00</div>
          <span className="text-[10px] text-slate-400 mt-1 block">Aguardando telemetria Zelunia (Fase 2)</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">ARR Projetado</span>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">R$ 0,00</div>
          <span className="text-[10px] text-slate-400 mt-1 block">Base anualizada calculada pelo Hub</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Produtos Conectados</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">0 / 10</div>
          <span className="text-[10px] text-amber-400 mt-1 block">1ª Integração: Zelunia (Planejada)</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Inadimplência</span>
            <AlertTriangle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">0,0%</div>
          <span className="text-[10px] text-slate-400 mt-1 block">Sem títulos vencidos apurados</span>
        </div>
      </div>

      {/* Seção de Status dos 10 Produtos */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Grid Operacional dos 10 Produtos</h3>
            <p className="text-xs text-slate-400">Status dos conectores M2M e fontes oficiais de dados</p>
          </div>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
            PULL Agendado
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Card Zelunia */}
          <div className="p-3.5 rounded-lg border border-indigo-500/30 bg-indigo-950/20 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-white">ZELUNIA</span>
              </div>
              <span className="text-[9px] bg-indigo-900/60 text-indigo-300 font-mono px-1.5 py-0.5 rounded border border-indigo-700">
                1º Integrado
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              SaaS Saúde (Clínicas e Profissionais). Escopo: Telemetria de uso, assinaturas e custo de IA.
            </p>
            <div className="mt-3 pt-2 border-t border-indigo-900/40 flex items-center justify-between text-[10px] text-slate-400">
              <span>Status: Aguardando Fase 2</span>
              <span className="text-amber-400">Pendente</span>
            </div>
          </div>

          {/* Card CongregaPay */}
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-300">CONGREGAPAY</span>
              </div>
              <span className="text-[9px] bg-slate-800 text-slate-400 font-mono px-1.5 py-0.5 rounded">
                Bilhetagem
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Bilhetagem e eventos. Escopo: TPV e taxas transacionais apuradas. Zero dados de doadores.
            </p>
            <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
              <span>Status: Fase 4</span>
              <span>Aguardando</span>
            </div>
          </div>

          {/* Card Insystens */}
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-300">INSYSTENS</span>
              </div>
              <span className="text-[9px] bg-slate-800 text-slate-400 font-mono px-1.5 py-0.5 rounded">
                Core Locked
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Plataforma com núcleo protegido. Escopo: Apenas telemetria estrita e licenças ativas.
            </p>
            <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
              <span>Status: Fase 4</span>
              <span>Aguardando</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
