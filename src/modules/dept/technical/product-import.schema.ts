import { z } from 'zod'

/** Thân request của luồng thêm + cập nhật SP bằng Excel (07/10/2026). */
const path = z.string().trim().min(1).max(300)

export const importPreviewSchema = z.object({ path })

export const importCommitSchema = z
  .object({
    path,
    /** Số hàng Excel của lô này (tối đa 50 — service kiểm). */
    rows: z.array(z.number().int().positive()).max(50),
    /** Dòng THÊM MỚI đã ghi ở lô trước — để không bị cấp mã lần hai. */
    written: z
      .array(
        z.object({
          row: z.number().int().positive(),
          code: z.string().trim().min(1).max(100),
        }),
      )
      .max(1000),
    /** Mã SP thay đóng gói ở lô này (sheet "Đóng gói") — tối đa 40. */
    packingCodes: z.array(z.string().trim().min(1).max(100)).max(40).optional(),
  })
  .refine((v) => v.rows.length > 0 || (v.packingCodes?.length ?? 0) > 0, {
    message: 'Lô rỗng',
  })

export const importFinishSchema = z.object({
  path,
  filename: z.string().trim().min(1).max(200),
  written: z
    .array(
      z.object({
        row: z.number().int().positive(),
        code: z.string().trim().min(1).max(100),
        version: z.string().trim().min(1).max(60),
        /** Ô "Ảnh gốc" mới — chỉ dòng vừa ghi ảnh mới. */
        imageRef: z.string().trim().max(200).nullable().optional(),
      }),
    )
    .max(1000),
})
