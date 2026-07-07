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
  created_at: string
  finalized_at: string | null
  deleted_at: string | null
}

export type FileParentColumns = {
  task_id?: string | null
  comment_id?: string | null
  customer_id?: string | null
  invoice_id?: string | null
  product_id?: string | null
}

export const filesRepo = {
  async insert(row: {
    bucket: FileBucket
    path: string
    filename: string
    mime_type: string
    size_bytes: number
    owner_id: string
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

  /** File đã finalize của 1 SP, mới nhất trước — nhiều file cùng parent = lịch sử phiên bản (NFR-03 GĐ1). */
  async listByProduct(productId: string): Promise<FileRow[]> {
    const { data } = await db()
      .from('files')
      .select('*')
      .eq('product_id', productId)
      .is('deleted_at', null)
      .not('finalized_at', 'is', null)
      .order('created_at', { ascending: false })
    return (data ?? []) as FileRow[]
  },

  async markFinalized(id: string, checksum: string | null): Promise<void> {
    const { error } = await db()
      .from('files')
      .update({ finalized_at: new Date().toISOString(), checksum })
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
