import { PrintToolbar } from './PrintToolbar'

/**
 * KHUNG PHIẾU IN DÙNG CHUNG — một bộ đầu/cuối cho mọi loại phiếu.
 *
 * Trước đây bốn trang in (đơn đặt hàng, báo giá, lệnh sản xuất, phiếu kho) mỗi
 * trang tự dựng lấy đầu phiếu và khối chữ ký. Kết quả là bốn kiểu khác nhau trên
 * giấy của cùng một công ty: chỗ có quốc hiệu chỗ không, chỗ ghi "Địa chỉ:" chỗ
 * để trần địa chỉ, dòng ngày tháng chỗ có địa danh chỗ không, khối chữ ký mỗi
 * phiếu một cách chia cột.
 *
 * Ở đây khai một lần theo đúng form đặt hàng thật của phòng Cung ứng:
 *
 *   CÔNG TY TNHH SX-TM HOÀNG GIA          CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
 *   Địa chỉ: …                            Độc lập – Tự do – Hạnh phúc
 *   MST: … SĐT: … Fax: …                  Gia Lai, ngày 06 tháng 07 năm 2026
 *
 *                  TIÊU ĐỀ / SUBTITLE
 *                                              Số: …
 *   Kính gửi:      …                           Theo HĐ số: …
 *   …
 *   [câu dẫn]
 *   [bảng dòng hàng — phần RIÊNG của từng loại phiếu]
 *   [khối tổng / điều khoản]
 *   ĐƠN VỊ CUNG CẤP    TRƯỞNG PHÒNG KẾ HOẠCH    GIÁM ĐỐC
 *
 * Mỗi trang chỉ còn phải lo phần GIỮA — thứ thật sự khác nhau giữa các loại
 * phiếu. Phần khung thì sửa một chỗ, cả bốn phiếu đổi theo.
 */

export type PrintCompany = {
  company_name?: string | null
  company_address?: string | null
  company_tax_code?: string | null
  company_phone?: string | null
  company_fax?: string | null
  company_locality?: string | null
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** "Gia Lai, ngày 06 tháng 07 năm 2026" — địa danh lấy từ cấu hình, không đoán. */
export function printDateLine(company: PrintCompany, d: Date): string {
  const locality = company.company_locality?.trim()
  return `${locality ? `${locality}, ` : ''}ngày ${pad2(d.getDate())} tháng ${pad2(
    d.getMonth() + 1,
  )} năm ${d.getFullYear()}`
}

/**
 * Trang in: khổ giấy + nền trắng + thanh nút (tự ẩn khi in).
 *
 * `landscape` cho phiếu nhiều cột (đơn đặt, báo giá, lệnh SX), `portrait` cho
 * phiếu hẹp (nhập/xuất kho).
 */
export function PrintPage({
  orientation = 'landscape',
  maxWidth = 'max-w-4xl',
  exportHref,
  children,
}: {
  orientation?: 'landscape' | 'portrait'
  maxWidth?: string
  /** Có = thanh nút thêm "Xuất Excel" tải phiếu dạng .xlsx. */
  exportHref?: string
  children: React.ReactNode
}) {
  const margin = orientation === 'portrait' ? '12mm' : '10mm'
  return (
    <div className={`mx-auto ${maxWidth} bg-white p-6 text-[13px] text-black print:p-0`}>
      <style>{`@page { size: A4 ${orientation}; margin: ${margin}; }`}</style>
      <PrintToolbar exportHref={exportHref} />
      {children}
    </div>
  )
}

/**
 * ĐẦU PHIẾU: khối công ty bên trái, quốc hiệu + ngày bên phải.
 *
 * `nationalHeading=false` cho phiếu gửi KHÁCH NƯỚC NGOÀI (báo giá tiếng Anh):
 * in quốc hiệu Việt Nam lên một tờ quotation gửi MERXX HANDELS GMBH là sai đối
 * tượng đọc. Dòng ngày vẫn giữ để hai loại phiếu còn nhận ra là cùng một nhà.
 *
 * `formNo` cho phiếu kho theo Thông tư 200 — chỗ đó luật quy định phải ghi
 * "Mẫu số 01-VT/02-VT", đứng thay chỗ quốc hiệu.
 */
export function PrintLetterhead({
  company,
  date,
  nationalHeading = true,
  formNo,
  dateLabel,
}: {
  company: PrintCompany
  date: Date
  nationalHeading?: boolean
  formNo?: { code: string; note: React.ReactNode }
  /** Đè dòng ngày (báo giá tiếng Anh dùng "Date: 06/07/2026"). */
  dateLabel?: string
}) {
  const info = [
    company.company_tax_code && `MST: ${company.company_tax_code}`,
    company.company_phone && `SĐT: ${company.company_phone}`,
    company.company_fax && `Fax: ${company.company_fax}`,
  ].filter(Boolean)

  return (
    <div className="flex justify-between gap-4 text-[12px]">
      <div className="max-w-[55%]">
        <div className="font-bold uppercase">{company.company_name}</div>
        {company.company_address && <div>Địa chỉ: {company.company_address}</div>}
        {info.length > 0 && <div>{info.join('      ')}</div>}
      </div>
      <div className="shrink-0 text-center">
        {nationalHeading && (
          <>
            <div className="font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div className="font-semibold">Độc lập – Tự do – Hạnh phúc</div>
          </>
        )}
        {formNo && (
          <div className="text-right">
            <div className="font-bold">Mẫu số: {formNo.code}</div>
            <div className="text-[10px] italic">{formNo.note}</div>
          </div>
        )}
        <div className={`italic ${nationalHeading || formNo ? 'mt-2' : ''}`}>
          {dateLabel ?? printDateLine(company, date)}
        </div>
      </div>
    </div>
  )
}

/** Tiêu đề phiếu — tiếng Việt lớn, dòng tiếng Anh nhỏ bên dưới nếu có. */
export function PrintTitle({ vi, en }: { vi: string; en?: string }) {
  return (
    <>
      <h1 className="mt-4 text-center text-2xl font-bold">{vi}</h1>
      {en && <div className="text-center text-[12px] tracking-wide">{en}</div>}
    </>
  )
}

/**
 * Khối định danh dưới tiêu đề: bên trái là "Kính gửi / Địa chỉ / MST…", bên phải
 * là mấy dòng số hiệu (Số ĐH, Theo HĐ số, LSX…).
 *
 * Bên phải KHÔNG đóng khung — phiếu thật để chữ thường chạy thẳng; khung viền là
 * thứ app từng tự thêm vào và làm hai bản khác nhau.
 */
export function PrintMeta({
  rows,
  refs,
  refsBoxed = false,
}: {
  /** [nhãn, giá trị] — bỏ qua dòng giá trị rỗng. */
  rows: [string, React.ReactNode][]
  refs?: [string, React.ReactNode][]
  /**
   * Đóng KHUNG khối số hiệu — đơn ĐH chuẩn 08/2026 kẻ hộp quanh "Số ĐH / LSX"
   * cho NCC thấy ngay số tham chiếu; các phiếu khác vẫn để chữ chạy thẳng.
   */
  refsBoxed?: boolean
}) {
  return (
    <div className="mt-2 flex items-start justify-between gap-4">
      <table className="text-[12px]">
        <tbody>
          {rows
            .filter(([, v]) => v !== null && v !== undefined && v !== '')
            .map(([label, v]) => (
              <tr key={label}>
                <td className="pr-2 align-top whitespace-nowrap">{label}</td>
                <td>{v}</td>
              </tr>
            ))}
        </tbody>
      </table>
      {refs && refs.length > 0 && (
        <div
          className={`shrink-0 text-[12px] ${
            refsBoxed
              ? 'divide-y divide-black border border-black text-center [&>div]:px-3 [&>div]:py-0.5'
              : ''
          }`}
        >
          {refs.map(([label, v]) => (
            <div key={label}>
              {label} {v}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** "ĐIỀU KHOẢN & YÊU CẦU" — 5 dòng nhãn: giá trị, bỏ dòng trống. */
export function PrintTerms({
  title = 'ĐIỀU KHOẢN & YÊU CẦU',
  items,
}: {
  title?: string
  items: [string, string | null | undefined][]
}) {
  const rows = items.filter(([, v]) => v && v.trim())
  if (rows.length === 0) return null
  return (
    <div className="mt-3 text-[12px]">
      <div className="font-bold">{title}</div>
      <table className="mt-1">
        <tbody>
          {rows.map(([label, v]) => (
            <tr key={label}>
              {/* Nhãn ĐẬM (28/08): nhãn và nội dung cùng một sắc chữ thì mắt
                  không tách được đâu là mục, đâu là điều khoản — nhất là khi
                  in đen trắng, thứ duy nhất phân biệt được là nét chữ. */}
              <td className="pr-3 align-top font-semibold whitespace-nowrap">
                {label}:
              </td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * KHỐI CHỮ KÝ — chia đều theo số cột, cùng một kiểu ở mọi phiếu.
 *
 * Trước mỗi phiếu một kiểu: đơn đặt dùng `flex justify-between w-1/3`, phiếu kho
 * dùng `grid-cols-4`, lệnh SX chỉ có một ô đẩy sang phải. In ra thì ba tờ của
 * cùng một công ty trông như ba nơi phát hành.
 */
export function PrintSignatures({
  cols,
  space = 'mt-10',
}: {
  cols: { role: string; hint?: string; name?: string | null }[]
  /** Khoảng chừa phía trên để ký — phiếu kho cần nhiều hơn. */
  space?: string
}) {
  return (
    <div className={`${space} flex justify-between gap-4 text-center text-[12px]`}>
      {cols.map((c) => (
        <div key={c.role} className="flex-1">
          <div className="font-bold">{c.role}</div>
          {c.hint && <div className="text-[11px] italic">({c.hint})</div>}
          {c.name && <div className="mt-16">{c.name}</div>}
        </div>
      ))}
    </div>
  )
}

/** Ô bảng có viền đen — kiểu bảng dùng chung của mọi phiếu in. */
export const printCell = 'border border-black px-1'
export const printTable = 'w-full border-collapse border border-black text-center'
