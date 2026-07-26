'use client'

import { useState } from 'react'
import { ProductSectionForm } from './ProductSectionForm'
import { SECTIONS, withSuggest, type ProductView } from './product-sections'

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
) {
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const pk = product.packing ?? {}
  const ts = product.tech_spec ?? {}

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
        section={withSuggest(section, suggestions)}
        productId={product.id}
        values={{
          ...(product as unknown as Record<string, string | number | boolean | null>),
          ...pk,
          ...ts,
        }}
        currentPacking={pk as Record<string, unknown>}
        currentTechSpec={ts as Record<string, unknown>}
        onClose={close}
      />
    )
  }

  return { editingKey, editHandler, node, close }
}
