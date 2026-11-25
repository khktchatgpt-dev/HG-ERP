/**
 * BIÊN BẢN KIỂM TRA ĐẦU VÀO — luật thuần cho bản in "Phiếu nhập kho kiêm biên
 * bản kiểm tra đầu vào" (bản vẽ BmMmB47fgZhpxwWCuDhu4j, duyệt 25/11/2026).
 *
 * Bản in đi kèm phiếu 01-VT, KHÔNG thay nó. ERP điền thứ nó biết; phần kiểm tra
 * (SL đạt / lỗi, checklist, kết luận, chữ ký QC) để trống cho người kiểm ghi tay.
 * Cố ý KHÔNG chép công thức của file Excel gốc: nó coi "đủ số" là "đạt".
 */

export type TieuChi = { nhom: string; tieu_chi: string }

/** Hai dòng luôn có, mọi phiếu. */
export const TIEU_CHI_CHUNG: TieuChi[] = [
  { nhom: 'Hồ sơ', tieu_chi: 'Đơn mua / phiếu giao hàng khớp thông tin lô' },
  { nhom: 'Số lượng', tieu_chi: 'Đếm / cân / đo; đối chiếu đơn vị tính và chứng từ' },
]

/** Tám tiêu chí riêng theo loại vật tư — nguyên văn file Excel của công ty. */
const TC = {
  go: { nhom: 'Gỗ tự nhiên / gỗ xẻ', tieu_chi: 'Loài gỗ, quy cách, độ ẩm, nứt, cong vênh, mối mọt, mắt chết' },
  van: { nhom: 'Ván công nghiệp', tieu_chi: 'Loại ván, độ dày, kích thước, phẳng, sứt cạnh, phồng rộp' },
  veneer: { nhom: 'Veneer / laminate', tieu_chi: 'Mã màu / vân, độ dày, trầy xước, bong, lệch màu' },
  mut: { nhom: 'Mút / foam', tieu_chi: 'Chủng loại, tỷ trọng / độ cứng theo yêu cầu, kích thước, biến dạng' },
  vai: { nhom: 'Vải / da', tieu_chi: 'Mã màu, khổ, lỗi dệt / bề mặt, bẩn, mùi, số mét' },
  keo: { nhom: 'Keo / sơn / hóa chất', tieu_chi: 'Nhãn, mã, hạn dùng, tình trạng bao bì; COA / SDS nếu yêu cầu' },
  kimKhi: { nhom: 'Phụ kiện kim khí', tieu_chi: 'Mã / mẫu, kích thước, lớp mạ, số lượng, vận hành / lắp thử' },
  baoBi: { nhom: 'Bao bì / nhãn', tieu_chi: 'Tình trạng kiện, mã hàng / lô, nhãn và điều kiện vận chuyển' },
} satisfies Record<string, TieuChi> // prettier-ignore

/** Nhóm vật tư ERP chưa có tiêu chí riêng trong file Excel thì dùng câu này. */
export const TIEU_CHI_KHAC = 'Quy cách, kích thước, ngoại quan theo đơn mua'

/** Nhóm vật tư ERP (đầu tên nhóm, không dấu, thường) → tiêu chí riêng. */
const THEO_NHOM: [string, TieuChi[]][] = [
  ['go - van', [TC.go, TC.van, TC.veneer]],
  ['mut', [TC.mut]],
  ['vai', [TC.vai]],
  ['son - keo', [TC.keo]],
  ['dau - nhot', [TC.keo]],
  ['bu long', [TC.kimKhi]],
  ['phu kien', [TC.kimKhi]],
  ['bao bi', [TC.baoBi]],
]

const khongDau = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()

/**
 * Dòng checklist cho một phiếu: Hồ sơ + Số lượng, rồi tiêu chí của từng nhóm vật
 * tư có trong phiếu (theo thứ tự gặp, không lặp). Nhóm chưa có tiêu chí riêng
 * thì một dòng mang tên nhóm + câu chung; dòng chưa có nhóm gom vào "Khác".
 */
export function dongChecklist(nhomVatTu: (string | null | undefined)[]): TieuChi[] {
  const out: TieuChi[] = [...TIEU_CHI_CHUNG]
  const daCo = new Set<string>()
  const them = (t: TieuChi) => {
    if (daCo.has(t.nhom)) return
    daCo.add(t.nhom)
    out.push(t)
  }
  for (const g of nhomVatTu) {
    const ten = g?.trim() || 'Khác'
    const k = khongDau(ten)
    const hit = THEO_NHOM.find(([dau]) => k.startsWith(dau))
    if (hit) hit[1].forEach(them)
    else them({ nhom: ten, tieu_chi: TIEU_CHI_KHAC })
  }
  return out
}

/** Một dòng hàng trên biên bản. `qty` null = bản in trước khi ghi sổ (ô để trống). */
export type DongKiemTra = {
  id: string
  code: string
  name: string
  spec: string | null
  group: string | null
  unit: string
  /** SL theo đơn (sau ghi sổ) hoặc SL còn chờ về (trước ghi sổ). */
  qty_doc: number | null
  qty: number | null
}

/** "Tên · quy cách" — bỏ quy cách nếu tên đã chứa nguyên văn nó. */
export function tenQuyCach(name: string, spec: string | null): string {
  const s = spec?.trim()
  // "555x555x20" và "555×555×20" là một quy cách — so sau khi gộp dấu nhân + khoảng trắng.
  const gon = (v: string) => v.toLowerCase().replace(/[×*]/g, 'x').replace(/\s+/g, '')
  if (!s || gon(name).includes(gon(s))) return name
  return `${name} · ${s}`
}
