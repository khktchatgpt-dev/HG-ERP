import { z } from 'zod'

/**
 * Quản lý NHÓM / NHÓM PHỤ vật tư (03/09/2026) — biên vào của các route
 * `material-groups`. Tên nhóm là NHÃN người đọc (group_name trên vật tư trỏ
 * bằng nhãn, không FK — free-text-over-fk), nên mọi thao tác nhận tên, cắt
 * khoảng trắng, chặn rỗng.
 */
const label = z.string().trim().min(2, 'Tên nhóm quá ngắn').max(100)

export const materialGroupCreateSchema = z.object({ name: label })

export const materialGroupUpdateSchema = z
  .object({
    name: label.optional(),
    is_active: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.is_active !== undefined, {
    message: 'Chưa nói đổi gì',
  })

/**
 * Nhóm phụ không có bảng riêng — nó là cột text trên vật tư — nên "đổi tên",
 * "gộp" và "xoá" đều là một câu update trên các mã trong nhóm chính đó:
 *   rename: from → to (to đã tồn tại thì chính là GỘP)
 *   delete: name → null
 */
export const materialSubGroupActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('rename'),
    group_name: label,
    from: label,
    to: label,
  }),
  z.object({
    action: z.literal('delete'),
    group_name: label,
    name: label,
  }),
])
