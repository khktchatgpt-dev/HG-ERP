import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { docTemplatesService } from '@/modules/core/doc-templates/doc-templates.service'
import { resolveSignatures } from '@/lib/doc-templates'
import { entryDocsRepo } from '@/modules/dept/production/entry-docs.repo'
import { entriesRepo } from '@/modules/dept/production/entries.repo'
import { defectCodesRepo } from '@/modules/dept/production/defect-codes.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import {
  PrintLetterhead,
  PrintMeta,
  PrintPage,
  PrintSignatures,
  PrintTitle,
  printCell,
  printTable,
} from '../../PrintSheet'

/**
 * PHIẾU BÁO SẢN LƯỢNG (PBS) — bản giấy để tổ trưởng / quản đốc ký tay.
 *
 * VÌ SAO CẦN, khi số đã nằm trong máy: xưởng vẫn chạy bằng chữ ký. Thống kê
 * gõ sổ xong in ra, tổ trưởng ký xác nhận "đúng số tổ tôi làm hôm nay", quản
 * đốc ký duyệt. Đây cũng là lý do hệ thống KHÔNG cần tầng duyệt điện tử (chốt
 * 27/08: tổ trưởng không dùng máy) — tờ giấy này thay chỗ đó.
 *
 * Mọi khối khung (đầu phiếu, tiêu đề, chữ ký) dùng chung `PrintSheet` nên tờ
 * này trông cùng một nhà với phiếu mua, phiếu kho, lệnh sản xuất.
 *
 * DỌC chứ không ngang: phiếu 7 cột và thường dưới 30 dòng; in ngang là phí
 * nửa tờ giấy.
 */
export default async function PhieuSxPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const { id } = await params

  const doc = await entryDocsRepo.findById(id)
  if (!doc) redirect('/thongke/lenh')

  const [lines, lsx, stages, company, tpl, defectCodes] = await Promise.all([
    entriesRepo.listByDoc(id),
    productionRepo.findById(doc.production_order_id),
    productionRepo.listStages(),
    settingsService.getAll(),
    // Mẫu in (0164) — tiêu đề và các cột ký sửa được ở /admin/doc-templates,
    // không phải sửa mã.
    docTemplatesService.get('PBS'),
    defectCodesRepo.listActive(),
  ])

  const stageLabel = stages.find((s) => s.code === doc.stage)?.label ?? doc.stage
  const totalQty = lines.reduce((a, l) => a + Number(l.qty), 0)
  const totalDefect = lines.reduce((a, l) => a + Number(l.defect_qty), 0)
  const totalRework = lines.reduce((a, l) => a + Number(l.rework_qty ?? 0), 0)

  // Sổ lưu MÃ lý do; tờ giấy phải in chữ người đọc được. Dòng gõ tự do không
  // có mã thì in nguyên chữ đã gõ.
  const labelByCode = new Map(defectCodes.map((c) => [c.code, c.label]))
  const reasonText = (l: { defect_code: string | null; defect_reason: string | null }) =>
    (l.defect_code ? labelByCode.get(l.defect_code) : null) ?? l.defect_reason ?? ''
  const vnDate = (iso: string) => iso.split('-').reverse().join('/')

  return (
    <PrintPage orientation="portrait" maxWidth="max-w-3xl">
      <PrintLetterhead
        company={company}
        date={new Date(doc.created_at)}
        nationalHeading={tpl.national_heading}
      />
      <PrintTitle vi={tpl.title_vi} en={tpl.title_en ?? undefined} />
      <PrintMeta
        rows={[
          ['Lệnh sản xuất:', lsx?.code ?? doc.lsx_code ?? '—'],
          ['Khách hàng:', lsx?.customer_name ?? '—'],
          ['Công đoạn:', stageLabel],
          ['Tổ:', doc.team_name ?? '—'],
        ]}
        refs={[
          ['Số:', doc.doc_no],
          ['Ngày SX:', vnDate(doc.entry_date)],
        ]}
        refsBoxed
      />

      {/* `printTable` — bảng viền đen dùng chung của mọi phiếu in. */}
      <table className={`${printTable} mt-3 text-[12px]`}>
        <thead>
          <tr>
            <th className={`${printCell} w-8`}>TT</th>
            <th className={`${printCell} text-left`}>Chi tiết / cụm</th>
            <th className={`${printCell} w-20`}>SL đạt</th>
            <th className={`${printCell} w-16`}>Phế</th>
            <th className={`${printCell} w-16`}>Sửa lại</th>
            <th className={`${printCell} text-left`}>Lý do</th>
            <th className={`${printCell} w-24`}>Người làm</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id}>
              <td className={printCell}>{i + 1}</td>
              <td className={`${printCell} text-left`}>
                {l.component_cluster ? `${l.component_cluster} · ` : ''}
                {l.component_name ?? '—'}
              </td>
              <td className={printCell}>{Number(l.qty).toLocaleString('vi-VN')}</td>
              <td className={printCell}>
                {Number(l.defect_qty) > 0
                  ? Number(l.defect_qty).toLocaleString('vi-VN')
                  : ''}
              </td>
              <td className={printCell}>
                {Number(l.rework_qty ?? 0) > 0
                  ? Number(l.rework_qty).toLocaleString('vi-VN')
                  : ''}
              </td>
              <td className={`${printCell} text-left`}>{reasonText(l)}</td>
              <td className={printCell}>{l.worker_name ?? ''}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className={printCell} colSpan={2}>
              CỘNG {lines.length} dòng
            </td>
            <td className={printCell}>{totalQty.toLocaleString('vi-VN')}</td>
            <td className={printCell}>
              {totalDefect > 0 ? totalDefect.toLocaleString('vi-VN') : ''}
            </td>
            <td className={printCell}>
              {totalRework > 0 ? totalRework.toLocaleString('vi-VN') : ''}
            </td>
            <td className={printCell} colSpan={2} />
          </tr>
        </tbody>
      </table>

      {doc.note && <p className="mt-2 text-[12px]">Ghi chú: {doc.note}</p>}

      {/*
        Đơn vị đếm KHÔNG in thành cột riêng mà nói một câu: trong cùng một
        phiếu thì mọi dòng cùng một công đoạn, nên hoặc tất cả đếm chi tiết
        hoặc tất cả đếm bộ. Một cột lặp đúng một chữ 30 lần là cột thừa.
      */}
      <p className="mt-1 text-[11px] italic">
        Đơn vị: theo đơn vị đếm của công đoạn {stageLabel.toLowerCase()} (chi tiết hoặc bộ
        sản phẩm).
      </p>

      <PrintSignatures
        cols={resolveSignatures(tpl.signatures, {
          names: { creator: doc.created_by_name },
        })}
      />
    </PrintPage>
  )
}
