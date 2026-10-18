import { z } from 'zod'

/** Tháng của bảng công: 'YYYY-MM'. */
export const bangCongQuerySchema = z.object({
  thang: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Tháng phải dạng YYYY-MM'),
})

const ngay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải dạng YYYY-MM-DD')

/** Khoảng ngày lấy về từ máy, tính cả hai đầu; tối đa 1 năm một lần. */
export const keoSchema = z
  .object({ tu: ngay, den: ngay })
  .refine((v) => v.den >= v.tu, {
    message: '"Đến ngày" phải sau hoặc bằng "Từ ngày"',
    path: ['den'],
  })
  .refine((v) => (Date.parse(v.den) - Date.parse(v.tu)) / 86400_000 <= 366, {
    message: 'Mỗi lần lấy tối đa 1 năm',
    path: ['den'],
  })

const hoTen = z
  .string()
  .trim()
  .min(2, 'Họ tên quá ngắn')
  .max(120, 'Họ tên tối đa 120 ký tự')
/** Bộ phận / tổ gõ tự do (rỗng = chưa có). */
const boPhan = z
  .string()
  .trim()
  .max(80, 'Bộ phận tối đa 80 ký tự')
  .transform((v) => v || null)
const uuid = z.string().uuid()

/** Sửa một nhân viên chấm công. */
export const nhanVienSuaSchema = z.object({
  full_name: hoTen,
  team: boPhan,
  shift_id: uuid,
  active: z.boolean(),
  /** Không chấm công — không quẹt máy, không bị tính thiếu công. */
  attendance_exempt: z.boolean(),
})

/** Thêm nhân viên — mã NV là số trên máy chấm công (bỏ số 0 đầu). */
export const nhanVienThemSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{1,9}$/, 'Mã NV là số trên máy chấm công')
    .transform((v) => v.replace(/^0+(?=\d)/, '')),
  full_name: hoTen,
  team: boPhan,
  shift_id: uuid,
  /** Ghép luôn mã trên máy này (dòng `hr_device_users`) — khi tạo từ "mã chưa ghép". */
  device_user_id: uuid.optional(),
})

/** Đổi ca và/hoặc bộ phận cho nhiều người một lần. */
export const nhanVienHangLoatSchema = z
  .object({
    ids: z.array(uuid).min(1, 'Chưa chọn ai').max(500),
    shift_id: uuid.optional(),
    team: boPhan.optional(),
  })
  .refine((v) => v.shift_id !== undefined || v.team !== undefined, {
    message: 'Chọn ca hoặc bộ phận cần đổi',
  })

/** Ghép (employee_id = người) hoặc gỡ (null) một mã trên máy. */
export const ghepMaSchema = z.object({
  device_user_id: uuid,
  employee_id: uuid.nullable(),
})

/** Ngăn "Chấm công một người": mã NV + khoảng ngày (tối đa 1 năm, câu 16). */
export const motNguoiQuerySchema = z
  .object({ ma: z.string().trim().min(1, 'Thiếu mã NV').max(20), tu: ngay, den: ngay })
  .refine((v) => v.den >= v.tu, {
    message: '"Đến ngày" phải sau hoặc bằng "Từ ngày"',
    path: ['den'],
  })
  .refine((v) => (Date.parse(v.den) - Date.parse(v.tu)) / 86400_000 < 366, {
    message: 'Mỗi lần xem tối đa 1 năm',
    path: ['den'],
  })

const gio = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Giờ phải dạng HH:MM')
  .transform((v) => (v.length === 5 ? `${v}:00` : v))
const chu = (max: number, ten: string) =>
  z.string().trim().max(max, `${ten} tối đa ${max} ký tự`)

/** Gửi một điều chỉnh chấm công (bản vẽ DieuChinh, câu 22–25). */
export const dieuChinhGuiSchema = z.discriminatedUnion('loai', [
  z.object({
    loai: z.literal('add_punch'),
    ma: z.string().trim().min(1),
    ngay,
    gio,
    chieu: z.enum(['in', 'out']),
    lyDo: chu(200, 'Lý do').min(2, 'Ghi lý do'),
    canCu: chu(300, 'Căn cứ').optional(),
  }),
  z.object({
    loai: z.literal('ignore_punch'),
    ma: z.string().trim().min(1),
    ngay,
    gio,
    lyDo: chu(200, 'Lý do').min(2, 'Ghi lý do'),
    canCu: chu(300, 'Căn cứ').optional(),
  }),
  z.object({
    loai: z.literal('leave'),
    ma: z.string().trim().min(1),
    ngay,
    nghi: z.enum(['annual', 'sick', 'personal', 'business_trip', 'unpaid']),
    lyDo: chu(200, 'Lý do').min(2, 'Ghi lý do'),
    canCu: chu(300, 'Căn cứ').optional(),
  }),
])
export type DieuChinhGui = z.infer<typeof dieuChinhGuiSchema>

/** Duyệt / từ chối / rút một (hoặc nhiều) điều chỉnh. */
export const dieuChinhQuyetSchema = z
  .object({
    ids: z.array(uuid).min(1).max(500),
    viec: z.enum(['duyet', 'tu_choi', 'rut']),
    ghiChu: chu(300, 'Ghi chú').optional(),
  })
  .refine((v) => v.viec !== 'tu_choi' || (v.ghiChu ?? '').length >= 2, {
    message: 'Từ chối phải ghi lý do',
    path: ['ghiChu'],
  })

/** Ghi / bỏ tick làm trưa: `phut` null = bỏ tick. */
export const truaSchema = z.object({
  muc: z
    .array(
      z.object({
        ma: z.string().trim().min(1),
        ngay: z
          .string()
          .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, 'Ngày phải dạng YYYY-MM-DD'),
        phut: z.number().int().min(1).max(240).nullable(),
      }),
    )
    .min(1)
    .max(500),
})

/** Đổi cách tính giờ công của một bộ phận. */
export const cachTinhSchema = z.object({
  boPhan: z.string().trim().min(1).max(120),
  cachTinh: z.enum(['khung', 'ngay']),
})

// ── Cách tính công (B2, 0243) ─────────────────────────────────────────────

const phutTrongNgay = z.number().int().min(0).max(2880)
const pt = z.number().min(0, 'Hệ số không âm').max(1000, 'Hệ số tối đa 1000 %')

export const banMoiSchema = z.object({ tuBan: z.string().uuid() })

export const banLuuSchema = z
  .object({
    quyTac: z
      .object({
        truaTu: phutTrongNgay,
        truaDen: phutTrongNgay,
        anHanPhut: z.number().int().min(0).max(120),
        lamTronRaKieu: z.enum(['bac_thang', 'xuong_30']),
        nguongNuaGio: z.number().int().min(0).max(59),
        nguongDuGio: z.number().int().min(0).max(59),
        lamTronVaoChieu: z.boolean(),
        tinhDenSom: z.boolean(),
        denSomTu: phutTrongNgay,
        caDemDen: phutTrongNgay,
        phutMotCong: z.number().int().min(60).max(720),
        heSoTrua: z.number().min(0).max(10),
        phutTruaMacDinh: z.number().int().min(1).max(240),
      })
      .optional(),
    khung: z
      .array(
        z.object({
          ma: z.string().regex(/^K[1-9]$/),
          ten: z.string().trim().min(1, 'Khung cần tên').max(60),
          tu: phutTrongNgay,
          den: phutTrongNgay,
          boPhanLo: z.boolean(),
          hanhChinh: z.boolean(),
        }),
      )
      .min(1)
      .max(9)
      .optional(),
    heSo: z
      .array(
        z.object({
          loai: z.enum(['frame', 'leave']),
          ma: z.string().min(1).max(20),
          ngay: z.enum(['thuong', 'cn', 'le', 'any']),
          pt: pt.nullable(),
          lyDo: z.string().trim().max(300, 'Lý do tối đa 300 ký tự').nullable(),
        }),
      )
      .max(100)
      .optional(),
  })
  .refine((v) => v.quyTac || v.khung || v.heSo, { message: 'Không có gì để lưu' })

export const banApDungSchema = z.object({
  tuKy: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Kỳ phải dạng YYYY-MM'),
})

// ── Kỳ công (B3, 0244) ───────────────────────────────────────────────────

export const kyThangSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Kỳ phải dạng YYYY-MM')

export const kyViecSchema = z.discriminatedUnion('viec', [
  z.object({
    viec: z.literal('xac_nhan'),
    to: z.string().trim().min(1).max(120),
    dongY0: z.boolean(),
  }),
  z.object({ viec: z.literal('bo_xac_nhan'), to: z.string().trim().min(1).max(120) }),
  z.object({ viec: z.literal('chot') }),
  z.object({
    viec: z.literal('xin_mo'),
    lyDo: z.string().trim().min(5, 'Ghi lý do xin mở lại (ít nhất 5 ký tự)').max(300),
  }),
  z.object({ viec: z.literal('rut_xin') }),
  z.object({
    viec: z.literal('quyet_mo'),
    dongY: z.boolean(),
    ghiChu: z.string().trim().max(300).optional(),
  }),
])
