/**
 * NHẬP HÀNG KHÔNG THEO ĐƠN — logic thuần của form `/warehouse/nhap/ngoai-don`
 * (hoàn thiện A2, `docs/kho-hoan-thien.md`). Server vẫn là người quyết:
 * `stockService.createReceiptDoc` với `po_id: null` tự gắn mã lý do **N2**,
 * tự chọn kệ theo trạng thái, và chặn mọi dòng lỡ mang `po_line_id`.
 *
 * ĐIỂM THIẾT KẾ QUAN TRỌNG NHẤT không phải là bỏ bớt hai cột Đặt / Đã về.
 * Đường này dễ bị lạm dụng: nếu nhận ngoài đơn nhẹ tay hơn nhận theo đơn thì
 * người ta dùng nó để né việc mở đơn mua, và Cung ứng mất dấu công nợ. Nên
 * form BẮT CHỌN vì sao không có đơn, và nói thẳng ở chân màn rằng tờ này
 * không vào đối chiếu công nợ.
 */

/** Trạng thái lô hàng lúc nhận — cùng hai lựa chọn với phiếu nhập theo đơn. */
export type TinhTrangNhan = 'ok' | 'blocked'

export type VatTuNhan = {
  id: string
  code: string
  name: string
  unit: string
}

export type DongNhanNgoai = VatTuNhan & {
  /** Tồn hiện tại lúc thêm dòng — null = chưa tra được. Chỉ để đối chiếu mắt. */
  ton: number | null
  qty: number
  tinh_trang: TinhTrangNhan
  /** Mã khu/kệ hàng vào. Rỗng = để service tự chọn theo trạng thái. */
  bin_id: string
  note: string
}

/**
 * VÌ SAO KHÔNG CÓ ĐƠN — bốn lựa chọn, KHÔNG phải ô gõ tự do.
 *
 * Hai người gõ "mua ngoài" và "mua lẻ" là cùng một việc mà báo cáo đếm thành
 * hai loại — đúng cái lỗi mà bộ mã lý do (0197) sinh ra để dẹp. Chọn thì đếm
 * được; gõ thì không.
 *
 * `heQua` không phải chữ trang trí: người chọn cần biết tờ này rồi AI ĐỌC và
 * đọc để làm gì, nếu không thì bốn lựa chọn chỉ là bốn cái nhãn như nhau.
 */
export type LyDoNgoaiDon = {
  readonly ma: string
  readonly nhan: string
  readonly heQua: string
  /** Bắt buộc ghi thêm một câu vào ghi chú phiếu. */
  readonly batGhiChu: boolean
}

export const LY_DO_NGOAI_DON = [
  {
    ma: 'mua_le',
    nhan: 'Mua lẻ tiền mặt',
    heQua: 'Kho tự đi mua, chưa qua đơn. Kế toán sẽ hỏi hoá đơn tờ này.',
    batGhiChu: false,
  },
  {
    ma: 'giao_kem',
    nhan: 'NCC giao kèm, không tính tiền',
    heQua: 'Hàng bù, hàng mẫu, quà kèm lô. Không phát sinh công nợ.',
    batGhiChu: false,
  },
  {
    ma: 'muon',
    nhan: 'Hàng mượn hoặc nhận lại',
    heQua: 'Mượn xưởng bạn, hoặc lấy lại hàng đã cho mượn. Có ngày phải trả.',
    batGhiChu: false,
  },
  {
    ma: 'khac',
    nhan: 'Khác',
    heQua: 'Bắt ghi một câu vào ghi chú phiếu — ô này không để trống được.',
    batGhiChu: true,
  },
] as const satisfies readonly LyDoNgoaiDon[]

export function timLyDoNgoaiDon(ma: string): LyDoNgoaiDon | null {
  return LY_DO_NGOAI_DON.find((x) => x.ma === ma) ?? null
}

/**
 * Thêm một mã vào lưới. MỘT MÃ MỘT DÒNG: chọn lại mã đã có thì không đẻ dòng
 * thứ hai (hai dòng cùng mã là hai lần cộng tồn mà người đọc chỉ thấy một) —
 * trả chỉ số dòng cũ để màn nhảy tới ô số của nó. Cùng luật với phiếu xuất.
 */
export function themDongNhan(
  rows: DongNhanNgoai[],
  vt: VatTuNhan,
  ton: number | null,
): { rows: DongNhanNgoai[]; index: number; trung: boolean } {
  const i = rows.findIndex((r) => r.id === vt.id)
  if (i >= 0) return { rows, index: i, trung: true }
  return {
    rows: [...rows, { ...vt, ton, qty: 0, tinh_trang: 'ok', bin_id: '', note: '' }],
    index: rows.length,
    trung: false,
  }
}

/**
 * Tổng của phiếu. Tách "dùng được" và "vào khoá" chứ không chỉ một con số:
 * hai thứ đó đi vào hai rổ tồn khác nhau (0194), và người nhận phải thấy
 * mình vừa khoá bao nhiêu TRƯỚC khi ghi sổ.
 */
export function tinhTongNhan(rows: DongNhanNgoai[]): {
  so_dong: number
  tong: number
  dung_duoc: number
  vao_khoa: number
} {
  let so_dong = 0
  let tong = 0
  let dung_duoc = 0
  let vao_khoa = 0
  for (const r of rows) {
    if (!(r.qty > 0)) continue
    so_dong++
    tong += r.qty
    if (r.tinh_trang === 'blocked') vao_khoa += r.qty
    else dung_duoc += r.qty
  }
  return { so_dong, tong, dung_duoc, vao_khoa }
}

export type DauPhieuNgoai = {
  /** Tên người / đơn vị giao. Bắt buộc — mẫu 01-VT có ô này. */
  nguoi_giao: string
  /** Mã trong `LY_DO_NGOAI_DON`. */
  ly_do: string
  supplier_doc_no: string
  doc_date: string
  note: string
}

export type KiemNhapNgoai =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'thieu_nguoi_giao'
        | 'thieu_ly_do'
        | 'thieu_ghi_chu'
        | 'khong_dong'
        | 'so_khong_hop_le'
        | 'khoa_thieu_ly_do'
      message: string
      /** Ô phải sửa: tên ô đầu phiếu, hoặc chỉ số dòng. */
      focus: 'nguoi_giao' | 'ly_do' | 'ghi_chu' | number
    }

/**
 * Vì sao CHƯA ghi sổ được — theo thứ tự đọc của đầu phiếu rồi tới lưới. Câu
 * nào cũng chỉ được tới đúng ô phải sửa (luật kiểm của `/design-lab`: hành
 * động bị chặn phải nói vướng gì VÀ cách gỡ).
 *
 * Dòng khoá thiếu lý do chặn ở đây VÀ ở schema server — lý do đi theo lô
 * suốt đời nó, là thứ Cung ứng đọc để quyết trả NCC hay nhận giá giảm.
 */
export function kiemTruocGhiSoNgoai(
  head: DauPhieuNgoai,
  rows: DongNhanNgoai[],
): KiemNhapNgoai {
  if (!head.nguoi_giao.trim()) {
    return {
      ok: false,
      reason: 'thieu_nguoi_giao',
      message: 'Chưa ghi ai giao hàng',
      focus: 'nguoi_giao',
    }
  }
  const ly = timLyDoNgoaiDon(head.ly_do)
  if (!ly) {
    return {
      ok: false,
      reason: 'thieu_ly_do',
      message: 'Chưa chọn vì sao không có đơn',
      focus: 'ly_do',
    }
  }
  if (ly.batGhiChu && !head.note.trim()) {
    return {
      ok: false,
      reason: 'thieu_ghi_chu',
      message: `Lý do “${ly.nhan}” phải ghi rõ một câu vào ghi chú phiếu`,
      focus: 'ghi_chu',
    }
  }
  const iSai = rows.findIndex((r) => !Number.isFinite(r.qty) || r.qty < 0)
  if (iSai >= 0) {
    return {
      ok: false,
      reason: 'so_khong_hop_le',
      message: `Dòng ${iSai + 1} ${rows[iSai].code}: số Nhận không hợp lệ`,
      focus: iSai,
    }
  }
  if (!rows.some((r) => r.qty > 0)) {
    return {
      ok: false,
      reason: 'khong_dong',
      message:
        rows.length === 0
          ? 'Chưa có dòng nào — tìm mã ở ô cuối lưới'
          : 'Chưa dòng nào có số Nhận',
      focus: rows.length === 0 ? -1 : 0,
    }
  }
  const iKhoa = rows.findIndex(
    (r) => r.qty > 0 && r.tinh_trang === 'blocked' && !r.note.trim(),
  )
  if (iKhoa >= 0) {
    return {
      ok: false,
      reason: 'khoa_thieu_ly_do',
      message: `${rows[iKhoa].code} khai “sai quy cách” — ghi lý do vào ô Ghi chú của dòng`,
      focus: iKhoa,
    }
  }
  return { ok: true }
}

/**
 * Đếm đơn mua CÒN MỞ của người giao vừa chọn.
 *
 * Khớp theo TÊN vì phiếu nhập lưu `counterparty` là chuỗi, không phải khoá
 * ngoại — và vì danh sách đơn mở cũng chỉ mang tên NCC. So sau khi gọn khoảng
 * trắng và bỏ phân biệt hoa thường; không so gần đúng, thà không cảnh báo còn
 * hơn cảnh báo nhầm NCC rồi người dùng học cách bỏ qua dải đó.
 */
export function donMoCuaNcc(
  nguoiGiao: string,
  pos: readonly { code: string; supplier_name: string }[],
): { code: string; supplier_name: string }[] {
  const k = nguoiGiao.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!k) return []
  return pos.filter(
    (p) => p.supplier_name.trim().toLowerCase().replace(/\s+/g, ' ') === k,
  )
}
