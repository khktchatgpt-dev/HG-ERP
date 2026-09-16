import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { docTemplatesService } from '@/modules/core/doc-templates/doc-templates.service'
import { WarehouseDocPrintSheet } from '../WarehouseDocPrintSheet'
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

  return (
    <WarehouseDocPrintSheet
      head={{
        kind: doc.kind === 'receipt' ? 'receipt' : 'issue',
        code: doc.code,
        date: new Date(doc.created_at),
        supplier_doc_no: doc.supplier_doc_no,
        counterparty: doc.counterparty,
        reason: doc.reason,
        note: doc.note,
        creator_name: doc.created_by_name,
      }}
      lines={lines.map((l) => ({
        id: l.id,
        // Dòng sổ cũ có thể mất tên/ĐVT (vật tư bị đổi) — in ô trống, không "null".
        material_code: l.material_code ?? '',
        material_name: l.material_name ?? '',
        material_unit: l.material_unit ?? '',
        qty_doc: l.qty_ordered,
        qty: l.qty,
        qty_rejected: l.qty_rejected,
        shelf_location: l.shelf_location,
        note: l.note,
      }))}
      company={company}
      tpl={tpl}
    />
  )
}
