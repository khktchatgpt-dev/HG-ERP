/**
 * Nạp hồ sơ nhân viên từ Excel (Hồ sơ nhân viên B4, bản vẽ lượt 2) — logic THUẦN.
 *
 * Cùng lối với nạp Hồ sơ lương: DÁN vùng có dòng tiêu đề, nhận cột theo TÊN (bỏ dấu), cột
 * lạ bỏ qua. Khớp người theo Mã NV; không có mã thì theo họ tên (+ tổ). Ô trống = không
 * đổi. Mặc định chỉ ĐIỀN ô đang trống — ghi đè giá trị có sẵn phải bật riêng.
 * File "chua co cccd.xlsx": cột "Bộ phận" ở đó là chức danh ("Công nhân tổ Phôi", "Kế
 * toán") nên tiêu đề đúng "Bộ phận" được hiểu là CHỨC DANH; tổ là "Tổ" / "Bộ phận / Tổ".
 */
import { chuanCccd, chuanSdt } from './ca-nhan'

export const COT_NAP = [
  'ma',
  'ten',
  'to',
  'chucDanh',
  'ngayVao',
  'ngaySinh',
  'gioiTinh',
  'quocTich',
  'queQuan',
  'trinhDo',
  'cccd',
  'ngayCap',
  'noiCap',
  'mst',
  'thuongTru',
  'choO',
  'dienThoai',
  'khanCapTen',
  'khanCapQuanHe',
  'khanCapSdt',
] as const
export type CotNapNv = (typeof COT_NAP)[number]

export const TEN_COT_NAP: Record<CotNapNv, string> = {
  ma: 'Mã NV',
  ten: 'Họ tên',
  to: 'Tổ',
  chucDanh: 'Chức danh',
  ngayVao: 'Ngày vào làm',
  ngaySinh: 'Ngày sinh',
  gioiTinh: 'Giới tính',
  quocTich: 'Quốc tịch',
  queQuan: 'Quê quán',
  trinhDo: 'Trình độ',
  cccd: 'Số CCCD',
  ngayCap: 'Ngày cấp',
  noiCap: 'Nơi cấp',
  mst: 'Mã số thuế',
  thuongTru: 'Thường trú',
  choO: 'Chỗ ở hiện tại',
  dienThoai: 'Điện thoại',
  khanCapTen: 'Liên hệ khẩn cấp',
  khanCapQuanHe: 'Quan hệ',
  khanCapSdt: 'SĐT khẩn cấp',
}

/** Cột chỉ người có quyền hr.employee.private mới ghi được. */
export const COT_RIENG: CotNapNv[] = [
  'ngaySinh',
  'gioiTinh',
  'quocTich',
  'queQuan',
  'trinhDo',
  'cccd',
  'ngayCap',
  'noiCap',
  'mst',
  'thuongTru',
  'choO',
  'dienThoai',
  'khanCapTen',
  'khanCapQuanHe',
  'khanCapSdt',
]

/** Bỏ dấu, chữ thường, giữ "/" và ngoặc (tiêu đề "Bộ phận / Tổ", "Tổ (Nhân sự)"). */
function chuan(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9/() ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Thứ tự KIỂM quan trọng: "Ngày cấp CCCD" phải vào ngày cấp, không vào CCCD. */
const NHAN: [CotNapNv, RegExp][] = [
  ['khanCapSdt', /(sdt|dien thoai|so dt).*(khan cap|nguoi than)/],
  ['khanCapTen', /(lien he khan cap|nguoi lien he|nguoi than)/],
  ['khanCapQuanHe', /^quan he/],
  ['ngayCap', /ngay cap/],
  ['noiCap', /noi cap/],
  ['ngayVao', /ngay (vao|bat dau)/],
  ['ngaySinh', /(ngay|nam) sinh/],
  ['mst', /(ma so thue|^mst$)/],
  ['cccd', /(cccd|cmnd|can cuoc|chung minh)/],
  ['ma', /^(ma ?nv|ma nhan vien|ma so|ma)$/],
  ['ten', /(ho (va )?ten|^ten$|ten nhan vien)/],
  ['chucDanh', /(chuc danh|chuc vu|vi tri|^bo phan$)/],
  ['to', /^(to|bo phan ?\/ ?to|to \(nhan su\)|to sx)$/],
  ['gioiTinh', /gioi tinh/],
  ['quocTich', /quoc tich/],
  ['queQuan', /que quan|nguyen quan/],
  ['trinhDo', /trinh do/],
  ['choO', /(cho o|tam tru|noi o)/],
  ['thuongTru', /(thuong tru|dia chi)/],
  ['dienThoai', /(dien thoai|sdt|so dt|di dong)/],
]

export function nhanCot(tieuDe: string): CotNapNv | null {
  const k = chuan(tieuDe)
  if (!k) return null
  return NHAN.find(([, re]) => re.test(k))?.[0] ?? null
}

export type DongNapNv = { dong: number } & Partial<Record<CotNapNv, string>>

/** Tách vùng dán (tab giữa cột). Dòng tiêu đề = dòng đầu trong 15 dòng có cột Mã hoặc Họ tên. */
export function docDanNv(text: string): { cot: CotNapNv[]; dong: DongNapNv[] } {
  const hang = text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.split('\t'))
  let dau = -1
  let map: (CotNapNv | null)[] = []
  for (let i = 0; i < Math.min(15, hang.length); i++) {
    const m = hang[i].map(nhanCot)
    if (m.includes('ma') || m.includes('ten')) {
      dau = i
      // Cùng một cột hai lần (hai cột "Địa chỉ") → chỉ lấy cột đầu.
      const thay = new Set<CotNapNv>()
      map = m.map((c) => (c && !thay.has(c) ? (thay.add(c), c) : null))
      break
    }
  }
  if (dau < 0) return { cot: [], dong: [] }
  const dong: DongNapNv[] = []
  for (let i = dau + 1; i < hang.length; i++) {
    const r: DongNapNv = { dong: i + 1 }
    let co = false
    hang[i].forEach((o, j) => {
      const c = map[j]
      const v = o.trim()
      if (c && v) {
        r[c] = v
        co = true
      }
    })
    if (co && (r.ma || r.ten)) dong.push(r)
  }
  return { cot: map.filter((c): c is CotNapNv => !!c), dong }
}

/** "14/05/1990", "14-5-1990", "1990-05-14" → ISO; năm 2 chữ số không nhận. */
export function docNgay(s: string): string | undefined {
  const t = s.trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t)
  let y: number, mo: number, d: number
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  else {
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t)
    if (!m) return undefined
    ;[d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
  }
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d)
    return undefined
  return dt.toISOString().slice(0, 10)
}

export function docGioiTinh(s: string): 'male' | 'female' | undefined {
  const k = chuan(s)
  if (/^(nam|male|m)$/.test(k)) return 'male'
  if (/^(nu|female|f)$/.test(k)) return 'female'
  return undefined
}

/** Giá trị một ô sau khi chuẩn hoá — `undefined` = ô sai định dạng (báo, bỏ qua ô đó). */
export function chuanO(cot: CotNapNv, v: string): string | undefined {
  switch (cot) {
    case 'ngayVao':
    case 'ngaySinh':
    case 'ngayCap':
      return docNgay(v)
    case 'gioiTinh':
      return docGioiTinh(v)
    case 'cccd':
      return chuanCccd(v) ?? undefined
    case 'mst': {
      const t = v.replace(/[\s.-]/g, '')
      return /^\d{10}(\d{2,3})?$/.test(t) ? t : undefined
    }
    case 'dienThoai':
    case 'khanCapSdt':
      return chuanSdt(v) ?? undefined
    default:
      return v.replace(/\s+/g, ' ').trim()
  }
}

/** Thông báo khi ô sai định dạng. */
export const LOI_O: Partial<Record<CotNapNv, string>> = {
  ngayVao: 'ngày dạng dd/mm/yyyy',
  ngaySinh: 'ngày dạng dd/mm/yyyy',
  ngayCap: 'ngày dạng dd/mm/yyyy',
  gioiTinh: 'Nam hoặc Nữ',
  cccd: '12 chữ số (CMND 9 số)',
  mst: '10 hoặc 13 chữ số',
  dienThoai: 'số VN 10 chữ số, bắt đầu bằng 0',
  khanCapSdt: 'số VN 10 chữ số, bắt đầu bằng 0',
}

export type DoiO = { cot: CotNapNv; cu: string | null; moi: string }

/**
 * So một dòng với giá trị đang có. `ghiDe` false = chỉ điền ô đang trống; ô có giá trị khác
 * thì báo "giữ nguyên" thay vì đổi.
 */
export function soKhac(
  dong: DongNapNv,
  hienTai: Partial<Record<CotNapNv, string | null>>,
  cot: CotNapNv[],
  ghiDe: boolean,
): { doi: DoiO[]; giu: DoiO[]; loi: string[] } {
  const doi: DoiO[] = []
  const giu: DoiO[] = []
  const loi: string[] = []
  for (const c of cot) {
    if (c === 'ma' || c === 'ten') continue
    const tho = dong[c]
    if (!tho) continue
    const v = chuanO(c, tho)
    if (v === undefined) {
      loi.push(`${TEN_COT_NAP[c]} "${tho}": ${LOI_O[c] ?? 'không đọc được'}`)
      continue
    }
    const cu = hienTai[c] ?? null
    if (cu === v) continue
    if (cu && !ghiDe) giu.push({ cot: c, cu, moi: v })
    else doi.push({ cot: c, cu, moi: v })
  }
  return { doi, giu, loi }
}
