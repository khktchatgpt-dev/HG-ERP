'use client'

/**
 * Kiểu, hằng và ô nhỏ dùng chung giữa các file của khu Thư viện sản phẩm.
 * Trình bày theo CSS của artboard (`thu-vien.css`, phạm vi `.tv`), không kit.
 */

import { FRAME_MATERIALS, PRODUCT_TYPES } from '@/lib/product-code'
import {
  HO_SO_LABEL,
  HO_SO_O,
  HO_SO_TEN,
  type HoSoCheck,
  type ThieuFilter,
} from '@/lib/ho-so-sp'
import type {
  LibraryChild,
  LibraryCounts,
  LibraryRow,
} from '@/modules/dept/technical/library.service'

export type { LibraryChild, LibraryCounts, LibraryRow }
export { PAGE_SIZE, XEM_KEY } from './thu-vien.const'

export type ThuVienFilters = {
  q: string
  kh: string
  loai: string
  khung: string
  thieu: '' | ThieuFilter
  kt: boolean
  tt: 'active' | 'inactive' | 'all'
  lenh: boolean
  mau: boolean
  gia: boolean
}

export const LOAI_LABEL: Record<string, string> = Object.fromEntries(
  PRODUCT_TYPES.map((t) => [t.code, t.label]),
)
export const KHUNG_LABEL: Record<string, string> = Object.fromEntries(
  FRAME_MATERIALS.map((m) => [m.code, m.label]),
)

/** `1500×900×740` — hoặc chuỗi rỗng khi thiếu bất kỳ chiều nào. */
export function fmtKt(l: number | null, w: number | null, h: number | null): string {
  if (!l || !w || !h) return ''
  const n = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 0 })
  return `${n(l)}×${n(w)}×${n(h)}`
}

export function fmtKg(v: number | null): string {
  if (v == null || v <= 0) return ''
  return v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })
}

export function fmtGia(v: number | null, cur: string | null): string {
  if (v == null) return ''
  const n = v.toLocaleString('vi-VN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
  return cur === 'USD' ? `${n} $` : cur ? `${n} ${cur}` : n
}

/** CHECKLIST HỒ SƠ — 6 ô (BOM · BV · Ảnh · ĐG · XC · Mẫu) đúng hình của artboard. */
export function OHoSo({ check, wide = false }: { check: HoSoCheck; wide?: boolean }) {
  return (
    <span className={wide ? 'ck wide' : 'ck'}>
      {HO_SO_O.map((o) => {
        const st = check[o]
        return (
          <span
            key={o}
            className={st === 'thieu' ? 'no' : st === 'khong_ap_dung' ? 'na' : undefined}
            title={`${HO_SO_TEN[o]}: ${st === 'co' ? 'có' : st === 'thieu' ? 'THIẾU' : 'không áp dụng'}`}
          >
            {HO_SO_LABEL[o]}
          </span>
        )
      })}
    </span>
  )
}

/** Nhãn cột "Định mức": trạng thái vẽ + số dòng. Không tô đỏ SP không cần BOM. */
export function TagDinhMuc({
  status,
  parts,
  check,
}: {
  status: LibraryRow['bom_status']
  parts: number
  check: HoSoCheck
}) {
  if (check.bom === 'khong_ap_dung') return <span className="tag">Không cần</span>
  if (parts === 0) return <span className="tag stop">Chưa có</span>
  const n = `${parts.toLocaleString('vi-VN')} dòng`
  if (status === 'done') return <span className="tag done">Đã vẽ · {n}</span>
  if (status === 'drawing') return <span className="tag warn">Đang vẽ · {n}</span>
  return <span className="tag">{n}</span>
}

/** Ô ảnh thu nhỏ 26px trong bảng; không ảnh thì ô kẻ chéo. */
export function AnhNho({ url, alt }: { url: string | null; alt: string }) {
  if (!url)
    return (
      <span
        className="thumb none"
        title="Chưa có ảnh đại diện"
        aria-label="Chưa có ảnh"
      />
    )
  // eslint-disable-next-line @next/next/no-img-element -- ảnh qua /api/files/[id]/img đã tối ưu + cache
  return <img src={url} alt={alt} loading="lazy" className="thumb" />
}
