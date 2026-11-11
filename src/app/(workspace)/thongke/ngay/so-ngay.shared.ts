import type { EntryDocStatus } from '@/lib/entry-doc-flow'
import type { DayTeam } from '@/modules/dept/production/entries.service'

/**
 * SỔ NGÀY & CHỐT SỔ — phần THUẦN của màn (bản vẽ 1 11/11/2026,
 * https://claude.ai/artifact/QSwyPC46SM81EEQfJiAycT, duyệt Q1–Q7): ghép tổ kỳ
 * vọng + phiếu + khoá thành MỘT hàng mỗi tổ, trạng thái sổ, chip đếm = chip
 * lọc, thứ tự (tổ của người xem lên đầu), câu xác nhận chốt / mở khoá, dấu
 * ở ma trận 7 ngày. Không `'use client'` để trang và test dùng.
 */

export const fmt = (n: number) => n.toLocaleString('vi-VN')
export const cx = (...xs: (string | false | null | undefined | 0)[]) =>
  xs.filter(Boolean).join(' ')
export const dmy = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
export const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
export const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
export const thu = (iso: string) => THU[new Date(`${iso}T00:00:00Z`).getUTCDay()]
/** Giờ VN "09:12" từ timestamptz. */
export const gio = (ts: string | null) =>
  ts
    ? new Date(ts).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh',
      })
    : ''

export type DocRow = {
  id: string
  doc_no: string
  lsx_id: string
  lsx_code: string | null
  stage: string
  status: EntryDocStatus
  team_id: string | null
  created_by_name: string | null
  created_at: string
  total_qty: number
  total_defect: number
  total_rework: number
  line_count: number
}

export type LockRow = {
  team_id: string
  team_name: string | null
  locked_by_name: string | null
  locked_at: string
}

export type UnlockRow = {
  team_department_id: string
  reason: string | null
  actor_name: string | null
  created_at: string
}

export type ToRow = {
  id: string
  name: string
  stage: string
  stage_label: string
  unit: string
  has_jobs: boolean
  docs: DocRow[]
  qty: number
  defect: number
  rework: number
  /** Phiếu nháp / bị trả về — chưa vào số chính thức. */
  drafts: number
  officials: number
  writers: string[]
  lock: { by: string | null; at: string } | null
  /** Lần mở khoá gần nhất của ngày — bày "đã mở lại: lý do". */
  unlock: UnlockRow | null
}

export type TrangThaiSo = 'chua_so' | 'dang_mo' | 'da_chot'

export function trangThaiSo(r: Pick<ToRow, 'docs' | 'lock'>): TrangThaiSo {
  if (r.lock) return 'da_chot'
  return r.docs.length > 0 ? 'dang_mo' : 'chua_so'
}

export const isDraft = (s: EntryDocStatus) => s === 'nhap' || s === 'tu_choi'

/**
 * Một hàng mỗi tổ KỲ VỌNG (Q1) + tổ ngoài danh sách nhưng có phiếu / khoá hôm
 * đó (số đã ghi không bao giờ vô hình). Thứ tự: tổ của người xem lên đầu (Q7),
 * còn lại giữ thứ tự danh mục công đoạn đã sắp ở service.
 */
export function buildRows(
  teams: DayTeam[],
  docs: DocRow[],
  locks: LockRow[],
  unlocks: UnlockRow[],
  myTeamId: string | null,
): ToRow[] {
  const byTeam = new Map<string, ToRow>()
  const mk = (t: DayTeam): ToRow => ({
    id: t.id,
    name: t.name,
    stage: t.stage,
    stage_label: t.stage_label,
    unit: t.unit,
    has_jobs: t.has_jobs,
    docs: [],
    qty: 0,
    defect: 0,
    rework: 0,
    drafts: 0,
    officials: 0,
    writers: [],
    lock: null,
    unlock: null,
  })
  for (const t of teams) byTeam.set(t.id, mk(t))
  const extra = (id: string, name: string | null) => {
    const r = byTeam.get(id)
    if (r) return r
    const n = mk({
      id,
      name: name ?? '?',
      stage: '',
      stage_label: '—',
      unit: '',
      has_jobs: false,
    })
    byTeam.set(id, n)
    return n
  }
  for (const d of docs) {
    const r = extra(d.team_id ?? 'khong-to', d.team_id ? null : '(không tổ)')
    r.docs.push(d)
    if (isDraft(d.status)) r.drafts++
    else {
      r.officials++
      r.qty = r2(r.qty + d.total_qty)
      r.defect = r2(r.defect + d.total_defect)
      r.rework = r2(r.rework + d.total_rework)
    }
    if (d.created_by_name && !r.writers.includes(d.created_by_name))
      r.writers.push(d.created_by_name)
  }
  for (const l of locks) {
    const r = extra(l.team_id, l.team_name)
    r.lock = { by: l.locked_by_name, at: l.locked_at }
  }
  for (const u of unlocks) {
    const r = byTeam.get(u.team_department_id)
    if (r && !r.lock) r.unlock = u
  }
  const rows = [...byTeam.values()]
  for (const r of rows) r.docs.sort((a, b) => a.created_at.localeCompare(b.created_at))
  if (myTeamId && byTeam.has(myTeamId)) {
    const mine = byTeam.get(myTeamId)!
    return [mine, ...rows.filter((r) => r.id !== myTeamId)]
  }
  return rows
}

const r2 = (n: number) => Math.round(n * 100) / 100

export type Chip = { id: string; label: string; test: (r: ToRow) => boolean }

/** Chip đếm bằng ĐÚNG hàm lọc. "Chưa chốt" gồm cả tổ chưa có sổ (Q1). */
export const CHIPS: Chip[] = [
  { id: 'chua_chot', label: 'Chưa chốt', test: (r) => trangThaiSo(r) !== 'da_chot' },
  { id: 'nhap', label: 'Có nháp', test: (r) => r.drafts > 0 },
  { id: 'da_chot', label: 'Đã chốt', test: (r) => trangThaiSo(r) === 'da_chot' },
  { id: 'all', label: 'Tất cả', test: () => true },
]

/** Tổ nên MỞ SẴN hàng con: có nháp hoặc có phế / sửa (Q2). */
export function moSan(r: ToRow): boolean {
  return r.docs.length > 0 && (r.drafts > 0 || r.defect > 0 || r.rework > 0)
}

/** Câu "Sổ ngày" trên hàng tổ. */
export function cauSo(r: ToRow): { tone: 'g' | 'w' | 'z'; text: string; sub?: string } {
  const tt = trangThaiSo(r)
  if (tt === 'da_chot')
    return {
      tone: 'g',
      text: 'đã chốt',
      sub: [r.lock?.by, r.lock ? gio(r.lock.at) : null].filter(Boolean).join(' · '),
    }
  if (tt === 'dang_mo')
    return {
      tone: 'w',
      text: 'đang mở',
      sub:
        r.drafts > 0
          ? `${fmt(r.drafts)} phiếu nháp chưa vào số chính thức`
          : r.unlock
            ? `mở lại: ${r.unlock.reason ?? ''}`
            : undefined,
    }
  return {
    tone: 'z',
    text: 'chưa có sổ',
    sub: r.has_jobs ? 'có việc đang chạy' : undefined,
  }
}

/** Nút cuối hàng theo trạng thái + quyền. */
export function nutHang(
  r: ToRow,
  p: { canLock: boolean; canUnlock: boolean },
): 'ghi' | 'chot' | 'mo_khoa' | null {
  const tt = trangThaiSo(r)
  if (tt === 'da_chot') return p.canUnlock ? 'mo_khoa' : null
  if (tt === 'dang_mo') return p.canLock ? 'chot' : null
  return p.canLock ? 'ghi' : null
}

/** Câu xác nhận chốt sổ (dưới hàng tổ): tóm tắt + cảnh báo nháp (Q3) hoặc sổ trống (Q4). */
export function cauChot(
  r: ToRow,
  date: string,
): { text: string; warn: string | null; empty: boolean } {
  if (r.docs.length === 0)
    return {
      text: `${r.name} · ${dm(date)} chưa có sổ — chốt sổ TRỐNG là ghi nhận "tổ không ghi hôm nay", Báo cáo đếm ngày đã chốt.`,
      warn: null,
      empty: true,
    }
  const parts = [
    `${fmt(r.officials)} phiếu chính thức`,
    `${fmt(r.qty)} ${r.unit}`.trim(),
    r.defect > 0 ? `phế ${fmt(r.defect)}` : null,
    r.rework > 0 ? `sửa ${fmt(r.rework)}` : null,
  ].filter(Boolean)
  const drafts = r.docs.filter((d) => isDraft(d.status))
  return {
    text: `Chốt sổ ${r.name} · ${dm(date)}: ${parts.join(' · ')}.`,
    warn:
      drafts.length > 0
        ? `${drafts.map((d) => d.doc_no).join(', ')} còn NHÁP (${fmt(drafts.reduce((a, d) => a + d.total_qty, 0))} ${r.unit}) — chốt xong không ghi chính thức được nữa.`
        : null,
    empty: false,
  }
}

/** Ô ma trận 7 ngày: dấu ✓ đã chốt · ● còn nháp · ! có sổ mà quên chốt (ngày đã qua). */
export function dauO(
  c: { qty: number; drafts: number; locked: boolean } | undefined,
  date: string,
  today: string,
): '✓' | '●' | '!' | null {
  if (!c) return null
  if (c.locked) return '✓'
  if (c.drafts > 0) return '●'
  if (date < today && c.qty > 0) return '!'
  return null
}
