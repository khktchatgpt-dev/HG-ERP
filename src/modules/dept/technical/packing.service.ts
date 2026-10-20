/**
 * PHƯƠNG ÁN ĐÓNG GÓI — thêm / sửa / đặt mặc định / xoá (08/10/2026).
 *
 * Quyền: cùng quyền sửa hồ sơ SP (`technical.product.update`). Hồ sơ ĐÃ KHOÁ thì
 * không sửa đóng gói — đóng gói là nội dung hồ sơ, như định mức và thuộc tính.
 */

import type { User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Forbidden, NotFound } from '@/server/http'
import { productsRepo } from './technical.repo'
import { packingRepo } from './packing.repo'
import type { PackingOptionInput, PackingOptionUpdate } from './packing.schema'

async function openProduct(user: User, productId: string) {
  await assertAction(user, 'technical.product.update')
  const p = await productsRepo.findById(productId)
  if (!p) throw NotFound('Sản phẩm không tồn tại')
  if (p.locked_at)
    throw Forbidden(`Hồ sơ ${p.code} đã khoá — mở khoá (ghi lý do) rồi mới sửa đóng gói`)
  return p
}

export const packingService = {
  async create(
    user: User,
    productId: string,
    input: PackingOptionInput,
  ): Promise<{ id: string }> {
    await openProduct(user, productId)
    const id = await packingRepo.create(productId, input)
    return { id }
  },

  async update(
    user: User,
    productId: string,
    optionId: string,
    patch: PackingOptionUpdate,
  ): Promise<void> {
    await openProduct(user, productId)
    const cur = await packingRepo.findOption(productId, optionId)
    if (!cur) throw NotFound('Phương án không tồn tại')
    // Bỏ cờ mặc định của phương án duy nhất đang mặc định = SP không còn phương án
    // in lên báo giá; chặn ở đây thay vì để lệch âm thầm.
    if (patch.is_default === false && cur.is_default)
      throw BadRequest('Phải chọn phương án khác làm mặc định trước')
    await packingRepo.update(productId, optionId, patch)
  },

  async remove(user: User, productId: string, optionId: string): Promise<void> {
    await openProduct(user, productId)
    const ok = await packingRepo.remove(productId, optionId)
    if (!ok) throw NotFound('Phương án không tồn tại')
    await packingRepo.ensureDefault(productId)
  },
}
