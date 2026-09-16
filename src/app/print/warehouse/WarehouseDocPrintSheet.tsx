import {
  PrintLetterhead,
  PrintMeta,
  PrintPage,
  PrintSignatures,
  PrintTitle,
  type PrintCompany,
} from '@/app/print/PrintSheet'
import { resolveSignatures, type DocTemplate } from '@/lib/doc-templates'

/**
 * PHIẾU NHẬP (01-VT) / PHIẾU XUẤT (02-VT) — phần thân, THUẦN HIỂN THỊ.
 *
 * Tách khỏi `/print/warehouse/[id]` để dùng ở HAI chỗ (chủ dự án 16/09/2026:
 * "phải có tính năng cho xem phiếu in trước"):
 *   · trang in — phiếu đã ghi sổ, dữ liệu từ DB;
 *   · nút "Xem bản in" trên form nhập / xuất — dựng từ BẢN ĐANG GÕ, chưa số.
 *
 * Một component cho cả hai là điều kiện để xem trước có giá trị: hai bản dựng
 * riêng thì bản xem trước trôi khỏi bản in thật (cùng lý do với PoPrintSheet).
 */

export type WarehousePrintLine = {
  id: string
  material_code: string
  material_name: string
  material_unit: string
  /** "Theo chứng từ": SL dòng đơn với phiếu nhập; null → in bằng SL thực. */
  qty_doc: number | null
  qty: number
  qty_rejected?: number
  shelf_location?: string | null
  note?: string | null
}

export type WarehousePrintHeader = {
  kind: 'receipt' | 'issue'
  /** null = bản xem trước, chưa ghi sổ nên chưa có số. */
  code: string | null
  date: Date
  supplier_doc_no?: string | null
  counterparty?: string | null
  reason?: string | null
  note?: string | null
  creator_name?: string | null
}

export function WarehouseDocPrintSheet({
  head,
  lines,
  company,
  tpl,
}: {
  head: WarehousePrintHeader
  lines: WarehousePrintLine[]
  company: PrintCompany
  tpl: DocTemplate
}) {
  const isReceipt = head.kind === 'receipt'
  // Tiêu đề + mẫu số TT200 lấy từ mẫu chứng từ (0164); mặc định trong code là
  // đúng giá trị cũ nên không có bảng cấu hình vẫn in ra y hệt.
  const form = tpl.form_no ?? (isReceipt ? '01-VT' : '02-VT')
  const qtyDoc = (l: WarehousePrintLine) => l.qty_doc ?? l.qty + (l.qty_rejected ?? 0)
  const totalQty = lines.reduce((s, l) => s + l.qty, 0)
  const totalDoc = lines.reduce((s, l) => s + qtyDoc(l), 0)

  return (
    <PrintPage orientation="portrait" maxWidth="max-w-3xl">
      {/* Phiếu kho theo Thông tư 200 nên chỗ quốc hiệu là "Mẫu số 01-VT/02-VT" —
          luật quy định, không thay bằng khối chung được. */}
      <PrintLetterhead
        company={company}
        date={head.date}
        nationalHeading={tpl.national_heading}
        formNo={{
          code: form,
          note: (
            <>
              Ban hành theo Thông tư số 200/2014/TT-BTC
              <br />
              ngày 22/12/2014 của Bộ Tài chính
            </>
          ),
        }}
      />
      <PrintTitle vi={tpl.title_vi} en={tpl.title_en ?? undefined} />
      <div className="mb-3 text-center text-[12px]">
        {head.code ? (
          <>
            Số: <b className="font-mono">{head.code}</b>
          </>
        ) : (
          <b>BẢN XEM TRƯỚC — chưa ghi sổ, số phiếu cấp khi ghi sổ</b>
        )}
      </div>

      <PrintMeta
        rows={[
          ...(isReceipt
            ? ([
                ['— Số phiếu giao / hoá đơn NCC:', head.supplier_doc_no || '……………………………'],
              ] as [string, string][])
            : []),
          [
            `— Họ và tên người ${isReceipt ? 'giao' : 'nhận'}:`,
            head.counterparty || '……………………………',
          ],
          ...(isReceipt
            ? // Phiếu nhập THEO ĐƠN không có lý do (lý do là đơn mua) — không
              // thêm một dòng chấm chấm trống vào mẫu đã dùng 47 lần.
              head.reason
              ? ([['— Lý do nhập kho:', head.reason]] as [string, string][])
              : []
            : ([['— Lý do xuất kho:', head.reason || '……………………………']] as [
                string,
                string,
              ][])),
          [`— ${isReceipt ? 'Nhập tại kho' : 'Xuất tại kho'}:`, 'Kho chính'],
        ]}
      />

      {/* eslint-disable-next-line hg/no-raw-control -- mẫu in TT200 kẻ bảng đen trắng, không phải bảng kit */}
      <table className="w-full border-collapse border border-black text-center text-[12px]">
        <thead>
          <tr className="font-semibold">
            <td rowSpan={2} className="border border-black px-1">
              STT
            </td>
            <td rowSpan={2} className="border border-black px-2">
              Tên, nhãn hiệu, quy cách, phẩm chất vật tư
            </td>
            <td rowSpan={2} className="border border-black px-1">
              Mã hàng
            </td>
            <td rowSpan={2} className="border border-black px-1">
              ĐVT
            </td>
            <td colSpan={2} className="border border-black px-1">
              Số lượng
            </td>
            <td rowSpan={2} className="border border-black px-1">
              Vị trí kệ
            </td>
            <td rowSpan={2} className="border border-black px-2">
              Ghi chú
            </td>
          </tr>
          <tr className="font-semibold">
            <td className="border border-black px-1">Theo chứng từ</td>
            <td className="border border-black px-1">
              {isReceipt ? 'Thực nhập' : 'Thực xuất'}
            </td>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id}>
              <td className="border border-black px-1">{i + 1}</td>
              <td className="border border-black px-2 text-left">{l.material_name}</td>
              <td className="border border-black px-1 font-mono text-[11px]">
                {l.material_code}
              </td>
              <td className="border border-black px-1">{l.material_unit}</td>
              <td className="border border-black px-1">
                {qtyDoc(l).toLocaleString('vi-VN')}
              </td>
              <td className="border border-black px-1 font-semibold">
                {l.qty.toLocaleString('vi-VN')}
              </td>
              <td className="border border-black px-1">{l.shelf_location ?? ''}</td>
              <td className="border border-black px-2 text-left text-[11px]">
                {[
                  l.qty_rejected && l.qty_rejected > 0
                    ? `QC loại ${l.qty_rejected}`
                    : null,
                  l.note,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr>
              <td
                colSpan={8}
                className="border border-black px-2 py-3 text-[11px] italic"
              >
                (chưa có dòng nào)
              </td>
            </tr>
          )}
          <tr className="font-bold">
            <td colSpan={4} className="border border-black px-2 text-right">
              Tổng cộng:
            </td>
            <td className="border border-black px-1">
              {totalDoc.toLocaleString('vi-VN')}
            </td>
            <td className="border border-black px-1">
              {totalQty.toLocaleString('vi-VN')}
            </td>
            <td className="border border-black px-1">×</td>
            <td className="border border-black px-1"></td>
          </tr>
        </tbody>
      </table>

      {head.note && <div className="mt-2 text-[12px]">— Ghi chú: {head.note}</div>}

      <PrintSignatures
        space="mt-8"
        cols={resolveSignatures(tpl.signatures, {
          names: {
            creator: head.creator_name ?? null,
            counterparty: head.counterparty ?? null,
          },
        })}
      />
    </PrintPage>
  )
}
