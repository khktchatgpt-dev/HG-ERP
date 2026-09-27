'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Empty,
  Grid,
  GridBody,
  GridBtn,
  GridHead,
  GridRow,
  Pick,
  Tag,
  Td,
  Th,
  useToast,
} from '@/components/kit'
import { FileUploader } from '@/components/FileUploader'
import { api, apiErrorText } from '@/lib/api'
import { DOC_TYPE_LABEL, PO_DOC_TYPES, type DocType } from '@/lib/file-limits'

/**
 * CHỨNG TỪ NCC CỦA ĐƠN MUA (0213) — báo giá, xác nhận đơn, hợp đồng, phiếu giao,
 * hoá đơn, CO/CQ. Trước đây một ô "File đính kèm" chung không phân loại: đơn
 * có 6 file thì phải mở từng cái mới biết đâu là phiếu giao đợt 2.
 *
 * Chọn loại TRƯỚC khi tải (mặc định "Báo giá NCC"); danh sách xếp theo đời đơn.
 * Xoá vẫn qua đúng route cũ (`/api/files/[id]`).
 */
type DocFile = {
  id: string
  filename: string
  size_bytes: number
  created_at: string
  doc_type: string | null
  owner_name: string | null
}

const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`) // prettier-ignore
const order = (t: string | null) => {
  const i = (PO_DOC_TYPES as readonly string[]).indexOf(t ?? 'other')
  return i < 0 ? 99 : i
}

export function PoDocuments({ poId, canEdit }: { poId: string; canEdit: boolean }) {
  const toast = useToast()
  const [files, setFiles] = useState<DocFile[] | null>(null)
  const [type, setType] = useState<DocType>('quote')

  const load = useCallback(async () => {
    try {
      const r = await api<{ files: DocFile[] }>(`/api/files?purchase_order_id=${poId}`)
      setFiles(r.files)
    } catch {
      setFiles([])
    }
  }, [poId])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() đặt state trong callback đã resolve
  useEffect(() => void load(), [load])

  async function download(f: DocFile) {
    try {
      const { url } = await api<{ url: string }>(`/api/files/${f.id}?download=1`)
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      toast.error('Không tải được file', apiErrorText(e))
    }
  }
  async function remove(f: DocFile) {
    if (!window.confirm(`Gỡ "${f.filename}" khỏi đơn?`)) return
    try {
      await api(`/api/files/${f.id}`, { method: 'DELETE' })
      toast.success('Đã gỡ file', f.filename)
      void load()
    } catch (e) {
      toast.error('Gỡ file thất bại', apiErrorText(e))
    }
  }

  const sorted = [...(files ?? [])].sort((a, b) => order(a.doc_type) - order(b.doc_type) || a.created_at.localeCompare(b.created_at)) // prettier-ignore

  return (
    <>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 px-[var(--gutter)] py-2">
          <span className="text-k-sm text-[var(--ink-2)]">Loại chứng từ</span>
          <Pick
            label="Loại chứng từ tải lên"
            value={type}
            onChange={(v) => setType(v as DocType)}
            options={PO_DOC_TYPES.map((t) => ({ value: t, label: DOC_TYPE_LABEL[t] }))}
          />
          <FileUploader
            parent={{ kind: 'purchase_order', id: poId }}
            bucket="attachments"
            docType={type}
            label="+ Tải lên"
            onUploaded={() => void load()}
          />
        </div>
      )}
      {files == null ? null : sorted.length === 0 ? (
        <div className="px-[var(--gutter)] pb-3">
          <Empty
            headline="Chưa có chứng từ nào của đơn"
            reason="Báo giá, xác nhận đơn, hợp đồng, phiếu giao, hoá đơn, CO/CQ của NCC chưa được lưu."
            next="Chọn loại chứng từ rồi bấm “+ Tải lên”."
          />
        </div>
      ) : (
        <Grid minWidth={640}>
          <GridHead>
            <Th width={190}>Loại</Th>
            <Th>File</Th>
            <Th num width={80}>
              Cỡ
            </Th>
            <Th width={170}>Người tải · ngày</Th>
            {canEdit && <Th width={60} />}
          </GridHead>
          <GridBody>
            {sorted.map((f) => (
              <GridRow key={f.id}>
                <Td>
                  <Tag tone="neutral">
                    {f.doc_type
                      ? (DOC_TYPE_LABEL[f.doc_type as DocType] ?? f.doc_type)
                      : 'Chưa phân loại'}
                  </Tag>
                </Td>
                <Td>
                  <GridBtn onClick={() => void download(f)}>{f.filename}</GridBtn>
                </Td>
                <Td num>{size(f.size_bytes)}</Td>
                <Td>
                  {f.owner_name ?? '—'} ·{' '}
                  {new Date(f.created_at).toLocaleDateString('vi-VN')}
                </Td>
                {canEdit && (
                  <Td>
                    <GridBtn
                      aria-label={`Gỡ ${f.filename}`}
                      onClick={() => void remove(f)}
                    >
                      Gỡ
                    </GridBtn>
                  </Td>
                )}
              </GridRow>
            ))}
          </GridBody>
        </Grid>
      )}
    </>
  )
}
