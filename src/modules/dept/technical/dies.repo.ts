import { db } from '@/server/db'

/**
 * Khuôn nhôm (0106) — mẫu đơn NHÔM tính tiền theo (kg/m × dài cây × số cây) ×
 * giá/kg, mà `kg/m` là thuộc tính của KHUÔN chứ không của vật tư. Chọn mã khuôn
 * trên dòng đơn là tự có kg/m, khỏi tra file Excel.
 *
 * Nạp bằng `node scripts/dies-import.mjs <file.xlsx>` từ sheet KHUÔN của phòng
 * Kỹ thuật. Cùng mã có nhiều đời (mở lại / bỏ gân / tăng dày) khác kg/m —
 * `is_current` đánh dấu đời đang dùng, đời cũ giữ để tra cứu.
 */
export type Die = {
  id: string
  code: string
  name: string | null
  profile_spec: string | null
  weight_per_m: number | null
  supplier_name: string | null
  status: 'active' | 'broken' | 'retired'
  is_current: boolean
  note: string | null
}

const COLS =
  'id, code, name, profile_spec, weight_per_m, supplier_name, status, is_current, note'

function toDie(r: Record<string, unknown>): Die {
  return {
    id: r.id as string,
    code: r.code as string,
    name: (r.name as string | null) ?? null,
    profile_spec: (r.profile_spec as string | null) ?? null,
    weight_per_m: r.weight_per_m == null ? null : Number(r.weight_per_m),
    supplier_name: (r.supplier_name as string | null) ?? null,
    status: (r.status as Die['status']) ?? 'active',
    is_current: Boolean(r.is_current),
    note: (r.note as string | null) ?? null,
  }
}

export const diesRepo = {
  /**
   * Tìm khuôn theo mã / tên chi tiết / quy cách. Mặc định chỉ đời đang dùng —
   * đặt hàng theo khuôn đã hư hoặc đã bỏ là đặt sai kg/m.
   */
  async search(opts: {
    q?: string
    limit: number
    include_inactive?: boolean
  }): Promise<Die[]> {
    let query = db()
      .from('technical_dies')
      .select(COLS)
      .order('code', { ascending: true })
      .limit(opts.limit)

    if (!opts.include_inactive)
      query = query.eq('is_current', true).eq('status', 'active')
    if (opts.q) {
      const q = opts.q.replace(/[%,()]/g, ' ').trim()
      if (q)
        query = query.or(`code.ilike.%${q}%,name.ilike.%${q}%,profile_spec.ilike.%${q}%`)
    }

    const { data } = await query
    return ((data as Record<string, unknown>[] | null) ?? []).map(toDie)
  },
}
