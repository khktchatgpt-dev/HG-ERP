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
 * ẢNH `/api/files/<id>/img` — ra khỏi gác phiên, tự gác bằng CHỮ KÝ trong URL.
 *
 * BẮT BUỘC phải vậy: trình tối ưu ảnh của Next gọi URL này từ SERVER
 * (`/_next/image?url=…`) nên KHÔNG mang cookie phiên — để proxy gác thì mọi ảnh
 * đều 401 và vỡ hết. Route tự kiểm HMAC (`@/server/file-image`) và chỉ phục vụ
 * file có mime `image/*`; tài liệu vẫn đi `/api/files/<id>` có gác phiên.
 *
 * Không nới lỏng gì thêm: bản ảnh đã tối ưu mà Vercel phát ra vốn đã nằm trên
 * CDN công khai.
 */
const IMAGE_PATH = /^\/api\/files\/[0-9a-f-]{36}\/img$/i

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

/**
 * Trang đổi mật khẩu BẮT BUỘC + những đường duy nhất người đang bị giữ ở đó còn
 * đi được: chính API đổi mật khẩu, và đăng xuất (đăng nhập nhầm tài khoản thì
 * phải có lối ra, không thì kẹt cứng).
 */
const FORCE_CHANGE_PATH = '/doi-mat-khau'
const FORCE_CHANGE_ALLOW = [FORCE_CHANGE_PATH, '/api/account/password', '/api/logout']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }
  if (IMAGE_PATH.test(pathname)) return NextResponse.next()

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

  /*
   * MẬT KHẨU TẠM — giữ người dùng ở /doi-mat-khau cho tới khi họ tự đặt lại.
   *
   * Gác ở proxy chứ không ở từng trang: tài khoản mới cấp (hoặc vừa bị admin
   * reset vì lộ mật khẩu) đang dùng mật khẩu mà NGƯỜI KHÁC BIẾT — chừa sót một
   * trang là chừa cả một đường vào. Cờ đọc từ claim `mc` trong token; token
   * được cấp lại ngay khi đổi xong (xem `accountService.changePassword`) nên
   * không có độ trễ.
   */
  if (session.mc && !FORCE_CHANGE_ALLOW.includes(pathname)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          error: 'Bạn phải đổi mật khẩu trước khi tiếp tục',
          code: 'MUST_CHANGE_PASSWORD',
        },
        { status: 403 },
      )
    }
    const url = request.nextUrl.clone()
    url.pathname = FORCE_CHANGE_PATH
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
