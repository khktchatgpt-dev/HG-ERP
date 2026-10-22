/**
 * GỢI Ý NHÀ CUNG CẤP cho một mã cần mua (Kế hoạch mua · bước 2, 22/10/2026).
 *
 * Thứ tự đã chốt (Q3 bản vẽ WE12EjR5…):
 *   1. NCC mua CHÍNH MÃ NÀY lần gần nhất — giá đã ký, cùng đơn vị.
 *   2. Chưa mua mã này bao giờ → NCC RẺ NHẤT CÙNG QUY CÁCH (nhôm/thép quy về
 *      đ/kg — `docQuyCach`), vì mỗi NCC một mã cho cùng một cây nhôm.
 *   3. Vẫn không có → NCC bán nhiều nhất CÙNG TIỂU NHÓM vật tư, GIÁ ĐỂ TRỐNG
 *      (phải hỏi giá) — đo 22/10: 29/38 mã của lệnh 13 MX chưa từng mua.
 *
 * Nguồn là DÒNG ĐƠN ĐÃ DUYỆT trở đi (giá nháp chưa phải giá chốt). Hàm thuần —
 * service nạp lịch sử, màn và Excel cùng gọi để hai nơi nói một con số.
 */

export type DongLichSu = {
  material_id: string
  supplier_id: string
  supplier_name: string
  po_code: string
  /** Ngày đặt (yyyy-mm-dd) — để biết "lần gần nhất". */
  at: string
  /** SL đặt theo ĐVT mua của dòng. */
  qty: number
  /** Thành tiền dòng (chưa VAT). */
  amount: number
  /** Khối lượng kg của dòng nếu có (qty2 khi unit2 = kg). */
  kg: number | null
  /** Khoá quy cách kim loại của vật tư dòng đó (null = không phải kim loại). */
  quyCach: string | null
  /**
   * ĐVT của SL trên dòng đơn — có thể KHÁC ĐVT danh mục (đo 22/10: LĐS mua theo
   * Kg, danh mục tính Con → "40.000 đ/con" nếu không mang theo đơn vị).
   */
  dv: string
}

export type NccTheoNhom = { supplier_id: string; supplier_name: string; soLan: number }

export type VatTuCanMua = {
  material_id: string
  quyCach: string | null
  /** Khối lượng một ĐVT mua (kg/cây) — để đổi đ/kg ra đ/cây. Null = chưa khai. */
  kgMoiDv: number | null
  /** ĐVT mua của mã (danh mục). */
  unit: string
}

export type NguonGoiY = 'ma' | 'quy_cach' | 'nhom'

export type UngVienNcc = {
  supplier_id: string
  supplier_name: string
  nguon: NguonGoiY
  /** Giá theo ĐVT mua của mã cần mua (đ/cây, đ/con…). Null = chưa biết. */
  giaDv: number | null
  /** Giá theo kg — chỉ hàng kim loại có khối lượng. */
  giaKg: number | null
  /** Đơn vị của `giaDv` — thường là ĐVT danh mục; khác thì màn phải cảnh báo. */
  dvGia: string
  /** Lần mua làm căn cứ (null với nguồn 'nhom'). */
  at: string | null
  po_code: string | null
  /** Số lần mua làm căn cứ (mã / cùng quy cách / cùng nhóm). */
  soLan: number
}

export const LY_DO_GOI_Y: Record<NguonGoiY, string> = {
  ma: 'mua mã này lần gần nhất',
  quy_cach: 'rẻ nhất cùng quy cách',
  nhom: 'bán nhiều nhất cùng nhóm',
}

const r0 = (v: number) => Math.round(v)

/** Ứng viên NCC cho một mã, đã xếp: nguồn 1 → 2 → 3. Ứng viên đầu là gợi ý. */
export function goiYNcc(
  vt: VatTuCanMua,
  lichSu: DongLichSu[],
  theoNhom: NccTheoNhom[],
  toiDaNhom = 3,
): UngVienNcc[] {
  const out: UngVienNcc[] = []
  const da = new Set<string>()

  // 1) Chính mã này — mỗi NCC lấy lần gần nhất, xếp mới nhất lên đầu.
  const cungMa = lichSu.filter((l) => l.material_id === vt.material_id && l.qty > 0)
  const theoNcc = new Map<string, DongLichSu[]>()
  for (const l of cungMa) theoNcc.set(l.supplier_id, [...(theoNcc.get(l.supplier_id) ?? []), l]) // prettier-ignore
  const nguon1 = [...theoNcc.values()]
    .map((ls) => {
      const moi = ls.reduce((a, b) => (b.at > a.at ? b : a))
      return {
        supplier_id: moi.supplier_id,
        supplier_name: moi.supplier_name,
        nguon: 'ma' as const,
        giaDv: r0(moi.amount / moi.qty),
        dvGia: moi.dv || vt.unit,
        giaKg: moi.kg ? r0(moi.amount / moi.kg) : null,
        at: moi.at,
        po_code: moi.po_code,
        soLan: ls.length,
      }
    })
    .sort((a, b) => b.at!.localeCompare(a.at!))
  for (const u of nguon1) {
    out.push(u)
    da.add(u.supplier_id)
  }

  // 2) Cùng quy cách, mã khác — chỉ so được khi dòng có kg.
  if (vt.quyCach) {
    const cung = lichSu.filter(
      (l) =>
        l.quyCach === vt.quyCach &&
        l.material_id !== vt.material_id &&
        l.kg != null &&
        l.kg > 0 &&
        !da.has(l.supplier_id),
    )
    const m = new Map<string, DongLichSu[]>()
    for (const l of cung) m.set(l.supplier_id, [...(m.get(l.supplier_id) ?? []), l])
    const nguon2 = [...m.values()]
      .map((ls) => {
        const moi = ls.reduce((a, b) => (b.at > a.at ? b : a))
        const giaKg = r0(moi.amount / moi.kg!)
        return {
          supplier_id: moi.supplier_id,
          supplier_name: moi.supplier_name,
          nguon: 'quy_cach' as const,
          giaKg,
          giaDv: vt.kgMoiDv ? r0(giaKg * vt.kgMoiDv) : null,
          dvGia: vt.unit,
          at: moi.at,
          po_code: moi.po_code,
          soLan: ls.length,
        }
      })
      .sort((a, b) => a.giaKg - b.giaKg)
    for (const u of nguon2) {
      out.push(u)
      da.add(u.supplier_id)
    }
  }

  // 3) Cùng tiểu nhóm — chỉ tên NCC, giá để trống.
  for (const n of theoNhom
    .filter((x) => !da.has(x.supplier_id))
    .sort((a, b) => b.soLan - a.soLan)
    .slice(0, toiDaNhom)) {
    out.push({
      supplier_id: n.supplier_id,
      supplier_name: n.supplier_name,
      nguon: 'nhom',
      giaDv: null,
      giaKg: null,
      dvGia: vt.unit,
      at: null,
      po_code: null,
      soLan: n.soLan,
    })
    da.add(n.supplier_id)
  }
  return out
}

/**
 * Chênh của ứng viên `b` so với `a`: so đ/kg khi cả hai có (kim loại khác chiều
 * dài cây vẫn so được), không thì so đ/ĐVT. Null = không so được.
 */
export function chenhGia(
  a: UngVienNcc | { giaDv: number | null; giaKg: number | null },
  b: UngVienNcc,
): number | null {
  if (a.giaKg && b.giaKg) return b.giaKg / a.giaKg - 1
  if (a.giaDv && b.giaDv) return b.giaDv / a.giaDv - 1
  return null
}

/** Tên NCC gọn để bày trên lưới: bỏ "CÔNG TY TNHH SX & TM…" — tên đầy đủ để ở title. */
export function tenNganNcc(name: string): string {
  const t = name
    .replace(/^(công ty|cty|doanh nghiệp tư nhân|dntn|cơ sở|hộ kinh doanh)\s+/i, '')
    .replace(/^(tnhh|cổ phần|cp)\s+/i, '')
    .replace(
      // "-DV" dính gạch đầu ("TM -DV -TH MINH THẮNG") cũng là phần loại hình.
      /^(-?(sx|tm|dv|th|xnk|sản xuất|thương mại|dịch vụ|xuất nhập khẩu|và|&|-|,)(\s+|$))+/i,
      '',
    )
    .trim()
  return t || name
}
