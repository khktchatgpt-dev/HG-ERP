/**
 * CẬP NHẬT SỐ THỰC TẾ — logic thuần của `/warehouse/cap-nhat-ton` (B1 "Kho cho
 * người mới", bản vẽ https://claude.ai/artifact/QpEkCkMHdMhFhF3WYhEF7z, chủ dự
 * án duyệt Q1–Q6 theo đề xuất 27/10/2026).
 *
 * Thủ kho gõ số đếm được của VÀI mã; máy tính chênh so với số trên máy rồi ghi
 * thành một đợt kiểm kê theo danh sách mã (bảng 0199 sẵn có, không migration).
 * Khác Kiểm kê định kỳ ở ba chỗ, đều do bản vẽ chốt:
 *   · hiện số "Trên máy" (Q4) — đây là sửa nhanh có lý do, không phải đếm mù;
 *   · lý do chọn trong danh sách cố định, "Khác" bắt ghi chú (Q5);
 *   · dòng GIẢM hàng của một lệnh thì hỏi tại dòng (Q3): tổ đã lấy → ghi xuất bù
 *     cho lệnh (vào giá thành), hỏng / mất thật → mới ghi thiếu. Đây là chỗ 3
 *     lệnh 01/02/05-MX bị kiểm kê 15/09 trừ thành X5, rời giá thành lệnh.
 * Server (`stocktakesService.capNhatNhanh`) tính lại chênh — số ở đây để người
 * gõ thấy trước, không phải số được ghi.
 */

export const LY_DO_CAP_NHAT = [
  { ma: 'giao_kho', nhan: 'Đếm lại khi giao kho' },
  { ma: 'hu_hong', nhan: 'Hư hỏng / hao hụt' },
  { ma: 'mat', nhan: 'Mất' },
  { ma: 'nham', nhan: 'Nhập / xuất nhầm trước đây' },
  { ma: 'hang_cu', nhan: 'Hàng cũ chưa có trên máy' },
  { ma: 'khac', nhan: 'Khác' },
] as const

export type MaLyDoCapNhat = (typeof LY_DO_CAP_NHAT)[number]['ma']

export const MA_LY_DO_CAP_NHAT = LY_DO_CAP_NHAT.map((x) => x.ma) as [
  MaLyDoCapNhat,
  ...MaLyDoCapNhat[],
]

export function nhanLyDoCapNhat(ma: string | null | undefined): string {
  return LY_DO_CAP_NHAT.find((x) => x.ma === ma)?.nhan ?? 'Khác'
}

/** Một lệnh đang được chia tồn của mã (cùng luật chia của Tồn kho › Theo lệnh). */
export type LenhCuaMa = { lsx_id: string; code: string; chia: number }

export type DongCapNhat = {
  material_id: string
  code: string
  name: string
  unit: string
  /** Tồn trên máy lúc thêm dòng. */
  tren_may: number
  /** Null = chưa gõ (khác hẳn gõ 0). NaN = gõ chữ không phải số. */
  thuc_te: number | null
  /** '' = theo lý do chung của phiếu. */
  ly_do: MaLyDoCapNhat | ''
  ghi_chu: string
  /** Lệnh đang được chia tồn của mã, phần lớn trước. */
  lenh: LenhCuaMa[]
  /** Dòng giảm hàng của lệnh: tổ đã lấy (xuất bù) hay hỏng / mất thật (thiếu). */
  che_do: 'xuat_bu' | 'thieu'
  xuat_bu_lsx: string | null
}

export type DauCapNhat = { ly_do_chung: MaLyDoCapNhat; ghi_chu: string }

const EPS = 1e-9
const tron = (n: number) => Math.round(n * 10_000) / 10_000

/** Số kiểu VN ("1.250" = 1250 · "12,5" = 12,5). Trống = null; chữ lạ = NaN. */
export function docSoThucTe(text: string): number | null {
  const t = text.trim()
  if (t === '') return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : Number.NaN
}

/** Một dòng mới — mặc định "tổ đã lấy" cho lệnh có phần lớn nhất (Q3). */
export function taoDong(
  vt: { id: string; code: string; name: string; unit: string },
  tren_may: number,
  lenh: LenhCuaMa[],
): DongCapNhat {
  const ds = [...lenh].sort((a, b) => b.chia - a.chia)
  return {
    material_id: vt.id,
    code: vt.code,
    name: vt.name,
    unit: vt.unit,
    tren_may,
    thuc_te: null,
    ly_do: '',
    ghi_chu: '',
    lenh: ds,
    che_do: 'xuat_bu',
    xuat_bu_lsx: ds[0]?.lsx_id ?? null,
  }
}

/** Thêm một mã — MỘT MÃ MỘT DÒNG; trùng thì trả chỉ số dòng cũ. */
export function themDongCapNhat(
  rows: DongCapNhat[],
  dong: DongCapNhat,
): { rows: DongCapNhat[]; index: number; trung: boolean } {
  const i = rows.findIndex((r) => r.material_id === dong.material_id)
  if (i >= 0) return { rows, index: i, trung: true }
  return { rows: [...rows, dong], index: rows.length, trung: false }
}

/** Thực tế − trên máy; null khi chưa gõ hoặc gõ sai. */
export function chenh(r: DongCapNhat): number | null {
  if (r.thuc_te == null || !Number.isFinite(r.thuc_te)) return null
  return tron(r.thuc_te - r.tren_may)
}

/** Dòng giảm hàng đang là của lệnh — phải hỏi tổ đã lấy hay hỏng / mất (Q3). */
export function hoiLenh(r: DongCapNhat): boolean {
  const c = chenh(r)
  return c != null && c < -EPS && r.lenh.length > 0
}

/** Dòng này đi thành phiếu XUẤT BÙ cho lệnh (không phải thiếu kiểm kê). */
export function laXuatBu(r: DongCapNhat): boolean {
  return hoiLenh(r) && r.che_do === 'xuat_bu' && !!r.xuat_bu_lsx
}

export function lyDoCua(r: DongCapNhat, dau: DauCapNhat): MaLyDoCapNhat {
  return r.ly_do || dau.ly_do_chung
}

export type LoiDong = {
  /** Chỉ số dòng; −1 = lỗi đầu phiếu. */
  i: number
  reason: 'rong' | 'chua_go' | 'so_sai' | 'so_am' | 'thieu_ghi_chu' | 'thieu_lenh'
  message: string
}

/**
 * Kiểm trước khi ghi — TRẢ MỌI lỗi (màn tô từng dòng), câu đầu tiên là câu
 * thanh chốt nói. Chưa gõ KHÔNG coi là 0: bỏ trống mà thành "đếm được 0" là xoá
 * sạch tồn của mã — đúng hạng lỗi kiểm kê phải chống (cùng luật `submitReview`).
 */
export function kiemTruocGhi(dau: DauCapNhat, rows: DongCapNhat[]): LoiDong[] {
  if (rows.length === 0)
    return [{ i: -1, reason: 'rong', message: 'Chưa có mã nào — gõ mã ở ô "Thêm mã"' }]
  const loi: LoiDong[] = []
  rows.forEach((r, i) => {
    const so = i + 1
    if (r.thuc_te == null)
      loi.push({ i, reason: 'chua_go', message: `dòng ${so} chưa gõ số thực tế` })
    else if (!Number.isFinite(r.thuc_te))
      loi.push({ i, reason: 'so_sai', message: `dòng ${so} số thực tế không đọc được` })
    else if (r.thuc_te < 0)
      loi.push({ i, reason: 'so_am', message: `dòng ${so} số âm — kệ hết thì gõ 0` })
    else if (hoiLenh(r) && r.che_do === 'xuat_bu' && !r.xuat_bu_lsx)
      loi.push({ i, reason: 'thieu_lenh', message: `dòng ${so} chưa chọn lệnh xuất bù` })
    if (lyDoCua(r, dau) === 'khac' && !r.ghi_chu.trim() && !dau.ghi_chu.trim())
      loi.push({
        i,
        reason: 'thieu_ghi_chu',
        message: `dòng ${so} lý do "Khác" cần ghi chú`,
      })
  })
  return loi
}

/** Câu thanh chốt: lỗi đầu + còn bao nhiêu lỗi nữa. */
export function cauChan(loi: LoiDong[]): string | null {
  if (loi.length === 0) return null
  const dau = loi[0].message
  const con = loi.length - 1
  return `${dau.charAt(0).toUpperCase()}${dau.slice(1)}${con > 0 ? ` (và ${con} chỗ nữa)` : ''}`
}

export type TomTatCapNhat = {
  dong: number
  khop: number
  thua: number
  thieu: number
  xuat_bu: number
  chua_go: number
}

export function tomTat(rows: DongCapNhat[]): TomTatCapNhat {
  const t: TomTatCapNhat = { dong: rows.length, khop: 0, thua: 0, thieu: 0, xuat_bu: 0, chua_go: 0 } // prettier-ignore
  for (const r of rows) {
    const c = chenh(r)
    if (c == null) t.chua_go += 1
    else if (Math.abs(c) <= EPS) t.khop += 1
    else if (c > 0) t.thua += 1
    else if (laXuatBu(r)) t.xuat_bu += 1
    else t.thieu += 1
  }
  return t
}

/** Thân POST `cap-nhat-ton` — chỉ gửi lệnh xuất bù cho dòng thật sự xuất bù. */
export function thanGui(dau: DauCapNhat, rows: DongCapNhat[]) {
  return {
    ly_do_chung: dau.ly_do_chung,
    ghi_chu: dau.ghi_chu.trim() || null,
    lines: rows.map((r) => ({
      material_id: r.material_id,
      counted_qty: r.thuc_te ?? 0,
      ly_do: r.ly_do || null,
      ghi_chu: r.ghi_chu.trim() || null,
      xuat_bu_lsx_id: laXuatBu(r) ? r.xuat_bu_lsx : null,
    })),
  }
}

/** Ghi chú của dòng đợt kiểm kê — in lên biên bản 05-VT, hiện ở đối chiếu. */
export function ghiChuDong(input: {
  ly_do: MaLyDoCapNhat
  ghi_chu?: string | null
  xuat_bu_code?: string | null
}): string {
  return [
    nhanLyDoCapNhat(input.ly_do),
    input.ghi_chu?.trim() || null,
    input.xuat_bu_code ? `tổ đã lấy → xuất bù cho ${input.xuat_bu_code}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
