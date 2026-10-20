import { authService } from '@/modules/core/auth/auth.service'
import { Btn, Empty, ScreenFrame } from '@/components/kit'
import { NhanHangScreen } from './NhanHangScreen'
import { taiNhanHang } from './tai-nhan-hang'

export const metadata = { title: 'Mua hàng · Nhận hàng' }
export const dynamic = 'force-dynamic'

/**
 * NHẬN HÀNG TRONG KHU CUNG ỨNG — `/mua-hang/don/[id]/nhan?dot=<shipment_id>`
 * (01/10/2026, bản vẽ F2 canvas "Cung ứng · Hàng về" › Bản 3, chủ dự án duyệt).
 *
 * Cung ứng TẠM nhận hàng thay Kho. Từ 12/10/2026 đây là form RIÊNG của khu Mua
 * hàng (`NhanHangScreen` + `taiNhanHang`, chép từ form của Kho — chủ dự án:
 * "không dùng chung giao diện giữa 2 phòng"). Đường GHI vẫn chung — cùng POST
 * `docs/receipt`, cùng luật ở tầng dữ liệu — nên tồn, trạng thái đơn, đợt giao,
 * mẫu in 01-VT vẫn đi đúng một đường. Quyền ghi sổ vẫn là `warehouse.stock.write`: khi Kho
 * nhận lại việc, gỡ vai Kho của người Cung ứng là nút Ghi sổ tự khoá.
 *
 * Khác cửa Kho đúng một luật: đơn ĐÃ DUYỆT CHƯA GỬI NCC thì chặn.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  /** `sua` = phiếu cũ đã đảo để LẬP LẠI (Sửa phiếu nhập, 02/10/2026). */
  searchParams: Promise<{ dot?: string; sua?: string }>
}) {
  const user = await authService.requirePageUser()
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const r = await taiNhanHang(user, id, sp.dot, 'cung-ung', sp.sua)

  if (r.kind === 'chan') {
    return (
      <ScreenFrame>
        <Empty
          headline={`${r.po.code} chưa nhận hàng được`}
          reason={r.reason}
          next={
            <>
              <Btn icon="quayLai" href="/mua-hang/theo-doi">
                Về Theo dõi đơn hàng
              </Btn>
              <Btn icon="don" primary href={`/mua-hang/don/${r.po.id}`}>
                {r.chuaGui ? `Mở đơn ${r.po.code} để gửi NCC` : `Mở đơn ${r.po.code}`}
              </Btn>
            </>
          }
        />
      </ScreenFrame>
    )
  }

  return <NhanHangScreen {...r.props} />
}
