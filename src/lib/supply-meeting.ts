/**
 * BẢNG HỌP CUNG ỨNG — mức rủi ro của MỘT LỆNH SẢN XUẤT nhìn từ vật tư.
 * Logic thuần, có test; caller truyền `todayIso` (yyyy-mm-dd).
 *
 * Câu hỏi trong họp không phải "đơn mua đang ở bậc nào" (đó là `lsxSupplyGate`)
 * mà là "LỆNH NÀY CÓ NGUY CƠ DỪNG VÌ THIẾU VẬT TƯ KHÔNG, VÀ AI PHẢI LÀM GÌ".
 * Bậc chỉ mô tả vị trí; mức rủi ro ghép bậc với THỜI GIAN CÒN LẠI của lệnh —
 * một lệnh "đang về" mà hạn vật tư là ngày mai khẩn hơn một lệnh "chưa lập đơn"
 * còn ba tuần. Vì thế tệp này KHÔNG thay `lsx-supply.ts`, nó đứng trên đó.
 *
 * Mốc tính "sát theo lệnh" (user chốt 05/09/2026): dùng HẠN VẬT TƯ của chính
 * lệnh (`materials_due_at`, chính là cột "Hạn ĐH phải về" trong sổ Excel của
 * Cung ứng). Lệnh chưa đặt hạn thì tạm mượn NGÀY XUẤT và nói rõ là suy ra —
 * xuất mà chưa có vật tư thì chắc chắn trễ, nên mốc đó vẫn là mốc thật, chỉ là
 * muộn hơn mốc đúng. Không có cả hai thì xếp riêng: không có mốc thì mọi cảnh
 * báo đều im, và đó chính là thứ phải được nhìn thấy.
 */

import { daysUntilDue, lsxSupplyGate, type LsxSupplyInput } from './lsx-supply'
import { LATE_RISK_HORIZON_DAYS, isMissingEta } from './late-risk'

/** Còn ≤ N ngày tới mốc mà vật tư chưa đủ = nguy cơ dừng sản xuất. */
export const MEETING_STOP_DAYS = 3

export type MeetingRiskLevel = 'stop' | 'warn' | 'watch' | 'inflight' | 'ready'

export type MeetingOwner = 'Cung ứng' | 'Nhà cung cấp' | 'Kho' | '—'

export type MeetingRiskInput = LsxSupplyInput & {
  materials_due_at: string | null
  ship_date: string | null
  /** Đơn mua của lệnh — chỉ cần trạng thái + hẹn giao. */
  pos: { status: string; expected_at: string | null }[]
}

export type MeetingDue = {
  date: string
  /** Mốc lấy từ hạn vật tư của lệnh, hay phải mượn ngày xuất. */
  source: 'materials_due_at' | 'ship_date'
}

export type MeetingRisk = {
  level: MeetingRiskLevel
  label: string
  /** Một câu nói rõ VÌ SAO lệnh ở mức này — chính là dòng "Vấn đề" trong họp. */
  reason: string
  /** Ai đang cầm bóng. */
  owner: MeetingOwner
  /** Việc phải làm, thể mệnh lệnh. Rỗng khi không có gì phải làm. */
  action: string
  /**
   * Câu hỏi cần SẢN XUẤT trả lời — chỉ có khi lệnh ở mức khẩn: vật tư không
   * kịp thì bên xưởng phải quyết chờ hay đổi lịch, Cung ứng không quyết thay
   * được. Đây là nguồn của khối "Việc cần quyết định".
   */
  decision: string | null
  due: MeetingDue | null
  /** Số ngày tới mốc (âm = đã qua). null khi không có mốc. */
  daysLeft: number | null
  /** Hẹn về gần nhất trong các đơn chưa xong. */
  nextExpected: string | null
  /** Đơn đã gửi NCC mà không có hẹn giao. */
  posNoEta: number
  /** Lệnh không có hạn vật tư lẫn ngày xuất — cờ riêng để UI gắn nhãn dù mức là gì. */
  missingDue: boolean
  /** Thứ tự khẩn: nhỏ trước. */
  rank: number
}

export const MEETING_LEVEL: Record<
  MeetingRiskLevel,
  { label: string; tone: 'stop' | 'warn' | 'muted' | 'primary' | 'done'; order: number }
> = {
  stop: { label: 'Nguy cơ dừng SX', tone: 'stop', order: 0 },
  warn: { label: 'Thiếu / chưa mua', tone: 'warn', order: 1 },
  watch: { label: 'Chưa có mốc', tone: 'muted', order: 2 },
  inflight: { label: 'Đang về', tone: 'primary', order: 3 },
  ready: { label: 'Đủ vật tư', tone: 'done', order: 4 },
}

export const MEETING_LEVELS = (Object.keys(MEETING_LEVEL) as MeetingRiskLevel[]).sort(
  (a, b) => MEETING_LEVEL[a].order - MEETING_LEVEL[b].order,
)

/** Mốc của lệnh: hạn vật tư trước, thiếu thì mượn ngày xuất. */
export function meetingDue(r: {
  materials_due_at: string | null
  ship_date: string | null
}): MeetingDue | null {
  if (r.materials_due_at) return { date: r.materials_due_at, source: 'materials_due_at' }
  if (r.ship_date) return { date: r.ship_date, source: 'ship_date' }
  return null
}

const PO_ALIVE_NOT_DONE = new Set([
  'ordered',
  'confirmed',
  'in_transit',
  'partial',
  'approved',
  'pending_approval',
])

/** Đơn ĐÃ RA KHỎI NHÀ — chỉ những đơn này mới đòi hẹn giao được. */
const PO_SENT = new Set(['ordered', 'confirmed', 'in_transit', 'partial'])

/** dd/mm từ yyyy-mm-dd — để câu lý do đọc như người Việt đọc. */
function dmy(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

/** "còn 2 ngày" / "hôm nay" / "đã qua 4 ngày". */
function whenText(daysLeft: number): string {
  if (daysLeft === 0) return 'là hôm nay'
  if (daysLeft > 0) return `còn ${daysLeft} ngày`
  return `đã qua ${-daysLeft} ngày`
}

function dueText(due: MeetingDue, daysLeft: number): string {
  const name = due.source === 'materials_due_at' ? 'Hạn vật tư' : 'Ngày xuất'
  return `${name} ${dmy(due.date)} (${whenText(daysLeft)})`
}

export function assessMeetingRisk(r: MeetingRiskInput, todayIso: string): MeetingRisk {
  const gate = lsxSupplyGate(r)
  const due = meetingDue(r)
  const daysLeft = due ? daysUntilDue(due.date, todayIso) : null
  const notDone = r.pos.filter((p) => PO_ALIVE_NOT_DONE.has(p.status))
  const nextExpected =
    notDone
      .map((p) => p.expected_at)
      .filter((d): d is string => d != null)
      .sort()[0] ?? null
  const posNoEta = r.pos.filter((p) => PO_SENT.has(p.status) && isMissingEta(p)).length
  /*
   * Đơn ĐÃ DUYỆT mà chưa gửi NCC: bậc `lsxSupplyGate` xếp nó vào "đang về" (nó
   * đếm approved như đơn mở), nhưng trong họp thì đó là đơn còn nằm trong nhà —
   * việc của Cung ứng, cùng nhóm với "chưa gửi" của `supply-watch`. Xét riêng ở
   * đây thay vì sửa bậc, để màn Vật tư theo lệnh không đổi nghĩa.
   */
  const posApproved = r.pos.filter((p) => p.status === 'approved').length

  const base = { due, daysLeft, nextExpected, posNoEta, missingDue: due === null }
  const make = (
    level: MeetingRiskLevel,
    rest: Pick<MeetingRisk, 'reason' | 'owner' | 'action' | 'decision'>,
  ): MeetingRisk => ({
    level,
    label: MEETING_LEVEL[level].label,
    rank: MEETING_LEVEL[level].order,
    ...base,
    ...rest,
  })

  // 1. Xong là xong, không cần nhìn mốc.
  if (gate.key === 'done') {
    return make('ready', { reason: gate.detail, owner: '—', action: '', decision: null })
  }

  // Mô tả "đang kẹt ở đâu" — dùng chung cho mức khẩn lẫn mức theo dõi.
  type Stuck = { text: string; action: string; mine?: boolean; owner?: MeetingOwner }
  const stuck: Stuck = (() => {
    switch (gate.key) {
      case 'none':
        return { text: 'chưa lập đơn mua nào', action: 'Lập đơn mua ngay' }
      case 'unsent':
        return {
          text: `${r.posUnsent} đơn còn nháp hoặc chờ ký, chưa gửi NCC`,
          action: 'Gửi đơn cho nhà cung cấp',
        }
      case 'late':
        return {
          text: `${r.posLate} đơn nhà cung cấp quá hẹn giao`,
          action: 'Giục nhà cung cấp, chốt ngày mới',
        }
      default:
        if (posApproved > 0) {
          return {
            text: `${posApproved} đơn đã duyệt nhưng chưa gửi NCC`,
            action: 'Gửi đơn cho nhà cung cấp',
            mine: true,
            owner: 'Cung ứng' as const,
          }
        }
        return {
          text: nextExpected
            ? `vật tư chưa về đủ, hẹn gần nhất ${dmy(nextExpected)}`
            : 'vật tư chưa về đủ, chưa có hẹn giao',
          action: 'Giục nhà cung cấp giao sớm',
        }
    }
  })()
  const mine = stuck.mine ?? gate.mine
  const owner: MeetingOwner = stuck.owner ?? gate.owner

  // 2. KHẨN — thời gian không còn để xoay: mốc đã sát mà vật tư chưa đủ, hoặc
  //    mốc còn trong tầm cảnh báo mà bóng vẫn ở phía Cung ứng (chưa mua/chưa
  //    gửi/NCC trễ). Sản xuất phải được hỏi ngay.
  if (due && daysLeft !== null) {
    const critical = daysLeft <= MEETING_STOP_DAYS
    const mineAndClose = mine && daysLeft <= LATE_RISK_HORIZON_DAYS
    if (critical || mineAndClose) {
      return make('stop', {
        reason: `${dueText(due, daysLeft)} mà ${stuck.text}`,
        owner,
        action: stuck.action,
        decision: 'Chờ vật tư hay đổi lịch / chuyển lệnh khác?',
      })
    }
  }

  // 3. THEO DÕI — việc của Cung ứng, còn thời gian.
  if (mine) {
    return make('warn', {
      reason:
        due && daysLeft !== null
          ? `${stuck.text}; ${dueText(due, daysLeft)}`
          : `${stuck.text}; lệnh chưa đặt hạn vật tư`,
      owner,
      action: stuck.action,
      decision: null,
    })
  }

  // 4. CHƯA CÓ MỐC — không đo được trễ. Lệnh không hạn xếp trước đơn không hẹn:
  //    thiếu hạn lệnh thì cả lệnh mù, thiếu hẹn đơn chỉ mù một đơn.
  if (!due) {
    return make('watch', {
      reason: 'Lệnh chưa đặt hạn vật tư và chưa có ngày xuất, không đo được trễ',
      owner: 'Cung ứng',
      action: 'Đặt hạn vật tư cho lệnh',
      decision: null,
    })
  }
  if (posNoEta > 0) {
    return make('watch', {
      reason: `${posNoEta} đơn đã gửi nhưng chưa có hẹn giao, cảnh báo trễ đang bỏ qua`,
      owner: 'Cung ứng',
      action: 'Chốt ngày giao với nhà cung cấp',
      decision: null,
    })
  }

  // 5. Còn lại: NCC đang lo, còn thời gian.
  return make('inflight', {
    reason: `${stuck.text}; ${dueText(due, daysLeft as number)}`,
    owner: 'Nhà cung cấp',
    action: '',
    decision: null,
  })
}

// ── Gom cho cả bảng họp ─────────────────────────────────────────────────

export type MeetingRow<T> = { row: T; risk: MeetingRisk }

/**
 * Xếp thứ tự đọc trong họp: khẩn trước, cùng mức thì mốc gần trước (không mốc
 * xếp sau có mốc), rồi mã lệnh giảm dần cho ổn định.
 */
export function compareMeeting<T extends { code: string }>(
  a: MeetingRow<T>,
  b: MeetingRow<T>,
): number {
  if (a.risk.rank !== b.risk.rank) return a.risk.rank - b.risk.rank
  const da = a.risk.daysLeft ?? Number.POSITIVE_INFINITY
  const db = b.risk.daysLeft ?? Number.POSITIVE_INFINITY
  if (da !== db) return da - db
  return b.row.code.localeCompare(a.row.code, 'vi', { numeric: true })
}

export function buildMeeting<T extends MeetingRiskInput & { code: string }>(
  rows: T[],
  todayIso: string,
): {
  rows: MeetingRow<T>[]
  counts: Record<MeetingRiskLevel, number>
  /** Lệnh cần nêu trong họp: mọi mức trừ Đang về và Đủ. */
  issues: MeetingRow<T>[]
  /** Việc Sản xuất phải quyết — lệnh mức khẩn. */
  decisions: MeetingRow<T>[]
} {
  const all = rows
    .map((row) => ({ row, risk: assessMeetingRisk(row, todayIso) }))
    .sort(compareMeeting)
  const counts: Record<MeetingRiskLevel, number> = {
    stop: 0,
    warn: 0,
    watch: 0,
    inflight: 0,
    ready: 0,
  }
  for (const m of all) counts[m.risk.level]++
  return {
    rows: all,
    counts,
    issues: all.filter((m) => m.risk.rank <= MEETING_LEVEL.watch.order),
    decisions: all.filter((m) => m.risk.decision !== null),
  }
}

// ── Việc cần quyết định trong họp ───────────────────────────────────────

export type AgendaItem<T> = {
  /** Bộ phận phải làm / phải quyết. */
  dept: string
  action: string
  rows: MeetingRow<T>[]
  /** Mốc gần nhất trong các lệnh của việc này. */
  due: string | null
  /** Mức khẩn cao nhất trong nhóm (nhỏ = khẩn). */
  rank: number
}

/**
 * Gom việc theo (bộ phận, hành động) — KHÔNG lặp lại danh sách vấn đề. Trong
 * họp người ta hỏi "Cung ứng phải làm gì, Sản xuất phải quyết gì, Giám đốc phải
 * ký gì", chứ không đọc lại từng lệnh lần thứ hai.
 *
 *  - Lệnh mức khẩn sinh một dòng cho SẢN XUẤT (câu hỏi `decision`).
 *  - Lệnh có đơn đang chờ ký sinh một dòng cho GIÁM ĐỐC — đơn nằm bàn Giám đốc
 *    thì Cung ứng không làm gì được, nêu ở đây là để nhắc đúng người.
 *  - Mọi lệnh có `action` gom vào dòng của bộ phận đang cầm bóng.
 */
export function buildAgenda<T extends MeetingRiskInput>(
  rows: MeetingRow<T>[],
): AgendaItem<T>[] {
  const map = new Map<string, AgendaItem<T>>()
  const add = (dept: string, action: string, m: MeetingRow<T>) => {
    const key = `${dept}|${action}`
    const cur = map.get(key)
    const d = m.risk.due?.date ?? null
    map.set(key, {
      dept,
      action,
      rows: [...(cur?.rows ?? []), m],
      due: cur?.due && d ? (d < cur.due ? d : cur.due) : (cur?.due ?? d),
      rank: Math.min(cur?.rank ?? 9, m.risk.rank),
    })
  }
  for (const m of rows) {
    if (m.risk.decision) add('Sản xuất', m.risk.decision, m)
    if (m.row.pos.some((p) => p.status === 'pending_approval')) {
      add('Giám đốc', 'Duyệt đơn mua đang chờ ký', m)
    }
    if (m.risk.action) add(m.risk.owner, m.risk.action, m)
  }
  return [...map.values()].sort(
    (a, b) => a.rank - b.rank || b.rows.length - a.rows.length,
  )
}
