import { api, apiErrorText } from '@/lib/api'
import { canReschedule } from '@/lib/po-reschedule'
import { validateShipments, type ShipmentInput } from '@/lib/po-shipments'
import { dmy } from './don-chung-tu.shared'
import type { ShipmentLite } from './nhan-hang'
import type { PlanColumn } from './soan-don'

/**
 * SỬA TẠI CHỖ đơn đã ra khỏi nháp (B1, 28/09/2026 — artboard 14).
 *
 * Trước đó một tờ đơn có BỐN cửa sửa (Điều chỉnh · Sửa điều khoản · Đổi hẹn giao
 * · Thêm đợt), ba cửa nằm trong "⋯"; đổi hẹn giao bắt ghi lý do, và kết quả đo
 * được là 53/85 đơn đã gửi trống hạn giao, 0 vết đổi hẹn. Nay MỘT nút "Sửa" mở
 * hẹn giao + điều khoản + số HĐ + người ký + ghi chú cùng lúc; Lưu ghi theo PHẦN
 * bằng các route sẵn có (dời hẹn → điều khoản), server không đổi.
 *
 * File thuần (không React) để test được: luật hẹn giao đổi được khi nào, lưu
 * theo phần và câu báo khi hỏng giữa chừng.
 */

export type DateEdit = {
  /** Bước này đổi hẹn giao được không (`canReschedule`). */
  ok: boolean
  /** Vì sao khoá — nói ngay cạnh ô. */
  why?: string
  /** Ngày đang lưu (YYYY-MM-DD), '' = chưa hẹn. */
  current: string
  /** Người dùng đã đổi ngày so với bản đang lưu. */
  changed: boolean
}

export function dateEditState(
  po: { status: string; expected_at: string | null } | null,
  expectedAt: string,
  editing: boolean,
): DateEdit {
  const current = po?.expected_at ? po.expected_at.slice(0, 10) : ''
  const guard = po
    ? canReschedule(po.status)
    : { ok: false as const, reason: 'Lưu đơn trước' }
  return {
    ok: guard.ok,
    why: guard.ok ? undefined : guard.reason,
    current,
    changed: editing && guard.ok && expectedAt !== current,
  }
}

/** Chặn TRƯỚC khi gọi server — trả câu người đọc được, hoặc null nếu lưu được. */
export function suaTaiChoPreflight(
  noteOver: number,
  date: DateEdit,
  expectedAt: string,
): string | null {
  if (noteOver > 0) return `Ghi chú dài hơn mức cho phép ${noteOver} ký tự`
  if (date.changed && !expectedAt)
    return 'Hạn giao đang trống — chọn ngày, hoặc bấm Thôi để giữ ngày cũ'
  return null
}

type HeaderLike = {
  expectedAt: string
  contractNo: string
  terms: { quality: string; delivery_place: string; payment: string; invoice: string; lead_time: string } // prettier-ignore
  signerRole: string
  note: string
}

/* ── ĐỢT GIAO SỬA THẲNG TRONG LƯỚI (B2, 28/09/2026) ──────────────────────────
   Dùng lại lưới "Chia đợt" của lúc soạn (mỗi đợt một CỘT). Chỉ đợt ĐANG HẸN
   (planned) vào lưới; đợt xe đã tới / đã nhận nằm ngoài, khoá. Lưu = so cột
   với đợt đang lưu rồi gọi đúng route từng đợt: sửa · thêm · bỏ. */

/** Cột của lưới sửa — `id` = đợt đang lưu, không id = đợt mới thêm. */
export type ShipCol = PlanColumn & { id?: string }

type LineRef = { id?: string | null; name: string; qty_ordered: number }
type ShipInputWithId = ShipmentInput & { id?: string }

/** Đợt đang hẹn → cột sửa được. Dòng đợt trỏ tới line không còn trên đơn thì bỏ mảnh đó. */
export function plannedColumns(shipments: ShipmentLite[], lines: LineRef[]): ShipCol[] {
  const idx = new Map<string, number>()
  lines.forEach((l, i) => l.id && idx.set(l.id, i))
  return shipments
    .filter((s) => s.status === 'planned')
    .map((s) => {
      const qty: Record<number, number | ''> = {}
      for (const l of s.lines) {
        const i = idx.get(l.po_line_id)
        if (i != null) qty[i] = l.qty
      }
      return { id: s.id, date: s.expected_date.slice(0, 10), qty }
    })
}

/** Cột → bộ đợt theo `po_line_id`. Cột không ngày hoặc không số thì bỏ (như lúc soạn). */
export function columnsToInputs(cols: ShipCol[], lines: LineRef[]): ShipInputWithId[] {
  const out: ShipInputWithId[] = []
  for (const c of cols) {
    if (!c.date) continue
    const ls = Object.entries(c.qty)
      .map(([i, q]) => ({
        po_line_id: lines[Number(i)]?.id ?? '',
        qty: typeof q === 'number' ? q : 0,
      })) // prettier-ignore
      .filter((l) => l.po_line_id && l.qty > 0)
    if (ls.length > 0)
      out.push({ ...(c.id ? { id: c.id } : {}), expected_date: c.date, lines: ls })
  }
  return out
}

/** Lỗi chặn của lưới đợt — dùng ĐÚNG hàm server dùng (`validateShipments`), cộng đợt đã khoá vào phần "đã chia". */
export function shipmentsPreflight(
  cols: ShipCol[],
  lines: LineRef[],
  shipments: ShipmentLite[],
): string[] {
  const inputs = columnsToInputs(cols, lines)
  if (inputs.length === 0) return []
  const locked = new Map<string, number>()
  for (const s of shipments) {
    if (s.status === 'planned' || s.status === 'cancelled') continue
    for (const l of s.lines)
      locked.set(l.po_line_id, (locked.get(l.po_line_id) ?? 0) + l.qty)
  }
  const poLines = lines.flatMap((l) => (l.id ? [{ id: l.id, qty_ordered: l.qty_ordered, name: l.name }] : [])) // prettier-ignore
  return validateShipments(inputs, poLines, locked).errors
}

export type ShipmentDiff = {
  edits: {
    id: string
    expected_date: string
    lines: { po_line_id: string; qty: number }[]
  }[]
  adds: ShipmentInput[]
  cancels: string[]
}

/** So cột với đợt đang hẹn: đổi ngày hay số → sửa; cột mới → thêm; đợt biến khỏi lưới → bỏ. */
export function diffShipments(
  cols: ShipCol[],
  lines: LineRef[],
  shipments: ShipmentLite[],
): ShipmentDiff {
  const before = new Map(
    shipments.filter((s) => s.status === 'planned').map((s) => [s.id, s]),
  )
  const key = (ls: { po_line_id: string; qty: number }[]) =>
    ls
      .map((l) => `${l.po_line_id}:${l.qty}`)
      .sort()
      .join('|')
  const out: ShipmentDiff = { edits: [], adds: [], cancels: [] }
  const seen = new Set<string>()
  for (const s of columnsToInputs(cols, lines)) {
    if (!s.id) {
      out.adds.push({ expected_date: s.expected_date, lines: s.lines })
      continue
    }
    seen.add(s.id)
    const b = before.get(s.id)
    if (!b) continue
    const same =
      b.expected_date.slice(0, 10) === s.expected_date && key(b.lines) === key(s.lines)
    if (!same)
      out.edits.push({ id: s.id, expected_date: s.expected_date, lines: s.lines })
  }
  // Đợt đang hẹn mà không còn cột nào (bị bỏ, hoặc xoá hết số) → bỏ đợt.
  for (const id of before.keys()) if (!seen.has(id)) out.cancels.push(id)
  return out
}

export const shipDiffCount = (d: ShipmentDiff) =>
  d.edits.length + d.adds.length + d.cancels.length

export type SaveOutcome =
  | { ok: true; detail: string }
  | { ok: false; title: string; detail: string; dateSaved: boolean }

/**
 * Lưu theo PHẦN, mỗi phần một route sẵn có: dời hẹn (kéo đợt chưa giao theo, ghi
 * vết) TRƯỚC, điều khoản, rồi đợt giao (bỏ → sửa → thêm). Không có giao dịch
 * gộp, nên hỏng giữa chừng phải nói rõ phần nào đã vào — người dùng biết mình
 * còn phải làm gì.
 */
export async function saveSuaTaiCho(
  poId: string,
  h: HeaderLike,
  date: DateEdit,
  reason: string,
  ships: ShipmentDiff = { edits: [], adds: [], cancels: [] },
): Promise<SaveOutcome> {
  let dateSaved = false
  let termsSaved = false
  let shipDone = 0
  const shipAll = shipDiffCount(ships)
  try {
    if (date.changed) {
      await api(`/api/dept/supply/pos/${poId}/reschedule`, {
        method: 'POST',
        body: { expected_at: h.expectedAt, reason: reason.trim() },
      })
      dateSaved = true
    }
    const t = (v: string) => v.trim() || null
    await api(`/api/dept/supply/pos/${poId}/terms`, {
      method: 'PATCH',
      body: {
        contract_no: t(h.contractNo),
        terms_quality: t(h.terms.quality),
        terms_delivery_place: t(h.terms.delivery_place),
        terms_payment: t(h.terms.payment),
        terms_invoice: t(h.terms.invoice),
        terms_lead_time: t(h.terms.lead_time),
        signer_role: t(h.signerRole),
        note: t(h.note),
      },
    })
    termsSaved = true
    // Đợt giao: bỏ trước (nhả số lượng), rồi sửa, rồi thêm — server kiểm tổng
    // các đợt sống không vượt SL đặt ở từng bước. Lý do máy ghi: sửa tại chỗ.
    for (const id of ships.cancels) {
      await api(`/api/dept/supply/shipments/${id}`, { method: 'PATCH', body: { action: 'cancel', reason: 'Bỏ đợt khi sửa đơn tại chỗ' } }) // prettier-ignore
      shipDone++
    }
    for (const s of ships.edits) {
      await api(`/api/dept/supply/shipments/${s.id}`, { method: 'PATCH', body: { action: 'edit', expected_date: s.expected_date, lines: s.lines, reason: 'Sửa đợt trong lưới khi sửa đơn tại chỗ' } }) // prettier-ignore
      shipDone++
    }
    if (ships.adds.length) {
      await api(`/api/dept/supply/pos/${poId}/shipments`, { method: 'POST', body: { shipments: ships.adds } }) // prettier-ignore
      shipDone += ships.adds.length
    }
    const parts = [
      dateSaved
        ? `hẹn giao ${dmy(date.current) || 'chưa hẹn'} → ${dmy(h.expectedAt)}`
        : null,
      'điều khoản · ghi chú',
      shipAll ? `${shipAll} đợt giao (${[ships.edits.length && `${ships.edits.length} sửa`, ships.adds.length && `${ships.adds.length} thêm`, ships.cancels.length && `${ships.cancels.length} bỏ`].filter(Boolean).join(' · ')})` : null, // prettier-ignore
    ].filter(Boolean)
    return { ok: true, detail: `Đã ghi: ${parts.join(' · ')}` }
  } catch (e) {
    const done = [dateSaved && 'hẹn giao', termsSaved && 'điều khoản', shipDone > 0 && `${shipDone}/${shipAll} đợt`].filter(Boolean) // prettier-ignore
    return {
      ok: false,
      title: done.length
        ? `Đã ghi ${done.join(', ')} — phần còn lại CHƯA lưu`
        : 'Không lưu được',
      detail: apiErrorText(e),
      dateSaved: dateSaved || termsSaved || shipDone > 0,
    }
  }
}

/**
 * Đưa con trỏ vào một ô của khối Đầu đơn theo `aria-label` — chip đầu trang bấm
 * vào là tới đúng ô. Hai nhịp vẽ: mục menu đổi rồi khối mới mở; ô chỉ có sau đó.
 */
export function focusDauDon(label: string): void {
  const find = () =>
    document.querySelector<HTMLElement>(
      `#dau-don [aria-label="${label}"], #dau-don [aria-label="${label} — ngày"]`,
    )
  requestAnimationFrame(() => requestAnimationFrame(() => find()?.focus()))
}
