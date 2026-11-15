import { entriesRepo } from './entries.repo'
import { entryDocsRepo } from './entry-docs.repo'
import { productionRepo } from './production.repo'
import { lsxDossierService } from './lsx-dossier.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import type { User } from '@/modules/core/users/users.repo'
import { resolveTeamStage } from '@/lib/stage-for-dept'
import { vnTodayIso } from '@/lib/local-date'
import { isDraftStatus, type SdgDocStatus } from '@/lib/so-da-ghi'
import {
  gomSoCongDoan,
  ngayTrongThang,
  type ScdGhi,
  type ScdLenh,
  type ScdNguon,
} from '@/lib/so-cong-doan'

/**
 * SỔ CÔNG ĐOẠN (bản vẽ 14/11/2026 https://claude.ai/artifact/CpB5jKcS9Swtx6cHqKUyXx,
 * duyệt Q1–Q6) — "tờ công đoạn" của sổ Excel thống kê: một công đoạn, cả tháng,
 * chi tiết của mọi lệnh × một cột mỗi ngày. CHỈ ĐỂ XEM: sửa số ở Sổ theo ngày.
 *
 * Cần · Đã làm lấy nguyên ô Hồ sơ lệnh (`lsxDossierService.get`) như Sổ theo ngày —
 * ba màn một ô một số. Ô ngày = Σ đạt CHÍNH THỨC (nháp chưa vào số).
 */

export type SoCongDoanPayload = {
  today: string
  /** yyyy-mm */
  thang: string
  ngay: string[]
  /** Dải tờ: công đoạn có dòng chính thức trong tháng, theo lộ trình; n = số chi tiết. */
  to_cong_doan: { code: string; label: string; n: number }[]
  cd: string | null
  cd_label: string | null
  ca: boolean
  lenh: ScdLenh[]
  /** Tên tổ cho tooltip ô ngày. */
  teams: Record<string, string>
}

const THANG = /^\d{4}-\d{2}$/

export const soCongDoanService = {
  async load(
    user: User,
    q: { thang?: string; cd?: string; ca?: string },
  ): Promise<SoCongDoanPayload> {
    const today = vnTodayIso()
    const thang =
      q.thang && THANG.test(q.thang) && q.thang <= today.slice(0, 7)
        ? q.thang
        : today.slice(0, 7)
    const ngay = ngayTrongThang(thang)
    const ca = q.ca === '1'

    const [depts, stagesCat, entries] = await Promise.all([
      departmentsRepo.list(),
      productionRepo.listStages(),
      entriesRepo.listForReview({ from: ngay[0], to: ngay[ngay.length - 1] }),
    ])
    const docIds = [
      ...new Set(entries.map((e) => e.doc_id).filter((x): x is string => !!x)),
    ]
    const docs = await entryDocsRepo.listByIds(docIds)
    const nhap = new Set(
      docs.filter((x) => isDraftStatus(x.status as SdgDocStatus)).map((x) => x.id),
    )
    const chinh = entries.filter((e) => !(e.doc_id && nhap.has(e.doc_id)))

    // Dải tờ — số CHI TIẾT có ghi (đúng số hàng tờ đó bày ở chế độ mặc định).
    const ctTheoCd = new Map<string, Set<string>>()
    for (const e of chinh) {
      const s = ctTheoCd.get(e.stage) ?? new Set<string>()
      s.add(`${e.production_order_id}|${e.component_id}`)
      ctTheoCd.set(e.stage, s)
    }
    const to_cong_doan = stagesCat
      .filter((s) => ctTheoCd.has(s.code) || s.code === q.cd)
      .map((s) => ({ code: s.code, label: s.label, n: ctTheoCd.get(s.code)?.size ?? 0 }))

    // Tờ mặc định: `?cd=` → công đoạn của tổ tài khoản (Thống kê Tổ Hàn mở tờ Hàn) →
    // tờ đầu có số.
    const toCuaToi = depts.find((d) => d.id === user.department_id)
    const cdTo =
      toCuaToi && toCuaToi.workspace_id === 'production'
        ? resolveTeamStage(toCuaToi, stagesCat)
        : null
    const cd =
      (q.cd && stagesCat.some((s) => s.code === q.cd) ? q.cd : null) ??
      (cdTo && ctTheoCd.has(cdTo) ? cdTo : null) ??
      to_cong_doan[0]?.code ??
      null
    if (cd && !to_cong_doan.some((t) => t.code === cd)) {
      const s = stagesCat.find((x) => x.code === cd)!
      to_cong_doan.push({ code: s.code, label: s.label, n: 0 })
      to_cong_doan.sort(
        (a, b) =>
          stagesCat.findIndex((s) => s.code === a.code) -
          stagesCat.findIndex((s) => s.code === b.code),
      )
    }

    const ghiCd = cd ? chinh.filter((e) => e.stage === cd) : []
    const lsxIds = new Set(ghiCd.map((e) => e.production_order_id))
    if (ca) for (const o of await productionRepo.listActive()) lsxIds.add(o.id)
    const dossiers = await Promise.all(
      [...lsxIds].map((id) => lsxDossierService.get(user, id).catch(() => null)),
    )

    const nguon: ScdNguon[] = []
    for (const d of dossiers) {
      if (!d || !cd) continue
      for (const line of d.lines)
        line.rows.forEach((r, i) => {
          const cell = r.cells[cd]
          if (!cell) return
          nguon.push({
            lsx_id: d.lsx.id,
            lsx_code: d.lsx.code,
            ma: line.product_code,
            ten_sp: line.product_name,
            row_id: r.id,
            // Dòng CỤM mang cluster = chính tên nó — khỏi lặp "Cụm khung · Cụm khung".
            cum: r.cluster && r.cluster !== r.name ? r.cluster : null,
            ten: r.name,
            thu_tu: i,
            can: r.total_needed,
            da_lam: cell.done,
          })
        })
    }
    const ghi: ScdGhi[] = ghiCd.map((e) => ({
      lsx_id: e.production_order_id,
      lsx_code: e.lsx_code ?? '—',
      component_id: e.component_id,
      ten: e.component_name ?? '?',
      cum:
        e.component_cluster && e.component_cluster !== e.component_name
          ? e.component_cluster
          : null,
      thu_tu: e.component_sort ?? 9999,
      ngay: e.entry_date,
      qty: e.qty,
      team_id: e.team_department_id,
    }))

    return {
      today,
      thang,
      ngay,
      to_cong_doan,
      cd,
      cd_label: stagesCat.find((s) => s.code === cd)?.label ?? null,
      ca,
      lenh: gomSoCongDoan(nguon, ghi, { ca }),
      teams: Object.fromEntries(
        depts.filter((x) => x.workspace_id === 'production').map((x) => [x.id, x.name]),
      ),
    }
  },
}
