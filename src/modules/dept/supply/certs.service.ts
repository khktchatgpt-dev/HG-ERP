import { certsRepo, type SupplierCert } from './supply.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { z } from 'zod'
import type { certCreateSchema } from './certs.schema'
import type { User } from '@/modules/core/users/users.repo'

type CertInput = z.infer<typeof certCreateSchema>

export const certsService = {
  /** Đọc: mọi NV đã đăng nhập (tra hồ sơ NCC). */
  async list(_user: User, supplierId: string): Promise<SupplierCert[]> {
    return certsRepo.list(supplierId)
  },

  async create(user: User, input: CertInput): Promise<SupplierCert> {
    await assertAction(user, 'supply.cert.manage')
    return certsRepo.insert({
      supplier_id: input.supplier_id,
      cert_type: input.cert_type,
      cert_no: input.cert_no ?? null,
      issued_on: input.issued_on ?? null,
      note: input.note ?? null,
      created_by: user.id,
    })
  },

  async remove(user: User, id: string): Promise<void> {
    await assertAction(user, 'supply.cert.manage')
    await certsRepo.remove(id)
  },
}
