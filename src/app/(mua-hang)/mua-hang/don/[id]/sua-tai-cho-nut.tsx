'use client'

import { Action, ActionGroup, Btn } from '@/components/kit'
import type { DonCtx } from './useDonChungTu'

/**
 * Hai nút Lưu / Thôi của chế độ SỬA TẠI CHỖ — hiện ở hai chỗ (cạnh mã đơn và ở
 * ActionPane bố cục cũ), cùng một luật khoá. Một nguồn cho cả hai.
 */
export function SuaTaiChoNut({ d, as = 'btn' }: { d: DonCtx; as?: 'btn' | 'action' }) {
  // "Thôi" đi qua `askCancelEdit`: có thay đổi (dòng, đợt, điều khoản) thì hỏi trước.
  const { busy, noteOver, saveTerms, askCancelEdit: cancelTermsEdit } = d
  const title =
    noteOver > 0 ? `Ghi chú dài hơn mức cho phép ${noteOver} ký tự` : undefined
  if (as === 'action') {
    return (
      <ActionGroup label="Đang sửa">
        <Action
          primary
          disabled={busy || noteOver > 0}
          title={title}
          onClick={() => void saveTerms()}
        >
          {' '}
          {/* prettier-ignore */}
          Lưu
        </Action>
        <Action icon="huy" disabled={busy} onClick={cancelTermsEdit}>
          Thôi
        </Action>
      </ActionGroup>
    )
  }
  return (
    <>
      <Btn
        primary
        icon="luuNhap"
        disabled={busy || noteOver > 0}
        title={title}
        onClick={() => void saveTerms()}
      >
        {' '}
        {/* prettier-ignore */}
        Lưu
      </Btn>
      <Btn icon="huy" disabled={busy} onClick={cancelTermsEdit}>
        Thôi
      </Btn>
    </>
  )
}
