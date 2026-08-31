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
  /**
   * Bản ĐANG DÙNG của (product_id, doc_type) — 0181. Chỉ có nghĩa với file gắn
   * SP. Duy nhất được ép bằng UNIQUE index có điều kiện dưới DB, không phải do
   * tầng ứng dụng tự giữ.
   */
  is_current: boolean
  /** Ký hiệu phiên bản người dùng gõ ("Rev 3", "v2.1") — text tự do, xem 0181. */
  rev: string | null
  /** Ghi chú ngắn cho riêng file này. */
  note: string | null
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

  /** Ghi chú + ký hiệu phiên bản của một file (0181). Chuỗi rỗng → null. */
  async updateMeta(
    id: string,
    patch: { rev?: string | null; note?: string | null },
  ): Promise<FileRow> {
    const { data, error } = await db()
      .from('files')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'files updateMeta failed')
    return data as FileRow
  },

  /**
   * Đánh dấu BẢN ĐANG DÙNG cho (product_id, doc_type) — hạ cờ ở các file cùng
   * nhóm TRƯỚC rồi mới nâng, vì DB có UNIQUE index chỉ cho phép một bản. Làm
   * ngược thứ tự là đụng ràng buộc ngay ở lệnh đầu.
   *
   * Không chạy trong transaction: supabase-js không mở được transaction từ
   * client. Rủi ro thật là lỡ hạ xong mà lệnh nâng hỏng thì nhóm đó tạm thời
   * KHÔNG có bản nào được đánh dấu — mất một cái nhãn, không mất file, và người
   * dùng bấm lại là xong. Đổi lại nếu làm ngược thì luôn đụng UNIQUE.
   */
  async setCurrent(
    file: Pick<FileRow, 'id' | 'product_id' | 'doc_type'>,
    isCurrent: boolean,
  ): Promise<void> {
    if (isCurrent && file.product_id && file.doc_type) {
      const { error: clearErr } = await db()
        .from('files')
        .update({ is_current: false })
        .eq('product_id', file.product_id)
        .eq('doc_type', file.doc_type)
        .eq('is_current', true)
      if (clearErr) throw new Error(clearErr.message)
    }
    const { error } = await db()
      .from('files')
      .update({ is_current: isCurrent })
      .eq('id', file.id)
    if (error) throw new Error(error.message)
  },
}
