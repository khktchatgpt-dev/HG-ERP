'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { isoToVn, todayVn } from '@/lib/date-vn'
import {
  DE_NGHI_NHAN,
  DE_NGHI_TONE,
  dongTrong,
  tongDuKien,
  vuongGuiDuyet,
} from '@/lib/de-nghi'
import { useBeRong } from '@/lib/use-be-rong'
import {
  Action,
  ActionGroup,
  ActionPane,
  Btn,
  CellHint,
  Code,
  Combobox,
  CommitBar,
  DateInput,
  DocHead,
  Grid,
  GridBody,
  GridBtn,
  GridFoot,
  GridHead,
  GridRow,
  NoticeBar,
  NumInput,
  ScreenFrame,
  StatusBar,
  StatusTrack,
  Tag,
  TextInput,
  Th,
  useToast,
} from '@/components/kit'
import { HuyPhieuSheet } from './huy-phieu'
import {
  MUC_DICH_GOI_Y,
  type DongForm,
  type GiaGoiY,
  type PhieuForm,
} from './de-nghi.shared'

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
/** Số kiểu VN: "1.390" = 1390 · "2,5" = 2,5. Rỗng = null. */
const docSo = (v: string): number | null => {
  const t = v.trim()
  if (!t) return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const gio = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      })
    : ''

type VatTuChon = { id: string; code: string; name: string; unit: string }
const BUOC = ['Nháp', 'Chờ duyệt', 'Đã duyệt', 'Đang mua', 'Xong']
const BUOC_AT = {
  draft: 0,
  pending: 1,
  approved: 2,
  ordering: 3,
  done: 4,
  cancelled: 0,
} as const
let khoaTam = 0

/**
 * ĐỀ NGHỊ MUA VẬT TƯ — Kho lập phiếu (0236 · Đ1, bản vẽ DN-1
 * https://claude.ai/artifact/6bFb19HuFtSzT8y2wqT17g, duyệt 13/10/2026). Khuôn F:
 * lưới là nhân vật chính, đầu phiếu một dải, thanh chốt đáy nói vì sao chưa
 * gửi được bằng câu bấm được.
 *
 * Số hoá tờ giấy anh Hào gửi Zalo 13/10: cột Tên · ĐVT · SL · Đơn giá · Mục đích
 * giữ nguyên; thêm TỒN HIỆN TẠI (lãnh đạo thấy vì sao cần mua) và giá mua gần
 * nhất tự điền (Q4). Thứ chưa có mã thì gõ tên tự do (Q3).
 *
 * Sửa được khi phiếu còn NHÁP và người xem có quyền lập; còn lại chỉ xem.
 * Luật màn hẹp: < 900px bỏ cột Thành tiền (tổng vẫn ở thanh chốt), tồn xuống
 * thành dòng gợi ý dưới ô số lượng.
 */
export function DeNghiScreen({
  phieu,
  lsx,
  canManage,
}: {
  phieu: PhieuForm
  lsx: { id: string; code: string }[]
  canManage: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const sua = canManage && phieu.status === 'draft'
  const [head, setHead] = useState({
    department: phieu.department,
    need_by: phieu.need_by,
    note: phieu.note,
    production_order_id: phieu.production_order_id,
  })
  const [rows, setRows] = useState<DongForm[]>(phieu.lines)
  const [busy, setBusy] = useState(false)
  const [dangTra, setDangTra] = useState(false)
  const [moHuy, setMoHuy] = useState(false)
  const khung = useRef<HTMLDivElement>(null)
  const hep = useBeRong(khung) < 900

  const patch = (i: number, p: Partial<DongForm>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const tong = useMemo(() => tongDuKien(rows), [rows])
  const vuong = useMemo(() => vuongGuiDuyet(rows), [rows])
  const soChuaMa = rows.filter((r) => !r.material_id && !dongTrong(r)).length
  const lsxChon = lsx.find((l) => l.id === head.production_order_id) ?? null

  async function timVatTu(q: string): Promise<VatTuChon[]> {
    const res = await api<{ rows: VatTuChon[] }>(
      `/api/dept/warehouse/materials?q=${encodeURIComponent(q)}&active_only=true&page_size=20`,
    )
    return res.rows.map((m) => ({ id: m.id, code: m.code, name: m.name, unit: m.unit }))
  }

  const focus = (id: string) =>
    setTimeout(() => {
      const el = document.getElementById(id) as HTMLInputElement | null
      el?.focus()
      el?.select?.()
    }, 0)

  async function chonVatTu(vt: VatTuChon) {
    const trung = rows.findIndex((r) => r.material_id === vt.id)
    if (trung >= 0) {
      toast.error(
        `${vt.code} đã có ở dòng ${trung + 1}`,
        'Một mã một dòng — sửa số ở dòng đó.',
      )
      focus(`dn-qty-${trung}`)
      return
    }
    setDangTra(true)
    let goiY: { ton: number; gia: GiaGoiY | null } = { ton: 0, gia: null }
    try {
      const res = await api<{
        goi_y: Record<string, { ton: number; gia: GiaGoiY | null }>
      }>(`/api/dept/warehouse/de-nghi/goi-y?ids=${vt.id}`)
      goiY = res.goi_y[vt.id] ?? goiY
    } catch (e) {
      toast.error('Không tra được tồn / giá gần nhất', apiErrorText(e))
    } finally {
      setDangTra(false)
    }
    const i = rows.length
    setRows((rs) => [
      ...rs,
      {
        key: `tam-${++khoaTam}`,
        material_id: vt.id,
        code: vt.code,
        name: vt.name,
        unit: vt.unit,
        ton: goiY.ton,
        qty: null,
        unit_price: goiY.gia?.unit_price ?? null,
        purpose: '',
        note: '',
        gia_goi_y: goiY.gia,
      },
    ])
    focus(`dn-qty-${i}`)
  }

  const themDongTuDo = () => {
    const i = rows.length
    setRows((rs) => [
      ...rs,
      {
        key: `tam-${++khoaTam}`,
        material_id: null,
        code: null,
        name: '',
        unit: '',
        ton: null,
        qty: null,
        unit_price: null,
        purpose: '',
        note: '',
        gia_goi_y: null,
      },
    ])
    focus(`dn-ten-${i}`)
  }

  const body = () => ({
    department: head.department.trim() || 'Kho vật tư',
    need_by: head.need_by || null,
    note: head.note.trim() || null,
    production_order_id: head.production_order_id,
    lines: rows
      .filter((r) => !dongTrong(r))
      .map((r) => ({
        material_id: r.material_id,
        name: r.name.trim(),
        unit: r.unit.trim(),
        qty: r.qty ?? 0,
        unit_price: r.unit_price,
        purpose: r.purpose.trim() || null,
        note: r.note.trim() || null,
      })),
  })

  /** Lưu nháp; trả id phiếu (phiếu mới thì vừa tạo). */
  async function luu(): Promise<string | null> {
    const b = body()
    if (b.lines.some((l) => !(l.qty > 0) || !l.name || !l.unit)) {
      const v = vuong.find((x) => x.dong != null)
      toast.error('Chưa lưu được', v?.cau ?? 'Có dòng chưa đủ tên / ĐVT / số lượng')
      if (v?.dong != null) focus(`dn-qty-${v.dong}`)
      return null
    }
    if (phieu.id) {
      await api(`/api/dept/warehouse/de-nghi/${phieu.id}`, { method: 'PUT', body: b })
      return phieu.id
    }
    const r = await api<{ id: string; code: string }>('/api/dept/warehouse/de-nghi', {
      method: 'POST',
      body: b,
    })
    return r.id
  }

  async function luuNhap() {
    setBusy(true)
    try {
      const id = await luu()
      if (!id) return
      toast.success('Đã lưu nháp', 'Phiếu chưa gửi — lãnh đạo chưa thấy.')
      if (!phieu.id) router.replace(`/warehouse/de-nghi/${id}`)
      else router.refresh()
    } catch (e) {
      toast.error('Lưu nháp không được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function guiDuyet() {
    if (vuong.length > 0) {
      const v = vuong[0]
      if (v.dong != null) focus(v.dong != null && rows[v.dong]?.material_id ? `dn-qty-${v.dong}` : `dn-ten-${v.dong}`) // prettier-ignore
      return
    }
    setBusy(true)
    try {
      const id = await luu()
      if (!id) return
      await api(`/api/dept/warehouse/de-nghi/${id}/gui`, { method: 'POST' })
      toast.success('Đã gửi lãnh đạo duyệt', 'Phiếu khoá lại; muốn sửa thì rút về nháp.')
      if (!phieu.id) router.replace(`/warehouse/de-nghi/${id}`)
      else router.refresh()
    } catch (e) {
      toast.error('Gửi duyệt không được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function rutVe() {
    if (!phieu.id) return
    setBusy(true)
    try {
      await api(`/api/dept/warehouse/de-nghi/${phieu.id}/rut`, { method: 'POST' })
      toast.success('Đã rút về nháp', 'Sửa xong gửi lại.')
      router.refresh()
    } catch (e) {
      toast.error('Rút về không được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function chepLink() {
    const url = `${window.location.origin}/warehouse/de-nghi/${phieu.id}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Đã chép đường dẫn', 'Dán vào Zalo để lãnh đạo mở thẳng phiếu.')
    } catch {
      toast.error('Không chép được', url)
    }
  }

  const blocked = !sua ? undefined : vuong.length > 0 ? vuong[0].cau : undefined
  const soCot = hep ? 8 : 9

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <ScreenFrame>
        <ActionPane>
          <ActionGroup label="Phiếu">
            {sua && (
              <Action
                primary
                onClick={() => void guiDuyet()}
                disabled={busy}
                title={blocked}
              >
                {busy ? 'Đang gửi…' : 'Gửi lãnh đạo duyệt'}
              </Action>
            )}
            {sua && (
              <Action icon="luuNhap" onClick={() => void luuNhap()} disabled={busy}>
                Lưu nháp
              </Action>
            )}
            {canManage && phieu.status === 'pending' && (
              <Action icon="quayLai" onClick={() => void rutVe()} disabled={busy}>
                Rút về nháp
              </Action>
            )}
            {canManage &&
              phieu.id &&
              (phieu.status === 'draft' || phieu.status === 'pending') && (
                <Action icon="huy" onClick={() => setMoHuy(true)} disabled={busy}>
                  Huỷ phiếu
                </Action>
              )}
          </ActionGroup>
          {phieu.id && phieu.status !== 'draft' && phieu.status !== 'cancelled' && (
            <ActionGroup label="Gửi">
              <Action icon="saoChep" onClick={() => void chepLink()}>
                Chép đường dẫn
              </Action>
            </ActionGroup>
          )}
          {phieu.id && (
            <ActionGroup label="Bản in">
              <Action
                icon="in"
                onClick={() => window.open(`/print/de-nghi/${phieu.id}`, '_blank')}
              >
                In giấy đề nghị
              </Action>
            </ActionGroup>
          )}
          <ActionGroup label="Sổ">
            <Action icon="so" onClick={() => router.push('/warehouse/de-nghi')}>
              Sổ đề nghị
            </Action>
          </ActionGroup>
        </ActionPane>

        <DocHead
          compact
          kind="Đề nghị mua vật tư"
          code={phieu.code ?? 'Phiếu mới'}
          sub={`${head.department} lập · lãnh đạo duyệt · Cung ứng lập đơn mua · người đề nghị ${phieu.nguoi_de_nghi}`}
        >
          {phieu.status === 'cancelled' ? (
            <Tag tone={DE_NGHI_TONE.cancelled}>{DE_NGHI_NHAN.cancelled}</Tag>
          ) : (
            <StatusTrack label="Phiếu" steps={BUOC} at={BUOC_AT[phieu.status]} />
          )}
        </DocHead>

        {phieu.status === 'draft' && phieu.rejected_at && (
          <NoticeBar tone="stop" tag="Bị từ chối">
            {phieu.rejected_by_name ?? 'Lãnh đạo'} từ chối lúc {gio(phieu.rejected_at)}: “
            {phieu.rejected_reason}”. Sửa theo lý do rồi gửi lại.
          </NoticeBar>
        )}
        {phieu.status === 'pending' && (
          <NoticeBar tone="warn" tag="Chờ duyệt">
            Đã gửi lúc {gio(phieu.submitted_at)} — lãnh đạo đã nhận thông báo và duyệt
            trên hệ thống (cả trên điện thoại). Cần nhắc thì bấm “Chép đường dẫn” gửi
            Zalo. Muốn sửa thì rút về nháp.
          </NoticeBar>
        )}
        {(phieu.status === 'approved' || phieu.status === 'ordering') &&
          phieu.approved_at && (
            <NoticeBar tone="neutral" tag="Đã duyệt">
              {phieu.approved_by_name ?? 'Lãnh đạo'} duyệt lúc {gio(phieu.approved_at)}
              {phieu.lines.some((l) => l.approved_qty != null) &&
                ` · sửa số ${phieu.lines.filter((l) => l.approved_qty != null).length} dòng (cột Số lượng ghi số duyệt)`}
              . Cung ứng lập đơn mua từ phiếu này.
            </NoticeBar>
          )}
        {phieu.status === 'cancelled' && (
          <NoticeBar tone="neutral" tag="Đã huỷ">
            Huỷ lúc {gio(phieu.cancelled_at)} · lý do: {phieu.cancel_reason}
          </NoticeBar>
        )}

        {/* Đầu phiếu một dải (khuôn F): bộ phận · cần trước · lệnh · ghi chú. */}
        <div className="text-k-sm flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-[var(--hair)] bg-[var(--surface-card)] px-[var(--gutter)] py-2">
          <label className="inline-flex items-center gap-2">
            <span className="text-k-label font-semibold tracking-[.06em] whitespace-nowrap text-[var(--ink-3)] uppercase">
              Bộ phận
            </span>
            {sua ? (
              <TextInput
                value={head.department}
                onCommit={(v) => setHead((h) => ({ ...h, department: v }))}
                label="Bộ phận đề nghị"
                style={{ width: 150 }}
              />
            ) : (
              <b>{head.department}</b>
            )}
          </label>
          <span className="inline-flex items-center gap-2">
            <span className="text-k-label font-semibold tracking-[.06em] whitespace-nowrap text-[var(--ink-3)] uppercase">
              Ngày
            </span>
            <b className="num">
              {isoToVn(
                phieu.created_at ? todayVn(new Date(phieu.created_at)) : todayVn(),
              )}
            </b>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="text-k-label font-semibold tracking-[.06em] whitespace-nowrap text-[var(--ink-3)] uppercase">
              Cần trước
            </span>
            {sua ? (
              <DateInput
                value={head.need_by}
                onChange={(v) => setHead((h) => ({ ...h, need_by: v }))}
                label="Cần trước ngày"
              />
            ) : (
              <b className="num">{head.need_by ? isoToVn(head.need_by) : '—'}</b>
            )}
          </span>
          <span className="inline-flex min-w-0 items-center gap-2">
            <span className="text-k-label font-semibold tracking-[.06em] whitespace-nowrap text-[var(--ink-3)] uppercase">
              Lệnh SX
            </span>
            {sua ? (
              <Combobox
                value={head.production_order_id ?? ''}
                onChange={(v) =>
                  setHead((h) => ({ ...h, production_order_id: v || null }))
                }
                options={[
                  { value: '', label: 'Không gắn lệnh' },
                  ...lsx.map((l) => ({ value: l.id, label: l.code })),
                ]}
                label="Lệnh sản xuất (tuỳ chọn)"
                width={190}
              />
            ) : (
              <b className="num">{lsxChon?.code ?? '—'}</b>
            )}
          </span>
          <label className="inline-flex min-w-0 flex-1 basis-[260px] items-center gap-2">
            <span className="text-k-label font-semibold tracking-[.06em] whitespace-nowrap text-[var(--ink-3)] uppercase">
              Ghi chú
            </span>
            {sua ? (
              <TextInput
                value={head.note}
                onCommit={(v) => setHead((h) => ({ ...h, note: v }))}
                placeholder="VD: cấp phục vụ sản xuất tuần 42"
                label="Ghi chú chung"
                style={{ width: '100%' }}
              />
            ) : (
              <span className="truncate">{head.note || '—'}</span>
            )}
          </label>
        </div>

        {sua && (
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1">
            <span className="text-k-label font-bold tracking-[.07em] text-[var(--act-text)] uppercase">
              + Thêm dòng
            </span>
            <Combobox<VatTuChon>
              search={timVatTu}
              onPick={(vt) => void chonVatTu(vt)}
              keyOf={(m) => m.id}
              render={(m) => (
                <span className="flex items-baseline gap-2">
                  <Code>{m.code}</Code>
                  <span className="truncate">{m.name}</span>
                  <span className="ml-auto text-[var(--ink-3)]">{m.unit}</span>
                </span>
              )}
              placeholder={
                dangTra
                  ? 'Đang tra tồn + giá…'
                  : 'Gõ mã hoặc tên vật tư có trong danh mục'
              }
              label="Tìm vật tư để thêm dòng"
              width={hep ? 300 : 420}
              disabled={dangTra}
            />
            <Btn onClick={themDongTuDo} className="text-k-sm h-6 px-2">
              + Dòng chưa có mã
            </Btn>
            <span className="text-k-sm ml-auto text-[var(--ink-3)]">
              {rows.length} dòng
            </span>
          </div>
        )}

        <div ref={khung} className="h-0 w-full" aria-hidden />
        <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
          <Grid minWidth={hep ? 680 : 900}>
            <GridHead>
              <Th width={30}>#</Th>
              <Th width={hep ? 86 : 100}>Mã</Th>
              <Th>Tên vật tư</Th>
              <Th width={64}>ĐVT</Th>
              {!hep && (
                <Th num width={84}>
                  Tồn hiện tại
                </Th>
              )}
              <Th num width={100}>
                Số lượng
              </Th>
              <Th num width={110}>
                Đơn giá dự kiến
              </Th>
              {!hep && (
                <Th num width={110}>
                  Thành tiền
                </Th>
              )}
              <Th width={hep ? 130 : 160}>Mục đích / tổ dùng</Th>
              {sua && <Th width={50}></Th>}
            </GridHead>
            <GridBody>
              {rows.map((r, i) => {
                const tuDo = !r.material_id
                const tonThap = r.ton != null && r.qty != null && r.ton <= 0
                return (
                  <GridRow key={r.key}>
                    <td className="k-c-n">{i + 1}</td>
                    <td>
                      {r.code ? <Code>{r.code}</Code> : <Tag tone="warn">chưa có mã</Tag>}
                    </td>
                    <td className="max-w-0" title={r.name}>
                      {sua && tuDo ? (
                        <TextInput
                          id={`dn-ten-${i}`}
                          value={r.name}
                          onCommit={(v) => patch(i, { name: v })}
                          placeholder="tên vật tư (chưa có mã)"
                          label={`Tên vật tư dòng ${i + 1}`}
                        />
                      ) : (
                        <span className="block truncate">{r.name}</span>
                      )}
                    </td>
                    <td className="text-[var(--ink-3)]">
                      {sua && tuDo ? (
                        <TextInput
                          value={r.unit}
                          onCommit={(v) => patch(i, { unit: v })}
                          placeholder="ĐVT"
                          label={`ĐVT dòng ${i + 1}`}
                        />
                      ) : (
                        r.unit
                      )}
                    </td>
                    {!hep && (
                      <td className="k-r num">
                        {r.ton == null ? (
                          <span className="text-[var(--ink-empty)]">—</span>
                        ) : (
                          <span
                            className={
                              r.ton <= 0
                                ? 'font-semibold text-[var(--warn)]'
                                : 'text-[var(--ink-3)]'
                            }
                          >
                            {fmt(r.ton)}
                          </span>
                        )}
                      </td>
                    )}
                    <td className="k-r">
                      {sua ? (
                        <NumInput
                          id={`dn-qty-${i}`}
                          value={r.qty == null ? '' : String(r.qty)}
                          onCommit={(v) => patch(i, { qty: docSo(v) })}
                          aria-label={`Số lượng ${r.code ?? r.name}`}
                        />
                      ) : (
                        <>
                          <b className="num">
                            {r.qty == null ? '—' : fmt(r.approved_qty ?? r.qty)}
                          </b>
                          {r.approved_qty != null && r.qty != null && (
                            <CellHint tone="warn">đề nghị {fmt(r.qty)}</CellHint>
                          )}
                        </>
                      )}
                      {hep && r.ton != null && (
                        <CellHint tone={tonThap ? 'warn' : 'neutral'}>
                          tồn {fmt(r.ton)}
                        </CellHint>
                      )}
                    </td>
                    <td className="k-r">
                      {sua ? (
                        <NumInput
                          value={r.unit_price == null ? '' : String(r.unit_price)}
                          onCommit={(v) => patch(i, { unit_price: docSo(v) })}
                          aria-label={`Đơn giá dự kiến ${r.code ?? r.name}`}
                        />
                      ) : (
                        <span className="num">
                          {r.unit_price == null ? '—' : fmt(r.unit_price)}
                        </span>
                      )}
                      {r.gia_goi_y && (
                        <CellHint
                          title={`${r.gia_goi_y.po_code} · ${r.gia_goi_y.supplier_name} · ${isoToVn(todayVn(new Date(r.gia_goi_y.at)))}`}
                        >
                          lần trước {fmt(r.gia_goi_y.unit_price)}
                        </CellHint>
                      )}
                    </td>
                    {!hep && (
                      <td className="k-r num">
                        {r.qty != null && r.unit_price != null ? (
                          fmt(Math.round(r.qty * r.unit_price))
                        ) : (
                          <span className="text-[var(--ink-empty)]">—</span>
                        )}
                      </td>
                    )}
                    <td>
                      {sua ? (
                        <>
                          <input
                            list="dn-muc-dich"
                            defaultValue={r.purpose}
                            onBlur={(e) => patch(i, { purpose: e.target.value })}
                            placeholder="tổ / việc dùng"
                            aria-label={`Mục đích dòng ${i + 1}`}
                            className="text-k-sm h-[var(--ctl-h)] w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-card)] px-1.5 placeholder:text-[var(--ink-3)] focus:border-[var(--act)]"
                          />
                        </>
                      ) : (
                        <span className="block truncate text-[var(--ink-2)]">
                          {r.purpose || '—'}
                        </span>
                      )}
                    </td>
                    {sua && (
                      <td>
                        <GridBtn
                          onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                        >
                          Xoá
                        </GridBtn>
                      </td>
                    )}
                  </GridRow>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={soCot + (sua ? 1 : 0)}
                    className="py-6 text-center text-[var(--ink-3)]"
                  >
                    {sua
                      ? 'Chưa có dòng nào — gõ mã hoặc tên ở ô “Thêm dòng”; thứ chưa có mã thì bấm “+ Dòng chưa có mã”.'
                      : 'Phiếu không có dòng nào.'}
                  </td>
                </tr>
              )}
            </GridBody>
            <GridFoot>
              <td colSpan={hep ? 5 : 7}>
                {rows.length} dòng
                {soChuaMa > 0 &&
                  ` · ${soChuaMa} dòng chưa có mã (Cung ứng gắn mã khi lập đơn)`}
              </td>
              {!hep && <td className="k-r num">{fmt(tong.tong)}</td>}
              <td colSpan={sua ? 2 : 1} className="font-normal text-[var(--ink-3)]">
                {hep ? `${fmt(tong.tong)} · ` : ''}chưa VAT, chưa vận chuyển
                {tong.thieuGia > 0 && ` · ${tong.thieuGia} dòng chưa có giá`}
              </td>
            </GridFoot>
          </Grid>
          <datalist id="dn-muc-dich">
            {MUC_DICH_GOI_Y.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>

        <CommitBar
          totals={[
            { label: 'Dòng', value: rows.length },
            ...(soChuaMa > 0 ? [{ label: 'Chưa có mã', value: soChuaMa }] : []),
          ]}
          grand={{ label: 'Dự kiến (chưa VAT)', value: fmt(tong.tong) }}
          actions={
            sua ? (
              <>
                {/* Không dùng `blocked` của CommitBar: kit ghi "Chưa LƯU được" —
                    sai ở đây, lưu nháp vẫn được, chỉ GỬI DUYỆT bị chặn. */}
                {blocked && (
                  <button
                    type="button"
                    className="text-k-sm max-w-[360px] truncate font-semibold text-[var(--warn)] underline-offset-2 hover:underline"
                    title={blocked}
                    onClick={() => {
                      const v = vuong[0]
                      if (v?.dong != null)
                        focus(
                          rows[v.dong]?.name.trim()
                            ? `dn-qty-${v.dong}`
                            : `dn-ten-${v.dong}`,
                        )
                    }}
                  >
                    Chưa gửi được: {blocked} →
                  </button>
                )}
                <Btn onClick={() => void luuNhap()} disabled={busy}>
                  Lưu nháp
                </Btn>
                <Action
                  primary
                  onClick={() => void guiDuyet()}
                  disabled={busy || vuong.length > 0}
                  title={blocked}
                >
                  Gửi lãnh đạo duyệt
                </Action>
              </>
            ) : undefined
          }
        />
        <StatusBar
          left={[
            'Đơn giá tự điền theo lần mua gần nhất (đơn VND) — sửa được',
            'Gửi rồi phiếu khoá; muốn sửa thì rút về nháp khi lãnh đạo chưa duyệt',
          ]}
          right={`${rows.length} dòng`}
        />
      </ScreenFrame>
      {moHuy && phieu.id && (
        <HuyPhieuSheet
          id={phieu.id}
          code={phieu.code ?? ''}
          onClose={() => setMoHuy(false)}
          onDone={() => {
            setMoHuy(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
