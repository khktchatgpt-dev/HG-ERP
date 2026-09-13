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
/* ══════════════════════════════════════════════════════════════════════
   HỒ SƠ KHUÔN (0190) — danh mục dùng chung ở `/khuon`

   `search()` ở trên phục vụ Ô CHỌN KHUÔN: chỉ đời đang dùng, chỉ 'active'.
   Phần dưới phục vụ MÀN DANH MỤC — phải thấy CẢ khuôn hư, khuôn chưa rõ tình
   trạng, vì chính 74 mã "chưa xác định" mới là việc cần làm của màn đó.
   ══════════════════════════════════════════════════════════════════════ */

/** Trạng thái khuôn sau 0190 — ba giá trị cũ của 0106 giữ nguyên tên. */
export type DieStatus =
  'pending' | 'active' | 'rarely_used' | 'broken' | 'replaced' | 'retired' | 'unknown'

export type DieRow = {
  id: string
  code: string
  name: string | null
  part_group: string | null
  profile_shape: string | null
  alloy: string | null
  weight_per_m: number | null
  die_price: number | null
  unit: string | null
  holder_name: string | null
  supplier_name: string | null
  status: DieStatus
  is_current: boolean
  legacy_codes: string[]
  image_file_id: string | null
  data_confidence: 'confirmed' | 'needs_review'
  review_note: string | null
  duplicate_group: string | null
  note: string | null
  source_note: string | null
}

/** Thông số xưởng cần để đổi "dài cắt" ra "mấy cây nhôm" (0190 mục 2). */
export type DieSpec = {
  section_a_mm: number | null
  section_b_mm: number | null
  wall_thickness_mm: number | null
  outer_diameter_mm: number | null
  rib_count: number | null
  bar_length_m: number | null
  pcs_per_bundle: number | null
  weight_tolerance_pct: number | null
  saw_kerf_mm: number | null
  end_trim_mm: number | null
  surface_finish: string | null
  marking: string | null
}

export type DieEventType =
  | 'opened'
  | 'modified'
  | 'transferred'
  | 'broken'
  | 'replaced'
  | 'retired'
  | 'reopened'
  | 'note'

export type DieEvent = {
  id: string
  event_type: DieEventType
  event_date: string | null
  weight_before: number | null
  weight_after: number | null
  cost: number | null
  from_holder: string | null
  to_holder: string | null
  content: string | null
  source: string | null
  created_at: string
}

const ROW_COLS =
  'id, code, name, part_group, profile_shape, alloy, weight_per_m, die_price, unit, ' +
  'holder_name, supplier_name, status, is_current, legacy_codes, image_file_id, ' +
  'data_confidence, review_note, duplicate_group, note, source_note'

const SPEC_COLS =
  'section_a_mm, section_b_mm, wall_thickness_mm, outer_diameter_mm, rib_count, ' +
  'bar_length_m, pcs_per_bundle, weight_tolerance_pct, saw_kerf_mm, end_trim_mm, ' +
  'surface_finish, marking'

const n = (v: unknown): number | null => (v == null ? null : Number(v))

function toRow(r: Record<string, unknown>): DieRow {
  return {
    id: r.id as string,
    code: r.code as string,
    name: (r.name as string | null) ?? null,
    part_group: (r.part_group as string | null) ?? null,
    profile_shape: (r.profile_shape as string | null) ?? null,
    alloy: (r.alloy as string | null) ?? null,
    weight_per_m: n(r.weight_per_m),
    die_price: n(r.die_price),
    unit: (r.unit as string | null) ?? null,
    holder_name: (r.holder_name as string | null) ?? null,
    supplier_name: (r.supplier_name as string | null) ?? null,
    status: (r.status as DieStatus) ?? 'unknown',
    is_current: Boolean(r.is_current),
    legacy_codes: (r.legacy_codes as string[] | null) ?? [],
    image_file_id: (r.image_file_id as string | null) ?? null,
    data_confidence: (r.data_confidence as DieRow['data_confidence']) ?? 'confirmed',
    review_note: (r.review_note as string | null) ?? null,
    duplicate_group: (r.duplicate_group as string | null) ?? null,
    note: (r.note as string | null) ?? null,
    source_note: (r.source_note as string | null) ?? null,
  }
}

function toSpec(r: Record<string, unknown>): DieSpec {
  return {
    section_a_mm: n(r.section_a_mm),
    section_b_mm: n(r.section_b_mm),
    wall_thickness_mm: n(r.wall_thickness_mm),
    outer_diameter_mm: n(r.outer_diameter_mm),
    rib_count: n(r.rib_count),
    bar_length_m: n(r.bar_length_m),
    pcs_per_bundle: n(r.pcs_per_bundle),
    weight_tolerance_pct: n(r.weight_tolerance_pct),
    saw_kerf_mm: n(r.saw_kerf_mm),
    end_trim_mm: n(r.end_trim_mm),
    surface_finish: (r.surface_finish as string | null) ?? null,
    marking: (r.marking as string | null) ?? null,
  }
}

/** Dòng định mức đang trỏ vào một mã khuôn — nguồn của tab "Dùng ở SP nào". */
export type DieUsage = {
  product_id: string
  product_code: string | null
  product_name: string | null
  part_name: string
  profile_code: string
  qty: number | null
  cut_length_mm: number | null
  /** Khớp thẳng mã chuẩn, hay chỉ khớp qua một cách viết cũ. */
  via: 'code' | 'legacy'
}

const key = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

export const dieCatalogRepo = {
  /**
   * Cả danh mục trong một lượt. 215 dòng (13/09/2026) — phân trang ở đây là
   * chia một bảng nhỏ thành nhiều truy vấn rồi vẫn lọc lại trong trình duyệt.
   * Vòng `range` giữ để danh mục có lớn lên cũng không âm thầm cụt ở 1.000 —
   * đúng cái bẫy đã cắt mất mã có tồn ở màn kho.
   */
  async listAll(): Promise<DieRow[]> {
    const out: DieRow[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db()
        .from('technical_dies')
        .select(ROW_COLS)
        .order('code', { ascending: true })
        .range(from, from + 999)
      if (error) throw new Error(`technical_dies: ${error.message}`)
      const rows = (data as unknown as Record<string, unknown>[] | null) ?? []
      out.push(...rows.map(toRow))
      if (rows.length < 1000) break
    }
    return out
  },

  async getById(id: string): Promise<(DieRow & DieSpec) | null> {
    const { data } = await db()
      .from('technical_dies')
      .select(`${ROW_COLS}, ${SPEC_COLS}`)
      .eq('id', id)
      .maybeSingle()
    if (!data) return null
    const r = data as unknown as Record<string, unknown>
    return { ...toRow(r), ...toSpec(r) }
  },

  /** Nhật ký đời khuôn, mới nhất trước. Dòng không có ngày xuống cuối. */
  async listEvents(dieId: string): Promise<DieEvent[]> {
    const { data } = await db()
      .from('technical_die_events')
      .select(
        'id, event_type, event_date, weight_before, weight_after, cost, from_holder, to_holder, content, source, created_at',
      )
      .eq('die_id', dieId)
      .order('event_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    return ((data as unknown as Record<string, unknown>[] | null) ?? []).map((r) => ({
      id: r.id as string,
      event_type: r.event_type as DieEventType,
      event_date: (r.event_date as string | null) ?? null,
      weight_before: n(r.weight_before),
      weight_after: n(r.weight_after),
      cost: n(r.cost),
      from_holder: (r.from_holder as string | null) ?? null,
      to_holder: (r.to_holder as string | null) ?? null,
      content: (r.content as string | null) ?? null,
      source: (r.source as string | null) ?? null,
      created_at: r.created_at as string,
    }))
  },

  /**
   * Hồ sơ SP đang dùng khuôn. KHỚP MỀM, không FK: `profile_code` trên dòng
   * định mức là text tự do, và 87/137 giá trị đang có KHÔNG phải mã khuôn mà là
   * quy cách ("15x35", "VUONG20") — ép FK là hoặc mất dữ liệu, hoặc đẻ ra 87 mã
   * khuôn ma. Trả kèm `via` để màn nói rõ dòng nào khớp chắc, dòng nào chỉ khớp
   * qua cách viết cũ; đừng trưng một con số gộp.
   */
  /**
   * Tổng số hồ sơ SP — MẪU SỐ của ô "đang dùng ở" trên hồ sơ khuôn. "4 SP"
   * không nói lên gì; "4 trên 779 hồ sơ" thì có. Cùng module nên đọc thẳng,
   * không đi vòng qua service của hồ sơ SP cho một phép đếm.
   */
  async productTotal(): Promise<number> {
    const { count } = await db()
      .from('technical_products')
      .select('id', { count: 'exact', head: true })
    return count ?? 0
  },

  async usage(code: string, legacy: string[]): Promise<DieUsage[]> {
    const wanted = [code, ...legacy].filter(Boolean)
    if (wanted.length === 0) return []
    const { data } = await db()
      .from('technical_product_parts')
      .select(
        'product_id, part_name, profile_code, qty, cut_length_mm, technical_products(code, name)',
      )
      .in('profile_code', wanted)
      .limit(500)

    const codeKey = key(code)
    return ((data as unknown as Record<string, unknown>[] | null) ?? []).map((r) => {
      const p = r.technical_products as {
        code?: string
        name?: string
      } | null
      const pc = (r.profile_code as string) ?? ''
      return {
        product_id: r.product_id as string,
        product_code: p?.code ?? null,
        product_name: p?.name ?? null,
        part_name: (r.part_name as string) ?? '',
        profile_code: pc,
        qty: n(r.qty),
        cut_length_mm: n(r.cut_length_mm),
        via: key(pc) === codeKey ? 'code' : 'legacy',
      }
    })
  },
}
/* ══════════════════════════════════════════════════════════════════════
   ĐƯỜNG GHI (0190) — thêm / sửa / xoá khuôn và ghi nhật ký.
   Mọi luật nghiệp vụ (chặn trùng mã, tự đẻ sự kiện, chặn xoá khi còn ai dùng)
   nằm ở `dies.service`; ở đây chỉ là thao tác bảng.
   ══════════════════════════════════════════════════════════════════════ */

export type DieWriteFields = Partial<
  Omit<DieRow, 'id' | 'legacy_codes' | 'is_current'> & DieSpec
>

export type DieEventWrite = {
  die_id: string
  event_type: DieEventType
  event_date?: string | null
  weight_before?: number | null
  weight_after?: number | null
  cost?: number | null
  from_holder?: string | null
  to_holder?: string | null
  content?: string | null
  created_by?: string | null
}

export const dieWriteRepo = {
  /** Có mã này chưa? Dùng để chặn trùng lúc tạo — `code` KHÔNG unique ở DB. */
  async findByCode(code: string): Promise<{ id: string; code: string } | null> {
    const { data } = await db()
      .from('technical_dies')
      .select('id, code')
      .ilike('code', code.trim())
      .limit(1)
      .maybeSingle()
    return (data as { id: string; code: string } | null) ?? null
  },

  async insert(fields: DieWriteFields & { code: string }): Promise<string> {
    const { data, error } = await db()
      .from('technical_dies')
      .insert(fields)
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return (data as { id: string }).id
  },

  async update(id: string, fields: DieWriteFields): Promise<void> {
    const { error } = await db().from('technical_dies').update(fields).eq('id', id)
    if (error) throw new Error(error.message)
  },

  async remove(id: string): Promise<void> {
    const { error } = await db().from('technical_dies').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async insertEvent(ev: DieEventWrite): Promise<void> {
    const { error } = await db().from('technical_die_events').insert(ev)
    if (error) throw new Error(error.message)
  },

  /**
   * Đã có dòng đơn mua nào trỏ vào mã khuôn này chưa. Cùng với `usage()` (dòng
   * định mức) đây là hai đường duy nhất nơi khác nhắc tới khuôn — cả hai đều
   * nhắc bằng TEXT, không FK, nên xoá dòng khuôn không làm chúng gãy mà chỉ làm
   * chúng mồ côi. Đó mới là lý do phải chặn.
   */
  /**
   * Đếm nơi khác đang nhắc tới mã khuôn — hàng rào của lệnh XOÁ.
   *
   * ⚠️ SO KHỚP ĐÃ CHUẨN HOÁ, KHÔNG `eq`/`in` ĐÚNG TỪNG KÝ TỰ. Bài học trả giá
   * 13/09/2026: bản đầu của hàng rào này dùng `.eq('die_code', code)` và
   * `.in('profile_code', codes)`, nên nó chỉ bắt được khi nơi khác ghi mã Y HỆT.
   * Thực tế dòng định mức ghi rất tuỳ tiện — "TDA972" cho khuôn "TD-A972",
   * "TD916-3" cho "TD-916" — nên hàng rào TƯỞNG là đang bảo vệ mà thật ra cho
   * qua, và một khuôn thật đã bị xoá trong lượt thử. Chuẩn hoá đúng bằng hàm
   * `key()` mà tab "Dùng ở SP nào" đang dùng, để hai chỗ không bao giờ nói khác
   * nhau về việc "mã này có ai dùng không".
   *
   * Kéo cả cột về rồi lọc trong JS là có chủ ý: 462 dòng có `profile_code` và
   * 207 dòng đơn (đo 13/09/2026) — rẻ hơn nhiều so với việc dựng một hàm SQL
   * chuẩn hoá rồi phải nhớ sửa nó mỗi lần luật chuẩn hoá đổi.
   */
  async referenceCount(codes: string[]): Promise<{ poLines: number; parts: number }> {
    const want = new Set(codes.map(key).filter(Boolean))
    if (want.size === 0) return { poLines: 0, parts: 0 }

    const [{ data: lines }, { data: parts }] = await Promise.all([
      db()
        .from('supply_purchase_order_lines')
        .select('die_code')
        .not('die_code', 'is', null)
        .limit(5000),
      db()
        .from('technical_product_parts')
        .select('profile_code')
        .not('profile_code', 'is', null)
        .limit(5000),
    ])

    const hit = (rows: { [k: string]: unknown }[] | null, col: string) =>
      (rows ?? []).filter((r) => want.has(key(String(r[col] ?? '')))).length

    return {
      poLines: hit(lines as Record<string, unknown>[] | null, 'die_code'),
      parts: hit(parts as Record<string, unknown>[] | null, 'profile_code'),
    }
  },
}
