import type { NextConfig } from 'next'

/**
 * Host Supabase Storage, suy từ NEXT_PUBLIC_SUPABASE_URL thay vì hard-code để
 * mỗi môi trường (dev/staging/prod) tự trỏ đúng project của nó.
 *
 * Thiếu env thì trả mảng rỗng: `next/image` sẽ chặn ảnh remote (400) thay vì
 * âm thầm cho qua. Ồn ào ngay lúc dev tốt hơn là mở toang host.
 */
function supabaseImagePatterns(): NonNullable<NextConfig['images']>['remotePatterns'] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!raw) return []
  let hostname: string
  try {
    hostname = new URL(raw).hostname
  } catch {
    return []
  }
  return [
    {
      protocol: 'https',
      hostname,
      // Chỉ mở đúng đường signed object. Không mở `/storage/v1/object/public/**`
      // vì ảnh SP/bản vẽ là dữ liệu kinh doanh, luôn đi qua signed URL.
      pathname: '/storage/v1/object/sign/**',
      // Cố tình bỏ `search`: signed URL mang token đổi theo mỗi lần ký, không thể
      // khớp một query string cố định. Phạm vi đã bị siết bởi hostname + pathname.
    },
  ]
}

const nextConfig: NextConfig = {
  // Ghim root = thư mục project (nơi chạy `next dev`). Không ghim thì khi chạy
  // trong git worktree (.claude/worktrees/*) Next thấy 2 package-lock.json và
  // đoán nhầm root là repo cha → mọi route 404. Repo chính không ảnh hưởng.
  // Dùng process.cwd() thay __dirname: config TS được transpile ra file tạm,
  // __dirname trỏ sai chỗ.
  turbopack: { root: process.cwd() },
  images: {
    remotePatterns: supabaseImagePatterns(),
    /*
     * 31 NGÀY — không phải để tiết kiệm egress mà để tiết kiệm TIỀN: Vercel tính
     * phí mỗi lần tối ưu, và hết hạn cache là lần xem kế tiếp bị tính lại. Mặc
     * định 4h của Next 16 nghĩa là cùng một tấm ảnh bị tính 6 lần/ngày nếu có
     * người xem đều.
     *
     * An toàn vì ảnh BẤT BIẾN theo id: đổi ảnh SP = upload file mới = id mới =
     * `src` mới (xem `@/server/file-image`), không có chuyện nội dung sau một id
     * bị thay mà cache còn giữ bản cũ.
     */
    minimumCacheTTL: 60 * 60 * 24 * 31,
    // Chỉ cho tối ưu ảnh đi từ đường dẫn ảnh của app — chặn ai đó mượn
    // `/_next/image?url=` làm proxy resize cho ảnh bất kỳ.
    localPatterns: [{ pathname: '/api/files/**' }],
  },
  experimental: {
    // 14/08/2026 — trần upload ảnh nới 5MB → 50MB (migration 0147), user bắt đầu
    // đưa thẳng ảnh DSLR ~13MB lên hồ sơ SP. Optimizer phải TẢI TRỌN ảnh gốc từ
    // Supabase rồi mới resize; timeout mặc định 7s không đủ cho file cỡ đó trên
    // mạng chậm → /_next/image trả 500 → ô ảnh vỡ ("lỗi không xem được ảnh").
    // Chỉ nâng timeout, không nâng imgOptMaxInputPixels: 268MP mặc định đã dư
    // cho ảnh máy ảnh (24–61MP).
    imgOptTimeoutInSeconds: 30,
  },
}

export default nextConfig
