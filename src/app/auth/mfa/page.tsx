'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck, KeyRound, AlertCircle, RefreshCw, QrCode } from 'lucide-react'

interface Factor {
  id: string
  friendly_name?: string
  factor_type: string
  status: string
}

export default function MfaPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [factors, setFactors] = useState<Factor[]>([])
  const [verifyCode, setVerifyCode] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Estados de enrollment
  const [isEnrolling, setIsEnrolling] = useState(false)
  const [qrCodeUri, setQrCodeUri] = useState<string | null>(null)
  const [totpSecret, setTotpSecret] = useState<string | null>(null)
  const [newFactorId, setNewFactorId] = useState<string | null>(null)

  useEffect(() => {
    checkMfaFactors()
  }, [])

  const checkMfaFactors = async () => {
    setLoading(true)
    setErrorMsg(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) {
        setErrorMsg(error.message)
        return
      }

      const totpFactors = (data?.totp || []) as Factor[]
      setFactors(totpFactors)

      // Se não possui nenhum fator TOTP cadastrado, inicia enrollment automaticamente
      if (totpFactors.length === 0) {
        await startEnrollment()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao consultar fatores MFA'
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  const startEnrollment = async () => {
    setIsEnrolling(true)
    setErrorMsg(null)

    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Dispositivo Corporativo TOTP'
      })

      if (error) {
        setErrorMsg(error.message)
        return
      }

      if (data) {
        setNewFactorId(data.id)
        setQrCodeUri(data.totp.qr_code)
        setTotpSecret(data.totp.secret)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao iniciar registro TOTP'
      setErrorMsg(msg)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg(null)

    try {
      const factorId = isEnrolling ? newFactorId : factors[0]?.id

      if (!factorId) {
        setErrorMsg('Fator TOTP não encontrado para validação.')
        return
      }

      // Desafio e verificação
      const challenge = await supabase.auth.mfa.challenge({ factorId })
      if (challenge.error) {
        setErrorMsg(challenge.error.message)
        return
      }

      const verification = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: verifyCode.trim(),
      })

      if (verification.error) {
        setErrorMsg('Código TOTP inválido ou expirado.')
        return
      }

      // Verificação bem-sucedida eleva sessão para AAL2
      router.push('/hub/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro na validação do código'
      setErrorMsg(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-400">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">
              {isEnrolling ? 'Configurar 2º Fator' : 'Validação TOTP'}
            </h1>
            <p className="text-xs text-slate-400">Authenticator Assurance Level 2 (AAL2)</p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 bg-red-950/60 border border-red-800/80 rounded-lg flex items-center gap-2 text-sm text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isEnrolling && qrCodeUri && (
          <div className="mb-6 p-4 bg-slate-950 border border-slate-800 rounded-lg text-center">
            <p className="text-xs text-slate-300 mb-3">
              Escaneie o QR Code abaixo com seu aplicativo autenticador (Google Authenticator, Microsoft Authenticator ou 1Password):
            </p>
            <div className="flex justify-center p-2 bg-white rounded-lg inline-block mx-auto mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCodeUri} alt="QR Code TOTP" className="w-44 h-44" />
            </div>
            {totpSecret && (
              <p className="text-[11px] font-mono text-slate-400 break-all">
                Chave manual: <span className="text-blue-400 font-bold">{totpSecret}</span>
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Código de 6 dígitos
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={6}
                required
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="000000"
                className="w-full text-center tracking-widest text-lg font-mono px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
              />
              <KeyRound className="absolute right-3 top-2.5 w-5 h-5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || verifyCode.length < 6}
            className="w-full mt-2 py-2.5 px-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {submitting ? (
              <span>Validando...</span>
            ) : (
              <span>{isEnrolling ? 'Concluir Registro e Acessar' : 'Confirmar e Acessar'}</span>
            )}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <QrCode className="w-3.5 h-3.5 text-slate-400" />
            Padrão RFC 6238 TOTP
          </span>
          <button
            onClick={() => router.push('/auth/login')}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Voltar ao Login
          </button>
        </div>
      </div>
    </div>
  )
}
