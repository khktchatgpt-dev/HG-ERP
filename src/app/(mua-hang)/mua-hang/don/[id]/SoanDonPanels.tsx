'use client'

import { useMemo, useState } from 'react'
import {
  Btn,
  Consequence,
  DateInput,
  Grid,
  GridBody,
  GridBtn,
  GridFoot,
  GridHead,
  GridRow,
  NumInput,
  Pick,
  Sheet,
  SheetActions,
  Tag,
  Td,
  TextArea,
  Th,
  Tick,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { parsePoPaste, type PastedPoLine } from '@/lib/po-paste'
import type { PoMaterial } from '@/lib/po-material.types'
import type { CatalogSuggestion } from '@/lib/po-catalog-backfill'
import { validateShipments } from '@/lib/po-shipments'
import type { Line } from '@/app/(workspace)/planning/pos/new/po-line'
import { columnsToShipments, planLeft, type Need, type PlanColumn } from './soan-don'

/**
 * KHỐI SOẠN ĐƠN dựng bằng kit — chuyển từ bản cũ (`NeedsPanel`,
 * `PasteLinesDialog`, `ShipmentPlanPanel`, hộp cập nhật danh mục sau lưu) sang
 * ngôn ngữ ERP: lưới + Sheet, không Modal/Card của hệ cũ. Logic thuần dùng
 * chung với bản cũ: `lib/po-paste` (đọc vùng dán), route khớp mã, `lib/po-
 * shipments` (kiểm đợt), `soan-don.ts` (cột đợt, nhu cầu còn thiếu).
 */

const num = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

/* ══ 1. NHU CẦU THEO LỆNH — Dynamics "planned orders", SAP MRP ═══════════
   Đường tắt, không phải cửa bắt buộc: số từ bảng chi tiết lệnh (nhập tay ưu
   tiên, thiếu mới BOM × SL). Lệnh chưa có định mức thì nói thẳng. */
export function NhuCauGrid({
  needs,
  loading,
  usedIds,
  onAdd,
}: {
  needs: Need[]
  loading: boolean
  usedIds: Set<string>
  onAdd: (list: Need[]) => void
}) {
  if (loading) {
    return <div className="px-[var(--gutter)] py-3 text-[var(--fs-sm)] text-[var(--ink-3)]">Đang nạp nhu cầu của lệnh…</div> // prettier-ignore
  }
  if (needs.length === 0) {
    return (
      <div className="px-[var(--gutter)] py-3 text-[var(--fs-sm)] text-[var(--ink-2)]">
        <b>Lệnh này chưa có định mức để gợi ý.</b> Nhu cầu lấy từ bảng chi tiết lệnh (ưu
        tiên số nhập tay, thiếu mới nhân BOM × SL). Cứ chọn vật tư ở ô tìm như thường.
      </div>
    )
  }
  return (
    <Grid minWidth={760}>
      <GridHead>
        <Th>Mã · tên vật tư</Th>
        <Th width={60}>ĐVT</Th>
        <Th num>Cần</Th>
        <Th num>Tồn</Th>
        <Th num>Đã đặt</Th>
        <Th num>Đề xuất mua</Th>
        <Th width={120}>Trên đơn</Th>
        <Th width={80} />
      </GridHead>
      <GridBody>
        {needs.map((n) => {
          const on = usedIds.has(n.material_id)
          const cap = n.max_stock != null && n.max_stock > 0 ? Math.max(n.max_stock - (n.on_hand ?? 0) - (n.ordered ?? 0), 0) : null // prettier-ignore
          return (
            <GridRow key={n.material_id}>
              <Td>
                <span className="num k-strong">{n.material_code}</span> ·{' '}
                {n.material_name}
              </Td>
              <Td>{n.unit}</Td>
              <Td num>{num(n.qty_needed)}</Td>
              <Td num>{n.on_hand != null ? num(n.on_hand) : '—'}</Td>
              <Td num>{n.ordered != null ? num(n.ordered) : '—'}</Td>
              <Td num tone={n.suggest > 0 ? 'warn' : undefined}>
                <b>{num(n.suggest)}</b>
                {cap != null && n.suggest > cap && (
                  <span className="k-t-warn block text-[11px]">
                    vượt trần tồn {num(cap)}
                  </span>
                )}
              </Td>
              <Td>
                {on ? (
                  <Tag tone="done">đã có dòng</Tag>
                ) : n.suggest <= 0 ? (
                  <Tag>đủ</Tag>
                ) : (
                  <Tag tone="warn">còn thiếu</Tag>
                )}
              </Td>{' '}
              {/* prettier-ignore */}
              <Td>{!on && <GridBtn onClick={() => onAdd([n])}>+ Thêm</GridBtn>}</Td>
            </GridRow>
          )
        })}
      </GridBody>
    </Grid>
  )
}

/* ══ 2. DÁN TỪ EXCEL — vùng bảng (tên/mã · SL · giá) → khớp mã → soát → vào đơn ══
   Ba bậc khớp: mã/chắc (tự chọn), mờ (máy đề cử, người soát), không khớp (bỏ ·
   chọn tay · dòng tự gõ nếu mẫu cho phép). Không nuốt dòng nào im lặng. */
type MatchResult = { match: PoMaterial | null; candidates: PoMaterial[]; confidence: 'code' | 'sure' | 'fuzzy' | null } // prettier-ignore
type PasteRow = {
  pasted: PastedPoLine
  result: MatchResult
  choice: 'skip' | 'free' | number
}

export type PasteConfirm = {
  matched: { material: PoMaterial; qty: number | null; price: number | null; note: string | null }[] // prettier-ignore
  free: { name: string; qty: number | null; price: number | null; note: string | null }[]
}

export function DanExcelSheet({
  allowFree,
  onClose,
  onConfirm,
}: {
  /** Mẫu gỗ/gia công: dòng không khớp được chuyển thành dòng tự gõ. */
  allowFree: boolean
  onClose: () => void
  onConfirm: (picked: PasteConfirm) => void
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [rows, setRows] = useState<PasteRow[] | null>(null)
  const [skipped, setSkipped] = useState(0)

  async function analyze() {
    const parsed = parsePoPaste(text)
    if (parsed.lines.length === 0) {
      setErr('Không đọc được dòng nào. Dán vùng bảng từ Excel có cột tên hàng (SL, giá nếu có).') // prettier-ignore
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const { results } = await api<{ results: MatchResult[] }>('/api/dept/supply/po-materials/match', { method: 'POST', body: { items: parsed.lines.map((l) => ({ name: l.name, code: l.code })) } }) // prettier-ignore
      setSkipped(parsed.skipped)
      setRows(
        parsed.lines.map((pasted, i) => {
          const r = results[i]
          const idx = r.match ? Math.max(0, r.candidates.findIndex((c) => c.id === r.match!.id)) : -1 // prettier-ignore
          const candidates = r.match && idx === -1 && r.candidates.length === 0 ? [r.match] : r.candidates // prettier-ignore
          return { pasted, result: { ...r, candidates }, choice: r.match ? (idx === -1 ? 0 : idx) : 'skip' } // prettier-ignore
        }),
      )
    } catch (e) {
      setErr(`Khớp mã thất bại: ${apiErrorText(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const picked = useMemo((): PasteConfirm => {
    const out: PasteConfirm = { matched: [], free: [] }
    for (const r of rows ?? []) {
      if (r.choice === 'skip') continue
      if (r.choice === 'free') {
        out.free.push({ name: r.pasted.name, qty: r.pasted.qty, price: r.pasted.price, note: r.pasted.note }) // prettier-ignore
        continue
      }
      const m = r.result.candidates[r.choice]
      if (m) out.matched.push({ material: m, qty: r.pasted.qty, price: r.pasted.price, note: r.pasted.note }) // prettier-ignore
    }
    return out
  }, [rows])
  const total = picked.matched.length + picked.free.length
  const fuzzy = (rows ?? []).filter((r) => r.result.confidence === 'fuzzy').length
  const none = (rows ?? []).filter((r) => r.choice === 'skip').length

  return (
    <Sheet
      open
      onClose={onClose}
      width={860}
      title="Dán từ Excel"
      subtitle="Dán vùng bảng từ sổ (tên hàng hoặc mã · số lượng · đơn giá). Máy khớp mã, bạn soát dòng máy đề cử, rồi vào đơn một lượt."
      footer={
        rows ? (
          <>
            <Btn onClick={() => setRows(null)}>‹ Dán lại</Btn>
            <SheetActions
              busy={busy}
              disabled={total === 0}
              onCancel={onClose}
              onConfirm={() => {
                onConfirm(picked)
                onClose()
              }}
              confirmLabel={`Thêm ${total} dòng vào đơn`}
            />
          </>
        ) : (
          <SheetActions busy={busy} disabled={!text.trim()} onCancel={onClose} onConfirm={() => void analyze()} confirmLabel="Đọc & khớp mã" /> // prettier-ignore
        )
      }
    >
      {!rows ? (
        <>
          <TextArea
            value={text}
            onChange={setText}
            rows={12}
            placeholder={'Thép hộp 40x40x1.2\t2000\t18000\nSơn tĩnh điện đen\t120\t80000'}
          />{' '}
          {/* prettier-ignore */}
          <p className="mt-2 text-[var(--fs-sm)] text-[var(--ink-3)]">
            Nhận cả bảng có tiêu đề lẫn không; số kiểu Việt (1.234,5) và Excel Anh (1,234.5)
            đều đọc được. Dòng “Cộng”, dòng trống tên bị bỏ và được đếm.
          </p>
          {err && <p className="k-t-stop mt-2 text-[var(--fs-sm)]">{err}</p>}
        </>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap gap-x-4 text-[var(--fs-sm)] text-[var(--ink-2)]">
            <span>
              Đọc được <b className="num">{rows.length}</b> dòng
            </span>
            {fuzzy > 0 && (
              <span className="k-t-warn">
                <b className="num">{fuzzy}</b> dòng máy đề cử — soát lại
              </span>
            )}
            {none > 0 && (
              <span>
                <b className="num">{none}</b> dòng chưa chọn mã
              </span>
            )}
            {skipped > 0 && (
              <span>
                bỏ <b className="num">{skipped}</b> dòng tổng / trống
              </span>
            )}
          </div>
          <Grid minWidth={720}>
            <GridHead>
              <Th>Trong sổ</Th>
              <Th num width={80}>
                SL
              </Th>
              <Th num width={90}>
                Giá
              </Th>
              <Th width={90}>Khớp</Th>
              <Th>Vật tư trong danh mục</Th>
            </GridHead>
            <GridBody>
              {rows.map((r, i) => {
                const tone = r.result.confidence === 'fuzzy' ? 'warn' : r.result.confidence ? 'done' : 'neutral' // prettier-ignore
                const label = r.result.confidence === 'code' ? 'theo mã' : r.result.confidence === 'sure' ? 'chắc' : r.result.confidence === 'fuzzy' ? 'đề cử' : 'không' // prettier-ignore
                return (
                  <GridRow key={i}>
                    <Td>
                      {r.pasted.name}
                      {r.pasted.code && (
                        <span className="num text-[var(--ink-3)]">
                          {' '}
                          · {r.pasted.code}
                        </span>
                      )}
                    </Td>
                    <Td num>{r.pasted.qty != null ? num(r.pasted.qty) : '—'}</Td>
                    <Td num>{r.pasted.price != null ? num(r.pasted.price) : '—'}</Td>
                    <Td>
                      <Tag tone={tone}>{label}</Tag>
                    </Td>
                    <Td>
                      <Pick
                        label={`Chọn mã cho ${r.pasted.name}`}
                        value={String(r.choice)}
                        onChange={(v) => setRows((rs) => rs!.map((x, j) => (j === i ? { ...x, choice: v === 'skip' || v === 'free' ? v : Number(v) } : x)))} // prettier-ignore
                        options={[
                          ...r.result.candidates.map((c, k) => ({ value: String(k), label: `${c.code} · ${c.name} · ${c.unit}` })), // prettier-ignore
                          ...(allowFree
                            ? [
                                {
                                  value: 'free',
                                  label: '— dòng tự gõ (giữ tên trong sổ) —',
                                },
                              ]
                            : []),
                          { value: 'skip', label: '— bỏ dòng này —' },
                        ]}
                      />
                    </Td>
                  </GridRow>
                )
              })}
            </GridBody>
          </Grid>
        </>
      )}
    </Sheet>
  )
}

/* ══ 3. CHIA ĐỢT GIAO LÚC SOẠN — mỗi đợt một CỘT (NCC giao theo CHUYẾN) ═══
   Cột dọc thì ngày khai một lần cho mọi vật tư trong chuyến; người mua đọc
   ngang một hàng là thấy trọn đường đi của một vật tư. In lên phiếu gửi NCC. */
export function ChiaDotSoanGrid({
  lines,
  columns,
  onChange,
}: {
  lines: Line[]
  columns: PlanColumn[]
  onChange: (next: PlanColumn[]) => void
}) {
  // Dòng tự do (gỗ/gia công) nghiệm thu ngoài sổ kho — không đi theo đợt.
  const rows = lines.map((l, i) => ({ l, i })).filter(({ l }) => !l.is_free)
  const qtyOf = (l: Line) => (typeof l.qty === 'number' ? l.qty : 0)
  const setCol = (ci: number, patch: Partial<PlanColumn>) => onChange(columns.map((c, j) => (j === ci ? { ...c, ...patch } : c))) // prettier-ignore
  const setQty = (ci: number, li: number, v: number | '') => onChange(columns.map((c, j) => (j === ci ? { ...c, qty: { ...c.qty, [li]: v } } : c))) // prettier-ignore
  const drafts = columnsToShipments(columns)
  // Kiểm bằng CHÍNH hàm server dùng (chỉ số dòng đóng vai id).
  const v = validateShipments(
    drafts.map((d) => ({ expected_date: d.expected_date, lines: d.lines.map((l) => ({ po_line_id: String(l.line_index), qty: l.qty })) })), // prettier-ignore
    rows.map(({ l, i }) => ({ id: String(i), qty_ordered: qtyOf(l), name: l.name })),
  )

  if (rows.length === 0) {
    return <div className="px-[var(--gutter)] py-3 text-[var(--fs-sm)] text-[var(--ink-2)]">Chưa có dòng vật tư kho nào để chia đợt.</div> // prettier-ignore
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-[var(--gutter)] py-2 text-[var(--fs-sm)] text-[var(--ink-2)]">
        {drafts.length > 0 ? (
          <span>
            <b className="num">{drafts.length}</b> đợt — in lên phiếu gửi NCC. Ô để trống
            = không nằm trong đợt đó.
          </span>
        ) : (
          <span>
            Tuỳ chọn — hàng về nhiều chuyến thì thêm cột, mỗi cột một ngày giao.
          </span>
        )}
        <span className="ml-auto">
          <GridBtn onClick={() => onChange([...columns, { date: '', qty: {} }])}>
            + Thêm đợt
          </GridBtn>
        </span>
      </div>
      {columns.length > 0 && (
        <Grid minWidth={520 + columns.length * 150}>
          <GridHead>
            <Th>Vật tư</Th>
            <Th num width={90}>
              SL đặt
            </Th>
            {columns.map((c, ci) => (
              <Th key={ci} width={150}>
                <span className="flex items-center gap-1">
                  <DateInput
                    value={c.date}
                    onChange={(d) => setCol(ci, { date: d })}
                    label={`Ngày đợt ${ci + 1}`}
                  />
                  <GridBtn
                    title="Bỏ đợt"
                    onClick={() => onChange(columns.filter((_, j) => j !== ci))}
                  >
                    ×
                  </GridBtn>
                </span>
              </Th>
            ))}
            <Th num width={100}>
              Chưa xếp
            </Th>
          </GridHead>
          <GridBody>
            {rows.map(({ l, i }) => {
              const left = planLeft(columns, i, qtyOf(l))
              return (
                <GridRow key={i}>
                  <Td>
                    <span className="num k-strong">{l.code}</span> · {l.name}
                  </Td>
                  <Td num>
                    {num(qtyOf(l))} {l.unit}
                  </Td>
                  {columns.map((c, ci) => (
                    <Td key={ci} num>
                      <NumInput
                        value={
                          c.qty[i] === undefined || c.qty[i] === ''
                            ? ''
                            : String(c.qty[i])
                        }
                        aria-label={`SL đợt ${ci + 1} của ${l.name}`}
                        onCommit={(raw) => {
                          const n = Number(raw.replace(',', '.'))
                          setQty(ci, i, raw.trim() === '' || !(n >= 0) ? '' : n)
                        }}
                      />
                    </Td>
                  ))}
                  <Td num tone={left < 0 ? 'stop' : left > 0 ? 'warn' : undefined}>
                    {left === 0 ? '✓' : num(left)}
                  </Td>
                </GridRow>
              )
            })}
          </GridBody>
          <GridFoot>
            <Td colSpan={2 + columns.length}>
              {v.errors.length > 0 ? (
                <span className="k-t-stop font-normal">{v.errors.join(' · ')}</span>
              ) : v.warnings.length > 0 ? (
                <span className="k-t-warn font-normal">{v.warnings.join(' · ')}</span>
              ) : (
                <span className="font-normal text-[var(--ink-3)]">
                  Cột chưa có ngày hoặc không có số sẽ không lưu.
                </span>
              )}
            </Td>
            <Td />
          </GridFoot>
        </Grid>
      )}
    </>
  )
}

/* ══ 4. CẬP NHẬT DANH MỤC SAU KHI LƯU — không tự ghi ngầm ═══════════════
   Server trả "gõ trên dòng mà danh mục đang trống"; người soạn duyệt rồi mới
   ghi. Fill-empty không bao giờ đè; chỉ giá mua gần nhất là đè có chủ đích. */
export function CapNhatDanhMucSheet({
  items,
  busy,
  onSkip,
  onConfirm,
}: {
  items: CatalogSuggestion[]
  busy: boolean
  onSkip: () => void
  onConfirm: (picked: CatalogSuggestion[]) => void
}) {
  const [off, setOff] = useState<Set<string>>(new Set())
  const picked = items.filter((s) => !off.has(s.material_id))
  return (
    <Sheet
      open
      onClose={onSkip}
      width={720}
      title="Đơn đã lưu — cập nhật danh mục vật tư?"
      subtitle="Những thông số bạn gõ trên dòng mà danh mục đang để trống. Ghi vào thì lần đặt sau tự điền sẵn."
      footer={
        <>
          <Btn onClick={onSkip} disabled={busy}>
            Để sau
          </Btn>
          <Btn
            primary
            disabled={busy || picked.length === 0}
            onClick={() => onConfirm(picked)}
          >
            {busy ? 'Đang ghi…' : `Cập nhật ${picked.length} vật tư`}
          </Btn>
        </>
      }
    >
      <Grid minWidth={600}>
        <GridHead>
          <Th width={30} />
          <Th>Vật tư</Th>
          <Th>Ghi vào danh mục</Th>
        </GridHead>
        <GridBody>
          {items.map((s) => (
            <GridRow key={s.material_id}>
              <Td>
                <Tick
                  checked={!off.has(s.material_id)}
                  onChange={() => setOff((o) => { const n = new Set(o); if (n.has(s.material_id)) n.delete(s.material_id); else n.add(s.material_id); return n })} // prettier-ignore
                  label={`Cập nhật ${s.code}`}
                />
              </Td>
              <Td>
                <span className="num k-strong">{s.code}</span> · {s.name}
              </Td>
              <Td>
                <div className="flex flex-wrap gap-x-3 whitespace-normal">
                  {s.fields.map((f) => (
                    <span key={f.field}>
                      {f.label}:{' '}
                      <b className="num">
                        {f.overwrite && f.before != null ? `${f.before} → ` : ''}
                        {String(f.value)}
                      </b>
                    </span>
                  ))}
                </div>
              </Td>
            </GridRow>
          ))}
        </GridBody>
      </Grid>
      <Consequence>
        Chỉ điền ô đang trống; giá mua gần nhất thì đè có chủ ý. Kho vẫn thấy vết “vì đơn
        nào”.
      </Consequence>
    </Sheet>
  )
}
