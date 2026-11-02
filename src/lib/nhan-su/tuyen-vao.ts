/**
 * TUYỂN VÀO hỏi đủ thông tin ngay lúc nhận người (B3, bản vẽ 02/11/2026 mục C) — logic THUẦN:
 * kiểm form, gói gửi lên, giữ gì cho người kế tiếp. Đo 02/11: 23 người vào từ 15/09 chỉ 2 người
 * có SĐT, 7 người có ngày sinh — hộp cũ hỏi 6 ô rồi bảo "điền trên hồ sơ" và không ai điền.
 *
 * Bắt buộc chỉ ba ô (Q4): họ tên, bộ phận, ngày vào (+ mã trên máy nếu quẹt máy). Ô cá nhân
 * để trống vẫn lưu, hộp nói ô nào còn trống. Kiểm định dạng dùng chung `chuanO` / `docNgay`
 * với nạp Excel và Sửa trên bảng.
 */
import { boSo0 } from '@/lib/cham-cong/ghep-ten'
import { chuanO, docNgay, LOI_O } from './nap-ho-so'

export type FormTuyen = {
  khongCham: boolean
  ma: string
  /** Dòng `hr_device_users` khi chọn từ gợi ý mã đã quẹt — để ghép luôn. */
  deviceUserId: string | null
  ten: string
  boPhan: string
  chucVu: string
  ngayVao: string
  caId: string
  gioiTinh: '' | 'male' | 'female'
  ngaySinh: string
  cccd: string
  dienThoai: string
  choO: string
  ghiChu: string
}

export type OTuyen = keyof FormTuyen
export const TEN_O_TUYEN: Partial<Record<OTuyen, string>> = {
  ma: 'Mã trên máy',
  ten: 'Họ và tên',
  boPhan: 'Bộ phận',
  ngayVao: 'Ngày vào làm',
  gioiTinh: 'Giới tính',
  ngaySinh: 'Ngày sinh',
  cccd: 'Số CCCD',
  dienThoai: 'Điện thoại',
  choO: 'Nơi ở hiện tại',
}

export function formTrong(p: {
  ngayVao: string
  caId: string
  khongCham?: boolean
}): FormTuyen {
  return {
    khongCham: p.khongCham ?? false,
    ma: '',
    deviceUserId: null,
    ten: '',
    boPhan: '',
    chucVu: '',
    ngayVao: p.ngayVao,
    caId: p.caId,
    gioiTinh: '',
    ngaySinh: '',
    cccd: '',
    dienThoai: '',
    choO: '',
    ghiChu: '',
  }
}

/** Người kế tiếp trong cùng lượt (vd tuyển 7 người cùng tổ ngày 23/10): giữ việc, xoá người. */
export function choNguoiTiep(f: FormTuyen): FormTuyen {
  return {
    ...formTrong({ ngayVao: f.ngayVao, caId: f.caId, khongCham: f.khongCham }),
    boPhan: f.boPhan,
    chucVu: f.chucVu,
  }
}

export type VanDe = { o: OTuyen; loi: string }

/**
 * `chan` — chặn lưu (thiếu ô bắt buộc / sai định dạng), theo thứ tự ô trên hộp: câu đầu tiên
 * là câu bấm được nhảy tới ô. `trong` — ô cá nhân còn trống (lưu được, chỉ nói ra).
 * `rieng` false = người dùng không có quyền thông tin riêng: bỏ qua cả nhóm cá nhân.
 */
export function kiemTuyen(
  f: FormTuyen,
  maDaCo: string[],
  rieng: boolean,
): { chan: VanDe[]; trong: OTuyen[] } {
  const chan: VanDe[] = []
  if (!f.khongCham) {
    const m = f.ma.trim()
    if (!m) chan.push({ o: 'ma', loi: 'Thiếu mã trên máy (hoặc chọn Không chấm công)' })
    else if (!/^\d{1,9}$/.test(m))
      chan.push({ o: 'ma', loi: 'Mã trên máy chỉ gồm chữ số' })
    else if (maDaCo.some((c) => boSo0(c) === boSo0(m)))
      chan.push({ o: 'ma', loi: `Mã ${m} đã có người — kiểm lại số trên máy` })
  }
  if (f.ten.trim().length < 2) chan.push({ o: 'ten', loi: 'Thiếu họ và tên' })
  if (!f.boPhan.trim()) chan.push({ o: 'boPhan', loi: 'Thiếu bộ phận' })
  if (!f.ngayVao.trim()) chan.push({ o: 'ngayVao', loi: 'Thiếu ngày vào làm' })
  else if (!docNgay(f.ngayVao))
    chan.push({ o: 'ngayVao', loi: 'Ngày vào làm cần dạng dd/mm/yyyy' })
  const trong: OTuyen[] = []
  if (rieng) {
    if (!f.gioiTinh) trong.push('gioiTinh')
    const dinhDang: [OTuyen, 'ngaySinh' | 'cccd' | 'dienThoai'][] = [
      ['ngaySinh', 'ngaySinh'],
      ['cccd', 'cccd'],
      ['dienThoai', 'dienThoai'],
    ]
    for (const [o, cot] of dinhDang) {
      const v = (f[o] as string).trim()
      if (!v) trong.push(o)
      else if (chuanO(cot, v) === undefined)
        chan.push({ o, loi: `${TEN_O_TUYEN[o]} cần ${LOI_O[cot]}` })
    }
    if (!f.choO.trim()) trong.push('choO')
  }
  return { chan, trong }
}

/** Gói gửi POST nhan-vien (đã chuẩn hoá: ngày ISO, SĐT / CCCD chỉ chữ số). Gọi khi `chan` rỗng. */
export function goiTuyen(f: FormTuyen, rieng: boolean) {
  const v = (s: string) => s.trim()
  const o = (cot: 'ngaySinh' | 'cccd' | 'dienThoai', s: string) =>
    s.trim() ? chuanO(cot, s.trim()) : undefined
  return {
    khong_cham: f.khongCham,
    ...(!f.khongCham && { code: v(f.ma) }),
    ...(f.deviceUserId && !f.khongCham && { device_user_id: f.deviceUserId }),
    full_name: v(f.ten),
    hire_date: docNgay(f.ngayVao)!,
    team: v(f.boPhan),
    shift_id: f.caId,
    job_title: v(f.chucVu),
    note: v(f.ghiChu),
    ...(rieng && {
      ca_nhan: {
        ...(f.gioiTinh && { gender: f.gioiTinh }),
        ...(o('ngaySinh', f.ngaySinh) && { birth_date: o('ngaySinh', f.ngaySinh) }),
        ...(o('cccd', f.cccd) && { national_id: o('cccd', f.cccd) }),
        ...(o('dienThoai', f.dienThoai) && { phone: o('dienThoai', f.dienThoai) }),
        ...(v(f.choO) && { current_address: v(f.choO) }),
      },
    }),
  }
}
