'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Chip,
  Empty,
  Grid,
  GridBody,
  GridFoot,
  GridHead,
  GridRow,
  NoticeBar,
  NumInput,
  Pick,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  Td,
  Th,
  WhyBox,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { SOURCE_LABEL, termLabel, type Term, type TermSource } from '@/lib/payment-terms'
import type { DueBoard, DueRow } from '@/modules/dept/accounting/payment-terms.service'

const money = (n: number, cur: string) =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: cur === 'VND' ? 0 : 2 })
const dmy = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—')

/** Mẫu điều khoản hay gặp — chọn một phát, không phải nghĩ cú pháp. */
const PRESETS: { label: string; term: Term | null }[] = [
  { label: '— chưa khai mặc định —', term: null },
  { label: 'Trả ngay khi nhận (COD)', term: { basis: 'net', days: 0 } },
  { label: '15 ngày', term: { basis: 'net', days: 15 } },
  { label: '30 ngày', term: { basis: 'net', days: 30 } },
  { label: '45 ngày', term: { basis: 'net', days: 45 } },
  { label: '60 ngày', term: { basis: 'net', days: 60 } },
  { label: 'Cuối tháng', term: { basis: 'eom', days: 0 } },
  { label: 'Cuối tháng + 15 ngày', term: { basis: 'eom', days: 15 } },
]
const keyOf = (t: Term | null) => (t ? `${t.basis}:${t.days}` : '')

const FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'overdue', label: 'Quá hạn' },
  { id: 'soon', label: 'Đến hạn trong 7 ngày' },
  { id: 'none', label: 'Chưa có hạn' },
] as const
type FilterId = (typeof FILTERS)[number]['id']

const SOURCE_TONE: Record<TermSource, 'done' | 'warn' | 'stop' | undefined> = {
  don: 'done',
  ncc: undefined,
  mac_dinh: undefined,
  khong_co: 'stop',
}

/**
 * HẠN THANH TOÁN CÔNG NỢ — Khuôn C.
 *
 * ⭐ BẢN ĐẦU LÀ MÀN KHAI 164 HỒ SƠ NCC, đã bỏ. User chê đúng: *"nhiều nhà cung
 * cấp thì làm vậy rất khó dùng"*. ERP thật không bắt khai từng NCC — điều khoản
 * đàm phán theo ĐƠN, và công ty có MỘT mặc định đỡ phần còn lại.
 *
 * Đo 11/09/2026: không khai gì thì 15/44 đơn có hạn (đọc từ điều khoản sẵn có
 * trên đơn); khai **một** mặc định công ty thì **44/44**. Vì thế màn này xoay
 * quanh KHOẢN NỢ — đơn nào, hạn nào, quá bao lâu — còn việc khai chỉ còn đúng
 * một ô ở đầu trang.
 *
 * ⭐ MỖI HẠN NÓI RÕ LẤY TỪ ĐÂU. Một ngày tháng không kèm nguồn là con số không
 * kiểm được: người đọc không biết nên tin nó hay đi hỏi lại NCC.
 */
export function DieuKhoanScreen({
  board,
  canManage,
}: {
  board: DueBoard
  canManage: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<FilterId>('all')
  const [busy, setBusy] = useState(false)
  /** supplier_id → text đang gõ ở cột ghi đè. */
  const [draft, setDraft] = useState<Record<string, string>>({})

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return board.rows.filter((r) => {
      if (filter === 'overdue' && (r.overdue_days ?? -1) < 0) return false
      if (filter === 'soon' && !((r.overdue_days ?? -99) >= -7 && (r.overdue_days ?? 1) < 0)) return false // prettier-ignore
      if (filter === 'none' && r.overdue_days != null) return false
      if (!needle) return true
      return (
        r.supplier_name.toLowerCase().includes(needle) ||
        r.po_code.toLowerCase().includes(needle) ||
        (r.po_terms ?? '').toLowerCase().includes(needle)
      )
    })
  }, [board.rows, filter, q])

  async function setDefault(key: string): Promise<void> {
    if (busy) return
    const preset = PRESETS.find((p) => keyOf(p.term) === key)
    setBusy(true)
    try {
      await api('/api/dept/accounting/dieu-khoan-ncc', {
        method: 'POST',
        body: { term: preset?.term ?? null },
      })
      toast.success(
        preset?.term
          ? `Mặc định công ty: ${termLabel(preset.term)} — mọi khoản chưa có điều khoản riêng đã có hạn`
          : 'Đã bỏ mặc định — chỉ còn đọc điều khoản ghi trên từng đơn',
      )
      router.refresh()
    } catch (e) {
      toast.error(apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveSupplier(r: DueRow): Promise<void> {
    const text = (draft[r.supplier_id] ?? '').trim()
    if (busy) return
    setBusy(true)
    try {
      await api('/api/dept/accounting/dieu-khoan-ncc', {
        method: 'PATCH',
        body: { supplier_id: r.supplier_id, days: text === '' ? null : Number(text) },
      })
      toast.success(
        text === ''
          ? `Đã bỏ ghi đè cho ${r.supplier_name}`
          : `${r.supplier_name}: ${text} ngày — áp cho mọi đơn của NCC này chưa nói khác`,
      )
      setDraft((p) => {
        const next = { ...p }
        delete next[r.supplier_id]
        return next
      })
      router.refresh()
    } catch (e) {
      toast.error(apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const s = board.stats

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <ScreenFrame>
        <ScreenHeader
          compact
          eyebrow="Tài chính · Kế toán"
          title="Hạn thanh toán công nợ"
          actions={
            <>
              {/*
                MỘT Ô này thay cho việc khai 164 hồ sơ NCC. Đặt ở đầu trang chứ
                không giấu trong trang cấu hình: nó là thứ đổi cả bảng bên dưới.
              */}
              <Pick
                label="Mặc định công ty"
                width={230}
                value={keyOf(board.company_default)}
                disabled={!canManage || busy}
                onChange={setDefault}
                options={PRESETS.map((p) => ({
                  value: keyOf(p.term),
                  label: p.term ? `Mặc định: ${p.label}` : p.label,
                }))}
              />
              <Btn href="/finance/so-cong-no">Sổ công nợ</Btn>
              <Btn href="/finance/cong-no-ncc">Ghi thanh toán</Btn>
            </>
          }
        />

        {/*
          Nói VIỆC PHẢI LÀM, và việc đó chỉ là một cú bấm — không phải "thiếu dữ
          liệu ở 164 chỗ".
        */}
        {s.no_term > 0 && (
          <NoticeBar
            tone="stop"
            tag="Chưa có hạn"
            action={{ label: 'Xem các khoản đó', onClick: () => setFilter('none') }}
          >
            <b>{s.no_term}</b> khoản nợ chưa có hạn vì đơn không ghi điều khoản và công ty
            chưa khai mặc định.{' '}
            <b>Chọn “Mặc định công ty” ở góc trên là cả {s.no_term} khoản có hạn ngay</b>{' '}
            — không phải khai từng nhà cung cấp.
          </NoticeBar>
        )}

        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--hair)] px-[var(--gutter)] py-2">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Tìm nhà cung cấp, mã đơn, điều khoản…"
          />
          {FILTERS.map((f) => (
            <Chip
              key={f.id}
              on={filter === f.id}
              onClick={() => setFilter(f.id)}
              count={
                f.id === 'all'
                  ? s.total
                  : f.id === 'overdue'
                    ? s.overdue
                    : f.id === 'soon'
                      ? s.due_7d
                      : s.no_term
              }
            >
              {f.label}
            </Chip>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {rows.length === 0 ? (
            <Empty
              headline={
                board.rows.length === 0
                  ? 'Chưa có khoản nợ nào'
                  : 'Không khoản nào ở nhóm này'
              }
              reason={
                board.rows.length === 0
                  ? 'Khoản nợ phát sinh khi hàng về kho có giá. Chưa có phiếu nhập nào mang giá thì chưa có gì để tính hạn.'
                  : 'Bộ lọc hoặc ô tìm đang thu hẹp danh sách.'
              }
              next={
                board.rows.length === 0 ? (
                  <Btn primary href="/finance/so-cong-no">
                    Xem sổ công nợ
                  </Btn>
                ) : (
                  <Btn
                    onClick={() => {
                      setFilter('all')
                      setQ('')
                    }}
                  >
                    Xem tất cả
                  </Btn>
                )
              }
            />
          ) : (
            <Grid minWidth={1180}>
              <GridHead>
                <Th>Nhà cung cấp</Th>
                <Th width={140}>Đơn mua</Th>
                <Th num>Còn nợ</Th>
                <Th width={96}>Nhận ngày</Th>
                <Th width={150}>Điều khoản</Th>
                <Th width={96}>Hạn trả</Th>
                <Th width={110}>Tình trạng</Th>
                <Th num width={104}>
                  Đè cho NCC
                </Th>
              </GridHead>
              <GridBody>
                {rows.map((r) => {
                  const over = r.overdue_days
                  const edited = draft[r.supplier_id] !== undefined
                  return (
                    <GridRow key={r.po_id} selected={edited}>
                      <Td>{r.supplier_name}</Td>
                      <Td>
                        <a
                          className="num text-[var(--act)] underline"
                          href={`/mua-hang/don/${r.po_id}`}
                        >
                          {r.po_code}
                        </a>
                      </Td>
                      <Td num>
                        {money(r.amount, r.currency)}{' '}
                        <span className="text-[11px] text-[var(--ink-3)]">
                          {r.currency}
                        </span>
                      </Td>
                      <Td>
                        <span className="num">{dmy(r.received_on)}</span>
                      </Td>
                      {/*
                        Hạn KHÔNG đứng một mình — kèm nguồn. Một ngày tháng không
                        nói lấy từ đâu là con số không kiểm được.
                      */}
                      <Td tone={SOURCE_TONE[r.source]}>
                        {termLabel(r.term)}
                        <div className="text-[11px] text-[var(--ink-3)]">
                          {SOURCE_LABEL[r.source]}
                        </div>
                      </Td>
                      <Td>
                        <span className="num">{dmy(r.due_on)}</span>
                      </Td>
                      <Td
                        tone={
                          over == null
                            ? 'stop'
                            : over > 0
                              ? 'stop'
                              : over >= -7
                                ? 'warn'
                                : undefined
                        }
                      >
                        {over == null
                          ? 'chưa có hạn'
                          : over > 0
                            ? `quá ${over} ngày`
                            : over === 0
                              ? 'đến hạn hôm nay'
                              : `còn ${-over} ngày`}
                      </Td>
                      {/*
                        Ghi đè theo NCC chỉ dùng cho trường hợp NCC đó khác mặc
                        định — nên nó nằm ở cột cuối, không phải việc chính.
                      */}
                      <Td num>
                        <NumInput
                          value={draft[r.supplier_id] ?? ''}
                          onCommit={(v) => {
                            const d = v.replace(/[^\d]/g, '')
                            setDraft((p) => ({ ...p, [r.supplier_id]: d }))
                            if (canManage) void saveSupplier({ ...r })
                          }}
                          aria-label={`Ghi đè số ngày cho ${r.supplier_name}`}
                          placeholder="—"
                          disabled={!canManage || busy}
                        />
                      </Td>
                    </GridRow>
                  )
                })}
              </GridBody>
              <GridFoot>
                <Td colSpan={2}>Cộng theo tiền tệ</Td>
                <Td num>
                  {board.totals
                    .map(
                      (t) =>
                        `${money(t.overdue + t.due_7d + t.later + t.no_term, t.currency)} ${t.currency}`,
                    ) // prettier-ignore
                    .join(' · ')}
                </Td>
                <Td colSpan={5} />
              </GridFoot>
            </Grid>
          )}
        </div>

        <div className="px-[var(--gutter)] py-3">
          <WhyBox
            lines={[
              `Hạn = NGÀY NHẬN HÀNG + điều khoản. Số liệu lúc ${dmy(board.today)}`,
              'Điều khoản lấy theo thứ tự: ĐƠN MUA → HỒ SƠ NCC → MẶC ĐỊNH CÔNG TY — đơn thắng, vì điều khoản đàm phán theo từng đơn',
              `Đọc được từ đơn: ${s.by_source.don} · theo hồ sơ NCC: ${s.by_source.ncc} · theo mặc định: ${s.by_source.mac_dinh} · chưa có: ${s.by_source.khong_co}`,
              'Câu điều khoản MƠ HỒ ("cọc 30%, còn lại 30 ngày") KHÔNG được áp thẳng — nó rơi xuống tầng dưới, vì áp số đoán là giục NCC theo hạn chưa ai thoả thuận',
              '"Cuối tháng" là gốc tính hạn RIÊNG, không phải 30 ngày: nhận 01/09 thì cuối tháng là 30/09, còn 30 ngày là 01/10',
              'Khoản CHƯA CÓ HẠN không phải "chưa tới hạn" — nó không có tuổi, và không lên được bảng tuổi nợ',
            ]}
            result={board.totals
              .map((t) => `quá hạn ${money(t.overdue, t.currency)} ${t.currency}`)
              .join(' · ')}
          />
        </div>
      </ScreenFrame>
    </div>
  )
}
