import { z } from 'zod'

/**
 * Bảng chi tiết (component) theo LSX — NHẬP TAY bởi Kế hoạch, BOM chỉ tham
 * khảo (plan-lsx-components, SRS FR-MD-02/03). PUT ghi đè trọn bộ như BOM editor.
 */
export const componentLineSchema = z.object({
  order_line_id: z.string().uuid(), // chi tiết thuộc dòng SP nào trong lệnh
  cluster: z.string().trim().max(100).optional().nullable(), // "CỤM TỰA"
  name: z.string().trim().min(1, 'Nhập tên chi tiết').max(200), // "TAY+TỰA"
  material_id: z.string().uuid().optional().nullable(), // được để trống — chưa vào nhu cầu mua
  material_type: z.string().trim().max(50).optional().nullable(), // TRÒN/ĐẶC/HỘP…
  spec_thickness_mm: z.coerce.number().positive().optional().nullable(),
  spec_width_mm: z.coerce.number().positive().optional().nullable(),
  spec_length_mm: z.coerce.number().positive().optional().nullable(),
  qty_per_unit: z.coerce.number().positive(), // CT/SP
  dm_kg: z.coerce.number().min(0).optional().nullable(), // kg / 1 chi tiết
  pcs_per_bar: z.coerce.number().positive().optional().nullable(), // chi tiết / 1 cây
  // Công đoạn cuối của chi tiết (tuỳ SP — không sơn thì cuối là nguội);
  // null = công đoạn cuối danh mục.
  final_stage: z.string().trim().max(50).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
})

export const componentsSaveSchema = z.object({
  lines: z.array(componentLineSchema).max(500),
})

export const componentsSuggestQuerySchema = z.object({
  source: z.enum(['bom', 'previous']),
})
