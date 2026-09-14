import { Btn, Empty, NoticeBar, ScreenHeader } from '@/components/kit'

export const metadata = { title: 'Mua hàng · Hoá đơn NCC' }

/**
 * TRANG CHƯA DỰNG — và nói thẳng vì sao, thay vì "đang phát triển".
 *
 * Đây là trang DUY NHẤT trong khu Mua hàng cố ý chưa dựng (15/09/2026), vì
 * dựng lúc này là dựng trên không khí:
 *
 *   · `accounting_supplier_invoices` có **2 dòng**, `accounting_supplier_payments`
 *     có **0** — đo 15/09/2026. Mọi con số trên màn sẽ là số của dữ liệu mẫu.
 *   · Bảng hoá đơn KHÔNG có cột `po_id`, nên chưa gắn được hoá đơn vào đơn mua
 *     nào — không đối chiếu ba chiều (đơn ↔ hàng nhận ↔ hoá đơn) được.
 *   · Công nợ hiện tính theo HÀNG ĐÃ NHẬN, chưa theo hoá đơn. Đổi gốc tính là
 *     quyết định nghiệp vụ, không phải việc dựng màn.
 *
 * Nút chặn thật sự là Đợt 2 — chạy một đơn thật đi hết vòng đời để có phiếu
 * nhập gắn đơn mà đối chiếu. Xem `docs/ke-hoach-thuc-hien.md`.
 *
 * Màn hoá đơn của KẾ TOÁN thì đã có và đang chạy — dẫn sang đó, đừng bắt người
 * dùng đi tìm.
 */
export default function Page() {
  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader compact eyebrow="Mua hàng" title="Hoá đơn NCC" />
      <NoticeBar tone="warn" tag="Chưa dựng" action={{ label: 'Xem kế hoạch' }}>
        Cố ý chưa dựng: hệ thống mới có <b>2 hoá đơn</b> và <b>0 phiếu trả tiền</b>, dựng
        màn lúc này là bày số của dữ liệu mẫu.
      </NoticeBar>
      <div className="flex-1 bg-[var(--surface-card)]">
        <Empty
          headline="Hoá đơn nhà cung cấp do Kế toán nhập"
          reason="Cung ứng đặt hàng và theo hàng về; hoá đơn và công nợ là sổ của Kế toán — màn đó đã có và đang chạy. Bản riêng cho người mua (xem đơn này đã có hoá đơn chưa, đã trả bao nhiêu) còn chờ hai thứ: bảng hoá đơn có cột nối về đơn mua, và một đơn thật đã đi hết vòng đời để có cái mà đối chiếu."
          next={
            <>
              <Btn primary href="/finance/hoa-don-ncc">
                Mở sổ hoá đơn của Kế toán
              </Btn>
              <Btn href="/finance/cong-no-ncc">Công nợ nhà cung cấp</Btn>
            </>
          }
        />
      </div>
    </div>
  )
}
