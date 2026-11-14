import { db } from '@/server/db'
import { theoLo } from '@/server/theo-lo'
import { todayVn } from '@/lib/date-vn'
import type { DongSo } from '@/lib/kho-nxt'
import type { HangBanChot, ThangChot } from '@/lib/kho-kiem-ky'

/** Một dòng nhật ký chốt / mở lại kỳ (0300) — `ai` là TÊN người làm. */
export type NhatKyKy = {
  id: string
  thang: string
  action: 'close' | 'reopen'
  reason: string | null
  ai: string | null
  gt_ton_cuoi: number | null
  created_at: string
}

/** Một tháng đã chốt — `thang` dạng `YYYY-MM`, `closed_by` là TÊN người chốt. */
export type KyDaChot = {
  id: string
  thang: string
  den: string
  closed_at: string
  closed_by: string | null
}

/**
 * Đọc sổ kho cho Báo cáo Nhập–Xuất–Tồn (B6). Chỉ đọc.
 *
 * Đọc MỌI dòng sổ (cần lịch sử để ra tồn đầu + giá trị tồn đầu), chia trang
 * 1000 vì PostgREST cắt im lặng ở mốc đó. Đo 19/10/2026: 893 dòng — đọc hết
 * trong một lượt là đủ rẻ; khi sổ lớn lên thì đây là chỗ thêm số dư đầu kỳ đã
 * chốt (khoá kỳ, bước sau) thay vì cộng lại từ đầu.
 */

type Raw = {
  id: string
  material_id: string
  direction: 'in' | 'out'
  qty: unknown
  unit_cost: unknown
  reason_code: string | null
  ref_type: string | null
  po_line_id: string | null
  production_order_id: string | null
  doc_id: string | null
  created_at: string
  note: string | null
  doc: {
    code: string
    kind: string
    doc_date: string | null
    reversal_of_doc_id: string | null
    counterparty: string | null
    reason: string | null
  } | null
  line: { po: { code: string; currency: string | null; fx_rate: unknown } | null } | null
  lsx: { code: string } | null
}

const SELECT =
  'id, material_id, direction, qty, unit_cost, reason_code, ref_type, po_line_id, production_order_id, doc_id, created_at, note, doc:warehouse_docs(code, kind, doc_date, reversal_of_doc_id, counterparty, reason), line:supply_purchase_order_lines(po:supply_purchase_orders(code, currency, fx_rate)), lsx:production_orders(code)'

const one = <T>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

function dienGiai(r: Raw, doc: Raw['doc'], po: { code: string } | null): string | null {
  const phan: string[] = []
  if (doc?.reversal_of_doc_id) phan.push('Đảo phiếu')
  if (po) phan.push(po.code)
  if (r.lsx?.code) phan.push(`lệnh ${r.lsx.code}`)
  const ben = doc?.counterparty?.trim() || doc?.reason?.trim()
  if (ben) phan.push(ben)
  return phan.length ? phan.join(' · ') : r.note?.trim() || null
}

export const nxtRepo = {
  /** Mọi dòng sổ có ngày chứng từ ≤ `den`. */
  async dongSoDen(den: string): Promise<DongSo[]> {
    const out: DongSo[] = []
    for (let tu = 0; ; tu += 1000) {
      const { data, error } = await db()
        .from('warehouse_movements')
        .select(SELECT)
        .order('id')
        .range(tu, tu + 999)
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as unknown as Raw[]
      for (const r of rows) {
        const doc = one(r.doc)
        const line = one(r.line)
        const po = line ? one(line.po) : null
        // Q2: ngày CHỨNG TỪ; dòng không phiếu (5 dòng mồi 07/2026) lấy ngày ghi theo giờ VN.
        const ngay = doc?.doc_date ?? todayVn(new Date(r.created_at))
        if (ngay > den) continue
        out.push({
          id: r.id,
          material_id: r.material_id,
          direction: r.direction,
          qty: Number(r.qty ?? 0),
          unit_cost: r.unit_cost == null ? null : Number(r.unit_cost),
          currency: po?.currency ?? null,
          fx_rate: po?.fx_rate == null ? null : Number(po.fx_rate),
          reason_code: r.reason_code,
          ref_type: r.ref_type,
          po_line_id: r.po_line_id,
          production_order_id: r.production_order_id,
          ngay,
          doc_id: r.doc_id,
          doc_code: doc?.code ?? null,
          doc_kind: doc?.kind ?? null,
          la_dao: !!doc?.reversal_of_doc_id,
          dien_giai: dienGiai(r, doc, po),
        })
      }
      if (rows.length < 1000) break
    }
    return out
  },

  /**
   * Dòng đơn mua → các lệnh có phần trên dòng đó (cùng luật `hangLenhRepo.
   * dongCacLenh`): dòng CÓ chia (0185) → các lệnh được chia; dòng không chia →
   * lệnh chính của đơn. Dòng của đơn không gắn lệnh → không có trong map.
   * Kèm mã lệnh (nhúng cùng lượt — đỡ một vòng đi-về, đo 13/11/2026: 0,8 s → ~0,3 s).
   */
  async lenhCuaDongDon(
    lineIds: string[],
  ): Promise<{ lenh: Map<string, string[]>; ma: Map<string, string> }> {
    type Ma = { code: string } | { code: string }[] | null
    const [lines, chia] = await Promise.all([
      theoLo<{ id: string; po: { production_order_id: string | null; lsx: Ma } | { production_order_id: string | null; lsx: Ma }[] | null }> // prettier-ignore
      (lineIds, (lo) =>
        db()
          .from('supply_purchase_order_lines')
          .select(
            'id, po:supply_purchase_orders(production_order_id, lsx:production_orders!supply_purchase_orders_production_order_id_fkey(code))',
          )
          .in('id', lo)
          .order('id'),
      ),
      theoLo<{ line_id: string; production_order_id: string; lsx: Ma }>(lineIds, (lo) =>
        db()
          .from('supply_po_line_lsx')
          .select('line_id, production_order_id, lsx:production_orders(code)')
          .in('line_id', lo)
          .order('line_id'),
      ),
    ])
    const lenh = new Map<string, string[]>()
    const ma = new Map<string, string>()
    for (const c of chia) {
      lenh.set(c.line_id, [...(lenh.get(c.line_id) ?? []), c.production_order_id])
      const code = one(c.lsx)?.code
      if (code) ma.set(c.production_order_id, code)
    }
    for (const l of lines) {
      if (lenh.has(l.id)) continue
      const po = one(l.po)
      if (!po?.production_order_id) continue
      lenh.set(l.id, [po.production_order_id])
      const code = one(po.lsx)?.code
      if (code) ma.set(po.production_order_id, code)
    }
    return { lenh, ma }
  },

  /**
   * Các tháng ĐÃ CHỐT (0297), cũ → mới. Bảng chưa có (mã lên trước migration)
   * thì coi như chưa chốt tháng nào — Báo cáo tháng vẫn chạy như B1.
   */
  async kyDaChot(): Promise<KyDaChot[]> {
    const { data, error } = await db()
      .from('warehouse_periods')
      .select(
        'id, thang, den, closed_at, closer:users!warehouse_periods_closed_by_fkey(name)',
      )
      .order('thang')
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') return []
      throw new Error(error.message)
    }
    return (data ?? []).map((r) => ({
      id: r.id as string,
      thang: (r.thang as string).slice(0, 7),
      den: r.den as string,
      closed_at: r.closed_at as string,
      closed_by:
        one(r.closer as { name: string } | { name: string }[] | null)?.name ?? null,
    }))
  },

  /** Bản chốt theo mã của một tháng — chia trang 1000 (PostgREST cắt im lặng). */
  async banChot(periodId: string): Promise<HangBanChot[]> {
    const out: HangBanChot[] = []
    for (let tu = 0; ; tu += 1000) {
      const { data, error } = await db()
        .from('warehouse_period_costs')
        .select(
          'material_id, ton_dau, nhap, xuat, ton_cuoi, don_gia, gt_dau, gt_nhap, gt_xuat, gt_cuoi, bq, thieu_gia, lan_mua, thieu_ty_gia, phat_sinh',
        )
        .eq('period_id', periodId)
        .order('material_id')
        .range(tu, tu + 999)
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as unknown as HangBanChot[]
      out.push(...rows)
      if (rows.length < 1000) break
    }
    return out
  },

  /**
   * Ghi cả lượt chốt trong MỘT giao dịch (`warehouse_close_periods`, 0297).
   * Tháng đã chốt → lỗi `KHO_CHOT: …` (service đổi thành 409).
   */
  async ghiChot(actor: string, months: ThangChot[]): Promise<number> {
    const { data, error } = await db().rpc('warehouse_close_periods', {
      p_actor: actor,
      p_months: months,
    })
    if (error) throw new Error(error.message)
    return Number(data ?? 0)
  },

  /**
   * MỞ LẠI tháng chốt mới nhất (B3, 0300) — một giao dịch: ghi nhật ký rồi xoá
   * bản chốt. Không phải tháng mới nhất / lý do ngắn → `KHO_CHOT: …` (service → 409).
   */
  async moLai(actor: string, thang: string, lyDo: string): Promise<void> {
    const { error } = await db().rpc('warehouse_reopen_period', {
      p_actor: actor,
      p_thang: `${thang}-01`,
      p_reason: lyDo,
    })
    if (error) throw new Error(error.message)
  },

  /**
   * Nhật ký chốt / mở lại kỳ, mới → cũ (0300). Bảng chưa có (mã lên trước
   * migration) thì rỗng — Báo cáo tháng vẫn chạy.
   */
  async nhatKy(limit = 50): Promise<NhatKyKy[]> {
    const { data, error } = await db()
      .from('warehouse_period_log')
      .select(
        'id, thang, action, reason, gt_ton_cuoi, created_at, actor:users!warehouse_period_log_actor_id_fkey(name)',
      )
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') return []
      throw new Error(error.message)
    }
    return (data ?? []).map((r) => ({
      id: r.id as string,
      thang: (r.thang as string).slice(0, 7),
      action: r.action as 'close' | 'reopen',
      reason: (r.reason as string | null) ?? null,
      ai: one(r.actor as { name: string } | { name: string }[] | null)?.name ?? null,
      gt_ton_cuoi: r.gt_ton_cuoi == null ? null : Number(r.gt_ton_cuoi),
      created_at: r.created_at as string,
    }))
  },

  async maLenh(ids: string[]): Promise<Map<string, string>> {
    const rows = await theoLo<{ id: string; code: string }>(ids, (lo) =>
      db().from('production_orders').select('id, code').in('id', lo).order('id'),
    )
    return new Map(rows.map((r) => [r.id, r.code]))
  },

  async vatTu(
    ids: string[],
  ): Promise<
    Map<string, { code: string; name: string; unit: string; group_name: string | null }>
  > {
    const rows =
      await theoLo<{ id: string; code: string; name: string; unit: string; group_name: string | null }> // prettier-ignore
      (
        ids,
        (lo) => db().from('warehouse_materials').select('id, code, name, unit, group_name').in('id', lo).order('id'), // prettier-ignore
      )
    return new Map(rows.map((r) => [r.id, r]))
  },
}
