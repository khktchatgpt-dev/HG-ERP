'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import { downloadCsv } from '@/lib/csv'
import { isoToVn, todayVn } from '@/lib/date-vn'
import { NGUONG_DU_TOAN } from '@/lib/hang-muc'
import { poStatusLabel, poStatusTone } from '@/lib/po-status'
import { goiYMucDich } from '@/lib/po-muc-dich'
import type { ProjectPo, ProjectRow } from '@/modules/dept/supply/projects.service'
import { DaiSo, DauTrang, HangLoc, MenuBa, Nhan, NUM, Nut, OSo, TD, TF, TH, ThanhDuoi, Trang, type Tone } from '../../_erp/ui' // prettier-ignore
import { HangMucSheet } from '../hang-muc-sheet'
import { tien } from '../hang-muc.shared'

/** Ngày theo giờ Việt Nam của một mốc timestamptz (cắt chuỗi UTC là lệch ngày sau 17h). */
const ngay = (ts: string) => isoToVn(todayVn(new Date(ts)))
const TONE: Record<string, Tone> = {
  gray: 'neutral',
  amber: 'warn',
  blue: 'run',
  green: 'done',
  red: 'stop',
}
const pctOf = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null)

/**
 * HỒ SƠ HẠNG MỤC — chép khối "Hồ sơ hạng mục" của bản vẽ Đầu đơn mua, viết tay
 * không qua kit. "Việc này đã tiêu bao nhiêu, qua những đơn nào?" Hạng mục không
 * có vòng duyệt (chỉ mở / đóng) nên chỗ của trạng thái là dải 5 ô số, mỗi ô kèm
 * mẫu số; số đi qua lib/hang-muc như danh sách.
 */
export function HoSoHangMucScreen({
  project: h,
  pos,
  canManage,
  kinds,
}: {
  project: ProjectRow
  pos: ProjectPo[]
  canManage: boolean
  kinds: string[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [sua, setSua] = useState(false)
  const so = h.so
  const mo = h.status === 'open'
  const cur = h.currency
  const vuot = h.budget != null ? so.ordered - h.budget : 0
  const khoa = !canManage ? 'Chỉ phòng Cung ứng' : undefined

  async function doiTrangThai() {
    try {
      await api(`/api/dept/supply/projects/${h.id}`, { method: 'PATCH', body: { status: mo ? 'closed' : 'open' } }) // prettier-ignore
      toast.success(mo ? `Đã đóng ${h.code}` : `Đã mở lại ${h.code}`, mo ? 'Không chọn được cho đơn mới; đơn cũ giữ nguyên.' : undefined) // prettier-ignore
      router.refresh()
    } catch (e) {
      toast.error('Không đổi được', apiErrorText(e))
    }
  }
  const xuat = () =>
    downloadCsv(`${h.code}.csv`, pos, [
      { key: 'code', header: 'Đơn' },
      { key: 'supplier_name', header: 'Nhà cung cấp' },
      { key: 'materials', header: 'Vật tư', get: (r) => r.materials.join(', ') },
      { key: 'status', header: 'Trạng thái', get: (r) => poStatusLabel(r.status) },
      { key: 'expected_at', header: 'Hẹn giao', get: (r) => isoToVn(r.expected_at) },
      { key: 'gross', header: 'Giá trị (gồm VAT)' },
      { key: 'received_net', header: 'Đã về (chưa VAT)' },
      { key: 'currency', header: 'Tiền tệ' },
    ])

  return (
    <Trang>
      <DauTrang
        eyebrow="Hạng mục ngoài sản xuất"
        title={
          <span className="flex items-center gap-2.5">
            <span className="font-mono">{h.code}</span>
            <span>{h.name}</span>
          </span>
        }
        status={
          mo ? (
            <Nhan tone="run">Đang mở</Nhan>
          ) : (
            <Nhan>Đã đóng {h.closed_at ? ngay(h.closed_at) : ''}</Nhan>
          )
        }
        actions={
          <>
            <Nut
              chinh
              khoa={
                khoa ??
                (!mo ? 'Hạng mục đã đóng — mở lại (⋯) trước khi đặt thêm' : undefined)
              }
              href={`/mua-hang/don/moi?hm=${h.id}`}
            >
              + Đơn mua cho hạng mục
            </Nut>
            <Nut khoa={khoa} onClick={() => setSua(true)}>
              Sửa
            </Nut>
            <MenuBa
              items={[
                {
                  label: mo ? 'Đóng hạng mục' : 'Mở lại hạng mục',
                  khoa,
                  onClick: () => void doiTrangThai(),
                },
                { label: 'Xuất Excel đơn của hạng mục', onClick: xuat },
              ]}
            />
          </>
        }
        facts={[
          { k: 'Loại', v: h.kind },
          { k: 'Phụ trách', v: h.owner_name ?? '—' },
          { k: 'Mở từ', v: <span className="font-mono">{ngay(h.created_at)}</span> },
          ...(h.note ? [{ k: 'Ghi chú', v: h.note }] : []),
          ...(h.chu_y.length
            ? [{ k: 'Cần chú ý', v: h.chu_y.join(' · '), tone: 'warn' as const }]
            : []),
        ]}
      />
      <DaiSo>
        <OSo
          k="Dự toán"
          v={h.budget != null ? tien(h.budget, cur) : '—'}
          sub={
            h.budget != null
              ? 'chỉ để theo dõi — không chặn đơn'
              : 'chưa đặt — bấm Sửa để thêm'
          }
        />
        <OSo
          k="Đã đặt"
          v={tien(so.ordered, cur)}
          sub={`${so.pct != null ? `${so.pct}% dự toán · ` : ''}${so.n} đơn, trừ nháp + huỷ${vuot > 0.005 ? ` · vượt ${tien(vuot, cur)}` : ''}`}
          tone={so.pct != null && so.pct >= NGUONG_DU_TOAN ? 'warn' : undefined}
          thanh={so.pct ?? undefined}
        />
        <OSo
          k="Đã về"
          v={so.n ? tien(so.received_net, cur) : '—'}
          sub={
            so.thieu_gia
              ? `${so.thieu_gia} đơn phiếu nhập thiếu giá — số này đang THIẾU`
              : so.loi_tai_chinh
                ? `${so.loi_tai_chinh} đơn chưa đọc được — số này đang THIẾU`
                : `${pctOf(so.received_net, so.ordered) ?? 0}% đã đặt · theo phiếu kho, chưa VAT`
          }
          tone={so.thieu_gia || so.loi_tai_chinh ? 'warn' : undefined}
        />
        <OSo
          k="Đã có hoá đơn"
          v={so.n ? tien(so.invoiced_gross, cur) : '—'}
          sub={`${so.co_hoa_don} / ${so.n} đơn · gồm VAT`}
        />{' '}
        <OSo
          k="Đã trả"
          v={so.n ? tien(so.paid, cur) : '—'}
          sub={
            so.owed > 0.005
              ? `còn nợ NCC ${tien(so.owed, cur)}`
              : 'không còn nợ trên hoá đơn'
          }
          tone={so.owed > 0.005 ? 'warn' : undefined}
        />
      </DaiSo>
      <HangLoc>
        <span>
          <b className="text-[var(--ink)]">{pos.length} đơn</b> · {so.nhap} nháp
        </span>
        <span className="ml-auto">
          <Nut onClick={xuat}>Excel</Nut>
        </span>
      </HangLoc>
      <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
        <table
          className="w-full border-separate border-spacing-0"
          aria-label={`Đơn mua của ${h.code}`}
        >
          <thead>
            <tr>
              <th className={TH}>Đơn</th>
              <th className={TH}>Nhà cung cấp</th>
              <th className={TH}>Vật tư</th>
              <th className={TH}>Trạng thái</th>
              <th className={TH}>Hẹn giao</th>
              <th className={`${TH} text-right`}>Giá trị (gồm VAT)</th>
              <th className={`${TH} text-right`} title="Theo phiếu kho, chưa VAT">
                Đã về
              </th>
            </tr>
          </thead>
          <tbody>
            {pos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--ink-2)]">
                  <b className="text-[var(--ink)]">Hạng mục chưa có đơn mua nào</b>
                  <div className="mt-1 text-[12px]">
                    {mo && canManage ? (
                      <Link
                        href={`/mua-hang/don/moi?hm=${h.id}`}
                        className="font-semibold text-[var(--act)] hover:underline"
                      >
                        Soạn đơn đầu tiên cho hạng mục →
                      </Link>
                    ) : (
                      'Mở lại hạng mục rồi soạn đơn.'
                    )}
                  </div>
                </td>
              </tr>
            )}
            {pos.map((r) => (
              <DongDon key={r.id} r={r} cur={cur} />
            ))}
          </tbody>
          {so.n > 0 && (
            <tfoot>
              <tr>
                <td colSpan={5} className={TF}>
                  Cộng {so.n} đơn đã đặt
                  <span className="ml-1.5 font-normal text-[var(--ink-3)]">
                    — KHÔNG gồm
                    {so.nhap ? ` ${so.nhap} nháp (${tien(so.nhap_gross, cur)}),` : ''} đơn
                    huỷ, phí vận chuyển
                    {so.khac_tien_te ? `, ${so.khac_tien_te} đơn khác tiền tệ` : ''}
                  </span>
                </td>
                <td className={`${TF} ${NUM}`}>{tien(so.ordered, cur)}</td>
                <td className={`${TF} ${NUM}`}>{tien(so.received_net, cur)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <ThanhDuoi
        left={<span>Bấm mã đơn để mở đơn mua</span>}
        right={`${pos.length} đơn · ${so.nhap} nháp`}
      />
      {sua && (
        <HangMucSheet
          ban={{ id: h.id, code: h.code, name: h.name, kind: h.kind, budget: h.budget, note: h.note, currency: cur, owner_name: h.owner_name }} // prettier-ignore
          goiYLoai={goiYMucDich(kinds)}
          onClose={() => setSua(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </Trang>
  )
}

/** Một đơn của hạng mục — nháp / huỷ chữ nhạt (không cộng vào tổng). */
function DongDon({ r, cur }: { r: ProjectPo; cur: string }) {
  const nhat = r.status === 'draft' || r.status === 'cancelled'
  const m = (n: number | null) =>
    n ? (r.currency === cur ? tien(n, cur) : `${tien(n, r.currency)} ${r.currency}`) : ''
  return (
    <tr className="hover:bg-[var(--surface-hover)]">
      <td className={TD}>
        <Link
          href={`/mua-hang/don/${r.id}`}
          className="font-mono font-semibold text-[var(--act)] hover:underline"
        >
          {r.code}
        </Link>
      </td>
      <td className={TD}>{r.supplier_name}</td>
      <td
        className={`${TD} max-w-[360px] truncate text-[var(--ink-3)]`}
        title={r.materials.join(', ')}
      >
        {r.materials.slice(0, 2).join(', ')}
        {r.materials.length > 2 ? ` +${r.materials.length - 2} mã` : ''}
      </td>
      <td className={TD}>
        <span className="inline-flex items-center gap-1.5">
          <Nhan tone={TONE[poStatusTone(r.status)] ?? 'neutral'}>
            {poStatusLabel(r.status)}
          </Nhan>
          {r.overdue && <Nhan tone="stop">Quá hẹn</Nhan>}
        </span>
      </td>
      <td className={`${TD} font-mono`}>{isoToVn(r.expected_at)}</td>
      <td className={`${TD} ${NUM} ${nhat ? 'text-[var(--ink-3)]' : ''}`}>
        {m(r.gross)}
      </td>
      <td
        className={`${TD} ${NUM}`}
        title={
          r.missing_price_lines
            ? `${r.missing_price_lines} dòng đã về nhưng phiếu nhập không có giá — tính 0`
            : undefined
        }
      >
        {' '}
        {m(r.received_net)}
        {r.missing_price_lines > 0 && (
          <span className="ml-1.5">
            <Nhan tone="warn">thiếu giá</Nhan>
          </span>
        )}
        {r.finance_error && (
          <span className="ml-1.5">
            <Nhan tone="stop">chưa đọc được</Nhan>
          </span>
        )}
      </td>
    </tr>
  )
}
