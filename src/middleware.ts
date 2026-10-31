import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-hub.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  const pathname = request.nextUrl.pathname

  // Ignorar arquivos estáticos, rotas de api ou auth públicas
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/auth/login') ||
    pathname.startsWith('/api/health')
  ) {
    return response
  }

  // Verificar sessão ativa
  const { data: { user } } = await supabase.auth.getUser()

  // Se não autenticado e tentando acessar áreas protegidas
  if (!user) {
    if (pathname.startsWith('/hub') || pathname.startsWith('/auth/mfa')) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      return NextResponse.redirect(url)
    }
    return response
  }

  // Verificar AAL (Nível de Garantia do Autenticador / MFA)
  const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  const isAal2 = mfaData?.currentLevel === 'aal2'

  // Se autenticado mas sem AAL2 e tentando acessar o Hub protegido
  if (pathname.startsWith('/hub')) {
    if (!isAal2) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/mfa'
      return NextResponse.redirect(url)
    }
  }

  // Se já tem AAL2 e tenta acessar a página de login ou mfa, manda pro dashboard
  if (isAal2 && (pathname === '/auth/login' || pathname === '/auth/mfa')) {
    const url = request.nextUrl.clone()
    url.pathname = '/hub/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
