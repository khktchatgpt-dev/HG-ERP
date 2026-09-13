import type { User } from '@/modules/core/users/users.repo'
import { productsService } from '@/modules/dept/technical/technical.service'
import {
  partGroupsRepo,
  productProfileRepo,
  type PartGroupRow,
} from '@/modules/dept/technical/technical.repo'
import { bomToCutLines, type BomToCutResult } from '@/lib/cut-plan/from-bom'

/**
 * QUY CẮT PHÔI — phần cần DB: nạp định mức của một hồ sơ SP thành dòng cắt.
 * Luật ánh xạ nằm ở `lib/cut-plan/from-bom.ts` (thuần, có test); đây chỉ lấy
 * sản phẩm + định mức + nhãn nhóm rồi gọi vào.
 *
 * Quyền: thư viện SP là tài sản chung, mọi nhân viên đọc được (`productsService
 * .list/.get` không gác) — quy cắt cũng chỉ ĐỌC định mức, không ghi gì.
 */
export const cutPlanService = {
  async fromProduct(
    user: User,
    productId: string,
    qtyProducts: number,
  ): Promise<{ product: { id: string; code: string; name: string } } & BomToCutResult> {
    const product = await productsService.get(user, productId)
    const [parts, groups] = await Promise.all([
      productProfileRepo.parts(productId),
      partGroupsRepo.list(false),
    ])
    const labels = Object.fromEntries(groups.map((g: PartGroupRow) => [g.code, g.label]))
    return {
      product: { id: product.id, code: product.code, name: product.name },
      ...bomToCutLines(parts, qtyProducts, labels),
    }
  },
}
