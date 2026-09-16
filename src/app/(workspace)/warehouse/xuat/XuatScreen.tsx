'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ApiError, api, apiErrorText } from '@/lib/api'
import { isoToVn } from '@/lib/date-vn'
import { useToast } from '@/components/ui/Toast'
import { DaGhiSoBar } from '@/components/warehouse/DaGhiSoBar'
import {
  WarehouseDocPrintSheet,
  type WarehousePrintLine,
} from '@/app/print/warehouse/WarehouseDocPrintSheet'
import type { PrintCompany } from '@/app/print/PrintSheet'
import type { DocTemplate } from '@/lib/doc-templates'
import {
  LY_DO_XUAT_LE,
  kiemTruocGhiSoXuat,
  lyDoCanLenh,
  themDong,
  thieuTon,
  tinhTongXuat,
  type DauPhieuXuat,
  type DongXuat,
  type LoaiXuat,
  type VatTuChon,
} from '@/lib/kho-phieu-xuat'
import { cn } from '@/lib/utils'
import {
  Action,
  ActionGroup,
  ActionPane,
  Btn,
  CellHint,
  Code,
  CommitBar,
  Crumb,
  DateInput,
  DocHead,
  Grid,
  GridBody,
  GridBtn,
  GridFoot,
  GridHead,
  GridRow,
  Consequence,
  Lookup,
  NumInput,
  Pick,
  PickFind,
  ScreenFrame,
  Sheet,
  SheetActions,
  StatusBar,
  StatusTrack,
  Tag,
  TextArea,
  TextInput,
  Th,
} from '@/components/kit'

const fmt = (n: number) => n.toLocaleString('vi-VN')

type LsxOpt = {
  id: string
  code: string
  customer_name: string
  order_codes: string[]
  status: string
}

/* ── Hai mảnh nhỏ của đầu phiếu, chỉ màn này dùng ─────────────────────── */

/** Nhãn ô đầu phiếu kèm số thứ tự câu hỏi (1 xuất cho → 2 lệnh → 3 tổ → 4 ngày). */
function Buoc({
  n,
  dim = false,
  need = false,
  children,
}: {
  n: number | string
  dim?: boolean
  /** Ô bắt buộc đang TRỐNG sau khi đã bấm Ghi sổ — mới đỏ, không đỏ lúc mở form. */
  need?: boolean
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[6px] font-bold tracking-[.07em] whitespace-nowrap text-[var(--fs-label)] uppercase',
        need ? 'text-[var(--stop)]' : 'text-[var(--ink-label)]',
      )}
    >
      <i
        className={cn(
          'grid h-4 w-4 place-items-center rounded-full text-[10px] font-bold tracking-normal not-italic',
          need
            ? 'bg-[var(--stop)] text-white'
            : dim
              ? 'bg-[var(--track)] text-[var(--ink-2)]'
              : 'bg-[var(--act)] text-[var(--act-ink)]',
        )}
      >
        {n}
      </i>
      {children}
    </span>
  )
}

/** Dải nút chọn một — segmented control dựng từ `Btn` của kit. */
function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
  need = false,
}: {
  value: T | ''
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
  disabled?: boolean
  need?: boolean
}) {
  return (
    <span
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex h-[26px] overflow-hidden rounded-[var(--radius)] border',
        need ? 'border-[var(--stop)]' : 'border-[var(--line)]',
      )}
    >
      {options.map((o) => (
        <Btn
          key={o.value}
          primary={o.value === value}
          disabled={disabled}
          aria-checked={o.value === value}
          role="radio"
          onClick={() => onChange(o.value)}
          className={cn(
            'h-full rounded-none border-0 border-r border-[var(--line)] px-[11px] text-[12.5px] last:border-r-0',
            o.value !== value && 'bg-[var(--surface-card)] font-medium',
          )}
        >
          {o.label}
        </Btn>
      ))}
    </span>
  )
}

const tenTo = (n: string) => n.replace(/^tổ\s+/i, '')

/**
 * PHIẾU XUẤT — Khuôn F, Bước 2 Kho. Bản thiết kế: artboard 3 · 3b · 3c ở
 * https://claude.ai/artifact/G9Zso3vzCHUYpNGRp9o7Nf
 *
 * Đầu phiếu đi theo thứ tự câu hỏi thật: 1 Xuất cho (lệnh / lẻ) → 2 Lệnh
 * (hoặc Lý do) → 3 Tổ lấy (8 tổ, bấm một phát) → 4 Ngày (mặc định hôm nay,
 * bấm "sửa" mới đổi). Ô bắt buộc chỉ đỏ SAU KHI bấm Ghi sổ mà còn trống —
 * đỏ lúc form mới mở là mắng người chưa làm gì.
 *
 * Lưới: thêm dòng bằng ô tìm TRÊN lưới, tồn dùng được tra lúc thêm. Một mã
 * một dòng.
 *
 * GHI SỔ = một POST `docs/issue`. Server vẫn là người quyết (guard trạng thái
 * lệnh, tồn, giữ chỗ; mã X1 tự gắn). Ghi xong: dải xanh có nút In phiếu và
 * phiếu mới trống — thủ kho thường ghi liền cho mấy tổ.
 */
export function XuatScreen({
  lsx,
  to,
  phong,
  today,
  nguoiLap,
  canEdit,
  company,
  tpl,
}: {
  lsx: LsxOpt[]
  /** Tên các tổ sản xuất — dải nút "Tổ lấy". */
  to: string[]
  /** Mọi phòng ban — ô "Bộ phận nhận" khi xuất lẻ. */
  phong: string[]
  today: string
  nguoiLap: string
  canEdit: boolean
  company: PrintCompany
  tpl: DocTemplate
}) {
  const router = useRouter()
  const params = useSearchParams()
  const toast = useToast()
  const [head, setHead] = useState<DauPhieuXuat>({
    loai: 'lsx',
    lsx_id: '',
    ly_do: '',
    to: '',
    nguoi_lay: '',
    doc_date: today,
  })
  const [suaNgay, setSuaNgay] = useState(false)
  const [rows, setRows] = useState<DongXuat[]>([])
  const [dangTra, setDangTra] = useState(false)
  /** Đã bấm Ghi sổ ít nhất một lần — từ đó ô thiếu mới đỏ. */
  const [daThu, setDaThu] = useState(false)
  /** Xem bản in TRƯỚC khi ghi sổ — vẽ bằng ĐÚNG component của trang in. */
  const [xemIn, setXemIn] = useState(false)
  const [busy, setBusy] = useState(false)
  /** Câu của server khi lấn phần giữ cho LSX khác — mở hộp xin lý do. */
  const [lanSheet, setLanSheet] = useState<string | null>(null)
  const [lanDraft, setLanDraft] = useState('')
  /**
   * Phiếu VỪA GHI — dải trên đầu màn, có nút In. Không dùng toast: người ghi
   * sổ xong thường phải in ngay đưa tổ ký, mà toast tự tắt sau vài giây.
   */
  const [vuaGhi, setVuaGhi] = useState<{
    id: string
    code: string
    dong: number
    to: string
  } | null>(null)

  const setH = (p: Partial<DauPhieuXuat>) => setHead((h) => ({ ...h, ...p }))
  const patch = (i: number, p: Partial<DongXuat>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)))

  const tong = useMemo(() => tinhTongXuat(rows), [rows])
  const kiem = useMemo(() => kiemTruocGhiSoXuat(head, rows), [head, rows])
  const canLenh = head.loai === 'lsx' || lyDoCanLenh(head.ly_do)
  const lsxChon = lsx.find((l) => l.id === head.lsx_id) ?? null
  const thieu = (o: 'lenh' | 'ly_do' | 'to') => daThu && !kiem.ok && kiem.focus === o

  async function timVatTu(q: string): Promise<VatTuChon[]> {
    const res = await api<{ rows: VatTuChon[] }>(
      `/api/dept/warehouse/materials?q=${encodeURIComponent(q)}&active_only=true&page_size=20`,
    )
    return res.rows.map((m) => ({ id: m.id, code: m.code, name: m.name, unit: m.unit }))
  }

  async function chonVatTu(vt: VatTuChon) {
    setDangTra(true)
    let qty_ok: number | null = null
    try {
      const res = await api<{ rows: { material_id: string; qty_ok: number }[] }>(
        `/api/dept/warehouse/stock/ton?ids=${vt.id}`,
      )
      qty_ok = res.rows[0]?.qty_ok ?? 0
    } catch (e) {
      toast.error('Không tra được tồn', apiErrorText(e))
    } finally {
      setDangTra(false)
    }
    const r = themDong(rows, vt, qty_ok)
    if (r.trung)
      toast.error(
        `${vt.code} đã có ở dòng ${r.index + 1}`,
        'Một mã một dòng — sửa số ở dòng đó.',
      )
    else setRows(r.rows)
    setTimeout(() => focusQty(r.index), 0)
  }

  const focusQty = (i: number) => {
    const el = document.getElementById(`xuat-qty-${i}`) as HTMLInputElement | null
    el?.focus()
    el?.select()
  }

  /*
    MỞ TỪ MÀN TỒN KHO (`?ma=`): thêm sẵn mã đó thành dòng đầu. Người đứng ở
    Tồn kho thấy "mã này còn 380" rồi bấm Xuất — bắt họ gõ lại mã ở form là
    bắt làm hai lần một việc.

    Chạy ĐÚNG MỘT LẦN cho mỗi mã: `useRef` canh, vì `chonVatTu` gọi API nên
    effect chạy lại là thêm dòng trùng (`themDong` chặn trùng, nhưng vẫn tốn
    một lượt gọi và một toast "đã có ở dòng 1" vô cớ).
  */
  const maUrl = params.get('ma')
  const daPrefill = useRef<string | null>(null)
  useEffect(() => {
    if (!maUrl || daPrefill.current === maUrl) return
    daPrefill.current = maUrl
    void (async () => {
      const found = await timVatTu(maUrl)
      const vt = found.find((m) => m.code === maUrl) ?? found[0]
      if (vt) await chonVatTu(vt)
      else toast.error(`Không thấy mã ${maUrl}`, 'Gõ lại ở ô Thêm dòng.')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chạy theo mã trên URL, các hàm kia ổn định trong lượt
  }, [maUrl])

  const lamMoi = () => {
    setRows([])
    setHead({
      loai: 'lsx',
      lsx_id: '',
      ly_do: '',
      to: '',
      nguoi_lay: '',
      doc_date: today,
    })
    setDaThu(false)
    setSuaNgay(false)
  }

  /**
   * Ghi sổ — một POST `docs/issue`. Server vẫn là người quyết: guard trạng
   * thái lệnh, guard tồn, guard giữ chỗ, mã X1 tự gắn cho đường theo lệnh.
   *
   * `lan` = xác nhận lấn phần đang giữ cho LSX khác (409 RESERVED_CONFLICT) —
   * gửi lại kèm lý do, service ghi vết "[Vượt khả dụng] …" vào ghi chú phiếu.
   */
  async function guiPhieu(lan?: string) {
    setBusy(true)
    try {
      const res = await api<{ id: string; code: string }>(
        '/api/dept/warehouse/docs/issue',
        {
          method: 'POST',
          body: {
            kind: head.loai,
            production_order_id:
              head.loai === 'lsx' || lyDoCanLenh(head.ly_do) ? head.lsx_id : null,
            // Người NHẬN trên mẫu 02-VT: tổ, kèm tên người lấy nếu có khai.
            counterparty: [head.to, head.nguoi_lay.trim()].filter(Boolean).join(' · '),
            // Xuất theo lệnh luôn là X1 — service bỏ qua reason_code ở đường đó.
            reason_code: head.loai === 'daily' ? head.ly_do : null,
            reason:
              head.loai === 'daily' && lyDoChon
                ? `${lyDoChon.ma} · ${lyDoChon.nhan}`
                : null,
            doc_date: head.doc_date || null,
            override_reserved: !!lan,
            override_reason: lan ?? null,
            lines: rows
              .filter((r) => r.qty > 0)
              .map((r) => ({
                material_id: r.id,
                qty: r.qty,
                note: r.note.trim() || null,
              })),
          },
        },
      )
      setVuaGhi({ id: res.id, code: res.code, dong: tong.so_dong, to: head.to })
      setLanSheet(null)
      setLanDraft('')
      lamMoi()
      router.refresh()
    } catch (e) {
      // Lấn phần giữ cho lệnh khác: mở hộp xin lý do, mang nguyên câu server
      // nói (mã nào, cần bao nhiêu, khả dụng bao nhiêu) — không diễn giải lại.
      if (e instanceof ApiError && e.code === 'RESERVED_CONFLICT') {
        setLanSheet(e.message)
        setLanDraft('')
      } else toast.error('Chưa ghi sổ được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const ghiSo = () => {
    setDaThu(true)
    if (!kiem.ok) {
      if (typeof kiem.focus === 'number') {
        if (kiem.focus >= 0) focusQty(kiem.focus)
        else document.getElementById('xuat-tim')?.focus()
      } else document.getElementById(`xuat-${kiem.focus}`)?.focus()
      return
    }
    void guiPhieu()
  }

  const lyDoChon = LY_DO_XUAT_LE.find((x) => x.ma === head.ly_do)
  const tieuDe =
    head.loai === 'lsx'
      ? lsxChon
        ? `Cấp cho lệnh ${lsxChon.code} · ${lsxChon.customer_name}`
        : 'Cấp cho lệnh sản xuất'
      : lyDoChon
        ? `Xuất lẻ · ${lyDoChon.nhan}`
        : 'Xuất lẻ'
  const blocked = !canEdit
    ? 'Tài khoản này không có quyền ghi sổ kho'
    : busy
      ? 'Đang ghi sổ…'
      : daThu && !kiem.ok
        ? kiem.message
        : undefined

  return (
    <div
      className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault()
          ghiSo()
        }
      }}
    >
      {/*
        ScreenFrame chốt chiều cao bằng phần màn còn lại: thiếu nó thì wrapper
        không có trần, lưới co theo nội dung (đo 16/09: một hàng + thanh cuộn,
        nửa dưới cửa sổ trống) và danh sách gợi ý bị khung cuộn cắt.
      */}
      <ScreenFrame>
        <Crumb
          path={[{ label: 'Kho', href: '/warehouse/nhap' }, 'Xuất kho', 'Phiếu mới']}
        />
        <ActionPane>
          <ActionGroup label="Phiếu">
            <Action primary onClick={ghiSo} disabled={!canEdit || busy} title={blocked}>
              {busy ? 'Đang ghi sổ…' : 'Ghi sổ'}
            </Action>
            <Action
              onClick={lamMoi}
              disabled={busy || (rows.length === 0 && !head.to && !head.lsx_id)}
            >
              Làm mới
            </Action>
          </ActionGroup>
          <ActionGroup label="Bản in">
            <Action onClick={() => setXemIn(true)}>Xem bản in</Action>
          </ActionGroup>
          <ActionGroup label="Sổ">
            <Action onClick={() => router.push('/warehouse/phieu?ro=issue')}>
              Sổ phiếu xuất
            </Action>
          </ActionGroup>
        </ActionPane>

        {vuaGhi && (
          <DaGhiSoBar
            code={vuaGhi.code}
            docId={vuaGhi.id}
            detail={`${vuaGhi.dong} dòng · ${vuaGhi.to} — tồn đã trừ.`}
            soPhieuHref="/warehouse/phieu?ro=issue"
            onClose={() => setVuaGhi(null)}
          />
        )}
        <DocHead
          compact
          kind="Phiếu xuất kho"
          code={tieuDe}
          sub={`thủ kho ghi sổ sau khi tổ lấy · số phiếu PXK cấp khi ghi sổ · người lập ${nguoiLap}`}
        >
          <StatusTrack label="Phiếu" steps={['Đang lập', 'Đã ghi sổ']} at={0} />
        </DocHead>

        {/* ── Đầu phiếu, hàng 1: xuất cho → lệnh / lý do → ngày ───────────── */}
        <div className="flex flex-wrap items-center gap-x-[18px] gap-y-[6px] border-b border-[var(--hair)] bg-[var(--surface-card)] px-[var(--gutter)] py-[7px]">
          <span className="inline-flex items-center gap-2">
            <Buoc n={1}>Xuất cho</Buoc>
            <Seg<LoaiXuat>
              value={head.loai}
              label="Xuất cho"
              options={[
                { value: 'lsx', label: 'Lệnh sản xuất' },
                { value: 'daily', label: 'Xuất lẻ' },
              ]}
              onChange={(v) => setH({ loai: v, ly_do: '', to: '' })}
            />
          </span>

          {head.loai === 'daily' && (
            <span className="inline-flex items-center gap-2">
              <Buoc n={2} need={thieu('ly_do')}>
                Lý do
              </Buoc>
              <span id="xuat-ly_do" tabIndex={-1}>
                <Pick
                  value={head.ly_do}
                  onChange={(v) => setH({ ly_do: v })}
                  options={[
                    { value: '', label: '— chọn lý do —' },
                    ...LY_DO_XUAT_LE.map((x) => ({
                      value: x.ma,
                      label: `${x.ma} · ${x.nhan}`,
                    })),
                  ]}
                  label="Lý do xuất lẻ"
                  width={300}
                />
              </span>
            </span>
          )}

          {canLenh && (
            <span className="inline-flex min-w-0 flex-1 basis-[420px] items-center gap-2">
              <Buoc n={head.loai === 'daily' ? '2b' : 2} need={thieu('lenh')}>
                Lệnh
              </Buoc>
              <span id="xuat-lenh" tabIndex={-1} className="min-w-0 flex-1">
                <PickFind
                  value={head.lsx_id}
                  onChange={(v) => setH({ lsx_id: v })}
                  options={lsx.map((l) => ({
                    value: l.id,
                    label: l.code,
                    hint: `${l.customer_name}${l.order_codes.length ? ` · ${l.order_codes.join(', ')}` : ''} · ${l.status === 'in_progress' ? 'đang SX' : 'đã duyệt'}`,
                  }))}
                  label="Lệnh sản xuất"
                  placeholder="gõ số lệnh hoặc tên khách…"
                  width={560}
                  emptyLabel="— chọn lệnh đang chạy —"
                />
              </span>
              {lsxChon && (
                <Tag tone={lsxChon.status === 'in_progress' ? 'neutral' : 'done'}>
                  {lsxChon.status === 'in_progress' ? 'đang SX' : 'đã duyệt'}
                </Tag>
              )}
            </span>
          )}

          <span className="ml-auto inline-flex items-center gap-2">
            <Buoc n={4} dim>
              Ngày
            </Buoc>
            {suaNgay ? (
              <DateInput
                value={head.doc_date}
                onChange={(v) => setH({ doc_date: v })}
                label="Ngày chứng từ"
              />
            ) : (
              <span className="inline-flex items-center gap-[6px] text-[var(--fs-sm)] text-[var(--ink-2)]">
                {head.doc_date === today ? 'hôm nay · ' : ''}
                <b className="num font-semibold text-[var(--ink)]">
                  {isoToVn(head.doc_date)}
                </b>
                <Btn
                  className="h-[22px] border-0 bg-transparent px-1 text-[11px] text-[var(--act-text)]"
                  onClick={() => setSuaNgay(true)}
                >
                  sửa
                </Btn>
              </span>
            )}
          </span>
        </div>

        {/* ── Đầu phiếu, hàng 2: tổ lấy / bộ phận nhận → người lấy ────────── */}
        <div className="flex flex-wrap items-center gap-x-[18px] gap-y-[6px] border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-[7px]">
          <span className="inline-flex items-center gap-2" id="xuat-to" tabIndex={-1}>
            <Buoc n={3} need={thieu('to')}>
              {head.loai === 'lsx' ? 'Tổ lấy' : 'Bộ phận nhận'}
            </Buoc>
            {head.loai === 'lsx' ? (
              <Seg<string>
                value={head.to}
                label="Tổ lấy"
                need={thieu('to')}
                options={to.map((t) => ({ value: t, label: tenTo(t) }))}
                onChange={(v) => setH({ to: v })}
              />
            ) : (
              <PickFind
                value={head.to}
                onChange={(v) => setH({ to: v })}
                options={phong.map((p) => ({ value: p, label: p }))}
                label="Bộ phận nhận"
                placeholder="gõ tên phòng / tổ…"
                width={240}
                emptyLabel="— chọn bộ phận —"
              />
            )}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="font-bold tracking-[.07em] text-[var(--fs-label)] text-[var(--ink-3)] uppercase">
              Người lấy
            </span>
            <TextInput
              value={head.nguoi_lay}
              onCommit={(v) => setH({ nguoi_lay: v })}
              placeholder="tên người lấy (không bắt buộc)"
              label="Người lấy"
              style={{ width: 200 }}
            />
          </span>
          <span className="ml-auto text-[var(--fs-micro)] text-[var(--ink-3)]">
            Thêm dòng: gõ ở ô ngay trên lưới · Enter chọn · Tab sang số
          </span>
        </div>

        {/*
          Ô tìm đứng NGOÀI khung cuộn của lưới: đặt nó làm dòng cuối lưới thì
          danh sách gợi ý (absolute) bị `overflow:auto` của khung cắt, chỉ lộ
          một dòng đè lên hàng Tổng — chủ dự án chụp màn 16/09. Ở đây gợi ý
          rơi xuống lưới, không bị cắt; dòng mới vẫn vào cuối lưới, focus ô số.
        */}
        <div className="flex items-center gap-3 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-[5px]">
          <span className="font-bold tracking-[.07em] text-[var(--act-text)] text-[var(--fs-label)] uppercase">
            + Thêm dòng
          </span>
          <Lookup<VatTuChon>
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
              dangTra ? 'Đang tra tồn…' : 'Gõ mã hoặc tên vật tư · Enter để thêm dòng'
            }
            label="Tìm vật tư để thêm dòng"
            width={460}
            disabled={dangTra}
          />
          <span className="ml-auto text-[var(--fs-sm)] text-[var(--ink-3)]">
            {rows.length} dòng
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
          <Grid minWidth={900}>
            <GridHead>
              <Th width={30}>#</Th>
              <Th width={110}>Mã</Th>
              <Th>Tên vật tư</Th>
              <Th width={56}>ĐVT</Th>
              <Th num width={110}>
                Tồn dùng được
              </Th>
              <Th num width={110}>
                Lần này
              </Th>
              <Th width={300}>Ghi chú</Th>
              <Th width={60}></Th>
            </GridHead>
            <GridBody>
              {rows.map((r, i) => {
                const th = thieuTon(r)
                return (
                  <GridRow key={r.id}>
                    <td className="k-c-n">{i + 1}</td>
                    <td>
                      <Code>{r.code}</Code>
                    </td>
                    <td className="max-w-0 truncate" title={r.name}>
                      {r.name}
                    </td>
                    <td className="text-[var(--ink-3)]">{r.unit}</td>
                    <td className="k-r num">
                      {r.qty_ok == null ? (
                        <span className="text-[var(--ink-empty)]">?</span>
                      ) : (
                        fmt(r.qty_ok)
                      )}
                    </td>
                    <td className="k-r">
                      <NumInput
                        id={`xuat-qty-${i}`}
                        value={String(r.qty)}
                        onCommit={(v) =>
                          patch(i, {
                            qty: Number(v.replace(/\./g, '').replace(',', '.')) || 0,
                          })
                        }
                        aria-label={`Lần này ${r.code}`}
                      />
                      {th != null && (
                        <CellHint tone="warn">
                          tồn {fmt(r.qty_ok ?? 0)} — thiếu {fmt(th)}
                        </CellHint>
                      )}
                    </td>
                    <td>
                      <TextInput
                        value={r.note}
                        onCommit={(v) => patch(i, { note: v })}
                        placeholder="ghi chú (không bắt buộc)"
                        label={`Ghi chú ${r.code}`}
                      />
                    </td>
                    <td>
                      <GridBtn
                        onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                      >
                        Xoá
                      </GridBtn>
                    </td>
                  </GridRow>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-[var(--ink-3)]">
                    Chưa có dòng nào — gõ mã hoặc tên vật tư ở ô “Thêm dòng” phía trên.
                  </td>
                </tr>
              )}
            </GridBody>
            <GridFoot>
              <td colSpan={5}>Tổng</td>
              <td className="k-r num">{fmt(tong.tong)}</td>
              <td colSpan={2} className="font-normal text-[var(--ink-3)]">
                {tong.so_dong} dòng có số · tổng chỉ để đếm, nhiều đơn vị khác nhau
              </td>
            </GridFoot>
          </Grid>
        </div>

        <CommitBar
          totals={[
            { label: 'Dòng', value: rows.length },
            ...(lsxChon ? [{ label: 'Lệnh', value: lsxChon.code }] : []),
            ...(head.to
              ? [{ label: head.loai === 'lsx' ? 'Tổ' : 'Nhận', value: head.to }]
              : []),
          ]}
          grand={{ label: 'Tổng lượng', value: fmt(tong.tong) }}
          blocked={blocked}
          onGoBlocked={daThu && !kiem.ok ? ghiSo : undefined}
          actions={
            <>
              <span className="text-[var(--fs-micro)] text-[var(--ink-3)]">
                Ctrl + Enter
              </span>
              <Action primary onClick={ghiSo} disabled={!canEdit} title={blocked}>
                Ghi sổ
              </Action>
            </>
          }
        />
        <StatusBar
          left={[
            head.loai === 'lsx'
              ? 'Mã lý do X1 tự gắn · tiền vào giá thành lệnh · tồn chỉ đổi khi ghi sổ'
              : 'Xuất lẻ: mã lý do người chọn, không vào giá thành lệnh · tồn chỉ đổi khi ghi sổ',
            'Ghi sổ xong: phiếu mới trống, ghi tiếp cho tổ khác',
          ]}
          right={`${rows.length} dòng`}
        />
        {lanSheet && (
          <Sheet
            open
            onClose={() => setLanSheet(null)}
            stakes="nang"
            title="Xuất lấn phần đang giữ cho lệnh khác"
            subtitle="Tồn còn đủ, nhưng phần này đã hứa cho lệnh sản xuất khác đã duyệt."
            footer={
              <SheetActions
                stakes="nang"
                onCancel={() => setLanSheet(null)}
                onConfirm={() => void guiPhieu(lanDraft.trim())}
                cancelLabel="Quay lại sửa số"
                confirmLabel="Vẫn xuất"
                busy={busy}
                disabled={lanDraft.trim() === ''}
              />
            }
          >
            {/* Câu NGUYÊN VĂN của server: mã nào, cần bao nhiêu, khả dụng bao nhiêu. */}
            <div className="k-note k-note-text">{lanSheet}</div>
            <div className="mt-3">
              <div className="mb-1 font-bold tracking-[.09em] text-[var(--fs-label)] text-[var(--ink-label)] uppercase">
                Lý do vẫn xuất · bắt buộc
              </div>
              <TextArea
                value={lanDraft}
                onChange={setLanDraft}
                rows={3}
                placeholder="ví dụ: lệnh kia chưa vào chuyền, tổ trưởng hai bên đã thống nhất"
                aria-label="Lý do xuất lấn phần đang giữ"
              />
            </div>
            <Consequence>
              Lý do ghi vào ghi chú phiếu để hậu kiểm biết ai lấy của ai. Lệnh bị lấn sẽ
              thiếu đúng phần này khi tới lượt cấp.
            </Consequence>
          </Sheet>
        )}

        {xemIn && (
          <Sheet
            open
            onClose={() => setXemIn(false)}
            width={900}
            title="Xem trước phiếu xuất kho"
            subtitle="Dựng từ bản đang gõ — chưa ghi sổ, chưa có số phiếu. Đúng mẫu 02-VT sẽ in ra."
          >
            <WarehouseDocPrintSheet
              head={{
                kind: 'issue',
                code: null,
                date: new Date(head.doc_date),
                counterparty:
                  [head.to, head.nguoi_lay.trim()].filter(Boolean).join(' · ') || null,
                reason:
                  head.loai === 'lsx'
                    ? `Cấp cho lệnh ${lsxChon?.code ?? ''}`.trim()
                    : lyDoChon
                      ? `${lyDoChon.ma} · ${lyDoChon.nhan}`
                      : null,
                creator_name: nguoiLap,
              }}
              lines={rows.map<WarehousePrintLine>((r) => ({
                id: r.id,
                material_code: r.code,
                material_name: r.name,
                material_unit: r.unit,
                qty_doc: null,
                qty: r.qty,
                note: r.note || null,
              }))}
              company={company}
              tpl={tpl}
            />
          </Sheet>
        )}
      </ScreenFrame>
    </div>
  )
}
