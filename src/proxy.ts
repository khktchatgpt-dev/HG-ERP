import { NextResponse, type NextRequest } from 'next/server'
import { verifySessionToken } from '@/modules/core/auth/session'

const PUBLIC_PATHS = ['/login', '/register', '/api/login', '/api/register', '/api/logout']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  const token = request.cookies.get('session')?.value
  const session = token ? await verifySessionToken(token) : null

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    // Nhớ trang đang định vào để sau login quay lại đúng chỗ ("/" thì thôi —
    // login sẽ tự đưa vào workspace mặc định).
    if (pathname !== '/') {
      url.searchParams.set('next', pathname + request.nextUrl.search)
    }
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
