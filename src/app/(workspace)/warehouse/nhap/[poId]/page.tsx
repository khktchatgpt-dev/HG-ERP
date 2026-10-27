import { authService } from '@/modules/core/auth/auth.service'
import Link from 'next/link'
import { KhoKhung, Rong } from '../../_erp/khung'
import { PhieuNhapScreen } from './PhieuNhapScreen'
import { taiPhieuNhap } from './tai-phieu-nhap'

export const metadata = { title: 'Kho · Nhận hàng' }
export const dynamic = 'force-dynamic'

/**
 * PHIẾU NHẬP THEO ĐƠN MUA — `/warehouse/nhap/[poId]?dot=<shipment_id>`
 * (Bước 1 Kho, việc 3: form; việc 4 nối ghi sổ).
 *
 * Form + bộ nạp là của RIÊNG Kho (12/10/2026: cửa Cung ứng `/mua-hang/don/[id]/nhan`
 * có bản riêng — hai phòng không dùng chung giao diện). Đường ghi + luật vẫn chung
 * (POST `docs/receipt`, `lib/kho-phieu-nhap`), nên hai cửa không thể ghi khác nhau.
 *
 * Đơn không ở trạng thái nhận được (chưa duyệt, đã về đủ, đã huỷ) thì màn
 * nói thẳng vì sao và dẫn về đơn — không mở một form ghi sổ vào đơn sai.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ poId: string }>
  /** `sua` = phiếu cũ đã đảo để LẬP LẠI — Sửa phiếu ở chi tiết phiếu Kho (12/10/2026). */
  searchParams: Promise<{ dot?: string; sua?: string }>
}) {
  const user = await authService.requirePageUser()
  const [{ poId }, sp] = await Promise.all([params, searchParams])
  const r = await taiPhieuNhap(user, poId, sp.dot, 'kho', sp.sua)

  if (r.kind === 'chan') {
    return (
      <KhoKhung label={`${r.po.code} chưa nhận hàng được`}>
        <Rong
          tieuDe={`${r.po.code} chưa nhận hàng được`}
          lyDo={r.reason}
          tiep={
            <span style={{ display: 'flex', gap: 8 }}>
              <Link href="/warehouse/nhap" className="kh-btn">
                Về danh sách nhận hàng
              </Link>
              {/* Hộp "Hàng của đơn" trong Kho — NV Kho không vào được khu Mua hàng. */}
              <Link href={`/warehouse/nhap?don=${r.po.id}`} className="kh-btn p">
                Xem hàng của đơn {r.po.code}
              </Link>
            </span>
          }
        />
      </KhoKhung>
    )
  }

  return <PhieuNhapScreen {...r.props} />
}
