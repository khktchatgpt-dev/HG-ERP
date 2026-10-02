import { db } from '@/server/db'
import { BadRequest, Conflict, NotFound } from '@/server/http'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import { todayVn } from '@/lib/date-vn'
import {
  fxDeviationPct,
  planFxAssign,
  rateRowFor,
  type FxAssignDoc,
  type FxAssignPlan,
} from '@/lib/fx'
import { fxRatesRepo, type FxRateRow } from './fx-rates.repo'
import type { FxRateCreateInput, FxRateUpdateInput } from './fx-rates.schema'

/**
 * TỶ GIÁ — bảng do Kế toán nhập, chứng từ đóng băng lúc ghi.
 *
 * Màn trả lời: *"tỷ giá đang áp dụng là bao nhiêu, và chứng từ ngoại tệ nào
 * còn chưa có tỷ giá?"* Hai luật của `lib/fx.ts` áp nguyên: chứng từ đã chốt
 * giữ tỷ giá của nó; thiếu thì null, không đoán.
 *
 * "Chứng từ dùng" của một dòng = chứng từ mà `rateRowFor(fx_date)` trỏ đúng
 * dòng đó VÀ `fx_rate` còn bằng tỷ giá của dòng. Dòng có chứng từ dùng thì
 * KHOÁ sửa (chốt 02/10/2026): sửa là làm sổ của chứng từ đã in lệch với bảng.
 */

export type FxRateScreenRow = FxRateRow & {
  created_by_name: string | null
  /** Lệch % so với dòng gần nhất TRƯỚC nó cùng ngoại tệ. null = dòng đầu. */
  deviation_pct: number | null
  /** Số chứng từ đã ghi cứng tỷ giá này (đơn mua + đơn bán + hoá đơn + phiếu trả). */
  used_by: number
  /** Dòng đang áp dụng hôm nay cho ngoại tệ đó. */
  current: boolean
}

export type FxBoard = {
  rows: FxRateScreenRow[]
  today: string
  /** Mỗi ngoại tệ đang có đơn: tỷ giá hiện hành + số chứng từ thiếu. */
  currencies: {
    code: string
    current: FxRateRow | null
    previous: FxRateRow | null
    missing_po: number
    missing_so: number
    /** Mẫu số: tổng đơn ngoại tệ đó (đã chốt, chưa huỷ). */
    total_po: number
    total_so: number
  }[]
  missing_total: number
}

/** Đơn mua đã QUA cửa duyệt — chỉ những đơn này mới "phải có" tỷ giá. */
const PO_FX_STATUSES = ['approved', 'ordered', 'confirmed', 'in_transit', 'partial', 'received'] // prettier-ignore

type PoDoc = { id: string; code: string; currency: string; status: string; fx_rate: unknown; fx_date: string | null; approved_at: string | null; created_at: string } // prettier-ignore
type SoDoc = { id: string; code: string; currency: string; status: string; fx_rate: unknown; fx_date: string | null; created_at: string } // prettier-ignore

async function foreignDocs(): Promise<{ pos: PoDoc[]; sos: SoDoc[] }> {
  const [po, so] = await Promise.all([
    db()
      .from('supply_purchase_orders')
      .select('id, code, currency, status, fx_rate, fx_date, approved_at, created_at')
      .neq('currency', 'VND')
      .in('status', PO_FX_STATUSES)
      .limit(2000),
    db()
      .from('sales_orders')
      .select('id, code, currency, status, fx_rate, fx_date, created_at')
      .neq('currency', 'VND')
      .neq('status', 'cancelled')
      .limit(2000),
  ])
  if (po.error) throw new Error(po.error.message)
  if (so.error) throw new Error(so.error.message)
  return { pos: (po.data ?? []) as PoDoc[], sos: (so.data ?? []) as SoDoc[] }
}

/** Ngày chốt: đơn mua = ngày duyệt (đơn cũ không có thì ngày tạo), đơn bán = ngày tạo. */
const poFxDate = (p: PoDoc) => (p.approved_at ?? p.created_at).slice(0, 10)
const soFxDate = (s: SoDoc) => s.created_at.slice(0, 10)

async function userNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter((x): x is string => !!x))]
  if (uniq.length === 0) return new Map()
  const { data } = await db().from('users').select('id, name, email').in('id', uniq)
  type U = { id: string; name: string | null; email: string }
  return new Map(((data ?? []) as U[]).map((u) => [u.id, u.name || u.email]))
}

/** Đếm chứng từ đã ghi cứng từng dòng tỷ giá — đơn mua, đơn bán, hoá đơn, phiếu trả. */
async function usageByRate(rates: FxRateRow[]): Promise<Map<string, number>> {
  const used = new Map<string, number>()
  if (rates.length === 0) return used
  const bump = (currency: string, fx_date: string | null, fx_rate: unknown) => {
    if (!fx_date || fx_rate == null) return
    const row = rateRowFor(rates, currency, fx_date)
    if (row && row.rate === Number(fx_rate)) {
      const r = row as FxRateRow
      used.set(r.id, (used.get(r.id) ?? 0) + 1)
    }
  }
  const [po, so, inv, pay] = await Promise.all([
    db().from('supply_purchase_orders').select('currency, fx_date, fx_rate').not('fx_rate', 'is', null).limit(5000), // prettier-ignore
    db().from('sales_orders').select('currency, fx_date, fx_rate').not('fx_rate', 'is', null).limit(5000), // prettier-ignore
    db().from('accounting_supplier_invoices').select('currency, fx_date, fx_rate').not('fx_rate', 'is', null).limit(5000), // prettier-ignore
    db().from('accounting_supplier_payments').select('currency, fx_date, fx_rate').not('fx_rate', 'is', null).limit(5000), // prettier-ignore
  ])
  type D = { currency: string; fx_date: string | null; fx_rate: unknown }
  for (const set of [po.data, so.data, inv.data, pay.data])
    for (const d of (set ?? []) as D[]) bump(d.currency, d.fx_date, d.fx_rate)
  return used
}

export const fxRatesService = {
  async board(user: User): Promise<FxBoard> {
    await assertAction(user, 'accounting.fx.view')
    // Ngày VN, không phải UTC: 03h sáng 02/10 ở xưởng vẫn là 01/10 theo UTC —
    // ô "ngày áp dụng" mặc định sẽ lùi một ngày và dòng "đang áp dụng" chọn sai.
    const today = todayVn()
    const [rates, docs] = await Promise.all([fxRatesRepo.all(), foreignDocs()])
    const [names, used] = await Promise.all([
      userNames(rates.map((r) => r.created_by)),
      usageByRate(rates),
    ])

    const byCur = new Map<string, FxRateRow[]>()
    for (const r of rates) byCur.set(r.currency, [...(byCur.get(r.currency) ?? []), r])
    const currentId = new Set(
      [...byCur.keys()].map((c) => (rateRowFor(rates, c, today) as FxRateRow | null)?.id),
    )

    const rows: FxRateScreenRow[] = rates.map((r) => {
      const prev =
        (byCur.get(r.currency) ?? []).find((x) => x.rate_date < r.rate_date) ?? null
      return {
        ...r,
        created_by_name: r.created_by ? (names.get(r.created_by) ?? null) : null,
        deviation_pct: fxDeviationPct(r.rate, prev?.rate ?? null),
        used_by: used.get(r.id) ?? 0,
        current: currentId.has(r.id),
      }
    })

    const codes = new Set<string>([
      ...byCur.keys(),
      ...docs.pos.map((p) => p.currency),
      ...docs.sos.map((s) => s.currency),
    ])
    const currencies = [...codes].sort().map((code) => {
      const list = byCur.get(code) ?? []
      const current = (rateRowFor(rates, code, today) as FxRateRow | null) ?? null
      const previous = current ? (list.find((x) => x.rate_date < current.rate_date) ?? null) : null // prettier-ignore
      const pos = docs.pos.filter((p) => p.currency === code)
      const sos = docs.sos.filter((s) => s.currency === code)
      return {
        code,
        current,
        previous,
        missing_po: pos.filter((p) => p.fx_rate == null).length,
        missing_so: sos.filter((s) => s.fx_rate == null).length,
        total_po: pos.length,
        total_so: sos.length,
      }
    })

    return {
      rows,
      today,
      currencies,
      missing_total: currencies.reduce((a, c) => a + c.missing_po + c.missing_so, 0),
    }
  },

  async create(user: User, input: FxRateCreateInput): Promise<FxRateRow> {
    await assertAction(user, 'accounting.fx.manage')
    const dup = await fxRatesRepo.findByDate(input.currency, input.rate_date)
    if (dup) {
      throw Conflict(
        `Ngày ${dmy(input.rate_date)} đã có dòng ${input.currency} ${fmt(dup.rate)}. Một ngày chỉ một tỷ giá — sửa dòng đó hoặc chọn ngày khác.`,
        'FX_DATE_TAKEN',
      )
    }
    return fxRatesRepo.insert({
      currency: input.currency,
      rate_date: input.rate_date,
      rate: input.rate,
      source: input.source,
      note: input.note || null,
      created_by: user.id,
    })
  },

  /** Sửa dòng CHƯA chứng từ nào dùng. Có chứng từ dùng thì khoá: thêm ngày mới. */
  async update(user: User, input: FxRateUpdateInput): Promise<FxRateRow> {
    await assertAction(user, 'accounting.fx.manage')
    const row = await fxRatesRepo.findById(input.id)
    if (!row) throw NotFound('Dòng tỷ giá không tồn tại')
    const rates = await fxRatesRepo.all()
    const used = (await usageByRate(rates)).get(row.id) ?? 0
    if (used > 0) {
      throw BadRequest(
        `Dòng ${dmy(row.rate_date)} đã có ${used} chứng từ ghi cứng tỷ giá này — không sửa được. Thêm dòng ngày mới nếu tỷ giá đổi.`,
        'FX_IN_USE',
      )
    }
    return fxRatesRepo.patch(row.id, {
      rate: input.rate,
      source: input.source,
      note: input.note || null,
    })
  },

  /**
   * GÁN TỶ GIÁ CHO CHỨNG TỪ THIẾU. `dry` = chỉ trả kế hoạch để màn bày trước.
   * Ghi thật thì chỉ đụng chứng từ gán được; chứng từ không có dòng ≤ ngày chốt
   * đứng yên và được trả về để màn nói "thêm dòng ≤ ngày đó rồi gán lại".
   */
  async assignMissing(
    user: User,
    dry: boolean,
  ): Promise<{ plan: FxAssignPlan[]; assigned: number; skipped: number }> {
    await assertAction(user, 'accounting.fx.manage')
    const [rates, docs, poAmt, soAmt] = await Promise.all([
      fxRatesRepo.all(),
      foreignDocs(),
      lineTotals('supply_purchase_order_lines', 'po_id', 'qty_ordered'),
      lineTotals('sales_order_lines', 'order_id', 'qty'),
    ])
    const input: FxAssignDoc[] = [
      ...docs.pos
        .filter((p) => p.fx_rate == null)
        .map((p) => ({ id: p.id, kind: 'po' as const, code: p.code, currency: p.currency, fx_date: poFxDate(p), amount: poAmt.get(p.id) ?? 0 })), // prettier-ignore
      ...docs.sos
        .filter((s) => s.fx_rate == null)
        .map((s) => ({ id: s.id, kind: 'so' as const, code: s.code, currency: s.currency, fx_date: soFxDate(s), amount: soAmt.get(s.id) ?? 0 })), // prettier-ignore
    ]
    const plan = planFxAssign(input, rates).sort((a, b) =>
      a.fx_date.localeCompare(b.fx_date),
    )
    const ok = plan.filter((p) => p.rate != null)
    if (!dry) {
      await Promise.all(
        ok.map((p) =>
          db()
            .from(p.kind === 'po' ? 'supply_purchase_orders' : 'sales_orders')
            .update({ fx_rate: p.rate, fx_date: p.fx_date })
            .eq('id', p.id)
            .then(({ error }) => {
              if (error) throw new Error(error.message)
            }),
        ),
      )
    }
    return { plan, assigned: ok.length, skipped: plan.length - ok.length }
  },
}

/** Σ qty × unit_price theo chứng từ, làm tròn từng dòng (cùng luật `lib/lsx-finance`). */
async function lineTotals(
  table: 'supply_purchase_order_lines' | 'sales_order_lines',
  key: 'po_id' | 'order_id',
  qtyCol: 'qty_ordered' | 'qty',
): Promise<Map<string, number>> {
  // Hai bảng khác tên cột nên gọi tách để PostgREST suy kiểu được; gộp lại một
  // vòng cộng vì luật làm tròn từng dòng là chung.
  const q =
    table === 'supply_purchase_order_lines'
      ? db().from('supply_purchase_order_lines').select('po_id, qty_ordered, unit_price').limit(10000) // prettier-ignore
      : db().from('sales_order_lines').select('order_id, qty, unit_price').limit(10000)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  const out = new Map<string, number>()
  for (const raw of (data ?? []) as unknown[]) {
    const r = raw as Record<string, unknown>
    const id = String(r[key])
    const v = Math.round(Number(r[qtyCol] ?? 0) * Number(r.unit_price ?? 0) * 100) / 100
    out.set(id, Math.round(((out.get(id) ?? 0) + v) * 100) / 100)
  }
  return out
}

const dmy = (d: string) => d.split('-').reverse().join('/')
const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
