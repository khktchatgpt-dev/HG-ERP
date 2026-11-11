import type { EntrySheet } from '@/modules/dept/production/worklist.service'
import { CORE_FIELD_LABEL } from '@/lib/stage-config'

/**
 * Kiểu + hằng + kho nháp dùng chung giữa `useGhi` · `luoi-ghi` · `GhiScreen`.
 * Không JSX, không state.
 */

export type Sheet = EntrySheet
export type Line = Sheet['groups'][number]['lines'][number]

/** Một dòng gõ = {khoá cột → chuỗi}. Khoá cột khai ở `buildEditCols`. */
export type LineDraft = Record<string, string>
export type Drafts = Record<string, LineDraft>

export type EditKind = 'num' | 'text' | 'select'

/**
 * CỘT GÕ ĐƯỢC của lưới — dựng từ CẤU HÌNH công đoạn (0287) + ô riêng (0207),
 * không ghi cứng. Thứ tự mảng = trục ngang của bàn phím và vùng dán.
 */
export type EditCol = {
  /** `qty` `defect` `rework` `reason` `worker` `kg` `note`, hoặc `f:<field_key>`. */
  key: string
  label: string
  kind: EditKind
  /** Bắt buộc với DÒNG ĐÃ GÕ SỐ (không bắt dòng để trống). */
  required: boolean
  width: number
  options?: string[]
  /** Chỉ hiện khi bật "Cột chi tiết". */
  detail?: boolean
  /** Dòng phụ dưới tên cột. */
  hint?: string
}

export const FIELD_PREFIX = 'f:'

export function buildEditCols(sheet: Sheet, more: boolean): EditCol[] {
  const core = sheet.stage_cfg.core
  const cols: EditCol[] = [
    { key: 'qty', label: 'SL đạt', kind: 'num', required: true, width: 68 },
  ]
  if (core.defect !== 'off') {
    cols.push({
      key: 'defect',
      label: 'Phế',
      kind: 'num',
      required: core.defect === 'required',
      width: 56,
      hint: 'bỏ hẳn',
    })
  }
  if (core.rework !== 'off') {
    cols.push({
      key: 'rework',
      label: 'Sửa lại',
      kind: 'num',
      required: core.rework === 'required',
      width: 60,
      hint: 'cứu được',
    })
  }
  if (core.defect !== 'off' || core.rework !== 'off') {
    // Lý do chỉ bắt khi dòng CÓ phần không đạt — kiểm ở `rowProblems`.
    cols.push({
      key: 'reason',
      label: 'Lý do lỗi',
      kind: 'text',
      required: false,
      width: 130,
    })
  }
  for (const f of sheet.stage_fields) {
    cols.push({
      key: FIELD_PREFIX + f.field_key,
      label: f.label,
      kind: f.kind === 'select' ? 'select' : f.kind === 'number' ? 'num' : 'text',
      required: f.required,
      width: f.kind === 'number' ? 70 : 96,
      options: f.kind === 'select' ? (f.options ?? []) : undefined,
    })
  }
  if (core.worker !== 'off') {
    cols.push({
      key: 'worker',
      label: CORE_FIELD_LABEL.worker,
      kind: 'text',
      required: core.worker === 'required',
      width: 104,
    })
  }
  if (core.kg !== 'off') {
    cols.push({
      key: 'kg',
      label: 'Kg',
      kind: 'num',
      required: core.kg === 'required',
      width: 64,
      detail: core.kg !== 'required',
      hint: 'trống = ĐM × SL',
    })
  }
  cols.push({
    key: 'note',
    label: 'Ghi chú dòng',
    kind: 'text',
    required: false,
    width: 160,
    detail: true,
  })
  return cols.filter((c) => more || !c.detail)
}

export const num = (s: string | undefined) => {
  if (!s) return 0
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
export const fmt = (n: number) => n.toLocaleString('vi-VN')
export const dmy = (iso: string) => iso.split('-').reverse().join('/')

/** Dòng có số để vào phiếu: đạt, phế hoặc sửa lại > 0. */
export function isTyped(d: LineDraft | undefined): boolean {
  return !!d && (num(d.qty) > 0 || num(d.defect) > 0 || num(d.rework) > 0)
}

/** Dòng ĐÃ GÕ còn thiếu gì — mỗi phần tử trỏ đúng cột để nhảy tới. */
export function rowProblems(
  d: LineDraft,
  cols: EditCol[],
): { key: string; msg: string }[] {
  const out: { key: string; msg: string }[] = []
  const bad = num(d.defect) > 0 || num(d.rework) > 0
  for (const c of cols) {
    const v = (d[c.key] ?? '').trim()
    if (c.key === 'reason') {
      if (bad && !v) out.push({ key: c.key, msg: 'có phế/sửa lại mà chưa ghi vì sao' })
      continue
    }
    if (c.key === 'qty') continue
    if (c.required && !v) out.push({ key: c.key, msg: `chưa khai ${c.label}` })
  }
  return out
}

export const cellId = (componentId: string, key: string) => `cell-${componentId}-${key}`

// ── Cột chi tiết — nhớ theo MÁY (localStorage), đọc qua useSyncExternalStore ──
const MORE_KEY = 'hg:thongke-cot-chi-tiet'
const moreListeners = new Set<() => void>()
export function subscribeMore(cb: () => void) {
  moreListeners.add(cb)
  return () => {
    moreListeners.delete(cb)
  }
}
export function readMore() {
  try {
    return localStorage.getItem(MORE_KEY) === '1'
  } catch {
    return false
  }
}
export function writeMore(v: boolean) {
  try {
    localStorage.setItem(MORE_KEY, v ? '1' : '0')
  } catch {
    /* chế độ riêng tư chặn storage — phiên này vẫn đổi */
  }
  for (const cb of moreListeners) cb()
}

// ── Bản gõ dở — cứu lưới khi lỡ rời trang (L4, 22/09/2026) ─────────────────
// Khôi phục phải do NGƯỜI bấm: tự đổ số cũ vào lưới là mời ghi nhầm số hôm
// trước. Khoá theo (lệnh × công đoạn); kèm ngày + tổ của lúc gõ.
const DRAFT_PREFIX = 'hg:thongke-nhap-do:'
const draftListeners = new Set<() => void>()
export type SavedDraft = {
  at: number
  date: string
  team_id: string
  note: string
  lines: Drafts
}
export const draftKey = (lsxId: string, stage: string) =>
  `${DRAFT_PREFIX}${lsxId}|${stage}`
export function subscribeDraft(cb: () => void) {
  draftListeners.add(cb)
  return () => {
    draftListeners.delete(cb)
  }
}
/** Chuỗi THÔ, không parse: `useSyncExternalStore` so bằng `Object.is`. */
export function readDraftRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
export function writeDraftRaw(key: string, value: Omit<SavedDraft, 'at'> | null) {
  try {
    if (value) localStorage.setItem(key, JSON.stringify({ ...value, at: Date.now() }))
    else localStorage.removeItem(key)
  } catch {
    /* không cứu được thì thôi */
  }
  for (const cb of draftListeners) cb()
}
export function hasAnyValue(lines: Drafts): boolean {
  return Object.values(lines).some((d) => Object.values(d).some((v) => v.trim() !== ''))
}
