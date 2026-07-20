import { db } from '@/server/db'
import type { FileBucket } from './files.schema'

export type FileRow = {
  id: string
  bucket: FileBucket
  path: string
  filename: string
  mime_type: string
  size_bytes: number
  checksum: string | null
  owner_id: string | null
  task_id: string | null
  comment_id: string | null
  customer_id: string | null
  invoice_id: string | null
  product_id: string | null
  quote_id: string | null
  sales_order_id: string | null
  production_order_id: string | null
  purchase_order_id: string | null
  sample_id: string | null
  created_at: string
  doc_type: string | null
  finalized_at: string | null
  deleted_at: string | null
}

export type FileParentColumns = {
  task_id?: string | null
  comment_id?: string | null
  customer_id?: string | null
  invoice_id?: string | null
  product_id?: string | null
  quote_id?: string | null
  sales_order_id?: string | null
  production_order_id?: string | null
  purchase_order_id?: string | null
  sample_id?: string | null
}

/** Cột parent cho phép list file gốc chứng từ (0016/0030) + ảnh mẫu (0061). */
export type FileParentColumn =
  | 'product_id'
  | 'quote_id'
  | 'sales_order_id'
  | 'production_order_id'
  | 'purchase_order_id'
  | 'sample_id'

export const filesRepo = {
  async insert(row: {
    bucket: FileBucket
    path: string
    filename: string
    mime_type: string
    size_bytes: number
    owner_id: string
    doc_type?: string | null
    parent: FileParentColumns
  }): Promise<FileRow> {
    const { data, error } = await db()
      .from('files')
      .insert({
        bucket: row.bucket,
        path: row.path,
        filename: row.filename,
        mime_type: row.mime_type,
        size_bytes: row.size_bytes,
        owner_id: row.owner_id,
        doc_type: row.doc_type ?? null,
        ...row.parent,
      })
      .select('*')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'files insert failed')
    return data as FileRow
  },

  async getById(id: string): Promise<FileRow | null> {
    const { data } = await db()
      .from('files')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
    return (data as FileRow | null) ?? null
  },

  /** Nhiều file 1 query — cho batch signed URL (thư viện SP nạp N ảnh/lần tải). */
  async getByIds(ids: string[]): Promise<FileRow[]> {
    if (ids.length === 0) return []
    const { data } = await db()
      .from('files')
      .select('*')
      .in('id', ids)
      .is('deleted_at', null)
    return (data ?? []) as FileRow[]
  },

  /** File đã finalize của 1 SP, mới nhất trước — nhiều file cùng parent = lịch sử phiên bản (NFR-03 GĐ1). */
  async listByProduct(productId: string): Promise<FileRow[]> {
    return this.listByParent('product_id', productId)
  },

  /**
   * Cờ "SP đã có bản vẽ / BOM" suy từ FILE ĐÃ UPLOAD (0059) — thay cho 2 cột link
   * `drawing_url`/`bom_url` cũ. Chỉ lấy (product_id, doc_type) nên payload rất nhẹ.
   * `productIds` rỗng = lấy toàn bộ (dùng cho StatsBar trang chủ; tập drawing/bom nhỏ).
   */
  async productDocFlags(
    productIds?: string[],
  ): Promise<{ product_id: string; doc_type: string }[]> {
    if (productIds && productIds.length === 0) return []
    let q = db()
      .from('files')
      .select('product_id, doc_type')
      .in('doc_type', ['drawing', 'bom'])
      .is('deleted_at', null)
      .not('product_id', 'is', null)
    if (productIds) q = q.in('product_id', productIds)
    const { data } = await q.limit(5000)
    return (data ?? []) as { product_id: string; doc_type: string }[]
  },

  /** File gốc đã finalize theo 1 parent chứng từ (product/quote/order/LSX). */
  async listByParent(column: FileParentColumn, id: string): Promise<FileRow[]> {
    const { data } = await db()
      .from('files')
      .select('*')
      .eq(column, id)
      .is('deleted_at', null)
      .not('finalized_at', 'is', null)
      .order('created_at', { ascending: false })
    return (data ?? []) as FileRow[]
  },

  /** `sizeBytes` = số đo thật từ Storage, ghi đè số client khai lúc initUpload. */
  async markFinalized(
    id: string,
    checksum: string | null,
    sizeBytes?: number,
  ): Promise<void> {
    const { error } = await db()
      .from('files')
      .update({
        finalized_at: new Date().toISOString(),
        checksum,
        ...(sizeBytes === undefined ? {} : { size_bytes: sizeBytes }),
      })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  async softDelete(id: string): Promise<void> {
    const { error } = await db()
      .from('files')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },
}
