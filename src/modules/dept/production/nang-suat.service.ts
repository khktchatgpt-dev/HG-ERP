import { entriesRepo } from './entries.repo'
import { entryDocsRepo } from './entry-docs.repo'
import { productionRepo } from './production.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { resolveStageConfigs, type CountLevel } from '@/lib/stage-config'
import { countsAsOfficial } from '@/lib/entry-doc-flow'
import { shiftIso, vnTodayIso } from '@/lib/local-date'
import { gomNangSuat, type KyNgay, type NsHang, type NsPhieu } from '@/lib/nang-suat'

/**
 * NĂNG SUẤT — `/thongke/nang-suat` (bản vẽ 11/11/2026 tab 3,
 * https://claude.ai/artifact/LocfQfiJSjv6Sxc8a9KQ6N, Q2 + Q5 duyệt).
 *
 * Quản đốc / GĐ — "Công đoạn, tổ nào chậm so với định mức? Ngày nào tụt?".
 * Chỉ phiếu ĐÃ XÁC NHẬN vào số (cùng luật cột "Đã làm" của Ghi sản lượng) —
 * phiếu chờ xác nhận được đếm và nói ra, không cộng. Phép tính ở lib/nang-suat.
 */

export type NangSuatHang = NsHang & {
  label: string
  /** Dòng công đoạn: đơn vị đếm; dòng tổ: các công đoạn tổ đã ghi trong kỳ. */
  sub: string | null
  count_level: CountLevel | null
  /** ĐM kg / giờ-người (cấu hình công đoạn); tổ ghi nhiều công đoạn → null. */
  dm_ns: number | null
  /** Ngày phiếu chính thức gần nhất TRƯỚC kỳ — dòng không phiếu nào trong kỳ nói ra. */
  last_date: string | null
}

export type NangSuatPayload = {
  ky: KyNgay
  from: string
  to: string
  today: string
  days: string[]
  cong_doan: NangSuatHang[]
  to_xuong: NangSuatHang[]
  total: NsHang
  /** Phiếu trong kỳ chưa xác nhận (nháp / chờ / bị trả) — chưa tính. */
  chua_tinh: number
  /** Đã có phiếu chính thức nào chưa (trước hoặc trong kỳ). */
  co_so: boolean
  /** Có công đoạn nào đã đặt ĐM năng suất chưa. */
  co_dm: boolean
}

export const nangSuatService = {
  async get(opts: { ky: KyNgay }): Promise<NangSuatPayload> {
    const today = vnTodayIso()
    const to = today
    const from = shiftIso(to, -(opts.ky - 1))
    const days = Array.from({ length: opts.ky }, (_, i) => shiftIso(from, i))

    const [docs, entries, truoc, stagesCat, depts] = await Promise.all([
      entryDocsRepo.listGioCongRange(from, to),
      entriesRepo.listRange(from, to),
      entryDocsRepo.lastOfficialBefore(from),
      productionRepo.listStages(),
      departmentsRepo.list(),
    ])
    const cfg = resolveStageConfigs(stagesCat)
    const cfgOf = (code: string) => cfg.find((c) => c.code === code)
    const stageLabel = (code: string) => cfgOf(code)?.label ?? code
    const teamName = (id: string | null) =>
      (id && depts.find((d) => d.id === id)?.name) || '(không rõ tổ)'

    const chinhThuc: NsPhieu[] = docs
      .filter((p) => countsAsOfficial(p.status))
      .map((p) => ({
        id: p.id,
        entry_date: p.entry_date,
        stage: p.stage,
        team_id: p.team_department_id,
        labor_hours: p.labor_hours,
      }))
    const dong = entries.map((e) => ({ doc_id: e.doc_id, qty: e.qty, kg: e.kg }))

    const cd = gomNangSuat(chinhThuc, dong, days, (p) => p.stage)
    const tx = gomNangSuat(chinhThuc, dong, days, (p) => p.team_id ?? '')

    // "Lần ghi cuối" trước kỳ — danh sách đã xếp mới → cũ, lấy lần gặp đầu.
    const lastStage = new Map<string, string>()
    const lastTeam = new Map<string, string>()
    for (const t of truoc) {
      if (!lastStage.has(t.stage)) lastStage.set(t.stage, t.entry_date)
      const tk = t.team_department_id ?? ''
      if (!lastTeam.has(tk)) lastTeam.set(tk, t.entry_date)
    }

    const rongHang = (key: string): NsHang => ({
      key,
      kg: 0,
      qty: 0,
      hours: 0,
      kg_ns: 0,
      docs: 0,
      ns: null,
      by_day: days.map(() => ({ kg: 0, qty: 0, hours: 0, kg_ns: 0, docs: 0, ns: null })),
      missing_kg: 0,
      no_hours: 0,
    })

    // Tổ đã ghi mỗi công đoạn trong kỳ — cột "Tổ" của bảng theo công đoạn.
    const teamsOfStage = new Map<string, Set<string>>()
    for (const p of chinhThuc) {
      const set = teamsOfStage.get(p.stage) ?? new Set<string>()
      set.add(teamName(p.team_id))
      teamsOfStage.set(p.stage, set)
    }

    // Dòng công đoạn: có phiếu trong kỳ, hoặc từng có phiếu trước kỳ — đúng thứ tự danh mục.
    const cdKeys = new Set([...cd.rows.map((r) => r.key), ...lastStage.keys()])
    const cong_doan: NangSuatHang[] = stagesCat
      .filter((s) => cdKeys.has(s.code))
      .map((s) => {
        const r = cd.rows.find((x) => x.key === s.code) ?? rongHang(s.code)
        const c = cfgOf(s.code)
        return {
          ...r,
          label: s.label,
          sub: [...(teamsOfStage.get(s.code) ?? [])].join(', ') || null,
          count_level: c?.meta.count_level ?? null,
          dm_ns: c?.meta.dm_ns ?? null,
          last_date: r.docs > 0 ? null : (lastStage.get(s.code) ?? null),
        }
      })

    // Dòng tổ: công đoạn tổ đã ghi trong kỳ; ĐM chỉ khi tổ ghi đúng MỘT công đoạn.
    const stagesOfTeam = new Map<string, Set<string>>()
    for (const p of chinhThuc) {
      const k = p.team_id ?? ''
      const set = stagesOfTeam.get(k) ?? new Set<string>()
      set.add(p.stage)
      stagesOfTeam.set(k, set)
    }
    const txKeys = new Set([...tx.rows.map((r) => r.key), ...lastTeam.keys()])
    const to_xuong: NangSuatHang[] = [...txKeys]
      .map((k) => {
        const r = tx.rows.find((x) => x.key === k) ?? rongHang(k)
        const st = [...(stagesOfTeam.get(k) ?? [])]
        return {
          ...r,
          label: teamName(k || null),
          sub: st.length ? st.map(stageLabel).join(', ') : null,
          count_level: st.length === 1 ? (cfgOf(st[0])?.meta.count_level ?? null) : null,
          dm_ns: st.length === 1 ? (cfgOf(st[0])?.meta.dm_ns ?? null) : null,
          last_date: r.docs > 0 ? null : (lastTeam.get(k) ?? null),
        }
      })
      .sort((a, b) => b.kg - a.kg || a.label.localeCompare(b.label, 'vi'))

    return {
      ky: opts.ky,
      from,
      to,
      today,
      days,
      cong_doan,
      to_xuong,
      total: cd.total,
      chua_tinh: docs.filter((p) => !countsAsOfficial(p.status)).length,
      co_so: chinhThuc.length > 0 || truoc.length > 0,
      co_dm: cfg.some((c) => c.meta.dm_ns != null),
    }
  },
}
