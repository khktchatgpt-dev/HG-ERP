import { db } from '@/server/db'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import { buildFunnel, type FunnelEntry, type FunnelRow } from '@/lib/finance-funnel'
import { pareto, paretoCount, singleSource, type SpendRow, type SourceRisk } from '@/lib/spend-analysis'
import { payablesRepo } from './payables.repo'
import { summarizePayables, type PayableSupplierRow } from './payables.service'
import { supplierInvoicesRepo } from './supplier-invoices.repo'

/**
 * BÁO CÁO TÀI CHÍNH TỔNG HỢP — phía CHI (mua hàng).
 *
 * Trả lời: *"Tiền mua hàng đang nằm ở đâu, và sắp tới phải trả bao nhiêu."*
 *
 * ⭐ ĐÂY LÀ MÀN ƯỚC TÍNH, có chủ ý. Sổ công nợ (`/finance/cong-no-ncc`) chỉ ghi
 * nhận từ phiếu nhập kho — đúng chuẩn kế toán, nhưng Kho chưa vào nhịp nên con
 * số đó gần như bằng 0 trong khi đã cam kết mua 5,68 tỷ. Báo cáo này lấy thêm
 * hai mốc SỚM HƠN (đã cam kết · NCC đã xác nhận) để lập kế hoạch chi được, và
 * **phân vùng rõ mốc nào ghi sổ được, mốc nào không**.
 *
 * Không có phía THU: 120/120 dòng đơn bán đang có đơn giá 0 (đo 11/09/2026).
 * Dựng nửa báo cáo doanh thu bằng số 0 là mời người đọc trừ ra rồi gọi là lãi.
 */

export type FinanceReport = {
  funnel: FunnelRow[]
  /** Ước tính phải trả per NCC, theo đơn ĐÃ XÁC NHẬN. */
  suppliers: PayableSupplierRow[]
  /** Cam kết phát sinh theo tháng (theo ngày tạo đơn) — để nhìn nhịp chi. */
  by_month: { month: string; currency: string; committed: number; confirmed: number }[]
  /** Chi theo NHÓM vật tư, kèm luỹ kế (Pareto) — biết nên đàm phán ở đâu. */
  by_group: SpendRow[]
  /** Chi theo NCC, kèm luỹ kế. */
  by_supplier_spend: SpendRow[]
  /** Mã chỉ có MỘT nguồn cung — rủi ro đứt gãy. Xếp theo tiền. */
  single_source: SourceRisk[]
  /** Tổng số mã đã từng mua — mẫu số của `single_source`. */
  bought_material_count: number
  /** Câu tóm tắt Pareto theo tiền tệ chính. */
  pareto_supplier: { count: number; of: number } | null
  pareto_group: { count: number; of: number } | null
  /**
   * Thứ CHẶN phân tích sâu hơn — nói ra thay vì lặng lẽ bày bảng rỗng.
   * Xem docs/cong-no-ncc-va-da-tien-te.md và nguyên tắc 6 của sổ thiết kế.
   */
  gaps: { label: string; detail: string }[]
  measured_at: string
}

const r2 = (n: number) => Math.round(n * 100) / 100
const CONFIRMED_ON = ['confirmed', 'in_transit', 'partial', 'received']

export const financeReportService = {
  async overview(user: User): Promise<FinanceReport> {
    await assertAction(user, 'accounting.payable.view')

    const [lines, receipts, payments, confirmedRows] = await Promise.all([
      poLineAmounts(),
      payablesRepo.receiptValues(),
      payablesRepo.listPayments(),
      payablesRepo.confirmedPoValues(),
    ])

    // Vế "NCC đã đòi": tổng dòng hoá đơn đã vào sổ, theo tiền tệ của ĐƠN.
    const ccyOfLine = new Map(lines.map((l) => [l.line_id, l.currency]))
    const invLines = await supplierInvoicesRepo.invoiceLinesByPo(
      lines.map((l) => l.line_id),
    )

    const entries: FunnelEntry[] = []
    for (const l of lines) {
      entries.push({ currency: l.currency, stage: 'committed', amount: l.amount })
      if (l.confirmed) {
        entries.push({ currency: l.currency, stage: 'confirmed', amount: l.amount })
      }
    }
    for (const m of receipts) {
      const sign = m.direction === 'out' ? -1 : 1
      entries.push({ currency: m.currency, stage: 'received', amount: r2(sign * m.qty * m.unit_cost) }) // prettier-ignore
    }
    for (const il of invLines) {
      if (!il.po_line_id) continue
      entries.push({ currency: ccyOfLine.get(il.po_line_id) ?? 'VND', stage: 'invoiced', amount: il.amount }) // prettier-ignore
    }
    for (const p of payments) {
      entries.push({ currency: p.currency, stage: 'paid', amount: Number(p.amount) })
    }

    // Bảng NCC dùng lại `summarizePayables` (đã có test: tách tiền tệ, trừ đã
    // trả) với nguồn là ĐƠN ĐÃ XÁC NHẬN thay vì phiếu nhập.
    const suppliers = summarizePayables(confirmedRows, payments, [])

    const byMonth = new Map<string, { committed: number; confirmed: number }>()
    for (const l of lines) {
      const key = `${l.created_at.slice(0, 7)}|${l.currency}`
      const cur = byMonth.get(key) ?? { committed: 0, confirmed: 0 }
      cur.committed += l.amount
      if (l.confirmed) cur.confirmed += l.amount
      byMonth.set(key, cur)
    }

    const mainCcy = buildFunnel(entries)[0]?.currency ?? 'VND'
    const byGroup = pareto(
      lines.map((l) => ({ key: l.group_name, label: l.group_name, currency: l.currency, amount: l.amount, material_id: l.material_id })), // prettier-ignore
    )
    const bySupplierSpend = pareto(
      lines.map((l) => ({ key: l.supplier_id, label: l.supplier_name, currency: l.currency, amount: l.amount, material_id: l.material_id })), // prettier-ignore
    )
    const risk = singleSource(
      lines.filter((l) => l.material_id).map((l) => ({ material_id: l.material_id as string, code: l.material_code, name: l.material_name, supplier_id: l.supplier_id, supplier_name: l.supplier_name, currency: l.currency, amount: l.amount })), // prettier-ignore
    )
    const boughtMats = new Set(lines.filter((l) => l.material_id && l.amount > 0).map((l) => l.material_id)) // prettier-ignore

    return {
      funnel: buildFunnel(entries),
      by_group: byGroup,
      by_supplier_spend: bySupplierSpend,
      single_source: risk,
      bought_material_count: boughtMats.size,
      pareto_supplier: paretoCount(bySupplierSpend, mainCcy),
      pareto_group: paretoCount(byGroup, mainCcy),
      gaps: await dataGaps(),
      suppliers: suppliers.sort(
        (a, b) => (b.totals[0]?.balance ?? 0) - (a.totals[0]?.balance ?? 0),
      ),
      by_month: [...byMonth]
        .map(([key, v]) => {
          const [month, currency] = key.split('|')
          return { month, currency, committed: r2(v.committed), confirmed: r2(v.confirmed) } // prettier-ignore
        })
        .sort((a, b) => b.month.localeCompare(a.month))
        .slice(0, 12),
      measured_at: new Date().toISOString(),
    }
  },
}

/**
 * Tiền từng dòng đơn mua chưa huỷ, kèm tiền tệ và cờ "NCC đã xác nhận".
 *
 * Tính tiền theo ĐÚNG luật `price_basis`/`qty2` — dòng nhôm tính theo tổng kg,
 * nhân thẳng qty × giá là ra số khác hẳn. Làm tròn TỪNG DÒNG (xem docstring
 * `lib/lsx-finance.ts`): tiền mỗi dòng là số in ra giấy.
 */
type LineAmount = {
  line_id: string
  currency: string
  amount: number
  confirmed: boolean
  created_at: string
  material_id: string | null
  material_code: string
  material_name: string
  group_name: string
  supplier_id: string
  supplier_name: string
}

async function poLineAmounts(): Promise<LineAmount[]> {
  const { data } = await db()
    .from('supply_purchase_order_lines')
    .select(
      'id, material_id, qty_ordered, unit_price, price_basis, qty2, material:warehouse_materials(code, name, group_name), po:supply_purchase_orders!inner(currency, status, created_at, supplier_id, supplier:supply_suppliers(name, short_name))',
    )
    .limit(50000)
  type Raw = {
    id: string
    material_id: string | null
    qty_ordered: unknown
    unit_price: unknown
    price_basis: 'unit' | 'unit2'
    qty2: unknown
    material: { code: string; name: string; group_name: string | null } | null
    po: {
      currency: string
      status: string
      created_at: string
      supplier_id: string
      supplier: { name: string; short_name: string | null } | null
    } | null
  }
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v) // prettier-ignore
  const out: LineAmount[] = []
  for (const r of (data ?? []) as unknown as Raw[]) {
    const po = one(r.po)
    if (!po || po.status === 'cancelled') continue
    const price = r.unit_price == null ? 0 : Number(r.unit_price)
    const amount =
      r.price_basis === 'unit2' && r.qty2 != null
        ? Number(r.qty2) * price
        : Number(r.qty_ordered ?? 0) * price
    const mat = one(r.material)
    const sup = one(po.supplier)
    out.push({
      line_id: r.id,
      currency: po.currency || 'VND',
      amount: r2(amount),
      confirmed: CONFIRMED_ON.includes(po.status),
      created_at: po.created_at,
      material_id: r.material_id,
      material_code: mat?.code ?? '—',
      material_name: mat?.name ?? '—',
      // Dòng tự do (gỗ/gia công) không có vật tư kho nên không có nhóm — gom
      // vào một rổ có TÊN, đừng để chuỗi rỗng làm nhóm vô danh trên bảng.
      group_name: mat?.group_name || (r.material_id ? 'Chưa phân nhóm' : 'Dòng tự do'),
      supplier_id: po.supplier_id,
      supplier_name: sup?.short_name || sup?.name || '—',
    })
  }
  return out
}

/**
 * NHỮNG THỨ ĐANG CHẶN PHÂN TÍCH SÂU HƠN.
 *
 * Bày ra thay vì lặng lẽ dựng bảng rỗng: người đọc thấy bảng "giao đúng hạn"
 * trống sẽ nghĩ "chắc không ai trễ", trong khi sự thật là chưa ai khai hạn giao.
 * Số nào không kiểm được thì không ai tin (nguyên tắc 6 của sổ thiết kế).
 */
async function dataGaps(): Promise<{ label: string; detail: string }[]> {
  const gaps: { label: string; detail: string }[] = []
  const { data: pos } = await db()
    .from('supply_purchase_orders')
    .select('expected_at, status')
    .neq('status', 'cancelled')
    .limit(5000)
  const rows = (pos ?? []) as { expected_at: string | null }[]
  const noDue = rows.filter((p) => !p.expected_at).length
  if (noDue > 0) {
    gaps.push({
      label: 'Phân tích giao hàng',
      detail: `${noDue}/${rows.length} đơn mua CHƯA có hạn giao — chưa đo được tỉ lệ giao đúng hạn của nhà cung cấp.`,
    })
  }
  const { count: mv } = await db()
    .from('warehouse_movements')
    .select('*', { count: 'exact', head: true })
    .eq('direction', 'in')
  if ((mv ?? 0) < 30) {
    gaps.push({
      label: 'Chất lượng nhà cung cấp',
      detail: `Mới ${mv ?? 0} phiếu nhập — chưa đủ để đo tỉ lệ hàng lỗi hay giao thiếu.`,
    })
  }
  return gaps
}
