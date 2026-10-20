'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, TriangleAlert, X } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { kiemKeHoach, type LenhXuat, type LotInput } from '@/lib/ke-hoach-xuat'
import { NUM, TD, TH, ToolBtn } from '../_erp/ui'

/**
 * SALE CHIA ĐỢT CHO MỘT LỆNH (0222, 06/10/2026) — chủ dự án: "làm màn chia đợt
 * riêng cho sale". Lưới kiểu bảng tính, đúng cột sổ Excel của Sale (ảnh IBIZA):
 * Order # · PO khách · PO tham chiếu · Ngày xuất · SL từng SP · Ghi chú.
 *
 * Lưu = thay cả bộ kế hoạch của lệnh; KHÔNG đụng dòng lệnh nên KHÔNG tạo bản
 * chỉnh sửa lệnh. Kiểm bằng CHÍNH hàm server dùng (`kiemKeHoach`).
 * Ctrl+V ở một ô dán khối từ Excel sang phải / xuống dưới, tự thêm hàng.
 */

type Hang = {
  id: string
  order_no: string
  po_no: string
  po_ref: string
  ngay: string // dd/mm/yyyy như người gõ
  note: string
  sl: Record<string, string>
}

let dem = 0
const idMoi = () => `h${++dem}`

/** "1.864" / "1,864" / "42" → số; ô trống → 0; rác → NaN. */
function docSo(s: string): number {
  const t = s.replace(/\s/g, '')
  if (!t) return 0
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return Number(t.replace(/[.,]/g, ''))
  return Number(t.replace(',', '.'))
}

/** dd/mm/yyyy · dd-mm-yy · yyyy-mm-dd → yyyy-mm-dd; trống → null; sai → 'x'. */
function docNgay(s: string): string | null {
  const t = s.trim()
  if (!t) return null
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t)
  if (!m) return 'x'
  const y = m[3].length === 2 ? `20${m[3]}` : m[3]
  const d = m[1].padStart(2, '0')
  const mo = m[2].padStart(2, '0')
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return 'x'
  return `${y}-${mo}-${d}`
}
const hienNgay = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

/** Hàng khởi đầu: kế hoạch Sale đã lưu; chưa có thì từ đợt đang đọc của lệnh. */
function batDau(l: LenhXuat): Hang[] {
  if (l.ke_hoach)
    return l.ke_hoach.map((k) => ({
      id: idMoi(),
      order_no: k.order_no ?? '',
      po_no: k.po_no ?? '',
      po_ref: k.po_ref ?? '',
      ngay: hienNgay(k.ship_date),
      note: k.note ?? '',
      sl: Object.fromEntries(k.lines.map((x) => [x.product_key, String(x.qty)])),
    }))
  return l.dots.map((d) => ({
    id: idMoi(),
    order_no: '',
    po_no: d.label === '—' ? '' : d.label,
    po_ref: '',
    ngay: d.date_src === 'nhom' ? hienNgay(d.ship_date) : '',
    note: '',
    sl: Object.fromEntries(Object.entries(d.sl).map(([k, v]) => [k, String(v)])),
  }))
}

export function ChiaDot({ l, onClose }: { l: LenhXuat; onClose: () => void }) {
  const router = useRouter()
  const [hangs, setHangs] = useState<Hang[]>(() => batDau(l))
  const [busy, setBusy] = useState(false)
  const [loiLuu, setLoiLuu] = useState<string | null>(null)

  /** Cột nhập theo thứ tự trên lưới — dùng cho dán khối. */
  const cot = useMemo(
    () => [
      'order_no',
      'po_no',
      'po_ref',
      'ngay',
      ...l.sps.map((s) => `sp:${s.key}`),
      'note',
    ],
    [l.sps],
  )

  const lots: LotInput[] = hangs.map((h) => {
    const nd = docNgay(h.ngay)
    return {
      po_no: h.po_no.trim() || null,
      po_ref: h.po_ref.trim() || null,
      order_no: h.order_no.trim() || null,
      ship_date: nd === 'x' ? null : nd,
      note: h.note.trim() || null,
      lines: l.sps.map((s) => ({ product_key: s.key, qty: docSo(h.sl[s.key] ?? '') })),
    }
  })
  const kiem = kiemKeHoach(lots, l.sps)
  const loiNhap = [
    ...hangs.flatMap((h, i) => (docNgay(h.ngay) === 'x' ? [`Đợt ${i + 1}: ngày "${h.ngay}" không đọc được (dd/mm/yyyy)`] : [])), // prettier-ignore
    ...hangs.flatMap(
      (h, i) =>
      l.sps.flatMap((s) => (Number.isNaN(docSo(h.sl[s.key] ?? '')) ? [`Đợt ${i + 1}: SL "${h.sl[s.key]}" ở ${s.code} không phải số`] : [])), // prettier-ignore
    ),
  ]
  const loi = [...loiNhap, ...kiem.loi]

  const doi = (id: string, field: string, v: string) =>
    setHangs((hs) =>
      hs.map((h) =>
        h.id !== id
          ? h
          : field.startsWith('sp:')
            ? { ...h, sl: { ...h.sl, [field.slice(3)]: v } }
            : { ...h, [field]: v },
      ),
    )

  /** Dán khối từ Excel bắt đầu ở (hàng, cột) — sang phải, xuống dưới; thiếu hàng thì thêm. */
  function dan(e: React.ClipboardEvent<HTMLInputElement>, hang: number, cotDau: number) {
    const txt = e.clipboardData.getData('text/plain')
    if (!/[\t\n]/.test(txt)) return // một ô thì để trình duyệt dán bình thường
    e.preventDefault()
    const rows = txt
      .replace(/\r/g, '')
      .replace(/\n$/, '')
      .split('\n')
      .map((r) => r.split('\t'))
    setHangs((hs) => {
      const out = [...hs]
      rows.forEach((cells, ri) => {
        const idx = hang + ri
        while (out.length <= idx) out.push({ id: idMoi(), order_no: '', po_no: '', po_ref: '', ngay: '', note: '', sl: {} }) // prettier-ignore
        let h = { ...out[idx], sl: { ...out[idx].sl } }
        cells.forEach((v, ci) => {
          const f = cot[cotDau + ci]
          if (!f) return
          if (f.startsWith('sp:')) h = { ...h, sl: { ...h.sl, [f.slice(3)]: v.trim() } }
          else h = { ...h, [f]: v.trim() }
        })
        out[idx] = h
      })
      return out
    })
  }

  async function luu() {
    setBusy(true)
    setLoiLuu(null)
    try {
      await api(`/api/dept/sales/ship-plan/${l.lsx_id}`, {
        method: 'PUT',
        body: { lots },
      })
      router.refresh()
      onClose()
    } catch (e) {
      setLoiLuu(apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const o =
    'h-8 w-full border-0 bg-transparent px-2 text-[13px] outline-none focus:bg-[var(--accent)] focus:ring-1 focus:ring-[var(--primary)]'
  const pin = (left: number, w: number) => ({ left, minWidth: w, width: w })
  const tongXep = (k: string) => kiem.daXep[k] ?? 0

  return (
    <div>
      <div className="border-border bg-muted/40 flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <p className="text-muted-foreground text-xs">
          Gõ hoặc <b>dán từ Excel</b> (Ctrl+V ở ô đầu khối — dán sang phải, xuống dưới).
          Ngày dạng dd/mm/yyyy. Lưu không tạo bản chỉnh sửa lệnh.
        </p>
        <div className="flex items-center gap-2">
          <ToolBtn
            icon={Plus}
            onClick={() =>
              setHangs((hs) => [
                ...hs,
                {
                  id: idMoi(),
                  order_no: '',
                  po_no: '',
                  po_ref: '',
                  ngay: '',
                  note: '',
                  sl: {},
                },
              ])
            }
          >
            Thêm đợt
          </ToolBtn>
          <ToolBtn icon={X} onClick={onClose}>
            Huỷ
          </ToolBtn>
          <button
            type="button"
            disabled={busy || loi.length > 0 || hangs.length === 0}
            onClick={luu}
            title={loi.length ? loi[0] : undefined}
            className="disabled:bg-muted disabled:text-muted-foreground inline-flex h-8 items-center rounded-sm bg-[var(--primary)] px-3 text-[13px] font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:cursor-not-allowed"
          >
            {busy ? 'Đang lưu…' : `Lưu kế hoạch (${hangs.length} đợt)`}
          </button>
        </div>
      </div>
      {(loi.length > 0 || loiLuu) && (
        <div className="border-b border-[var(--stop)]/30 bg-[var(--stop)]/10 px-3 py-2 text-[13px] text-[var(--stop)]">
          <div className="flex items-center gap-1.5 font-semibold">
            <TriangleAlert className="h-4 w-4" /> Chưa lưu được — sửa{' '}
            {loiLuu ? 'lỗi dưới' : `${loi.length} chỗ`}:
          </div>
          <ul className="ml-6 list-disc">
            {loiLuu && <li>{loiLuu}</li>}
            {loi.slice(0, 6).map((x) => (
              <li key={x}>{x}</li>
            ))}
            {loi.length > 6 && <li>… và {loi.length - 6} lỗi nữa</li>}
          </ul>
        </div>
      )}
      <div className="max-h-[560px] overflow-auto">
        <table className="border-separate border-spacing-0">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className={`${TH} sticky z-30 border-r text-right`} style={pin(0, 40)}>
                #
              </th>
              <th className={`${TH} sticky z-30 border-r`} style={pin(40, 80)}>
                Order #
              </th>
              <th className={`${TH} sticky z-30 border-r`} style={pin(120, 150)}>
                PO khách
              </th>
              <th className={`${TH} sticky z-30 border-r`} style={pin(270, 110)}>
                PO tham chiếu
              </th>
              <th className={`${TH} sticky z-30 border-r`} style={pin(380, 110)}>
                Ngày xuất
              </th>
              {l.sps.map((s) => (
                <th
                  key={s.key}
                  className={`${TH} min-w-[96px] border-r text-right whitespace-normal`}
                  title={s.name ?? s.code}
                >
                  <span className="text-foreground block font-mono text-[11px] font-semibold">
                    {s.code}
                  </span>
                  <span className="block max-w-[120px] truncate text-[11px] font-normal">
                    {s.name}
                  </span>
                </th>
              ))}
              <th className={`${TH} min-w-[180px] border-r`}>Ghi chú</th>
              <th className={`${TH} w-9`} />
            </tr>
          </thead>
          <tbody>
            {hangs.map((h, ri) => (
              <tr key={h.id} className="group">
                <td
                  className={`${TD} ${NUM} bg-card text-muted-foreground sticky z-10 border-r text-xs`}
                  style={pin(0, 40)}
                >
                  {ri + 1}
                </td>
                {(['order_no', 'po_no', 'po_ref', 'ngay'] as const).map((f, ci) => (
                  <td
                    key={f}
                    className={`border-border bg-card sticky z-10 border-r border-b p-0 ${f === 'ngay' && docNgay(h.ngay) === 'x' ? 'bg-[var(--stop)]/10' : ''}`}
                    style={pin([40, 120, 270, 380][ci], [80, 150, 110, 110][ci])}
                  >
                    <input
                      value={h[f]}
                      onChange={(e) => doi(h.id, f, e.target.value)}
                      onPaste={(e) => dan(e, ri, ci)}
                      placeholder={f === 'ngay' ? 'dd/mm/yyyy' : ''}
                      aria-label={`${['Order #', 'PO khách', 'PO tham chiếu', 'Ngày xuất'][ci]} đợt ${ri + 1}`}
                      className={`${o} ${f === 'ngay' ? 'font-mono tabular-nums' : ''}`}
                    />
                  </td>
                ))}
                {l.sps.map((s, si) => {
                  const v = h.sl[s.key] ?? ''
                  return (
                    <td
                      key={s.key}
                      className={`border-border border-r border-b p-0 ${Number.isNaN(docSo(v)) ? 'bg-[var(--stop)]/10' : ''}`}
                    >
                      <input
                        value={v}
                        inputMode="numeric"
                        onChange={(e) => doi(h.id, `sp:${s.key}`, e.target.value)}
                        onPaste={(e) => dan(e, ri, 4 + si)}
                        aria-label={`SL ${s.code} đợt ${ri + 1}`}
                        className={`${o} text-right font-mono font-semibold tabular-nums`}
                      />
                    </td>
                  )
                })}
                <td className="border-border border-r border-b p-0">
                  <input
                    value={h.note}
                    onChange={(e) => doi(h.id, 'note', e.target.value)}
                    onPaste={(e) => dan(e, ri, 4 + l.sps.length)}
                    aria-label={`Ghi chú đợt ${ri + 1}`}
                    className={o}
                  />
                </td>
                <td className="border-border border-b px-1 text-center">
                  <button
                    type="button"
                    onClick={() => setHangs((hs) => hs.filter((x) => x.id !== h.id))}
                    aria-label={`Xoá đợt ${ri + 1}`}
                    className="text-muted-foreground hover:text-[var(--stop)]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 z-20">
            <tr>
              <td
                colSpan={5}
                className="border-border sticky left-0 z-30 h-8 border-t border-r bg-[var(--accent)] px-3 text-xs font-bold"
              >
                TỔNG SỐ CÁI đã xếp
              </td>
              {l.sps.map((s) => (
                <td
                  key={s.key}
                  className={`border-border h-8 border-t border-r bg-[var(--accent)] px-2 ${NUM} text-[13px] font-bold`}
                >
                  {tongXep(s.key).toLocaleString('vi-VN')}
                </td>
              ))}
              <td colSpan={2} className="border-border border-t bg-[var(--accent)]" />
            </tr>
            <tr>
              <td
                colSpan={5}
                className="border-border bg-muted sticky left-0 z-30 h-8 border-t border-r px-3 text-xs font-semibold"
              >
                SL lệnh · <span className="text-muted-foreground">chưa xếp đợt</span>
              </td>
              {l.sps.map((s) => {
                const con = kiem.conLai[s.key] ?? s.qty
                return (
                  <td
                    key={s.key}
                    className={`border-border bg-muted h-8 border-t border-r px-2 ${NUM} text-xs`}
                  >
                    {s.qty.toLocaleString('vi-VN')} ·{' '}
                    <b
                      className={
                        con < 0
                          ? 'text-[var(--stop)]'
                          : con > 0
                            ? 'text-[var(--warn)]'
                            : 'text-[var(--done)]'
                      }
                    >
                      {con.toLocaleString('vi-VN')}
                    </b>
                  </td>
                )
              })}
              <td colSpan={2} className="border-border bg-muted border-t" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
