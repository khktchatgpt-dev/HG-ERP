import { authService } from '@/modules/core/auth/auth.service'
import { spExcelService } from '@/modules/dept/technical/sp-excel.service'
import { NhapExcelScreen } from './NhapExcelScreen'

/**
 * NHẬP + CẬP NHẬT SP BẰNG EXCEL — màn 3 bước theo bản vẽ
 * https://claude.ai/artifact/ArSSNepoFvD4LgBSc4G7t1 (09/10/2026): lấy file →
 * chọn file đã sửa → soi rồi ghi. Trang server chỉ gác quyền.
 */
export default async function NhapExcelPage() {
  const user = await authService.requirePageUser()
  const canUse = await spExcelService.canUse(user)
  return <NhapExcelScreen canUse={canUse} />
}
