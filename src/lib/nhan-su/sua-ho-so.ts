/**
 * SỬA HỒ SƠ MỘT NGƯỜI (B4, bản vẽ 02/11/2026 mục D) — logic THUẦN của nút "Sửa thông tin": cả
 * 4 khối thành ô nhập, lưu MỘT lần. Gom chỉ ô đã đổi (so sau khi chuẩn hoá — gõ lại "0905.123.456"
 * cho số đang là 0905123456 không tính là đổi), kiểm định dạng dùng chung với nạp Excel.
 */
import { ngayVn } from './bien-dong'
import { chuanCccd, chuanSdt, hienSdt, type CaNhan } from './ca-nhan'
import { docNgay } from './nap-ho-so'

export type FormHoSo = {
  ten: string
  boPhan: string
  chucVu: string
  ngayVao: string
  caId: string
  khongCham: boolean
  ghiChu: string
  gioiTinh: '' | 'male' | 'female'
  ngaySinh: string
  quocTich: string
  queQuan: string
  trinhDo: string
  /** Ô che: trống = giữ số cũ, gõ số mới là thay. */
  cccd: string
  ngayCap: string
  noiCap: string
  mst: string
  /** Mã số BHXH (B5, 0286) — bày đủ, sửa / xoá như ô thường. */
  maBhxh: string
  thuongTru: string
  choO: string
  dienThoai: string
  khanCapTen: string
  khanCapQuanHe: string
  khanCapSdt: string
}
export type OHoSo = keyof FormHoSo

/** Phần dòng nhân viên mà form cần. */
export type GocCv = {
  hoTen: string
  tenTuMay: boolean
  boPhan: string | null
  chucDanh: string | null
  ngayVao: string | null
  shiftId: string
  khongChamCong: boolean
  ghiChu: string | null
}

const ngay = (d: string | null) => (d ? ngayVn(d) : '')

/** Giá trị ban đầu của form (tên lấy từ máy giữ nguyên — trang nhắc gõ lại có dấu). */
export function formTu(n: GocCv, c: CaNhan | null): FormHoSo {
  return {
    ten: n.hoTen,
    boPhan: n.boPhan ?? '',
    chucVu: n.chucDanh ?? '',
    ngayVao: ngay(n.ngayVao),
    caId: n.shiftId,
    khongCham: n.khongChamCong,
    ghiChu: n.ghiChu ?? '',
    gioiTinh: c?.gioiTinh ?? '',
    ngaySinh: ngay(c?.ngaySinh ?? null),
    quocTich: c?.quocTich ?? '',
    queQuan: c?.queQuan ?? '',
    trinhDo: c?.trinhDo ?? '',
    cccd: '',
    ngayCap: ngay(c?.ngayCap ?? null),
    noiCap: c?.noiCap ?? '',
    mst: '',
    maBhxh: c?.maBhxh ?? '',
    thuongTru: c?.thuongTru ?? '',
    choO: c?.choO ?? '',
    dienThoai: hienSdt(c?.dienThoai ?? null),
    khanCapTen: c?.khanCapTen ?? '',
    khanCapQuanHe: c?.khanCapQuanHe ?? '',
    khanCapSdt: hienSdt(c?.khanCapSdt ?? null),
  }
}

export type VanDe = { o: OHoSo; loi: string }

const chuanMst = (s: string) => {
  const t = s.replace(/[\s.-]/g, '')
  return /^\d{10}(\d{2,3})?$/.test(t) ? t : undefined
}
const chuanBhxh = (s: string) => {
  const t = s.replace(/[\s.-]/g, '')
  return /^\d{10}$/.test(t) ? t : undefined
}

/**
 * Ô sai, theo thứ tự trên trang (Công việc → Cá nhân → Giấy tờ → Liên hệ): câu đầu tiên là
 * câu bấm được nhảy tới ô. `cv` / `rieng` = khối nào đang sửa được.
 */
export function kiemHoSo(
  f: FormHoSo,
  p: { cv: boolean; rieng: boolean; homNay: string },
): VanDe[] {
  const out: VanDe[] = []
  const ngayO = (o: OHoSo, ten: string, quaHomNay = false) => {
    const v = (f[o] as string).trim()
    if (!v) return
    const d = docNgay(v)
    if (!d) out.push({ o, loi: `${ten} cần dạng dd/mm/yyyy` })
    else if (!quaHomNay && d > p.homNay) out.push({ o, loi: `${ten} sau hôm nay` })
  }
  if (p.cv) {
    if (f.ten.trim().length < 2) out.push({ o: 'ten', loi: 'Gõ họ tên đầy đủ' })
    ngayO('ngayVao', 'Ngày vào', true)
  }
  if (p.rieng) {
    ngayO('ngaySinh', 'Ngày sinh')
    if (f.cccd.trim() && !chuanCccd(f.cccd))
      out.push({ o: 'cccd', loi: 'Số CCCD cần 12 chữ số (CMND 9 số)' })
    ngayO('ngayCap', 'Ngày cấp')
    if (f.mst.trim() && !chuanMst(f.mst))
      out.push({ o: 'mst', loi: 'Mã số thuế cần 10 hoặc 13 chữ số' })
    if (f.maBhxh.trim() && !chuanBhxh(f.maBhxh))
      out.push({ o: 'maBhxh', loi: 'Mã số BHXH cần 10 chữ số' })
    for (const o of ['dienThoai', 'khanCapSdt'] as const)
      if (f[o].trim() && !chuanSdt(f[o]))
        out.push({
          o,
          loi: `${o === 'dienThoai' ? 'Điện thoại' : 'SĐT khẩn cấp'} cần số VN 10 chữ số`,
        })
  }
  return out
}

type GoiHoSo = {
  cong_viec?: Record<string, string | boolean | null>
  ca_nhan?: Record<string, string | null>
}

/**
 * Gói gửi `[id]/thong-tin`: chỉ ô đã đổi so với `goc` (cùng form dựng từ dữ liệu đã lưu). Gọi
 * khi `kiemHoSo` rỗng. Ngày → ISO, SĐT / CCCD / MST → chỉ chữ số, chuỗi rỗng → null.
 */
export function goiHoSo(
  f: FormHoSo,
  goc: FormHoSo,
  p: { cv: boolean; rieng: boolean },
): { goi: GoiHoSo; so: number } {
  const chu = (s: string) => s.replace(/\s+/g, ' ').trim() || null
  const iso = (s: string) => (s.trim() ? docNgay(s)! : null)
  const sdt = (s: string) => (s.trim() ? chuanSdt(s)! : null)
  const cong_viec: Record<string, string | boolean | null> = {}
  const ca_nhan: Record<string, string | null> = {}
  const so = <T>(dich: Record<string, T>, k: string, a: T, b: T) => {
    if (a !== b) dich[k] = a
  }
  if (p.cv) {
    so(cong_viec, 'full_name', chu(f.ten), chu(goc.ten))
    so(cong_viec, 'team', chu(f.boPhan), chu(goc.boPhan))
    so(cong_viec, 'job_title', chu(f.chucVu), chu(goc.chucVu))
    so(cong_viec, 'hire_date', iso(f.ngayVao), iso(goc.ngayVao))
    so(cong_viec, 'shift_id', f.caId, goc.caId)
    so(cong_viec, 'attendance_exempt', f.khongCham, goc.khongCham)
    so(cong_viec, 'note', chu(f.ghiChu), chu(goc.ghiChu))
  }
  if (p.rieng) {
    so(ca_nhan, 'gender', f.gioiTinh || null, goc.gioiTinh || null)
    so(ca_nhan, 'birth_date', iso(f.ngaySinh), iso(goc.ngaySinh))
    so(ca_nhan, 'nationality', chu(f.quocTich), chu(goc.quocTich))
    so(ca_nhan, 'hometown', chu(f.queQuan), chu(goc.queQuan))
    so(ca_nhan, 'education', chu(f.trinhDo), chu(goc.trinhDo))
    if (f.cccd.trim()) ca_nhan.national_id = chuanCccd(f.cccd)!
    so(ca_nhan, 'id_issue_date', iso(f.ngayCap), iso(goc.ngayCap))
    so(ca_nhan, 'id_issue_place', chu(f.noiCap), chu(goc.noiCap))
    if (f.mst.trim()) ca_nhan.tax_code = chuanMst(f.mst)!
    so(
      ca_nhan,
      'social_insurance_no',
      f.maBhxh.trim() ? chuanBhxh(f.maBhxh)! : null,
      goc.maBhxh.trim() ? chuanBhxh(goc.maBhxh)! : null,
    )
    so(ca_nhan, 'permanent_address', chu(f.thuongTru), chu(goc.thuongTru))
    so(ca_nhan, 'current_address', chu(f.choO), chu(goc.choO))
    so(ca_nhan, 'phone', sdt(f.dienThoai), sdt(goc.dienThoai))
    so(ca_nhan, 'emergency_name', chu(f.khanCapTen), chu(goc.khanCapTen))
    so(ca_nhan, 'emergency_relation', chu(f.khanCapQuanHe), chu(goc.khanCapQuanHe))
    so(ca_nhan, 'emergency_phone', sdt(f.khanCapSdt), sdt(goc.khanCapSdt))
  }
  const goi: GoiHoSo = {}
  if (Object.keys(cong_viec).length) goi.cong_viec = cong_viec
  if (Object.keys(ca_nhan).length) goi.ca_nhan = ca_nhan
  return { goi, so: Object.keys(cong_viec).length + Object.keys(ca_nhan).length }
}
