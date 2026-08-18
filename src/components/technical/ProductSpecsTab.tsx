'use client'

import { Factory, Layers, Palette, Ruler, ShieldCheck, Tags } from 'lucide-react'
import Link from 'next/link'
import { SpecSection } from '@/components/technical/ProductSpecCards'
import { useSectionEditor } from '@/components/technical/useSectionEditor'
import {
  cartonCbm,
  dec,
  num,
  withPackingFallback,
  type ProductView,
} from '@/components/technical/product-sections'
import type { PackingOptionView } from '@/components/technical/ProductProfileCards'
import { FRAME_MATERIALS } from '@/lib/product-code'

/**
 * Tab THÔNG SỐ KỸ THUẬT — MỘT trang trả lời trọn "sản phẩm này là cái gì".
 *
 * Gộp lại theo yêu cầu user (13/08/2026: "thông số kỹ thuật hiện tại tôi thấy
 * tách ra, nên gộp lại trong trang thông số kỹ thuật") và theo đúng ba khu mục 5
 * của tài liệu:
 *
 *   1. Kích thước & khối lượng — trước nằm trong phần "Đóng gói xuất khẩu" ở tab
 *      Đóng gói, lẫn với số của THÙNG. Nay số của SẢN PHẨM về đây, tab Đóng gói
 *      chỉ còn carton / xếp cont.
 *   2. Vật liệu & màu — trước `material` ở thẻ "Đặc tính", còn gỗ/sơn/kính/nệm ở
 *      thẻ "Thông số sản xuất": cùng câu hỏi mà phải mở hai thẻ.
 *   3. Đặc tính + thông số SX + kiểm soát tài liệu ISO — giữ nguyên nghĩa.
 *
 * CBM / carton vẫn hiện ở đây nhưng CHỈ ĐỌC kèm link: nó là số dẫn xuất của
 * đóng gói, sửa ở tab Đóng gói — bày ô sửa ở hai nơi là mời ghi đè lẫn nhau.
 */
export function ProductSpecsTab({
  product,
  packingOptions,
  ownerName,
  suggestions,
  canEdit,
}: {
  product: ProductView
  packingOptions: PackingOptionView[]
  /** Tên người phụ trách hồ sơ — cho khối "Hồ sơ" thay khối ISO đã bỏ. */
  ownerName: string | null
  suggestions: Record<string, string[]>
  canEdit: boolean
}) {
  const { editHandler, node } = useSectionEditor(product, suggestions, canEdit)
  const ts = product.tech_spec ?? {}
  const pk = withPackingFallback(product.packing ?? {}, packingOptions)
  const cbm = cartonCbm(pk)
  const base = `/products/${product.id}`

  /** "1200 × 600 × 750" — bộ gấp; bộ MỞ hiện thành dòng riêng nếu có. */
  const dimText = (l?: number | null, w?: number | null, h?: number | null) =>
    l != null || w != null || h != null
      ? `${num(l) ?? '?'} × ${num(w) ?? '?'} × ${num(h) ?? '?'} mm`
      : null

  return (
    <div className="flex flex-col gap-6 pb-6">
      {/* ── 1. KÍCH THƯỚC & KHỐI LƯỢNG ─────────────────────────────────── */}
      <SpecSection
        icon={Ruler}
        tone="sky"
        title="Kích thước & khối lượng"
        hint="số của sản phẩm — mm / kg"
        fields={[
          // Bộ MỞ + độ dày ĐÃ BỎ (user chốt 18/08/2026) — KTSP chỉ còn một bộ
          // số gấp; khối "Số liệu từ định mức" cũng bỏ, xem thẳng ở tab Định mức.
          [
            'Kích thước (D × R × C)',
            dimText(product.length_mm, product.width_mm, product.height_mm),
          ],
          [
            'Khối lượng tịnh',
            dec(product.net_weight_kg, 3) && `${dec(product.net_weight_kg, 3)} kg`,
          ],
          [
            'KL cân thực tế',
            dec(product.actual_weight_kg, 3) && `${dec(product.actual_weight_kg, 3)} kg`,
          ],
        ]}
        onEdit={editHandler('dims')}
        editing={node('dims')}
      />

      {/* CBM & thùng — dẫn xuất từ đóng gói, để đây cho đủ mục 5 nhưng chỉ đọc. */}
      <SpecSection
        icon={Layers}
        tone="amber"
        title="Thể tích & thùng"
        hint="dẫn từ khối Đóng gói ở tab Hồ sơ"
        fields={[
          ['CBM / thùng', cbm != null ? `${cbm.toFixed(3)} m³` : null],
          ['SP / thùng', num(pk.qty_per_carton)],
          ['NW / thùng', dec(pk.nw_kg, 2) && `${dec(pk.nw_kg, 2)} kg`],
          ['GW / thùng', dec(pk.gw_kg, 2) && `${dec(pk.gw_kg, 2)} kg`],
        ]}
        moreHref={base}
      />

      {/* ── 2. VẬT LIỆU & MÀU ──────────────────────────────────────────── */}
      <SpecSection
        icon={Palette}
        tone="violet"
        title="Vật liệu & màu"
        hint="catalogue / LSX"
        fields={[
          ['Chất liệu chính', product.material],
          // Kim loại khung SUY TỪ MÃ SP, không có ô nhập — 529/537 SP có.
          [
            'Loại kim loại (khung)',
            product.frame_material
              ? (FRAME_MATERIALS.find((m) => m.code === product.frame_material)?.label ??
                product.frame_material)
              : null,
          ],
          ['Loại gỗ', ts.wood],
          ['Sơn (mã màu)', ts.paint],
          ['Vải', ts.fabric],
          ['Kính', ts.glass],
          ['Nệm / mút', ts.cushion],
          ['Phụ kiện (ngũ kim)', ts.hardware],
          ['Màu hoàn thiện (finish)', ts.finish],
          ['Có nệm / bọc', product.is_upholstered ? 'Có' : 'Không'],
          ['Có kính', product.has_glass ? 'Có' : 'Không'],
        ]}
        onEdit={editHandler('materials')}
        editing={node('materials')}
      />

      {/* ── 3. Đặc tính + sản xuất ─────────────────────────────────────── */}
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <SpecSection
          icon={Tags}
          tone="violet"
          title="Đặc tính sản phẩm"
          hint="catalogue / báo giá"
          fields={[
            ['Tải trọng tối đa', num(product.max_load_kg, ' kg')],
            [
              'Lắp ráp',
              product.assembly === 'kd'
                ? 'Tháo rời (KD)'
                : product.assembly === 'assembled'
                  ? 'Nguyên chiếc'
                  : null,
            ],
            ['Bộ gồm', product.set_contents],
            ['Là bộ nhiều món', product.is_set ? 'Có' : 'Không'],
          ]}
          onEdit={editHandler('export')}
          editing={node('export')}
        />

        <SpecSection
          icon={Factory}
          tone="emerald"
          title="Thông số sản xuất"
          hint="in trên LSX"
          fields={[
            ['Máy', ts.machine],
            ['Mẫu showroom', product.showroom_sample ? 'Có' : 'Không'],
          ]}
          onEdit={editHandler('techSpec')}
          editing={node('techSpec')}
        />
      </div>

      <p className="text-muted-foreground text-xs">
        Định mức vật tư chi tiết (từng chi tiết, mã vật tư, số lượng) nằm ở{' '}
        <Link href={`${base}/dinh-muc`} className="text-primary hover:underline">
          tab Định mức
        </Link>
        .
      </p>

      {/*
       * Khối ISO (Rev./hiệu lực/chữ ký) ĐÃ BỎ 18/08/2026 theo yêu cầu user —
       * app không chép chữ ký giấy; hồ sơ chỉ ghi nhận NGƯỜI PHỤ TRÁCH (đặt theo
       * phiên đăng nhập lúc tạo, sửa được ở tab Hồ sơ) và ngày tạo hệ thống.
       */}
      <SpecSection
        icon={ShieldCheck}
        tone="slate"
        title="Hồ sơ"
        hint="hệ thống tự ghi nhận"
        fields={[
          ['Người phụ trách', ownerName],
          ['Ngày tạo', new Date(product.created_at).toLocaleDateString('vi-VN')],
        ]}
      />
    </div>
  )
}
