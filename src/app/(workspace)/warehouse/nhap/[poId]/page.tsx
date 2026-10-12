import { authService } from '@/modules/core/auth/auth.service'
import { Btn, Empty } from '@/components/kit'
import { PhieuNhapScreen } from './PhieuNhapScreen'
import { taiPhieuNhap } from './tai-phieu-nhap'

export const metadata = { title: 'Kho · Nhận hàng' }
export const dynamic = 'force-dynamic'

/**
 * PHIẾU NHẬP THEO ĐƠN MUA — `/warehouse/nhap/[poId]?dot=<shipment_id>`
 * (Bước 1 Kho, việc 3: form; việc 4 nối ghi sổ).
 *
 * Dữ liệu nạp qua `taiPhieuNhap` — dùng chung với cửa Cung ứng
 * (`/mua-hang/don/[id]/nhan`), nên hai cửa không thể đếm khác nhau.
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
      <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
        <Empty
          headline={`${r.po.code} chưa nhận hàng được`}
          reason={r.reason}
          next={
            <>
              <Btn icon="quayLai" href="/warehouse/nhap">
                Về Hàng về
              </Btn>
              {/* Hộp "Hàng của đơn" trong Kho — NV Kho không vào được khu Mua hàng. */}
              <Btn icon="don" primary href={`/warehouse/nhap?don=${r.po.id}`}>
                Xem hàng của đơn {r.po.code}
              </Btn>
            </>
          }
        />
      </div>
    )
  }

  return <PhieuNhapScreen {...r.props} />
}
