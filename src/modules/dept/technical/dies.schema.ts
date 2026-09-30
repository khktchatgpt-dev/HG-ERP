import { z } from 'zod'
import { vnTodayIso } from '@/lib/local-date'

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
 * Ghi một dòng nhật ký bằng tay (hộp "Ghi nhật ký" trên hồ sơ khuôn, 29/09/2026).
 * Các sự kiện do ĐỔI HỒ SƠ sinh ra thì service tự ghi, không đi qua đường này.
 *
 * Nhật ký ghi chuyện ĐÃ xảy ra: ngày bắt buộc (ghi lùi được) và không được sau
 * hôm nay theo giờ VN. Báo hư / ghi chú mà không có nội dung là một dòng không
 * nói gì; chuyển khuôn mà không nói sang đâu thì nơi giữ không đổi được.
 */
export const DIE_EVENT_TYPES = [
  'broken',
  'modified',
  'transferred',
  'opened',
  'reopened',
  'replaced',
  'retired',
  'note',
] as const

export const dieEventSchema = z
  .object({
    event_type: z.enum(DIE_EVENT_TYPES),
    event_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Chưa nhập ngày xảy ra')
      .refine((d) => d <= vnTodayIso(), 'Ngày chưa tới — nhật ký ghi chuyện đã xảy ra'),
    weight_before: num(1000),
    weight_after: num(1000),
    cost: num(10_000_000_000),
    from_holder: text(120),
    to_holder: text(120),
    /** Khuôn thay thế (việc "Thay bằng mã khác"). */
    related_die_id: blank(z.uuid()),
    content: text(2000),
    /**
     * Cập nhật luôn hồ sơ theo việc này (tình trạng / nơi giữ / kg/m — xem
     * `lib/die-event-effect`). Bỏ tick khi chỉ ghi lại chuyện cũ đã qua.
     */
    apply: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if ((v.event_type === 'broken' || v.event_type === 'note') && !v.content) {
      ctx.addIssue({
        code: 'custom',
        path: ['content'],
        message: 'Ghi nội dung: chuyện gì, ai báo',
      })
    }
    if (v.event_type === 'transferred' && !v.to_holder) {
      ctx.addIssue({
        code: 'custom',
        path: ['to_holder'],
        message: 'Chưa ghi chuyển sang đâu',
      })
    }
  })

export type DieEventInput = z.infer<typeof dieEventSchema>
