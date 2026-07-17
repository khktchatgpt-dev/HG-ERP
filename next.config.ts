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
  images: {
    remotePatterns: supabaseImagePatterns(),
    // Ảnh SP hầu như không đổi (đổi ảnh = file mới, path mới), nên cache bản đã
    // tối ưu càng lâu càng đỡ egress. Next 16 mặc định đã là 4h; ghi rõ ra đây
    // cho khỏi phụ thuộc default có thể đổi.
    minimumCacheTTL: 60 * 60 * 4,
  },
}

export default nextConfig
