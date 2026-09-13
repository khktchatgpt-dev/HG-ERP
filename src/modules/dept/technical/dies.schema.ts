import { z } from 'zod'

/**
 * Zod cho danh mục KHUÔN NHÔM (0190). Kiểm ở BIÊN API; tầng service tin gọi nội bộ.
 *
 * Quy ước chung của các schema trong dự án: ô người dùng để trống gửi lên là chuỗi
 * rỗng, KHÔNG phải `undefined`. Ghi thẳng chuỗi rỗng xuống cột text là đẻ ra hai
 * loại "trống" (`''` và `NULL`) rồi mọi truy vấn sau phải nhớ kiểm cả hai — nên
 * `blank` chuẩn hoá về `null` ngay tại biên.
 */
const blank = <T extends z.ZodTypeAny>(s: T) =>
  z.preprocess((v) => (v === '' || v === undefined ? null : v), s.nullable())

const text = (max: number) => blank(z.string().trim().max(max))

/** Số dương, cho phép trống. Chuỗi rỗng → null chứ không phải 0. */
const num = (max: number) => blank(z.coerce.number().min(0).max(max).finite())

export const DIE_STATUSES = [
  'pending',
  'active',
  'rarely_used',
  'broken',
  'replaced',
  'retired',
  'unknown',
] as const

export const dieCreateSchema = z.object({
  /**
   * Mã khuôn. KHÔNG unique ở DB (0106: cùng mã có nhiều đời), nên service tự chặn
   * trùng lúc tạo — chặn ở tầng nghiệp vụ thì báo được câu người dùng hiểu, còn
   * để DB chặn thì ra lỗi ràng buộc trần trụi.
   */
  code: z.string().trim().min(1, 'Chưa nhập mã khuôn').max(60),
  name: text(300),
  part_group: text(60),
  profile_shape: text(60),
  alloy: text(60),
  weight_per_m: num(1000),
  unit: text(20),
  die_price: num(10_000_000_000),
  holder_name: text(120),
  status: z.enum(DIE_STATUSES).default('unknown'),
  note: text(2000),

  // Thông số cho xưởng — xem §4 của docs/quan-ly-khuon-ke-hoach.md.
  section_a_mm: num(10_000),
  section_b_mm: num(10_000),
  wall_thickness_mm: num(1000),
  outer_diameter_mm: num(10_000),
  rib_count: blank(z.coerce.number().int().min(0).max(50)),
  bar_length_m: num(100),
  pcs_per_bundle: blank(z.coerce.number().int().min(0).max(10_000)),
  weight_tolerance_pct: num(100),
  surface_finish: text(60),
  marking: text(120),
})

export type DieCreateInput = z.infer<typeof dieCreateSchema>

/** Sửa: mọi trường tuỳ chọn, nhưng gửi lên trường nào là ghi đè trường đó. */
export const dieUpdateSchema = dieCreateSchema.partial()
export type DieUpdateInput = z.infer<typeof dieUpdateSchema>

/**
 * Ghi một dòng nhật ký bằng tay. Các sự kiện do ĐỔI HỒ SƠ sinh ra thì service tự
 * ghi (xem `dies.service`), không đi qua đường này.
 */
export const dieEventSchema = z.object({
  event_type: z.enum([
    'opened',
    'modified',
    'transferred',
    'broken',
    'replaced',
    'retired',
    'reopened',
    'note',
  ]),
  event_date: blank(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải dạng YYYY-MM-DD')),
  weight_before: num(1000),
  weight_after: num(1000),
  cost: num(10_000_000_000),
  from_holder: text(120),
  to_holder: text(120),
  content: text(2000),
})

export type DieEventInput = z.infer<typeof dieEventSchema>
