import { z } from 'zod'
import { entriesRepo, type ReviewEntry } from './entries.repo'
import { entryDocsRepo } from './entry-docs.repo'
import { dayLocksRepo } from './day-locks.repo'
import { productionRepo } from './production.repo'
import { defectCodesRepo } from './defect-codes.repo'
import { lsxDossierService, type DossierRow } from './lsx-dossier.service'
import type { soDaGhiSaveSchema } from './entries.schema'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import type { User } from '@/modules/core/users/users.repo'
import { resolveTeamStage } from '@/lib/stage-for-dept'
import { vnTodayIso } from '@/lib/local-date'
import {
  scaleKg,
  type SdgDoc,
  type SdgDocStatus,
  type SdgLine,
  type SdgLock,
} from '@/lib/so-da-ghi'
import { BadRequest, Forbidden, NotFound } from '@/server/http'

/**
 * SỔ ĐÃ GHI (bản vẽ 13/11/2026 https://claude.ai/artifact/4ub2By9o62SJN4wCcXGrFe,
 * duyệt Q1–Q7) — thống kê tổ xem lại mọi dòng đã ghi, soát, sửa trước khi chốt
 * sổ ngày.
 *
 * MỘT Ô MỘT SỐ: Phải làm · Đã làm luỹ kế · Khả dụng KHÔNG tự cộng ở đây — lấy
 * nguyên ô của Hồ sơ lệnh (`lsxDossierService.get`), vốn cùng hàm với Ghi sản
 * lượng và Giao nhận. Sổ đã ghi của một tổ thường chạm 1–3 lệnh trong 7 ngày.
 */

/**
 * SỔ THEO NGÀY (tên mới 14/11/2026, bản vẽ https://claude.ai/artifact/CpB5jKcS9Swtx6cHqKUyXx
 * Q5): MỘT ngày. Chế độ 7 ngày đã bỏ — trùng lưới tổ × 7 ngày của Sổ ngày & chốt
 * sổ; nhiều ngày của một công đoạn thì xem Sổ công đoạn (`so-cong-doan.service`).
 */
export type SoDaGhiPayload = {
  today: string
  date: string
  team_id: string | null
  teams: { id: string; name: string; stage_label: string }[]
  /** Công đoạn theo LỘ TRÌNH (sort_order) — xếp phiếu + chip lọc (bản vẽ 14/11 Q2, Q5). */
  stages: { code: string; label: string }[]
  /** Chip công đoạn chọn sẵn (`?cd=`, tới từ ô ngày của Sổ công đoạn). */
  cd: string | null
  /** Đang mở MỘT phiếu (`?phieu=`) — thanh lọc nói và cho bỏ. */
  phieu: { id: string; doc_no: string } | null
  docs: SdgDoc[]
  lines: SdgLine[]
  locks: SdgLock[]
  defect_labels: Record<string, string>
  me_id: string
  /** Quản đốc / admin sửa được dòng người khác ghi (như deleteEntry). */
  can_all: boolean
}

const CLOSED = new Set(['completed', 'cancelled'])
const canAll = (u: User) => u.role === 'admin' || u.role === 'manager'
const ISO = /^\d{4}-\d{2}-\d{2}$/

export const soDaGhiService = {
  async load(
    user: User,
    q: { date?: string; to?: string; phieu?: string; cd?: string },
  ): Promise<SoDaGhiPayload> {
    const today = vnTodayIso()
    let date = q.date && ISO.test(q.date) && q.date <= today ? q.date : today

    const [depts, stagesCat, codes] = await Promise.all([
      departmentsRepo.list(),
      productionRepo.listStages(),
      defectCodesRepo.listActive(),
    ])
    const stageLabel = new Map(stagesCat.map((s) => [s.code, s.label]))
    const teams = depts
      .filter((d) => d.workspace_id === 'production')
      .map((d) => {
        const st = resolveTeamStage(d, stagesCat)
        return st
          ? { id: d.id, name: d.name, stage_label: stageLabel.get(st) ?? st }
          : null
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))

    // Tổ mặc định = tổ của tài khoản (7 tài khoản "Thống kê Tổ …" gắn đúng tổ);
    // người không gắn tổ (quản đốc) thấy mọi tổ — Q2. `?to=all` = mọi tổ.
    let teamId: string | null =
      q.to === 'all'
        ? null
        : q.to && teams.some((t) => t.id === q.to)
          ? q.to
          : user.department_id && teams.some((t) => t.id === user.department_id)
            ? user.department_id
            : null

    let phieu: SoDaGhiPayload['phieu'] = null
    if (q.phieu) {
      const doc = await entryDocsRepo.findByNo(q.phieu.trim())
      if (doc) {
        phieu = { id: doc.id, doc_no: doc.doc_no }
        date = doc.entry_date
        teamId = doc.team_department_id
      }
    }
    const from = date
    const to = date

    const [entries, locksRaw] = await Promise.all([
      entriesRepo.listForReview({ from, to, teamId, docId: phieu?.id ?? null }),
      dayLocksRepo.listRange(from, to),
    ])
    const docIds = [
      ...new Set(entries.map((e) => e.doc_id).filter((x): x is string => !!x)),
    ]
    const lsxIds = [...new Set(entries.map((e) => e.production_order_id))]
    const [docsRaw, dossiers] = await Promise.all([
      entryDocsRepo.listByIds(docIds),
      Promise.all(lsxIds.map((id) => lsxDossierService.get(user, id).catch(() => null))),
    ])

    // Ô Hồ sơ lệnh theo id chi tiết (dòng ảo đã vật chất hoá lúc ghi → id thật).
    const rowById = new Map<
      string,
      { row: DossierRow; product_code: string; product_name: string }
    >()
    const lsxClosed = new Map<string, boolean>()
    for (const d of dossiers) {
      if (!d) continue
      lsxClosed.set(d.lsx.id, CLOSED.has(d.lsx.status))
      for (const l of d.lines)
        for (const r of l.rows)
          rowById.set(r.id, {
            row: r,
            product_code: l.product_code,
            product_name: l.product_name,
          })
    }

    const docs: SdgDoc[] = docsRaw.map((x) => ({
      id: x.id,
      doc_no: x.doc_no,
      lsx_id: x.production_order_id,
      lsx_code: x.lsx_code ?? '—',
      lsx_closed:
        lsxClosed.get(x.production_order_id) ??
        CLOSED.has(entries.find((e) => e.doc_id === x.id)?.lsx_status ?? ''),
      stage: x.stage,
      stage_label: stageLabel.get(x.stage) ?? x.stage,
      team_id: x.team_department_id,
      team_name: x.team_name,
      entry_date: x.entry_date,
      status: x.status as SdgDocStatus,
      shift: x.shift,
      worker_count: x.worker_count,
      hours_per_worker: x.hours_per_worker,
      labor_hours: x.labor_hours,
      created_by: x.created_by,
      created_at: x.created_at,
    }))

    const lines: SdgLine[] = entries.map((e: ReviewEntry) => {
      const hit = rowById.get(e.component_id)
      const cell = hit?.row.cells[e.stage]
      return {
        id: e.id,
        doc_id: e.doc_id,
        lsx_id: e.production_order_id,
        entry_date: e.entry_date,
        team_id: e.team_department_id,
        stage: e.stage,
        component_id: e.component_id,
        product_code: hit?.product_code ?? null,
        // Hồ sơ lệnh lùi về mã khi SP không có tên — trùng mã thì khỏi bày lặp.
        product_name:
          hit && hit.product_name !== hit.product_code ? hit.product_name : null,
        name: e.component_name ?? '?',
        cluster: e.component_cluster,
        qty_per_unit: e.component_qty_per_unit,
        dm_kg: e.component_dm_kg,
        sort: e.component_sort ?? 9999,
        needed: hit ? hit.row.total_needed : null,
        done: cell ? cell.done : null,
        available: cell ? cell.available : null,
        qty: e.qty,
        defect: e.defect_qty,
        kg: e.kg,
        worker: e.worker_name ?? '',
        note: e.note ?? '',
        defect_code: e.defect_code,
        defect_reason: e.defect_reason ?? '',
        created_by: e.created_by,
        created_at: e.created_at,
      }
    })

    return {
      today,
      date,
      team_id: teamId,
      teams,
      stages: stagesCat.map((s) => ({ code: s.code, label: s.label })),
      cd: q.cd && stagesCat.some((s) => s.code === q.cd) ? q.cd : null,
      phieu,
      docs,
      lines,
      locks: locksRaw
        .filter((l) => !teamId || l.team_department_id === teamId)
        .map((l) => ({
          team_id: l.team_department_id,
          date: l.entry_date,
          by: l.locked_by_name,
          at: l.locked_at,
        })),
      defect_labels: Object.fromEntries(codes.map((c) => [c.code, c.label])),
      me_id: user.id,
      can_all: canAll(user),
    }
  },

  /**
   * "Lưu thay đổi": sửa số trên dòng đã có + xoá dòng — GÁC TRƯỚC, GHI SAU: một
   * dòng bị chặn thì không dòng nào được ghi (người dùng không phải đoán dòng
   * nào đã vào). Luật gác như `deleteEntry`: người ghi hoặc quản đốc/admin, sổ
   * ngày chưa chốt, lệnh chưa đóng. Phiếu hết dòng sau khi xoá thì xoá luôn
   * đầu phiếu — Sổ ngày không còn bày một phiếu 0 dòng.
   */
  async save(
    user: User,
    input: z.infer<typeof soDaGhiSaveSchema>,
  ): Promise<{ updated: number; deleted: number; docs_removed: number }> {
    const editIds = input.edits.map((e) => e.id)
    const ids = [...new Set([...editIds, ...input.deletes])]
    const rows = await entriesRepo.listByIdsWithDm(ids)
    const byId = new Map(rows.map((r) => [r.id, r]))
    if (rows.length !== ids.length)
      throw NotFound(
        'Có dòng sổ không còn — có thể ai đó vừa xoá. Tải lại trang rồi sửa lại.',
      )

    const lockCache = new Map<string, boolean>()
    const lsxCache = new Map<string, string | null>()
    for (const r of rows) {
      if (!canAll(user) && r.created_by !== user.id)
        throw Forbidden('Chỉ người ghi dòng hoặc quản đốc sửa / xoá được')
      if (r.team_department_id) {
        const k = `${r.team_department_id}|${r.entry_date}`
        if (!lockCache.has(k))
          lockCache.set(
            k,
            !!(await dayLocksRepo.find(r.team_department_id, r.entry_date)),
          )
        if (lockCache.get(k))
          throw BadRequest(
            `Sổ ngày ${r.entry_date.split('-').reverse().join('/')} của tổ đã chốt — mở khoá ở Sổ ngày trước khi sửa`,
          )
      }
      if (!lsxCache.has(r.production_order_id))
        lsxCache.set(
          r.production_order_id,
          (await productionRepo.findById(r.production_order_id))?.status ?? null,
        )
      if (CLOSED.has(lsxCache.get(r.production_order_id) ?? ''))
        throw BadRequest('Lệnh đã đóng — sổ khoá, không sửa / xoá được')
    }

    const codes = await defectCodesRepo.listActive()
    const codeByLabel = new Map(codes.map((c) => [c.label.toLowerCase(), c.code]))
    const deleting = new Set(input.deletes)
    const patches = input.edits
      .filter((e) => !deleting.has(e.id))
      .map((e) => {
        const r = byId.get(e.id)!
        const qty = e.qty ?? r.qty
        const defect = e.defect_qty ?? r.defect_qty
        if (qty <= 0 && defect <= 0)
          throw BadRequest('Dòng không còn số nào — bấm Xoá thay vì để 0')
        const fields: Parameters<typeof entriesRepo.update>[1] = {}
        if (e.qty != null && e.qty !== r.qty) {
          fields.qty = qty
          fields.kg = scaleKg(r.kg, r.qty, qty, r.dm_kg)
        }
        if (e.defect_qty != null && e.defect_qty !== r.defect_qty)
          fields.defect_qty = defect
        if (e.worker_name != null) fields.worker_name = e.worker_name || null
        if (defect > 0) {
          // Ô chữ là LÝ DO (cùng luật entryLineSchema: có lỗi thì phải có lý do).
          if (e.text != null) {
            const code = codeByLabel.get(e.text.toLowerCase()) ?? null
            fields.defect_code = code
            fields.defect_reason = code ? null : e.text || null
          }
          const coLyDo =
            e.text != null
              ? !!e.text
              : !!(r.defect_code || (r.defect_reason ?? '').trim())
          if (!coLyDo) throw BadRequest('Có lỗi thì phải ghi lý do')
        } else {
          if (r.defect_qty > 0 || r.defect_code || r.defect_reason) {
            fields.defect_code = null
            fields.defect_reason = null
          }
          if (e.text != null) fields.note = e.text || null
        }
        return { id: e.id, fields }
      })
      .filter((p) => Object.keys(p.fields).length > 0)

    for (const p of patches) await entriesRepo.update(p.id, p.fields)
    for (const id of input.deletes) await entriesRepo.delete(id)

    // Phiếu hết dòng → xoá đầu phiếu.
    let docsRemoved = 0
    const touchedDocs = new Set(
      input.deletes.map((id) => byId.get(id)?.doc_id).filter((x): x is string => !!x),
    )
    for (const docId of touchedDocs) {
      if ((await entriesRepo.listByDoc(docId)).length === 0) {
        await entryDocsRepo.delete(docId)
        docsRemoved++
      }
    }
    return {
      updated: patches.length,
      deleted: input.deletes.length,
      docs_removed: docsRemoved,
    }
  },
}
