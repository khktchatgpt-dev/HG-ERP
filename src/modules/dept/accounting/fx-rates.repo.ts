import { db } from '@/server/db'
import { rateFor, type FxRate } from '@/lib/fx'

export type FxRateRow = FxRate & {
  id: string
  source: string | null
  note: string | null
  created_by: string | null
  created_at: string
}

type Raw = {
  id: string
  currency: string
  rate_date: string
  rate: unknown
  source: string | null
  note: string | null
  created_by: string | null
  created_at: string
}

const COLS = 'id, currency, rate_date, rate, source, note, created_by, created_at'
const toRow = (r: Raw): FxRateRow => ({ ...r, rate: Number(r.rate) })

/**
 * Bảng tỷ giá (0189). Nhỏ (một dòng mỗi tuần mỗi ngoại tệ) nên đọc cả bảng
 * rồi tính trong bộ nhớ — `rateFor` cần toàn bộ dòng của một ngoại tệ.
 */
export const fxRatesRepo = {
  async all(): Promise<FxRateRow[]> {
    const { data, error } = await db()
      .from('fx_rates')
      .select(COLS)
      .order('rate_date', { ascending: false })
      .limit(2000)
    if (error) throw new Error(error.message)
    return ((data ?? []) as Raw[]).map(toRow)
  },

  async findById(id: string): Promise<FxRateRow | null> {
    const { data, error } = await db()
      .from('fx_rates')
      .select(COLS)
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data ? toRow(data as Raw) : null
  },

  async findByDate(currency: string, rate_date: string): Promise<FxRateRow | null> {
    const { data, error } = await db()
      .from('fx_rates')
      .select(COLS)
      .eq('currency', currency)
      .eq('rate_date', rate_date)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data ? toRow(data as Raw) : null
  },

  async insert(row: {
    currency: string
    rate_date: string
    rate: number
    source: string
    note: string | null
    created_by: string
  }): Promise<FxRateRow> {
    const { data, error } = await db().from('fx_rates').insert(row).select(COLS).single()
    if (error || !data) throw new Error(error?.message ?? 'Insert fx_rate failed')
    return toRow(data as Raw)
  },

  async patch(
    id: string,
    patch: { rate: number; source: string; note: string | null },
  ): Promise<FxRateRow> {
    const { data, error } = await db()
      .from('fx_rates')
      .update(patch)
      .eq('id', id)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Update fx_rate failed')
    return toRow(data as Raw)
  },

  /**
   * Tỷ giá áp cho một chứng từ chốt hôm `date` — dùng ở chỗ DUYỆT đơn mua và
   * XÁC NHẬN đơn bán. `null` = chưa có dòng nào ≤ ngày đó: chứng từ vẫn đi,
   * cột để trống, màn Tỷ giá sẽ bày nó ở "thiếu tỷ giá".
   */
  async rateAt(currency: string, date: string): Promise<number | null> {
    if (currency === 'VND') return null
    const { data, error } = await db()
      .from('fx_rates')
      .select('currency, rate_date, rate')
      .eq('currency', currency)
      .lte('rate_date', date)
      .order('rate_date', { ascending: false })
      .limit(1)
    if (error) throw new Error(error.message)
    const rows = (
      (data ?? []) as { currency: string; rate_date: string; rate: unknown }[]
    ).map((r) => ({ ...r, rate: Number(r.rate) }))
    return rateFor(rows, currency, date)
  },
}
