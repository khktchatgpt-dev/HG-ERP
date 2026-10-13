import { useState } from 'react'
import type { PoTemplate } from '@/lib/po-template'

/**
 * ĐƠN MỚI PHẢI TỰ CHỌN MẪU trước khi thêm dòng (12/10/2026, phòng Cung ứng).
 *
 * Bản 29/09 tự đổi mẫu theo NHÓM của vật tư đầu tiên, còn chọn NCC thì đổi theo
 * đơn gần nhất của NCC. Cả hai đoán sai ở chỗ một nhóm / một NCC có nhiều loại
 * hàng: nhóm "Bao bì - đóng gói - tem nhãn" gán carton nên đơn tem nhãn mở ra cột
 * Cách mở / Lọt lòng; Hiệp Hưng giao cả thùng lẫn tem. Nay thanh lưới bày ô chọn
 * mẫu tại chỗ (`thanh-luoi.tsx`), còn `chuaChonMau` là chốt chặn cho MỌI đường
 * thêm dòng (ô tìm, dán Excel, dòng tự do, nhu cầu lệnh, mồi từ URL).
 *
 * Đơn đã lưu / nhân bản từ đơn nguồn / khôi phục nháp coi như đã chọn.
 */
export function useChonMau(i: {
  daChon: boolean
  template: PoTemplate
  changeTemplate: (t: PoTemplate) => void
  markDirty: () => void
  bao: () => void
  supplierId: string
  lastTemplates?: Readonly<Record<string, PoTemplate>>
}) {
  const [mauDaChon, setMauDaChon] = useState(i.daChon)
  const chuaChonMau = (): boolean => {
    if (mauDaChon) return false
    i.bao()
    return true
  }
  const chonMau = (t: PoTemplate) => {
    i.markDirty()
    setMauDaChon(true)
    if (t !== i.template) i.changeTemplate(t)
  }
  // Mẫu NCC này hay dùng — chỉ GỢI Ý (đứng đầu danh sách chọn), không tự áp.
  const mauGoiY: PoTemplate | null =
    (i.supplierId && i.lastTemplates?.[i.supplierId]) || null
  return { mauDaChon, setMauDaChon, chuaChonMau, chonMau, mauGoiY } as const
}
