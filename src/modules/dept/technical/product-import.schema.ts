import { z } from 'zod'

/** Thân request của luồng thêm + cập nhật SP bằng Excel (07/10/2026). */
const path = z.string().trim().min(1).max(300)

export const importPreviewSchema = z.object({ path })

export const importCommitSchema = z.object({
  path,
  /** Số hàng Excel của lô này (tối đa 50 — service kiểm). */
  rows: z.array(z.number().int().positive()).min(1).max(50),
  /** Dòng THÊM MỚI đã ghi ở lô trước — để không bị cấp mã lần hai. */
  written: z
    .array(
      z.object({
        row: z.number().int().positive(),
        code: z.string().trim().min(1).max(100),
      }),
    )
    .max(1000),
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
      }),
    )
    .max(1000),
})
