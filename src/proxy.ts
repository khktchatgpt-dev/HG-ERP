import { NextResponse, type NextRequest } from 'next/server'
import { verifySessionToken } from '@/modules/core/auth/session'

// `/design-lab`: trang styleguide TĨNH (dữ liệu giả, không gọi API) để duyệt
// bộ UI mới — mở public cho dễ xem/chia sẻ nội bộ; xoá khỏi danh sách nếu muốn
// bắt đăng nhập.
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/api/login',
  '/api/register',
  '/api/logout',
  '/design-lab',
]

/**
 * Trang đã DỌN CHỖ — giữ link/bookmark cũ sống. Đổi ở đây (proxy) thay vì bằng
 * page stub vì stub nằm trong layout workspace cũ nên vẫn bị gác quyền vào
 * workspace đó; proxy chạy trước layout nên ai cũng đi tới đích được.
 *
 * `/technical/products` → `/products`: hồ sơ SP tách ra khu dùng chung để mọi
 * phòng xem được, không phải vào workspace Kỹ thuật (xem `src/app/(shared)`).
 * KHÔNG ảnh hưởng API `/api/dept/technical/products/*` — pathname đó bắt đầu
 * bằng `/api/`.
 */
const MOVED_PREFIXES: ReadonlyArray<readonly [from: string, to: string]> = [
  ['/technical/products', '/products'],
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  // Đổi chỗ TRƯỚC khi gác đăng nhập, để người chưa đăng nhập bấm link cũ thì
  // `?next=` đã là URL mới (khỏi phải nhảy hai lần sau khi đăng nhập).
  for (const [from, to] of MOVED_PREFIXES) {
    if (pathname === from || pathname.startsWith(from + '/')) {
      const url = request.nextUrl.clone()
      url.pathname = to + pathname.slice(from.length)
      return NextResponse.redirect(url)
    }
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
