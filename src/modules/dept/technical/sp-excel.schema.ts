import { z } from 'zod'

/** Đầu vào các route của luồng Excel SP (09/10/2026). Đường dẫn file tạm do server cấp. */
const pathSchema = z.string().trim().min(1).max(300)

export const spExcelPreviewSchema = z.object({ path: pathSchema })

export const spExcelCommitSchema = z.object({
  path: pathSchema,
  /** Số hàng Excel của lô này (≤ 50). */
  rows: z.array(z.number().int().min(4)).min(1).max(50),
  /** Dòng THÊM MỚI đã ghi ở lô trước — để không cấp mã lần hai. */
  written: z
    .array(z.object({ row: z.number().int(), code: z.string().min(1) }))
    .default([]),
})

export const spExcelFinishSchema = z.object({
  path: pathSchema,
  filename: z.string().trim().min(1).max(200),
  written: z.array(
    z.object({
      row: z.number().int(),
      code: z.string().min(1),
      version: z.string(),
      imageRef: z.string().nullable().optional(),
    }),
  ),
})

export const spExcelExportQuerySchema = z.object({
  /** Mẫu trống. */
  blank: z.string().optional(),
  /** SP của một lệnh SX (mã lệnh). */
  lsx: z.string().trim().max(60).optional(),
  // Bộ lọc thư viện — đúng tham số URL của /thu-vien.
  q: z.string().trim().max(200).optional(),
  kh: z.string().max(200).optional(),
  loai: z.string().max(4).optional(),
  khung: z.string().max(4).optional(),
  thieu: z.string().max(20).optional(),
  kt: z.string().optional(),
  tt: z.string().optional(),
  lenh: z.string().optional(),
  mau: z.string().optional(),
})
export type SpExcelExportQuery = z.infer<typeof spExcelExportQuerySchema>
