import { dongChecklist, tenQuyCach, type DongKiemTra } from '@/lib/bien-ban-kiem-tra'
import { PrintLetterhead, PrintPage, type PrintCompany } from '@/app/print/PrintSheet'

/**
 * PHIẾU NHẬP KHO KIÊM BIÊN BẢN KIỂM TRA ĐẦU VÀO — bản in thứ hai của phiếu nhập,
 * đi kèm 01-VT (bản vẽ BmMmB47fgZhpxwWCuDhu4j, chủ dự án duyệt Q1–Q6 25/11/2026).
 *
 * Dựng theo file Excel "HOANGGIA - PHIẾU NHẬP KHO KIÊM BIÊN BẢN KIỂM HÀNG": năm
 * khối A–E, A4 ngang. ERP điền thứ nó có; ô ERP chưa giữ (số xe, lô, ngày SX,
 * hạn dùng, QC) in dòng chấm. SL đạt / lỗi, checklist, kết luận để TRỐNG — QC
 * ghi tay trên giấy (Q3: chỉ in tiêu chí theo nhóm vật tư có trong phiếu).
 *
 * Hai chỗ dùng: sau ghi sổ (`/print/warehouse/[id]/kiem-tra`) và trước ghi sổ,
 * cầm ra xe kiểm (`/print/warehouse/don/[poId]/kiem-tra`, `qty` = null).
 */

export type BienBanHead = {
  /** null = bản in trước khi ghi sổ, chưa có số phiếu. */
  code: string | null
  date: Date
  ncc: string | null
  /** Q4: ERP chưa cấp mã NCC — in MST thay. */
  ncc_tax_no: string | null
  ncc_address: string | null
  don: string[]
  lenh: string[]
  supplier_doc_no: string | null
  counterparty: string | null
  receiver_name: string | null
}

const CHAM = '……………………………'
const n = (v: number | null) => (v == null ? '' : v.toLocaleString('vi-VN'))

const cell = 'border border-black px-1.5 py-0.5 align-top'
const head = `${cell} bg-neutral-100 text-center font-bold`
const k = `${cell} w-px font-semibold whitespace-nowrap`
const dot = `${cell} text-neutral-500`

function O({ label }: { label: string }) {
  return (
    <span className="mr-2 inline-flex items-center gap-1 whitespace-nowrap">
      <span className="inline-block size-2.5 border border-black" aria-hidden />
      {label}
    </span>
  )
}

function Khoi({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 border border-b-0 border-black bg-neutral-100 px-1.5 py-0.5 font-bold">
      {children}
    </div>
  )
}

export function BienBanKiemTraSheet({
  head: h,
  lines,
  company,
}: {
  head: BienBanHead
  lines: DongKiemTra[]
  company: PrintCompany
}) {
  const truoc = h.code == null
  const checklist = dongChecklist(lines.map((l) => l.group))
  const tongDoc = lines.reduce((s, l) => s + (l.qty_doc ?? 0), 0)
  const tongThuc = lines.reduce((s, l) => s + (l.qty ?? 0), 0)

  return (
    <PrintPage orientation="landscape" maxWidth="max-w-6xl">
      <div className="text-[11.5px] leading-snug">
        <PrintLetterhead
          company={company}
          date={h.date}
          nationalHeading={false}
          formNo={{ code: 'KH-01 (nội bộ)', note: 'Đi kèm Phiếu nhập kho 01-VT cùng số' }}
        />
        <h1 className="mt-2 text-center text-lg font-bold">
          PHIẾU NHẬP KHO KIÊM BIÊN BẢN KIỂM TRA ĐẦU VÀO
        </h1>
        <div className="mb-1 text-center">
          {truoc ? (
            <b>BẢN KIỂM TRA TRƯỚC KHI GHI SỔ — số phiếu cấp khi ghi sổ</b>
          ) : (
            <>
              Số: <b className="font-mono">{h.code}</b>
            </>
          )}
        </div>

        <Khoi>A. THÔNG TIN CHỨNG TỪ VÀ LÔ HÀNG</Khoi>
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className={k}>Nhà cung cấp:</td>
              <td className={cell} colSpan={3}>
                {h.ncc ?? CHAM}
              </td>
              <td className={k}>MST:</td>
              <td className={h.ncc_tax_no ? cell : dot}>{h.ncc_tax_no ?? CHAM}</td>
            </tr>
            <tr>
              <td className={k}>Địa chỉ:</td>
              <td className={h.ncc_address ? cell : dot} colSpan={3}>
                {h.ncc_address ?? CHAM}
              </td>
              <td className={k}>Đơn mua:</td>
              <td className={`${cell} font-mono text-[10.5px]`}>
                {h.don.join(', ') || '—'}
                {h.lenh.length > 0 && (
                  <span className="font-sans"> · lệnh {h.lenh.join(', ')}</span>
                )}
              </td>
            </tr>
            <tr>
              <td className={k}>Số phiếu giao NCC:</td>
              <td className={h.supplier_doc_no ? cell : dot}>
                {h.supplier_doc_no ?? CHAM}
              </td>
              <td className={k}>Số xe / container:</td>
              <td className={dot}>{CHAM}</td>
              <td className={k}>Kho nhận:</td>
              <td className={cell}>Kho chính</td>
            </tr>
            <tr>
              <td className={k}>Ngày sản xuất:</td>
              <td className={dot}>{CHAM}</td>
              <td className={k}>Số lô / batch:</td>
              <td className={dot}>{CHAM}</td>
              <td className={k}>Hạn dùng (nếu có):</td>
              <td className={dot}>{CHAM}</td>
            </tr>
            <tr>
              <td className={k}>Người giao:</td>
              <td className={h.counterparty ? cell : dot}>{h.counterparty ?? CHAM}</td>
              <td className={k}>Người nhận:</td>
              <td className={h.receiver_name ? cell : dot}>{h.receiver_name ?? CHAM}</td>
              <td className={k}>QC kiểm tra:</td>
              <td className={dot}>{CHAM}</td>
            </tr>
          </tbody>
        </table>

        <Khoi>B. KIỂM ĐẾM VÀ KIỂM TRA CHẤT LƯỢNG</Khoi>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${head} w-[3%]`}>STT</th>
              <th className={`${head} w-[8%]`}>Mã VT</th>
              <th className={head}>Tên vật tư / quy cách</th>
              <th className={`${head} w-[13%]`}>Nhóm vật tư</th>
              <th className={`${head} w-[5%]`}>ĐVT</th>
              <th className={`${head} w-[7%]`}>{truoc ? 'SL còn chờ' : 'SL theo đơn'}</th>
              <th className={`${head} w-[7%]`}>SL thực nhận</th>
              <th className={`${head} w-[7%]`}>SL đạt</th>
              <th className={`${head} w-[7%]`}>SL lỗi / thiếu</th>
              <th className={`${head} w-[11%]`}>Kết quả</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id} className="break-inside-avoid">
                <td className={`${cell} text-center`}>{i + 1}</td>
                <td className={`${cell} font-mono text-[10.5px]`}>{l.code}</td>
                <td className={cell}>{tenQuyCach(l.name, l.spec)}</td>
                <td className={cell}>{l.group ?? ''}</td>
                <td className={`${cell} text-center`}>{l.unit}</td>
                <td className={`${cell} text-right font-mono tabular-nums`}>
                  {n(l.qty_doc)}
                </td>
                <td className={`${cell} text-right font-mono tabular-nums`}>
                  {n(l.qty)}
                </td>
                <td className={cell} />
                <td className={cell} />
                <td className={`${cell} text-center`}>
                  <O label="Đạt" />
                  <O label="Lỗi" />
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td className={`${cell} py-2 text-center italic`} colSpan={10}>
                  (không còn dòng nào chờ nhận)
                </td>
              </tr>
            )}
            <tr className="font-bold">
              <td className={`${cell} text-right`} colSpan={5}>
                Cộng {lines.length} dòng (nhiều ĐVT thì tổng chỉ để đếm)
              </td>
              <td className={`${cell} text-right font-mono tabular-nums`}>
                {n(tongDoc)}
              </td>
              <td className={`${cell} text-right font-mono tabular-nums`}>
                {truoc ? '' : n(tongThuc)}
              </td>
              <td className={cell} />
              <td className={cell} />
              <td className={cell} />
            </tr>
          </tbody>
        </table>

        <div className="break-inside-avoid">
          <Khoi>C. CHECKLIST KIỂM TRA ĐẦU VÀO</Khoi>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`${head} w-[3%]`}>#</th>
                <th className={`${head} w-[16%]`}>Nhóm kiểm tra</th>
                <th className={head}>Tiêu chí kiểm tra</th>
                <th className={`${head} w-[18%]`}>Kết quả</th>
                <th className={`${head} w-[28%]`}>Ghi chú / số đo / bằng chứng</th>
              </tr>
            </thead>
            <tbody>
              {checklist.map((t, i) => (
                <tr key={t.nhom}>
                  <td className={`${cell} text-center`}>{i + 1}</td>
                  <td className={cell}>{t.nhom}</td>
                  <td className={cell}>{t.tieu_chi}</td>
                  <td className={cell}>
                    <O label="Đạt" />
                    <O label="Không" />
                    <O label="NA" />
                  </td>
                  <td className={cell} />
                </tr>
              ))}
            </tbody>
          </table>

          <Khoi>D. KẾT LUẬN VÀ XỬ LÝ</Khoi>
          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <td className={k}>Kết luận lô hàng:</td>
                <td className={cell}>
                  <O label="Nhận hết" />
                  <O label="Nhận phần đạt, giữ phần lỗi" />
                  <O label="Trả lại cả lô" />
                </td>
                <td className={k}>SL nhập kho:</td>
                <td className={`${cell} w-[12%]`} />
                <td className={k}>SL giữ / lỗi:</td>
                <td className={`${cell} w-[12%]`} />
              </tr>
              <tr>
                <td className={k}>Hướng xử lý:</td>
                <td className={`${cell} h-6`} colSpan={5} />
              </tr>
              <tr>
                <td className={k}>Lý do / mô tả lỗi:</td>
                <td className={`${cell} h-10`} colSpan={5} />
              </tr>
            </tbody>
          </table>

          <Khoi>E. XÁC NHẬN</Khoi>
          <div className="grid grid-cols-4 border border-black text-center">
            {[
              ['Người giao hàng', h.counterparty],
              ['Thủ kho / người nhận', h.receiver_name],
              ['QC kiểm tra', null],
              ['Quản lý duyệt', null],
            ].map(([role, name]) => (
              <div key={role} className="px-2 pt-1 pb-2">
                <div className="font-bold">{role}</div>
                <div className="text-[10.5px] italic">(Ký, ghi rõ họ tên)</div>
                <div className="mt-12 font-semibold">{name ?? ''}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PrintPage>
  )
}
