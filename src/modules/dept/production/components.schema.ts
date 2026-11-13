import { z } from 'zod'

/**
 * Bảng chi tiết (component) theo LSX — NHẬP TAY bởi Kế hoạch, BOM chỉ tham
 * khảo (plan-lsx-components, SRS FR-MD-02/03). PUT ghi đè trọn bộ như BOM editor.
 */
export const componentLineSchema = z.object({
  production_order_line_id: z.string().uuid(), // chi tiết thuộc dòng SP nào trong lệnh
  // 'part' = chi tiết (đếm ở phôi); 'assembly' = cụm (đếm từ hàn — 0088).
  kind: z.enum(['part', 'assembly']).default('part'),
  cluster: z.string().trim().max(100).optional().nullable(), // "CỤM TỰA"
  name: z.string().trim().min(1, 'Nhập tên chi tiết').max(200), // "TAY+TỰA"
  // Nhóm vật tư sao từ hồ sơ SP (0174) — quyết định chi tiết đi qua công đoạn
  // nào; NGU_KIM (vít/bulong) là hàng mua, không vào sổ sản lượng.
  group_code: z.string().trim().max(30).optional().nullable(),
  material_id: z.string().uuid().optional().nullable(), // được để trống — chưa vào nhu cầu mua
  material_type: z.string().trim().max(50).optional().nullable(), // TRÒN/ĐẶC/HỘP…
  spec_thickness_mm: z.coerce.number().positive().optional().nullable(),
  spec_width_mm: z.coerce.number().positive().optional().nullable(),
  spec_length_mm: z.coerce.number().positive().optional().nullable(),
  // Độ dày thành ống (mm); để trống = thanh đặc — 0089.
  wall_thickness_mm: z.coerce.number().positive().optional().nullable(),
  unit: z.string().trim().max(20).optional().nullable(), // ĐVT: cái/cụm/bộ/kg/m
  qty_per_unit: z.coerce.number().positive(), // chi tiết: CT/SP · cụm: cụm/SP
  dm_kg: z.coerce.number().min(0).optional().nullable(), // kg / 1 chi tiết (hoặc / 1 cụm)
  pcs_per_bar: z.coerce.number().positive().optional().nullable(), // chi tiết / 1 cây
  // Số chi tiết dùng cho 1 cụm cùng `cluster` (dòng chi tiết; cụm để trống).
  qty_per_assembly: z.coerce.number().positive().optional().nullable(),
  // Công đoạn đầu chuỗi (cụm bắt đầu ở hàn); null = từ đầu lộ trình.
  first_stage: z.string().trim().max(50).optional().nullable(),
  // Công đoạn cuối của chi tiết/cụm (tuỳ SP — không sơn thì cuối là nguội);
  // null = công đoạn cuối danh mục.
  final_stage: z.string().trim().max(50).optional().nullable(),
  // Lộ trình CHỤP từ hồ sơ SP lúc định hình (0288) — mã công đoạn đúng thứ tự;
  // null = suy theo nhóm vật tư như cũ. Kế hoạch lệnh vẫn thắng khi có.
  stages: z.array(z.string().trim().min(1).max(50)).max(20).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
})

export const componentsSaveSchema = z.object({
  lines: z.array(componentLineSchema).max(500),
  /** Khởi tạo định mức hồ sơ SP từ bảng này cho SP CHƯA có BOM (user chốt
   *  23/08/2026) — SP đã có định mức thì tự bỏ qua, không bao giờ đè. */
  seed_profile: z.boolean().default(false),
  /** Ghi ngược lộ trình CỤM của bảng này lên hồ sơ SP (04/11/2026, chủ dự án:
   *  kế hoạch định hình trên lệnh là đường chính, hồ sơ SP đi theo). Mặc định
   *  bật; tắt khi lệnh là ngoại lệ một lần. */
  sync_profile_routes: z.boolean().default(true),
  /**
   * SỐ CỤM / SP thống kê khai trên lệnh (13/11/2026, chủ dự án: "chưa có định
   * mức từ BOM thì thống kê có tự tạo để nhập liệu được không"). Đi cùng cờ
   * `sync_profile_routes`: ghi ngược lên `technical_product_clusters.qty_per_product`
   * để màn Ghi sản lượng hết báo "chưa có" và lệnh sau khỏi khai lại.
   */
  cluster_qty: z
    .array(
      z.object({
        production_order_line_id: z.string().uuid(),
        cluster: z.string().trim().min(1).max(200),
        qty: z.number().positive('Số cụm / SP phải > 0').max(1000),
      }),
    )
    .max(500)
    .default([]),
})

export const componentsSuggestQuerySchema = z.object({
  source: z.enum(['bom', 'previous']),
})
