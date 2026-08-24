import { authService } from '@/modules/core/auth/auth.service'
import { docTemplatesService } from '@/modules/core/doc-templates/doc-templates.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { DocTemplatesManager } from './DocTemplatesManager'

/**
 * MẪU CHỨNG TỪ (0164) — quy tắc đánh số + khuôn mẫu in của từng loại phiếu.
 *
 * Gác quyền nằm ở service khi GHI (`system.settings.manage`); trang chỉ đọc nên
 * mở cho ai vào được khu /admin.
 */
export default async function AdminDocTemplatesPage() {
  await authService.requirePageUser()
  const [templates, nextSeqs, company] = await Promise.all([
    docTemplatesService.list(),
    docTemplatesService.nextSeqs(),
    // Thông tin công ty cho ô XEM TRƯỚC — bày tờ giấy bằng dữ liệu thật thay vì
    // chữ giả "TÊN CÔNG TY", để người sửa thấy đúng thứ sẽ in ra.
    settingsService.getAll(),
  ])
  return (
    <DocTemplatesManager
      templates={templates}
      nextSeqs={nextSeqs}
      company={company}
    />
  )
}
