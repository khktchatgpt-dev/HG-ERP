/**
 * HỒ SƠ SẢN PHẨM — dữ liệu cho màn `/thu-vien/[id]` (khuôn E, 08/10/2026).
 *
 * Một lượt `hoSo` gom: hồ sơ + định mức + cụm + món + đóng gói + file + mẫu +
 * lệnh SX + đơn bán + giá KH (theo quyền), rồi chấm checklist 6 ô bằng ĐÚNG
 * hàm thư viện dùng (`lib/ho-so-sp`) để ô "Hồ sơ 4/6" ở đây khớp với ô trên
 * dòng danh sách.
 */

import type { User } from '@/modules/core/users/users.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { filesRepo } from '@/modules/core/files/files.repo'
import { NotFound } from '@/server/http'
import { bomRequiredFor, hoSoCheck, hoSoDiem, type HoSoCheck } from '@/lib/ho-so-sp'
import { fileImageSrc } from '@/server/file-image'
import {
  partGroupsRepo,
  productProfileRepo,
  productsRepo,
  type PackingOption,
  type PartGroupRow,
  type Product,
  type ProductCluster,
  type ProductPart,
  type ProductSetItem,
} from './technical.repo'
import { samplesRepo } from './samples.repo'
import { productRevisionsRepo } from './product-revisions.repo'
import { profileRepo } from './profile.repo'

export type HoSoFile = {
  id: string
  filename: string
  doc_type: string | null
  created_at: string
  mime_type: string
  size_bytes: number
}

export type HoSoRevision = {
  id: string
  rev: number
  action: 'lock' | 'unlock' | 'status'
  reason: string | null
  changed_fields: string[]
  /** `{from,to}` khi action = status. */
  status: { from?: string; to?: string } | null
  parts: number
  created_at: string
  by: string | null
}

/** Dòng định mức còn THIẾU SỐ — thứ chặn việc chốt bản. */
export type PartMissing = {
  id: string
  part_no: number | null
  part_name: string
  group_code: string
  thieu: string[]
}

export type HoSoData = {
  product: Product
  rev: number
  creatorName: string | null
  ownerName: string | null
  imageUrl: string | null
  /** Mọi ảnh gắn SP (doc_type image), ảnh đại diện đứng đầu. */
  imageUrls: string[]
  parts: ProductPart[]
  groups: PartGroupRow[]
  clusters: ProductCluster[]
  setItems: ProductSetItem[]
  packing: PackingOption[]
  files: HoSoFile[]
  hasSample: boolean
  check: HoSoCheck
  diem: { co: number; apDung: number }
  thieuSo: PartMissing[]
  plan: {
    price: number | null
    currency: string | null
    at: string | null
    source: string | null
  } | null
  revisions: HoSoRevision[]
}

/** Dòng nào thiếu số để tính: SL trống, hoặc dòng có quy cách thanh mà không có dài cắt. */
export function partsThieuSo(parts: ProductPart[]): PartMissing[] {
  const out: PartMissing[] = []
  for (const p of parts) {
    const thieu: string[] = []
    if (p.qty == null) thieu.push('SL')
    const laThanh = !!(p.profile_shape || p.kg_per_m || p.dim_a_mm)
    if (laThanh && p.cut_length_mm == null) thieu.push('dài cắt')
    if (thieu.length)
      out.push({
        id: p.id,
        part_no: p.part_no,
        part_name: p.part_name,
        group_code: p.group_code,
        thieu,
      })
  }
  return out
}

export const profileService = {
  async hoSo(_user: User, id: string, canPrice: boolean): Promise<HoSoData> {
    const product = await productsRepo.findById(id)
    if (!product) throw NotFound('Sản phẩm không tồn tại')
    const [
      parts,
      groups,
      clusters,
      setItems,
      packing,
      files,
      hasSample,
      rev,
      plan,
      revisions,
    ] = await Promise.all([
      productProfileRepo.parts(id),
      partGroupsRepo.list(),
      productProfileRepo.clusters(id),
      productProfileRepo.setItems(id),
      productProfileRepo.packingOptions(id),
      filesRepo.listByProduct(id),
      samplesRepo.productHasLiveSample(id),
      productRevisionsRepo.maxRev(id),
      canPrice ? profileRepo.planOf(id) : Promise.resolve(null),
      productRevisionsRepo.list(id),
    ])
    const ids = [
      product.owner_id,
      product.created_by,
      ...revisions.map((r) => r.created_by),
    ].filter((v): v is string => !!v)
    const names = ids.length
      ? await usersRepo.displayNamesByIds(ids)
      : new Map<string, string>()

    const live = files.filter((f) => !f.deleted_at)
    const pk0 = packing.find((o) => o.is_default) ?? packing[0]
    const jsonb = (product.packing ?? {}) as {
      carton_l_cm?: number
      loading_40hc?: number
    }
    const loading = pk0?.loading_40hc ?? jsonb.loading_40hc ?? null
    const check = hoSoCheck({
      has_parts: parts.length > 0,
      has_drawing: live.some((f) => f.doc_type === 'drawing'),
      has_image: !!product.image_file_id,
      has_packing: packing.length > 0 || !!jsonb.carton_l_cm,
      has_loading: !!loading && loading > 0,
      has_sample: hasSample,
      bom_required: bomRequiredFor(product.product_type),
    })
    const imageIds = [
      product.image_file_id,
      ...live
        .filter((f) => f.doc_type === 'image' && f.id !== product.image_file_id)
        .map((f) => f.id),
    ].filter((v): v is string => !!v)

    return {
      product,
      rev,
      creatorName: product.created_by ? (names.get(product.created_by) ?? null) : null,
      ownerName: product.owner_id ? (names.get(product.owner_id) ?? null) : null,
      imageUrl: product.image_file_id ? fileImageSrc(product.image_file_id) : null,
      imageUrls: imageIds.map(fileImageSrc),
      parts,
      groups,
      clusters,
      setItems,
      packing,
      files: live.map((f) => ({
        id: f.id,
        filename: f.filename,
        doc_type: f.doc_type,
        created_at: f.created_at,
        mime_type: f.mime_type,
        size_bytes: f.size_bytes,
      })),
      revisions: revisions.map((r) => {
        const snap = (r.fields_snapshot ?? {}) as { from?: string; to?: string }
        return {
          id: r.id,
          rev: r.rev,
          action: r.action,
          reason: r.reason,
          changed_fields: r.changed_fields ?? [],
          status: r.action === 'status' ? { from: snap.from, to: snap.to } : null,
          parts: Array.isArray(r.parts_snapshot) ? r.parts_snapshot.length : 0,
          created_at: r.created_at,
          by: r.created_by ? (names.get(r.created_by) ?? null) : null,
        }
      }),
      hasSample,
      check,
      diem: hoSoDiem(check),
      thieuSo: partsThieuSo(parts),
      plan,
    }
  },
}
