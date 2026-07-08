import { authService } from '@/modules/core/auth/auth.service'
import { catalogsService } from '@/modules/core/catalogs/catalogs.service'
import { CatalogsManager } from './CatalogsManager'

/** Danh mục dùng chung (FR-ADM-04): ĐVT, nhóm vật tư, giai đoạn SX, loại hợp đồng… */
export default async function AdminCatalogsPage() {
  const user = (await authService.currentUser())!
  const items = await catalogsService.list(user)
  return <CatalogsManager items={items} />
}
