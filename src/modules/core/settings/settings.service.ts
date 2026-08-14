import { db } from '@/server/db'
import { Forbidden } from '@/server/http'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { DEFAULT_APPROVAL_THRESHOLDS, type ApprovalThresholds } from '@/lib/exec-ops'
import type { User } from '@/modules/core/users/users.repo'

export type Settings = {
  company_name: string
  company_tax_code: string
  company_address: string
  /**
   * ĐỊA DANH mở đầu dòng ngày tháng trên phiếu in: "Gia Lai, ngày 06 tháng 07…".
   *
   * Là ô riêng chứ không suy từ `company_address`: bản trước cắt đoạn cuối địa
   * chỉ ra làm địa danh, mà địa chỉ đang lưu bằng tiếng Anh nên phiếu in ra
   * "Vietnam, ngày…" rồi "Binh Dinh Province, ngày…". Địa danh trên văn bản là
   * thứ pháp lý, không phải thứ để đoán.
   */
  company_locality: string
  company_phone: string
  // Bên bán trên hợp đồng (Sales Contract).
  company_email: string
  company_fax: string
  company_bank_account: string
  company_swift: string
  company_representative: string
  company_representative_title: string
  company_fsc_cert: string
  // Điều khoản gỗ/FSC (Article 4) — gần như cố định theo DN.
  fsc_scientific_name: string
  fsc_country_origin: string
  fsc_area_origin: string
  fsc_forest_owner: string
  fsc_exporter: string
  fsc_importer: string
  fsc_seller: string
  fsc_coordinates: string
}

/*
 * `approval_thresholds` (§5F) CỐ Ý KHÔNG nằm trong `Settings`: mọi field ở đây
 * là chuỗi, và các mẫu in đang truyền nguyên khối `Settings` vào
 * `Record<string, string | null>`. Nhét một object vào giữa là vỡ toàn bộ trang
 * in. Ngưỡng ký có đường đọc/ghi riêng bên dưới.
 */

const DEFAULTS: Settings = {
  company_name: 'Công ty SXTM Hoàng Gia',
  company_tax_code: '',
  company_address: '',
  // Trụ sở ở Cụm công nghiệp Cát Nhơn, Xã Xuân An — địa danh trên mọi đơn đặt
  // hàng thật của phòng Cung ứng năm 2026 là "Gia Lai".
  company_locality: 'Gia Lai',
  company_phone: '',
  company_email: '',
  company_fax: '',
  company_bank_account: '',
  company_swift: '',
  company_representative: '',
  company_representative_title: '',
  company_fsc_cert: '',
  fsc_scientific_name: '',
  fsc_country_origin: '',
  fsc_area_origin: '',
  fsc_forest_owner: '',
  fsc_exporter: '',
  fsc_importer: '',
  fsc_seller: '',
  fsc_coordinates: '',
}

export const settingsService = {
  async getAll(): Promise<Settings> {
    const { data } = await db().from('settings').select('key, value')
    const out = { ...DEFAULTS }
    for (const row of (data ?? []) as { key: string; value: unknown }[]) {
      // CHỈ nhận key có trong DEFAULTS. Bảng `settings` là kho key/value dùng
      // chung, giờ có cả hàng KHÔNG phải chuỗi (approval_thresholds). Không lọc
      // thì chúng lọt vào khối `Settings` mà mẫu in đang coi là toàn chuỗi.
      if (!Object.hasOwn(DEFAULTS, row.key)) continue
      ;(out as Record<string, unknown>)[row.key] = row.value
    }
    return out
  },

  /**
   * Bảng ngưỡng ký — đọc riêng vì Hộp ký gọi nó mỗi lần dựng màn, không cần
   * kéo theo cả khối thông tin công ty / điều khoản FSC.
   */
  async approvalThresholds(): Promise<ApprovalThresholds> {
    const { data } = await db()
      .from('settings')
      .select('value')
      .eq('key', 'approval_thresholds')
      .maybeSingle()
    const raw = (data as { value: unknown } | null)?.value
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return DEFAULT_APPROVAL_THRESHOLDS
    }
    return raw as ApprovalThresholds
  },

  /**
   * Đặt ngưỡng ký — gác bằng `exec.threshold.manage` (quyền của NGƯỜI KÝ), KHÔNG
   * bằng `system.settings.manage`. Giám đốc phải tự chỉnh được ngưỡng của chính
   * mình mà không cần chìa khoá quản trị hệ thống; đó là lý do nó không đi chung
   * đường với `update()` bên dưới.
   */
  async setApprovalThresholds(
    user: User,
    thresholds: ApprovalThresholds,
  ): Promise<ApprovalThresholds> {
    await assertAction(user, 'exec.threshold.manage')
    const { error } = await db()
      .from('settings')
      .upsert({ key: 'approval_thresholds', value: thresholds })
    if (error) throw new Error(error.message)
    return thresholds
  },

  async update(user: User, patch: Partial<Settings>) {
    if (user.role !== 'admin') throw Forbidden('Chỉ quản trị viên')
    const entries = Object.entries(patch).filter(([, v]) => v !== undefined)
    if (entries.length === 0) return this.getAll()
    const rows = entries.map(([key, value]) => ({ key, value }))
    const { error } = await db().from('settings').upsert(rows)
    if (error) throw new Error(error.message)
    return this.getAll()
  },
}
