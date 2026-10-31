import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import {
  monthRows,
  monthsWithDocs,
  supplierSheet,
  toDocs,
  type MonthRow,
  type SheetDoc,
  type SheetMonth,
} from '@/lib/cong-no-thang'
import type { ReceiptMove } from '@/lib/ap-receipt-ledger'
import { payablesRepo } from './payables.repo'

/**
 * CÔNG NỢ NCC THEO THÁNG (bản vẽ Ht7MpqcutpTUyG4r4DvymN bản 3, duyệt 31/10/2026).
 *
 * Hai màn, cùng một nguồn: movement gắn đơn mua (`payablesRepo.receiptMovesForLedger`)
 * → phiếu (`toDocs`). Màn 1 bày mọi tháng một lượt để đổi tháng không phải tải lại
 * (dữ liệu nhỏ: vài chục NCC × vài tháng). Quyền: `accounting.payable.view`.
 */

export type DanhSachThang = {
  months: { month: string; docs: number }[]
  byMonth: Record<string, MonthRow[]>
}

export type SoNcc = {
  supplier: { id: string; name: string } | null
  /** Mọi NCC có phiếu — ô đổi NCC ngay trên trang (Q14). */
  suppliers: { id: string; name: string }[]
  sheet: SheetMonth[]
  /** Ngày phiếu gần nhất của NCC — trạng thái "không có phiếu trong khoảng đã chọn". */
  last_date: string | null
}

async function loadDocs(): Promise<{ moves: ReceiptMove[]; docs: SheetDoc[] }> {
  const moves = await payablesRepo.receiptMovesForLedger()
  const origins = await payablesRepo.docCodes(
    moves.flatMap((m) =>
      m.is_reversal && m.reversal_of_doc_id ? [m.reversal_of_doc_id] : [],
    ),
  )
  const reversalOf = new Map<string, { code: string; date: string }>()
  for (const m of moves) {
    const o = m.reversal_of_doc_id ? origins.get(m.reversal_of_doc_id) : undefined
    if (o) reversalOf.set(m.doc_id, o)
  }
  return { moves, docs: toDocs(moves, reversalOf) }
}

export const congNoThangService = {
  async danhSach(user: User): Promise<DanhSachThang> {
    await assertAction(user, 'accounting.payable.view')
    const { moves, docs } = await loadDocs()
    const months = monthsWithDocs(moves)
    return {
      months,
      byMonth: Object.fromEntries(months.map((m) => [m.month, monthRows(docs, m.month)])),
    }
  },

  async soNcc(user: User, supplierId: string): Promise<SoNcc> {
    await assertAction(user, 'accounting.payable.view')
    const { docs } = await loadDocs()
    const names = new Map<string, string>()
    for (const d of docs) names.set(d.supplier_id, d.supplier_name)
    const mine = docs.filter((d) => d.supplier_id === supplierId)
    return {
      supplier: names.has(supplierId)
        ? { id: supplierId, name: names.get(supplierId)! }
        : null,
      suppliers: [...names]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
      sheet: supplierSheet(mine),
      last_date: mine.at(-1)?.date ?? null,
    }
  },

  /** Bản Excel của một tháng: danh sách NCC + mọi dòng hàng trong tháng. */
  async excelThang(
    user: User,
    month: string,
  ): Promise<{ rows: MonthRow[]; docs: SheetDoc[] }> {
    await assertAction(user, 'accounting.payable.view')
    const { docs } = await loadDocs()
    return {
      rows: monthRows(docs, month),
      docs: docs.filter((d) => d.date.startsWith(month)),
    }
  },
}
