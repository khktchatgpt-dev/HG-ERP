'use client'

import { HeadField, TextInput } from '@/components/kit'
import { chuanMucDich } from '@/lib/po-muc-dich'
import type { PoHeader } from '@/app/(mua-hang)/mua-hang/don/_lib/po-draft'

/**
 * HAI Ô CỦA ĐƠN NGOÀI LỆNH (0229, 11/10/2026) — đứng đúng chỗ ô "Lệnh" khi đơn
 * không theo lệnh: ô lệnh xám "ngoài lệnh" không nói được đơn mua cho việc gì.
 *
 * "Mục đích" gõ tự do kèm gợi ý (loại đã dùng nhiều trước, rồi loại mồi) —
 * chủ dự án: "rất nhiều loại ngoài lsx", nên không khoá vào danh sách cố định.
 * Bắt buộc ở cửa gửi duyệt (bảng kiểm + server), không chặn lưu nháp.
 */
export function OMucDich({
  header,
  setHeader,
  goiY,
}: {
  header: Pick<PoHeader, 'mucDich' | 'mucDichRef'>
  setHeader: (f: (h: PoHeader) => PoHeader) => void
  goiY: readonly string[]
}) {
  return (
    <>
      <HeadField label="Mục đích" need empty={!header.mucDich.trim()} width={200}>
        <TextInput
          label="Mục đích đơn ngoài lệnh"
          list="po-muc-dich-goi-y"
          value={header.mucDich}
          placeholder="vd. Khuôn mẫu, Dự trữ kho…"
          onCommit={(v) => setHeader((h) => ({ ...h, mucDich: chuanMucDich(v) ?? '' }))}
        />
        <datalist id="po-muc-dich-goi-y">
          {goiY.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
      </HeadField>
      <HeadField label="Cho ai / việc gì" width={200}>
        <TextInput
          label="Ghi rõ cho ai, việc gì"
          value={header.mucDichRef}
          placeholder="vd. PHIPPS, mã khuôn, lệnh cũ…"
          onCommit={(v) =>
            setHeader((h) => ({ ...h, mucDichRef: v.replace(/\s+/g, ' ').trim() }))
          }
        />
      </HeadField>
    </>
  )
}
