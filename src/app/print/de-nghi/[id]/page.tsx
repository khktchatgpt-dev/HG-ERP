import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { docTemplatesService } from '@/modules/core/doc-templates/doc-templates.service'
import { deNghiService } from '@/modules/dept/warehouse/de-nghi.service'
import { DE_NGHI_NHAN, tongDuKien } from '@/lib/de-nghi'
import { resolveSignatures } from '@/lib/doc-templates'
import {
  PrintLetterhead,
  PrintMeta,
  PrintPage,
  PrintSignatures,
  PrintTitle,
} from '../../PrintSheet'

export const dynamic = 'force-dynamic'

const so = (n: number | null) =>
  n == null ? '' : n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })

/**
 * IN "GIẤY ĐỀ NGHỊ MUA VẬT TƯ" (0236, Q7) — bố cục chép tờ giấy Kho vật tư đang
 * dùng (ảnh Zalo 13/10/2026): Kính gửi công ty · Tôi tên · Bộ phận · bảng Stt /
 * Tên vật tư / ĐVT / Số lượng / Đơn giá / Mục đích sử dụng · Tổng cộng · ô ký
 * "Duyệt của lãnh đạo" và "Người đề nghị". Người duyệt + giờ duyệt điền sẵn khi
 * phiếu đã duyệt (Đ2) — dùng khi kế toán cần lưu bản giấy.
 */
export default async function DeNghiPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const { id } = await params
  const [{ phieu: p }, company, tpl] = await Promise.all([
    deNghiService.get(user, id),
    settingsService.getAll(),
    docTemplatesService.get('DNM'),
  ])
  const t = tongDuKien(p.lines)
  const chuaChinhThuc =
    p.status === 'draft' || p.status === 'pending' || p.status === 'cancelled'

  return (
    <PrintPage orientation="portrait" maxWidth="max-w-3xl" pdfName={p.code}>
      <PrintLetterhead
        company={company}
        date={new Date(p.submitted_at ?? p.created_at)}
        nationalHeading={tpl.national_heading}
      />
      <PrintTitle vi={tpl.title_vi} en={tpl.title_en ?? undefined} />
      <div className="mb-3 text-center text-[12px]">
        Số: <b className="font-mono">{p.code}</b>
        {chuaChinhThuc && (
          <b> — {DE_NGHI_NHAN[p.status].toUpperCase()} (chưa được duyệt)</b>
        )}
      </div>
      <PrintMeta
        rows={[
          ['Kính gửi:', company.company_name ?? 'Ban Giám đốc công ty'],
          ['Tôi tên:', p.requested_by_name ?? '……………………'],
          ['Bộ phận:', p.department],
          ['Cần trước ngày:', p.need_by ? p.need_by.split('-').reverse().join('/') : ''],
          ['Cho lệnh SX:', p.lsx_code ?? ''],
          ['Đề nghị mua số vật tư sau:', ''],
        ]}
      />
      <table className="mt-1 w-full border-collapse border border-black text-center text-[12px]">
        <thead>
          <tr className="font-semibold">
            <td className="border border-black px-1">Stt</td>
            <td className="border border-black px-2">Tên vật tư</td>
            <td className="border border-black px-1">Mã</td>
            <td className="border border-black px-1">ĐVT</td>
            <td className="border border-black px-1">Số lượng</td>
            <td className="border border-black px-1">Đơn giá</td>
            <td className="border border-black px-1">Thành tiền</td>
            <td className="border border-black px-2">Mục đích sử dụng</td>
          </tr>
        </thead>
        <tbody>
          {p.lines.map((l, i) => {
            const sl = l.approved_qty ?? l.qty
            return (
              <tr key={l.id}>
                <td className="border border-black px-1">{i + 1}</td>
                <td className="border border-black px-2 text-left">{l.name}</td>
                <td className="border border-black px-1 font-mono text-[11px]">
                  {l.code ?? ''}
                </td>
                <td className="border border-black px-1">{l.unit}</td>
                <td className="border border-black px-1 text-right">{so(sl)}</td>
                <td className="border border-black px-1 text-right">
                  {so(l.unit_price)}
                </td>
                <td className="border border-black px-1 text-right">
                  {l.unit_price == null ? '' : so(Math.round(sl * l.unit_price))}
                </td>
                <td className="border border-black px-2 text-left text-[11px]">
                  {[l.purpose, l.note].filter(Boolean).join(' · ')}
                </td>
              </tr>
            )
          })}
          <tr className="font-semibold">
            <td className="border border-black px-2 text-left" colSpan={6}>
              TỔNG CỘNG (chưa VAT, chưa vận chuyển)
            </td>
            <td className="border border-black px-1 text-right">{so(t.tong)}</td>
            <td className="border border-black px-2 text-left text-[11px] font-normal">
              {t.thieuGia > 0 ? `${t.thieuGia} dòng chưa có giá` : ''}
            </td>
          </tr>
        </tbody>
      </table>
      {p.note && <div className="mt-2 text-[12px]">— Ghi chú: {p.note}</div>}
      <PrintSignatures
        space="mt-8"
        cols={resolveSignatures(tpl.signatures, {
          names: {
            creator: p.requested_by_name,
            approver: p.approved_by_name
              ? `${p.approved_by_name} · ${new Date(p.approved_at ?? '').toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`
              : null,
          },
        })}
      />
    </PrintPage>
  )
}
