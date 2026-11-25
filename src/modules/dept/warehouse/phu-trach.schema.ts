import { z } from 'zod'

/** Lưu phân công: danh sách nhóm đổi người; user_id null = bỏ gán (về thủ kho). */
export const luuPhuTrachSchema = z.object({
  items: z
    .array(
      z.object({
        group_name: z.string().trim().min(1).max(200),
        user_id: z.string().uuid().nullable(),
      }),
    )
    .min(1)
    .max(200),
})
export type LuuPhuTrachInput = z.infer<typeof luuPhuTrachSchema>
