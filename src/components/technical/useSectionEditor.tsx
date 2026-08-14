'use client'

import { useState } from 'react'
import { ProductSectionForm } from './ProductSectionForm'
import {
  SECTIONS,
  categoryOptions,
  ownerOptions,
  unitOptions,
  withSuggest,
  type ProductView,
} from './product-sections'

/** Danh mục SP đang hiệu lực (từ `catalog_items` loại `product_category`). */
export type CategoryOption = { code: string; label: string }

/** Nhân sự chọn được làm người phụ trách hồ sơ (0144). */
export type OwnerOption = { id: string; name: string }

/**
 * Lối sửa từng phần hồ sơ, dùng chung cho cả 4 tab. Form hiện NGAY TRONG thẻ
 * của phần đó (`SpecSection`/`TextCard` nhận qua prop `editing`), không phải hộp
 * thoại đè lên trang.
 *
 * Mỗi lúc chỉ mở một phần: đang sửa phần này mà bấm Sửa phần khác thì phần cũ
 * đóng lại — tránh hai form dở dang cùng lúc, người dùng không biết cái nào đã lưu.
 *
 * Tab nào cũng chỉ cần `editHandler('<key>')` cho nút Sửa và `node('<key>')`
 * cho thân thẻ. Phần khó nằm ở việc dựng `values`: jsonb `packing`/`tech_spec`
 * phải trải phẳng ra mới khớp tên ô trong form.
 */
export function useSectionEditor(
  product: ProductView,
  suggestions: Record<string, string[]>,
  canEdit: boolean,
  /** Chỉ tab "Hồ sơ" cần (ô Danh mục nằm ở phần Nhận diện). */
  categories: CategoryOption[] = [],
  /** Cũng chỉ tab "Hồ sơ" cần — ô Người phụ trách nằm cùng phần Nhận diện. */
  owners: OwnerOption[] = [],
  /**
   * Quy cách đóng gói ĐÃ BÙ từ phương án mặc định. Ô trống lấy số này làm gợi ý
   * xám thay vì để trắng — thẻ bên ngoài đang hiện số đó, mở form ra thấy trắng
   * thì người dùng gõ lại bằng trí nhớ và lệch với phương án.
   */
  packingFallback: Record<string, unknown> = {},
) {
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const pk = product.packing ?? {}
  const ts = product.tech_spec ?? {}

  /** Chỉ gợi ý cho ô CHƯA có giá trị riêng trên hồ sơ. */
  const fallbackPlaceholders: Record<string, string> = {}
  for (const [k, v] of Object.entries(packingFallback)) {
    if (v != null && (pk as Record<string, unknown>)[k] == null) {
      fallbackPlaceholders[k] = String(v)
    }
  }

  const close = () => setEditingKey(null)

  /** Trả undefined khi không có quyền — thẻ tự ẩn nút Sửa. */
  const editHandler = (key: string) => (canEdit ? () => setEditingKey(key) : undefined)

  /** Thân form của phần `key`, hoặc null nếu phần đó không đang mở. */
  function node(key: string) {
    if (editingKey !== key) return null
    const section = SECTIONS[key]
    if (!section) return null
    return (
      <ProductSectionForm
        section={withSuggest(section, suggestions, {
          // ComboField tự lo dòng "bỏ trống" nên bỏ mục rỗng khỏi danh sách.
          category: categoryOptions(categories, product.category).filter((o) => o.value),
          customer_name: (suggestions.customer_name ?? []).map((n) => ({
            value: n,
            label: n,
          })),
          owner_id: ownerOptions(owners, product.owner_id).filter((o) => o.value),
          unit: unitOptions(product.unit),
        })}
        productId={product.id}
        values={{
          ...(product as unknown as Record<string, string | number | boolean | null>),
          ...pk,
          ...ts,
        }}
        placeholders={fallbackPlaceholders}
        currentPacking={pk as Record<string, unknown>}
        currentTechSpec={ts as Record<string, unknown>}
        onClose={close}
      />
    )
  }

  return { editingKey, editHandler, node, close }
}
