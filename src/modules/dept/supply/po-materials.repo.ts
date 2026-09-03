import { db } from '@/server/db'
import { normalizeSearch, searchTokens } from '@/lib/search-text'
import { matchScore, rankMaterials } from '@/lib/material-search-rank'
import { namesAlike, sureKey, MIN_KEY_LEN } from '@/lib/material-key'
import type { PoLastLine, PoMaterial } from '@/lib/po-material.types'

/**
 * Vật tư như FORM SOẠN ĐƠN cần — TÌM Ở SERVER, không nạp sẵn cả kho.
 *
 * Trang tạo đơn cũ nạp 1.000 vật tư + toàn bộ tồn + 500 PO ngay ở server render,
 * chỉ để phục vụ một ô lọc. Ở đây trả tối đa `limit` dòng theo từ khoá, kèm đúng
 * những trường quyết định cách dòng được nhập:
 *   · kg_per_m + default_bar_length_m → tự tính tổng kg cho mẫu nhôm
 *   · spec, vat_rate, last_purchase_price → tự điền lên dòng
 *
 * Kiểu `PoMaterial`/`PoLastLine` khai MỘT nơi ở `@/lib/po-material.types` (đợt 1
 * cải thiện vật tư 13/08/2026) — client MaterialPicker đọc cùng định nghĩa,
 * hết bẫy "thêm trường phải sửa hai chỗ". Re-export để chỗ gọi cũ không đổi.
 */
export type { PoLastLine, PoMaterial } from '@/lib/po-material.types'

const COLS =
  'id, code, name, unit, group_name, sub_group, spec, kg_per_m, kg_per_unit, default_bar_length_m, price_unit, unit2_factor, vat_rate, default_supplier_id, last_purchase_price, pack_size, pack_unit, material_grade, open_style, pcs_per_ctn, finish'

function toMaterial(
  r: Record<string, unknown>,
  onHand: number | null,
  lastLine: PoLastLine | null,
): PoMaterial {
  return {
    id: r.id as string,
    code: r.code as string,
    name: r.name as string,
    unit: (r.unit as string) ?? '',
    group_name: (r.group_name as string | null) ?? null,
    sub_group: (r.sub_group as string | null) ?? null,
    spec: (r.spec as string | null) ?? null,
    // numeric của PostgREST về dạng chuỗi → ép về number.
    kg_per_m: r.kg_per_m == null ? null : Number(r.kg_per_m),
    kg_per_unit: r.kg_per_unit == null ? null : Number(r.kg_per_unit),
    default_bar_length_m:
      r.default_bar_length_m == null ? null : Number(r.default_bar_length_m),
    price_unit: (r.price_unit as string | null) ?? null,
    unit2_factor: r.unit2_factor == null ? null : Number(r.unit2_factor),
    vat_rate: r.vat_rate == null ? null : Number(r.vat_rate),
    default_supplier_id: (r.default_supplier_id as string | null) ?? null,
    last_purchase_price:
      r.last_purchase_price == null ? null : Number(r.last_purchase_price),
    pack_size: r.pack_size == null ? null : Number(r.pack_size),
    pack_unit: (r.pack_unit as string | null) ?? null,
    material_grade: (r.material_grade as string | null) ?? null,
    // Thông số theo nhóm (0137) — chọn vật tư là dòng đơn đủ cách mở/pcs/bề mặt.
    open_style: (r.open_style as string | null) ?? null,
    pcs_per_ctn: r.pcs_per_ctn == null ? null : Number(r.pcs_per_ctn),
    finish: (r.finish as string | null) ?? null,
    on_hand: onHand,
    last_line: lastLine,
  }
}

/** Tồn hiện tại của các vật tư — 1 truy vấn cho cả trang kết quả, không N+1. */
async function onHandMany(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map()
  const { data } = await db()
    .from('warehouse_stock')
    .select('material_id, on_hand')
    .in('material_id', ids)
  const m = new Map<string, number>()
  for (const r of (data ?? []) as { material_id: string; on_hand: unknown }[]) {
    m.set(r.material_id, Number(r.on_hand ?? 0))
  }
  return m
}

/**
 * Ô mô tả của dòng đơn GẦN NHẤT theo từng vật tư — 1 truy vấn cho cả trang.
 *
 * Bảng dòng không có created_at nên độ mới lấy theo NGÀY TẠO ĐƠN (embed
 * supply_purchase_orders.created_at) rồi chọn dòng mới nhất trong JS. Kéo dư
 * (limit 400) vì một vật tư có thể nằm trên nhiều đơn; thiếu lịch sử thì trả
 * null — dòng mới để trống như cũ, không chặn gì.
 */
async function lastLinesMany(ids: string[]): Promise<Map<string, PoLastLine>> {
  if (ids.length === 0) return new Map()
  const { data } = await db()
    .from('supply_purchase_order_lines')
    .select(
      'material_id, material_grade, dimension_text, finish, pcs_per_ctn, open_style, dm_per_sp, area_m2, inner_l_mm, inner_w_mm, inner_h_mm, price_per_m2, print_fee, carton_basis, supply_purchase_orders!inner(created_at)',
    )
    .in('material_id', ids)
    .limit(400)
  type Row = {
    material_id: string
    material_grade: string | null
    dimension_text: string | null
    finish: string | null
    pcs_per_ctn: unknown
    open_style: string | null
    dm_per_sp: unknown
    area_m2: unknown
    inner_l_mm: unknown
    inner_w_mm: unknown
    inner_h_mm: unknown
    price_per_m2: unknown
    print_fee: unknown
    carton_basis: string | null
    supply_purchase_orders: { created_at: string }
  }
  const rows = ((data ?? []) as unknown as Row[]).sort((a, b) =>
    (b.supply_purchase_orders?.created_at ?? '').localeCompare(
      a.supply_purchase_orders?.created_at ?? '',
    ),
  )
  const m = new Map<string, PoLastLine>()
  for (const r of rows) {
    if (m.has(r.material_id)) continue
    // PostgREST trả numeric dạng CHUỖI — ép về number như numericLineFields.
    const num = (v: unknown) => (v == null ? null : Number(v))
    m.set(r.material_id, {
      material_grade: r.material_grade ?? null,
      dimension_text: r.dimension_text ?? null,
      finish: r.finish ?? null,
      pcs_per_ctn: num(r.pcs_per_ctn),
      open_style: r.open_style ?? null,
      dm_per_sp: num(r.dm_per_sp),
      area_m2: num(r.area_m2),
      inner_l_mm: num(r.inner_l_mm),
      inner_w_mm: num(r.inner_w_mm),
      inner_h_mm: num(r.inner_h_mm),
      price_per_m2: num(r.price_per_m2),
      print_fee: num(r.print_fee),
      carton_basis: r.carton_basis ?? null,
    })
  }
  return m
}

/**
 * Gắn tồn kho + dòng đơn gần nhất cho MỘT TRANG kết quả. Tách riêng vì hai truy
 * vấn này đắt: chỉ chạy sau khi đã xếp hạng và cắt, không chạy trên cả cửa sổ lọc.
 */
async function hydrate(rows: Record<string, unknown>[]): Promise<PoMaterial[]> {
  const ids = rows.map((r) => r.id as string)
  const [onHand, lastLines] = await Promise.all([onHandMany(ids), lastLinesMany(ids)])
  return rows.map((r) =>
    toMaterial(
      r,
      onHand.get(r.id as string) ?? null, // null = chưa có sổ kho (0127)
      lastLines.get(r.id as string) ?? null,
    ),
  )
}

export const poMaterialsRepo = {
  /**
   * Tìm theo mã / tên / barcode — KHÔNG dính gì tới mẫu đơn.
   *
   * Trước đây lọc theo `po_template` gắn trên vật tư: gỗ mang mẫu "Đơn giản" nên
   * soạn đơn phụ kiện gõ "gỗ" ra trắng tay, người mua tưởng danh mục không có gỗ.
   * Bỏ hẳn (08/08/2026): mẫu đơn là thuộc tính của ĐƠN — chọn ở đầu form, quyết
   * định bộ cột; vật tư nào cũng đặt được ở mẫu nào.
   */
  async search(opts: {
    q?: string
    /** Lọc theo nhóm — danh mục 13k dòng, gõ "hộp" ra hàng trăm kết quả. */
    group?: string
    limit: number
  }): Promise<PoMaterial[]> {
    const base = () => {
      let query = db().from('warehouse_materials').select(COLS).eq('is_active', true)
      if (opts.group) query = query.eq('group_name', opts.group)
      return query
    }

    /*
     * TÌM KHÔNG DẤU (0127): AND từng từ khoá bằng ilike trên cột `search_text`
     * (đã hạ thường + bỏ dấu, gộp mã + tên + barcode + quy cách + nhóm phụ) —
     * "vit 4x15" không dấu, đảo thứ tự từ, đều trúng "Vít 4x15". Trước đây
     * ilike trên cột gốc phân biệt dấu, người gõ vội trắng tay.
     */
    const tokens = searchTokens(opts.q ?? '')
    if (tokens.length === 0) {
      const { data } = await base().order('code', { ascending: true }).limit(opts.limit)
      return hydrate((data as Record<string, unknown>[] | null) ?? [])
    }

    /*
     * BA ĐƯỜNG LỌC SONG SONG rồi gộp — vì một câu `ilike` AND từng từ là KHÔNG
     * ĐỦ (sửa 03/09/2026, người dùng báo: "gõ tên khá sát vẫn không lọc ra,
     * chọn nhóm mới tìm thấy").
     *
     * Gốc lỗi: câu AND đó khớp 471 mã cho "thùng carton", mà cửa sổ lấy về chỉ
     * 50 dòng ĐẦU BẢNG CHỮ CÁI ("BB ..."), nên món người ta vừa gõ gần đúng tên
     * không có mặt để mà xếp hạng. Chọn nhóm làm tập nhỏ lại dưới 50 nên "tự
     * nhiên tìm thấy" — đúng hiện tượng được báo.
     *
     *   1. CẢ CỤM: search_text chứa nguyên chuỗi đã chuẩn hoá — bắt đúng ca gõ
     *      gần hết tên, dù mã đó nằm cuối bảng chữ cái.
     *   2. TỪNG TỪ (AND): đường cũ, cho người gõ thiếu/đảo từ. Cửa sổ rộng hơn.
     *   3. MÃ: gõ mã thì ra ngay, không phải chờ khớp tên.
     *
     * Gộp xong mới xếp hạng (`rankMaterials`) rồi CẮT — và chỉ sau khi cắt mới
     * đi lấy tồn + dòng đơn gần nhất, nên phần đắt tiền vẫn chỉ chạy trên `limit`
     * dòng dù cửa sổ lọc rộng gấp nhiều lần.
     */
    const phrase = normalizeSearch(opts.q ?? '')
      .replace(/[,()*%\\]/g, ' ')
      .trim()
    const WINDOW = Math.max(opts.limit * 8, 200)
    let tokenQuery = base()
    for (const t of tokens) tokenQuery = tokenQuery.ilike('search_text', `%${t}%`)

    const [byPhrase, byTokens, byCode] = await Promise.all([
      phrase.length >= 2
        ? base().ilike('search_text', `%${phrase}%`).order('name').limit(60)
        : null,
      tokenQuery.order('name').limit(WINDOW),
      phrase.includes(' ') ? null : base().ilike('code', `${phrase}%`).limit(10),
    ])

    const seen = new Set<string>()
    const rows: Record<string, unknown>[] = []
    for (const res of [byCode, byPhrase, byTokens]) {
      for (const r of (res?.data as Record<string, unknown>[] | null) ?? []) {
        const id = r.id as string
        if (seen.has(id)) continue
        seen.add(id)
        rows.push(r)
      }
    }

    // Xếp theo ĐỘ KHỚP CHỮ trước (thuần, có test ở material-search-rank.test.ts).
    // Giá mua là tín hiệu "đang dùng" duy nhất có sẵn trong cột — dùng luôn ở
    // bước này; lịch sử lên đơn phải truy vấn nên để bước sau.
    const ranked = rankMaterials(
      opts.q ?? '',
      rows.map((r) => ({ code: r.code as string, name: r.name as string, row: r })),
      (x) => ({ priced: x.row.last_purchase_price != null }),
    ).slice(0, opts.limit)

    const mats = await hydrate(ranked.map((x) => x.row))
    /*
     * Bên trong danh sách đã hợp lệ, nhấc MÃ ĐÃ TỪNG LÊN ĐƠN lên trên (bất cập
     * "rừng mã trùng"): "vít 4x15" ra chục mã na ná, tồn 0 hết, thì tín hiệu tốt
     * nhất là mã người trước đã chọn. Chỉ đảo trong tập đã cắt nên không đẩy
     * được món lạc đề lên đầu.
     */
    const key = (m: PoMaterial) =>
      matchScore(opts.q ?? '', m) * 10 + (m.last_line ? 4 : 0)
    return mats.sort((a, b) => key(b) - key(a))
  },

  /**
   * KHỚP MÃ CHO VÙNG DÁN TỪ EXCEL (0136) — mỗi dòng sổ (tên, mã nếu có) tìm về
   * đúng một vật tư danh mục, hoặc danh sách ứng viên để người soạn chọn.
   *
   * Ba bậc tin cậy, cùng bộ so với dò-trùng khi khai vật tư (material-key):
   *   'code'  — sổ có mã và mã tồn tại: khớp thẳng, khỏi so tên.
   *   'sure'  — sureKey trùng (chỉ lệch dấu câu/khoảng trắng/viết tắt đã bung):
   *             nghĩa không đổi, tự chọn được.
   *   'fuzzy' — namesAlike (Buri/Bori, đen/đem…): ĐỀ CỬ chứ không tự chọn —
   *             UI bắt người soạn xác nhận, sai hàng là sai tiền.
   * Không bậc nào trúng → match null + ứng viên top đầu để chọn tay.
   */
  async matchMany(items: { name: string; code?: string | null }[]): Promise<
    {
      match: PoMaterial | null
      candidates: PoMaterial[]
      confidence: 'code' | 'sure' | 'fuzzy' | null
    }[]
  > {
    // Mã khớp thẳng — một truy vấn cho cả bộ.
    const codes = [
      ...new Set(items.map((i) => i.code?.trim()).filter((c): c is string => !!c)),
    ]
    const byCode = new Map<string, PoMaterial>()
    if (codes.length > 0) {
      const { data } = await db()
        .from('warehouse_materials')
        .select(COLS)
        .in('code', codes.slice(0, 100))
      const rows = (data as Record<string, unknown>[] | null) ?? []
      const rowIds = rows.map((r) => r.id as string)
      const [onHand, lastLines] = await Promise.all([
        onHandMany(rowIds),
        lastLinesMany(rowIds),
      ])
      for (const r of rows) {
        const m = toMaterial(
          r,
          onHand.get(r.id as string) ?? null,
          lastLines.get(r.id as string) ?? null,
        )
        byCode.set(m.code, m)
      }
    }

    // Tìm theo tên — đi đúng đường search của ô chọn vật tư (không dấu + xếp
    // hạng mã-đang-dùng). Chạy theo lô 10 để không dội 100 truy vấn cùng lúc.
    const out: {
      match: PoMaterial | null
      candidates: PoMaterial[]
      confidence: 'code' | 'sure' | 'fuzzy' | null
    }[] = new Array(items.length)
    const CHUNK = 10
    for (let start = 0; start < items.length; start += CHUNK) {
      const chunk = items.slice(start, start + CHUNK)
      await Promise.all(
        chunk.map(async (item, j) => {
          const i = start + j
          const coded = item.code?.trim() ? byCode.get(item.code.trim()) : undefined
          if (coded) {
            out[i] = { match: coded, candidates: [], confidence: 'code' }
            return
          }
          const candidates = await this.search({ q: item.name, limit: 4 })
          const key = sureKey(item.name)
          const sure =
            key.length >= MIN_KEY_LEN
              ? candidates.find((c) => sureKey(c.name) === key)
              : undefined
          if (sure) {
            out[i] = { match: sure, candidates, confidence: 'sure' }
            return
          }
          const fuzzy = candidates.find((c) => namesAlike(item.name, c.name))
          out[i] = {
            match: fuzzy ?? null,
            candidates,
            confidence: fuzzy ? 'fuzzy' : null,
          }
        }),
      )
    }
    return out
  },

  /** Nạp lại đúng các vật tư đang nằm trên dòng (mở form sửa đơn). */
  async byIds(ids: string[]): Promise<PoMaterial[]> {
    if (ids.length === 0) return []
    const { data } = await db()
      .from('warehouse_materials')
      .select(COLS)
      .in('id', ids.slice(0, 200))
    const rows = (data as Record<string, unknown>[] | null) ?? []
    const rowIds = rows.map((r) => r.id as string)
    const [onHand, lastLines] = await Promise.all([
      onHandMany(rowIds),
      lastLinesMany(rowIds),
    ])
    return rows.map((r) =>
      toMaterial(
        r,
        onHand.get(r.id as string) ?? null, // null = chưa có sổ kho (0127)
        lastLines.get(r.id as string) ?? null,
      ),
    )
  },
}
