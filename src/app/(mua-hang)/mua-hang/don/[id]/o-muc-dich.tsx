'use client'

import {
  Combobox,
  GridBtn,
  HeadField,
  TextInput,
  type ComboOption,
} from '@/components/kit'
import { chuanMucDich } from '@/lib/po-muc-dich'
import type { PoHeader } from '@/app/(mua-hang)/mua-hang/don/_lib/po-draft'

/** Giá trị riêng của dòng "Ngoài lệnh" trong ô chọn lệnh — không trùng id lệnh nào. */
const NGOAI = '@ngoai'

/**
 * Ô ĐẦU TIÊN CỦA ĐẦU ĐƠN: chọn lệnh, HOẶC (đơn ngoài lệnh) hai ô mục đích (0229).
 *
 * Ngoài lệnh từng chỉ bật được bằng ô "Loại đơn" giấu sau nút "VND · VAT 8% ▾"
 * — đo 11/10 trên màn soạn: không gì trên mặt màn nói ra lối đó. Nay "Ngoài
 * lệnh" là dòng cuối của chính ô chọn lệnh; chọn xong ô lệnh nhường chỗ cho:
 *
 *  - "Mục đích": gõ tự do kèm gợi ý (loại đã dùng nhiều trước, rồi loại mồi) —
 *    chủ dự án: "rất nhiều loại ngoài lsx", nên không khoá vào danh sách cố định.
 *    Bắt buộc ở cửa gửi duyệt (bảng kiểm + server), không chặn lưu nháp.
 *  - "Cho ai / việc gì": tên khách, mã khuôn, lệnh cũ…
 *
 * Chỉ ĐƠN MỚI đổi qua lại được: sửa nháp thì server giữ nguyên lệnh chính của
 * đơn (pos.service `update`), cho đổi trên màn là đổi giả.
 */
export function OLenhHoacMucDich({
  header,
  setHeader,
  goiY,
  lsxOptions,
  doiDuoc,
}: {
  header: Pick<PoHeader, 'poType' | 'lsxId' | 'mucDich' | 'mucDichRef'>
  setHeader: (f: (h: PoHeader) => PoHeader) => void
  goiY: readonly string[]
  lsxOptions: ComboOption[]
  /** Đơn mới — được chuyển giữa theo lệnh / ngoài lệnh. */
  doiDuoc: boolean
}) {
  if (header.poType === 'lsx')
    return (
      <HeadField label="Lệnh" need empty={!header.lsxId} width={150}>
        <Combobox
          label="Lệnh sản xuất"
          value={header.lsxId}
          onChange={
            (v) =>
            setHeader((h) => (v === NGOAI ? { ...h, poType: 'standalone', lsxId: '', extraLsxIds: [] } : { ...h, lsxId: v })) // prettier-ignore
          }
          emptyLabel="— chọn lệnh —"
          placeholder="Gõ số lệnh hoặc tên khách…"
          options={doiDuoc ? [...lsxOptions, { value: NGOAI, label: 'Ngoài lệnh', hint: 'mua không theo lệnh SX' }] : lsxOptions} // prettier-ignore
        />
      </HeadField>
    )
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
      {doiDuoc && (
        <GridBtn
          title="Đơn này mua theo một lệnh sản xuất"
          onClick={() => setHeader((h) => ({ ...h, poType: 'lsx' }))}
        >
          ↩ Theo lệnh
        </GridBtn>
      )}
    </>
  )
}
