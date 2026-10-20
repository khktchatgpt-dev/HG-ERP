import { settingsService, type Settings } from '@/modules/core/settings/settings.service'
import type { User } from '@/modules/core/users/users.repo'
import {
  buildMeeting,
  type MeetingRisk,
  type MeetingRiskLevel,
} from '@/lib/supply-meeting'
import {
  buildLsxSupplyRows,
  loadPoReportDetails,
  type LsxSupplyRow,
  type PoReportDetail,
} from './lsx-supply.service'
import { loadPoLinesAndBatches } from './lsx-detail-report.service'
import type { LsxReportBatch, LsxReportLine } from './lsx-detail-excel'

/**
 * BÁO CÁO ĐƠN HÀNG THEO LỆNH SẢN XUẤT — dữ liệu cho file Excel họp
 * (`supply-orders-excel.ts`), hai phạm vi cùng một khuôn: MỌI lệnh đang chạy,
 * hoặc MỘT lệnh (`lsxId`).
 *
 * User chốt 13/09/2026: file cũ "xấu và thiếu" — thiếu tờ con theo từng đơn
 * nhà cung cấp và tờ tổng hợp đọc được trong họp. Ở đây gom đúng ba nguồn đã
 * có, không đếm lại: lệnh + đơn (`buildLsxSupplyRows`, cùng màn Vật tư theo
 * lệnh), số liệu đơn (`loadPoReportDetails`), dòng + đợt nhận
 * (`loadPoLinesAndBatches`, cùng hồ sơ một lệnh). Mức của lệnh từ
 * `buildMeeting` — cùng ba trang họp.
 */

export type SupplyOrdersPo = LsxSupplyRow['pos'][number] &
  PoReportDetail & {
    /** Mã các lệnh KHÁC cùng dùng đơn này (đơn mua chung 0125). */
    shared_with: string[]
  }

export type SupplyOrdersLsx = {
  row: LsxSupplyRow
  risk: MeetingRisk
  pos: SupplyOrdersPo[]
}

export type SupplyOrdersReport = {
  today: string
  scope:
    { kind: 'all'; total: number } | { kind: 'lsx'; code: string; customer_name: string }
  company: Pick<
    Settings,
    'company_name' | 'company_address' | 'company_tax_code' | 'company_phone'
  >
  prepared_by: string
  /** Theo thứ tự họp: khẩn trước. */
  lsx: SupplyOrdersLsx[]
  counts: Record<MeetingRiskLevel, number>
  /** Số lệnh cần nêu trong họp (mọi mức trừ Đang về và Đủ). */
  issues: number
  /** po id → dòng vật tư / đợt nhận. */
  lines: Record<string, LsxReportLine[]>
  batches: Record<string, LsxReportBatch[]>
}

export async function loadSupplyOrdersReport(
  user: User,
  today: string,
  lsxId?: string | null,
): Promise<SupplyOrdersReport | null> {
  const [allRows, company] = await Promise.all([
    buildLsxSupplyRows(user, today),
    settingsService.getAll(),
  ])
  const rows = lsxId ? allRows.filter((r) => r.id === lsxId) : allRows
  if (lsxId && rows.length === 0) return null

  const m = buildMeeting(rows, today)
  // Đơn mua chung nằm ở nhiều lệnh — lọc trùng trước khi tra số liệu.
  const poIds = [...new Set(rows.flatMap((r) => r.pos.map((p) => p.id)))]
  const [details, { lines, batches }] = await Promise.all([
    loadPoReportDetails(poIds),
    loadPoLinesAndBatches(poIds),
  ])

  // "Mua chung với": tính trên MỌI lệnh, để lệnh ngoài phạm vi báo cáo vẫn
  // được nêu tên — người đọc file một lệnh cần biết đơn này còn phục vụ ai.
  const lsxCodesByPo = new Map<string, string[]>()
  for (const r of allRows) {
    for (const p of r.pos)
      lsxCodesByPo.set(p.id, [...(lsxCodesByPo.get(p.id) ?? []), r.code])
  }

  const empty: PoReportDetail = {
    material_group: null,
    received_at: null,
    qty_ordered: 0,
    qty_received: 0,
    lines_missing: 0,
    amount: 0,
    paid: 0,
    line_count: 0,
    unpriced_lines: 0,
    supplier_doc_no: null,
  }

  const lsx: SupplyOrdersLsx[] = m.rows.map(({ row, risk }) => ({
    row,
    risk,
    pos: row.pos.map((p) => ({
      ...p,
      ...(details[p.id] ?? empty),
      shared_with: (lsxCodesByPo.get(p.id) ?? []).filter((c) => c !== row.code),
    })),
  }))

  const one = lsxId ? rows[0] : null
  return {
    today,
    scope: one
      ? { kind: 'lsx', code: one.code, customer_name: one.customer_name }
      : { kind: 'all', total: rows.length },
    company: {
      company_name: company.company_name,
      company_address: company.company_address,
      company_tax_code: company.company_tax_code,
      company_phone: company.company_phone,
    },
    prepared_by: user.name ?? user.email,
    lsx,
    counts: m.counts,
    issues: m.issues.length,
    lines,
    batches,
  }
}
