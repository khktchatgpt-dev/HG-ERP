/**
 * CẤP VẬT TƯ — luật phân loại một dòng nhu cầu (sổ §4.1).
 *
 * LUẬT KHÓ NHẤT CỦA CẢ PHÂN HỆ: không bao giờ chỉ nói "không đủ tồn".
 *
 * "Không đủ tồn" đúng về dữ liệu và vô dụng về nghiệp vụ — nó không nói
 * người đứng ở quầy phải làm gì tiếp. Mỗi dòng thiếu phải nói THIẾU BAO
 * NHIÊU · HÀNG ĐANG MẮC Ở ĐÂU · GỠ THẾ NÀO.
 *
 * BỐN NHÃN KHÔNG ĐƯỢC GỘP, vì mỗi cái dẫn tới một việc khác hẳn:
 *
 *   · đã cấp đủ            → không phải làm gì
 *   · hàng có nhưng CHỜ KIỂM → đi nhắc người kiểm hàng
 *   · một phần đang KHOÁ    → đi hỏi Cung ứng (trả NCC hay nhận giá giảm)
 *   · CHƯA CÓ HÀNG          → đi xin mua
 *
 * Gộp ba cái sau thành "thiếu" là mất đúng thông tin quyết định việc tiếp
 * theo. Ba người khác nhau, ba màn khác nhau, ba khung thời gian khác nhau.
 *
 * File THUẦN, không chạm DB: nó là chỗ luật này được kiểm bằng test thay vì
 * bằng cách mở màn hình ra nhìn.
 */

export type NhanCap =
  /** Đã cấp đủ định mức — dòng này xong. */
  | 'du'
  /** Còn phải cấp, và kho có đủ hàng DÙNG ĐƯỢC để cấp ngay. */
  | 'cap-duoc'
  /** Cấp được một phần; phần còn lại đang nằm ở nơi khác (xem `ganTay`). */
  | 'mot-phan'
  /** Không cấp được gam nào. */
  | 'khong-cap-duoc'

/** Vì sao phần còn thiếu chưa cấp được — thứ quyết định việc tiếp theo. */
export type VuongMac =
  /** Có hàng nhưng đang chờ kiểm. Gỡ: người kiểm hàng xác nhận. */
  | 'cho-kiem'
  /** Có hàng nhưng đang khoá (hỏng / sai quy cách). Gỡ: Cung ứng quyết. */
  | 'dang-khoa'
  /** Hàng dùng được đang GIỮ cho lệnh khác. Gỡ: cắt chỗ hoặc chờ. */
  | 'giu-cho-lenh-khac'
  /** Kho không có gì cả. Gỡ: xin mua. */
  | 'chua-co-hang'

export type DongCap = {
  /** Định mức còn phải cấp cho lệnh này. */
  conPhaiCap: number
  /** Tồn DÙNG ĐƯỢC của mã (chưa trừ phần giữ cho lệnh khác). */
  dungDuoc: number
  /** Đang chờ kiểm. */
  choKiem: number
  /** Đang khoá. */
  dangKhoa: number
  /** Phần tồn dùng được đã hứa cho các lệnh KHÁC. */
  giuChoLenhKhac: number
}

export type KetQuaCap = {
  nhan: NhanCap
  /** Cấp được ngay bao nhiêu — số này điền sẵn vào lưới. */
  capNgay: number
  /** Còn thiếu sau khi cấp hết phần cấp được. */
  conThieu: number
  /**
   * Các vướng mắc của phần còn thiếu, XẾP THEO MỨC DỄ GỠ: chờ kiểm gỡ trong
   * ngày, hàng khoá gỡ trong tuần, chưa có hàng gỡ trong tháng. Người đứng ở
   * quầy đọc cái đầu tiên là biết đi đâu trước.
   */
  vuong: { loai: VuongMac; luong: number }[]
}

/** Làm tròn về 0 những sai số dấu phẩy động sinh ra từ phép trừ. */
function sach(v: number): number {
  return Math.abs(v) < 1e-9 ? 0 : v
}

export function phanLoaiDong(d: DongCap): KetQuaCap {
  const conPhaiCap = Math.max(0, sach(d.conPhaiCap))
  if (conPhaiCap === 0) {
    return { nhan: 'du', capNgay: 0, conThieu: 0, vuong: [] }
  }

  /*
   * KHẢ DỤNG = dùng được − phần đã hứa cho lệnh KHÁC.
   *
   * Không lấy thẳng `dungDuoc`: 500 cây trong kho mà 480 đã hứa cho lệnh
   * đang chạy thì cấp 100 cho lệnh này là rút chân người khác, và lỗi đó chỉ
   * lộ ra khi tổ kia ra lấy hàng không còn.
   */
  const khaDung = Math.max(0, sach(d.dungDuoc - d.giuChoLenhKhac))
  const capNgay = Math.min(conPhaiCap, khaDung)
  const conThieu = sach(conPhaiCap - capNgay)

  if (conThieu === 0) {
    return { nhan: 'cap-duoc', capNgay, conThieu: 0, vuong: [] }
  }

  /*
   * VƯỚNG MẮC — mỗi rổ chỉ đóng góp TỐI ĐA phần còn thiếu, và tính dồn theo
   * thứ tự dễ gỡ trước. Cộng cả ba rổ đầy đủ là nói quá: có 100 chờ kiểm và
   * 100 khoá mà chỉ thiếu 30 thì không phải "vướng 200".
   */
  const vuong: { loai: VuongMac; luong: number }[] = []
  let chuaGiaiThich = conThieu

  const them = (loai: VuongMac, co: number) => {
    const phan = Math.min(chuaGiaiThich, Math.max(0, sach(co)))
    if (phan > 0) {
      vuong.push({ loai, luong: phan })
      chuaGiaiThich = sach(chuaGiaiThich - phan)
    }
  }

  them('cho-kiem', d.choKiem)
  them('dang-khoa', d.dangKhoa)
  /*
   * Phần bị lệnh khác giữ chỉ tính vào vướng mắc khi nó THẬT SỰ chặn: kho có
   * hàng dùng được nhưng đã hứa đi nơi khác. `dungDuoc` đã trừ ở trên nên ở
   * đây chỉ lấy phần chồng lấn.
   */
  them('giu-cho-lenh-khac', Math.min(d.giuChoLenhKhac, d.dungDuoc))

  // Còn lại không rổ nào giải thích được = kho thật sự không có.
  if (chuaGiaiThich > 0) {
    vuong.push({ loai: 'chua-co-hang', luong: chuaGiaiThich })
  }

  return {
    nhan: capNgay > 0 ? 'mot-phan' : 'khong-cap-duoc',
    capNgay,
    conThieu,
    vuong,
  }
}

/** Câu người đọc hiểu cho một vướng mắc — dùng ở cả màn lẫn thông báo. */
export function moTaVuong(v: VuongMac): string {
  switch (v) {
    case 'cho-kiem':
      return 'đang chờ kiểm hàng'
    case 'dang-khoa':
      return 'đang khoá (hỏng / sai quy cách)'
    case 'giu-cho-lenh-khac':
      return 'đã hứa cho lệnh khác'
    case 'chua-co-hang':
      return 'kho không có'
  }
}

/**
 * VIỆC TIẾP THEO cho một vướng mắc — nhãn nút và nơi nó dẫn tới.
 *
 * Đây là nửa còn lại của luật: nói vướng gì mà không nói gỡ ở đâu thì vẫn là
 * "không đủ tồn" viết dài hơn.
 */
export function viecTiepTheo(v: VuongMac): { label: string; href: string } {
  switch (v) {
    case 'cho-kiem':
      return { label: 'Xem lô chờ kiểm', href: '/warehouse/stock?bucket=qc' }
    case 'dang-khoa':
      return { label: 'Sang Hàng mắc', href: '/warehouse/hang-mac' }
    case 'giu-cho-lenh-khac':
      return { label: 'Xem lệnh đang giữ', href: '/planning/lsx' }
    case 'chua-co-hang':
      return { label: 'Đề xuất mua', href: '/warehouse/don-ncc' }
  }
}
