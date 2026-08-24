import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { docTemplatesService } from '@/modules/core/doc-templates/doc-templates.service'
import { docsRepo, stocktakeRepo } from '@/modules/dept/warehouse/stock.repo'
import { materialsRepo } from '@/modules/dept/warehouse/warehouse.repo'
import { resolveSignatures } from '@/lib/doc-templates'
import {
  PrintLetterhead,
  PrintMeta,
  PrintPage,
  PrintSignatures,
  PrintTitle,
} from '../../PrintSheet'

/**
 * In phiếu kho TT200: 01-VT (nhập) / 02-VT (xuất) — 2 cột số lượng "theo chứng
 * từ" và "thực nhập/xuất"; 05-VT (biên bản kiểm kê — 0157/GĐ C) — tồn sổ / thực
 * đếm / chênh lệch. unit_cost ẩn GĐ1 (giá trị — đặc tả để sau).
 */
export default async function WarehouseDocPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const { id } = await params

  const doc = await docsRepo.findById(id)
  if (!doc) redirect('/warehouse/docs')
  if (doc.kind === 'stocktake') {
    const [stLines, company, tpl] = await Promise.all([
      stocktakeRepo.listByDoc(id),
      settingsService.getAll(),
      // Mẫu in (0164): tiêu đề, mẫu số TT200, các cột ký — sửa ở /admin/doc-templates.
      docTemplatesService.get('KK'),
    ])
    // Biên bản đầy đủ mọi dòng đã đếm; tên/ĐVT tra danh mục (dòng KK chỉ giữ id).
    const mats = new Map(
      (
        await Promise.all(
          [...new Set(stLines.map((l) => l.material_id))].map((mid) =>
            materialsRepo.findById(mid),
          ),
        )
      )
        .filter((m): m is NonNullable<typeof m> => m != null)
        .map((m) => [m.id, m]),
    )
    const d = new Date(doc.created_at)
    return (
      <PrintPage orientation="portrait" maxWidth="max-w-3xl">
        <PrintLetterhead
          company={company}
          date={d}
          nationalHeading={tpl.national_heading}
          formNo={{
            code: tpl.form_no ?? '05-VT',
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
          Số: <b className="font-mono">{doc.code}</b>
          {doc.status === 'pending' && <b> — CHỜ DUYỆT (chưa áp sổ)</b>}
          {doc.status === 'rejected' && <b> — ĐÃ TỪ CHỐI (không áp sổ)</b>}
        </div>
        <PrintMeta
          rows={[
            ['— Thời điểm kiểm kê:', d.toLocaleString('vi-VN')],
            ['— Lý do / đợt kiểm:', doc.reason ?? '……………………………'],
          ]}
        />
        <table className="w-full border-collapse border border-black text-center text-[12px]">
          <thead>
            <tr className="font-semibold">
              <td className="border border-black px-1">STT</td>
              <td className="border border-black px-2">
                Tên, nhãn hiệu, quy cách vật tư
              </td>
              <td className="border border-black px-1">Mã hàng</td>
              <td className="border border-black px-1">ĐVT</td>
              <td className="border border-black px-1">Tồn sổ</td>
              <td className="border border-black px-1">Thực đếm</td>
              <td className="border border-black px-1">Thừa</td>
              <td className="border border-black px-1">Thiếu</td>
              <td className="border border-black px-2">Ghi chú</td>
            </tr>
          </thead>
          <tbody>
            {stLines.map((l, i) => {
              const m = mats.get(l.material_id)
              return (
                <tr key={l.id}>
                  <td className="border border-black px-1">{i + 1}</td>
                  <td className="border border-black px-2 text-left">{m?.name ?? '?'}</td>
                  <td className="border border-black px-1 font-mono text-[11px]">
                    {m?.code ?? ''}
                  </td>
                  <td className="border border-black px-1">{m?.unit ?? ''}</td>
                  <td className="border border-black px-1">
                    {l.system_qty.toLocaleString('vi-VN')}
                  </td>
                  <td className="border border-black px-1 font-semibold">
                    {l.counted_qty.toLocaleString('vi-VN')}
                  </td>
                  <td className="border border-black px-1">
                    {l.diff > 0 ? l.diff.toLocaleString('vi-VN') : ''}
                  </td>
                  <td className="border border-black px-1">
                    {l.diff < 0 ? Math.abs(l.diff).toLocaleString('vi-VN') : ''}
                  </td>
                  <td className="border border-black px-2 text-left text-[11px]">
                    {l.note ?? ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {doc.note && <div className="mt-2 text-[12px]">— Ghi chú: {doc.note}</div>}
        {doc.reject_reason && (
          <div className="mt-2 text-[12px]">— Lý do từ chối: {doc.reject_reason}</div>
        )}
        <PrintSignatures
          space="mt-8"
          cols={resolveSignatures(tpl.signatures, {
            names: {
              creator: doc.created_by_name,
              approver: doc.approved_by_name,
            },
          })}
        />
      </PrintPage>
    )
  }
  const [lines, company, tpl] = await Promise.all([
    docsRepo.listLines(id),
    settingsService.getAll(),
    docTemplatesService.get(doc.kind === 'receipt' ? 'PNK' : 'PXK'),
  ])

  const isReceipt = doc.kind === 'receipt'
  // Tiêu đề + mẫu số TT200 lấy từ mẫu chứng từ (0164), mặc định trong code là
  // đúng giá trị cũ nên không có bảng cấu hình vẫn in ra y hệt.
  const title = tpl.title_vi
  const form = tpl.form_no ?? (isReceipt ? '01-VT' : '02-VT')
  const d = new Date(doc.created_at)
  const totalQty = lines.reduce((s, l) => s + l.qty, 0)
  const totalDoc = lines.reduce(
    (s, l) => s + (l.qty_ordered ?? l.qty + l.qty_rejected),
    0,
  )

  return (
    <PrintPage orientation="portrait" maxWidth="max-w-3xl">
      {/* Phiếu kho theo Thông tư 200 nên chỗ quốc hiệu là "Mẫu số 01-VT/02-VT" —
          luật quy định, không thay bằng khối chung được. Phần còn lại của đầu
          phiếu (khối công ty, dòng ngày kèm địa danh) thì dùng chung. */}
      <PrintLetterhead
        company={company}
        date={d}
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
      <PrintTitle vi={title} en={tpl.title_en ?? undefined} />
      <div className="mb-3 text-center text-[12px]">
        Số: <b className="font-mono">{doc.code}</b>
      </div>

      <PrintMeta
        rows={[
          // K3: số chứng từ NCC — chìa khoá đối chiếu 3 chiều với kế toán.
          ...(isReceipt
            ? ([
                ['— Số phiếu giao / hoá đơn NCC:', doc.supplier_doc_no ?? '……………………………'],
              ] as [string, string][])
            : []),
          [
            `— Họ và tên người ${isReceipt ? 'giao' : 'nhận'}:`,
            doc.counterparty ?? '……………………………',
          ],
          ...(isReceipt
            ? []
            : ([['— Lý do xuất kho:', doc.reason ?? '……………………………']] as [
                string,
                string,
              ][])),
          [`— ${isReceipt ? 'Nhập tại kho' : 'Xuất tại kho'}:`, 'Kho chính'],
        ]}
      />

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
                {(l.qty_ordered ?? l.qty + l.qty_rejected).toLocaleString('vi-VN')}
              </td>
              <td className="border border-black px-1 font-semibold">
                {l.qty.toLocaleString('vi-VN')}
              </td>
              <td className="border border-black px-1">{l.shelf_location ?? ''}</td>
              <td className="border border-black px-2 text-left text-[11px]">
                {[l.qty_rejected > 0 ? `QC loại ${l.qty_rejected}` : null, l.note]
                  .filter(Boolean)
                  .join(' · ')}
              </td>
            </tr>
          ))}
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

      {doc.note && <div className="mt-2 text-[12px]">— Ghi chú: {doc.note}</div>}

      <PrintSignatures
        space="mt-8"
        cols={resolveSignatures(tpl.signatures, {
          names: { creator: doc.created_by_name, counterparty: doc.counterparty },
        })}
      />
    </PrintPage>
  )
}
