'use client'

import { useState } from 'react'
import { Consequence, Sheet, SheetActions, TextArea } from '@/components/kit'
import type { BangLuongCtx } from './useBangLuong'
import { kyVn, so, tong } from './bang-luong.shared'

/** Bốn hộp xác nhận: gửi duyệt · duyệt / trả lại · rút bảng đã duyệt về nháp · đã chi. */
export function HopBangLuong({ d }: { d: BangLuongCtx }) {
  const { b } = d
  const [lyDo, setLyDo] = useState('')
  const tl = so(tong(b.phieu, (p) => p.thucLinh))
  const dong = () => {
    d.setHop(null)
    setLyDo('')
  }
  return (
    <>
      <Sheet
        open={d.hop === 'gui'}
        onClose={dong}
        title={`Gửi bảng lương kỳ ${kyVn(b.thang)} cho sếp duyệt?`}
        subtitle={`${b.phieu.length} người · thực lĩnh ${tl} đ`}
        stakes="vua"
        footer={
          <SheetActions
            stakes="vua"
            onCancel={dong}
            onConfirm={() => d.gui(lyDo)}
            confirmLabel="Gửi duyệt"
            cancelLabel="Để sau"
            busy={d.busy === 'gui'}
          />
        }
      >
        <label className="text-k-sm mb-1 block font-semibold" htmlFor="bl-ghi-gui">
          Ghi chú cho sếp (không bắt buộc)
        </label>
        <TextArea
          id="bl-ghi-gui"
          aria-label="Ghi chú cho sếp"
          value={lyDo}
          onChange={setLyDo}
          rows={3}
        />
        <Consequence>
          Sếp được báo và chỉ thấy tổng theo bộ phận (không thấy lương từng người). Bảng
          khoá sửa tới khi sếp duyệt hoặc trả lại; muốn sửa trước đó thì Rút về nháp.
        </Consequence>
      </Sheet>

      <Sheet
        open={d.hop === 'quyet'}
        onClose={dong}
        title={`Duyệt bảng lương kỳ ${kyVn(b.thang)}?`}
        subtitle={`${b.phieu.length} người · thực lĩnh ${tl} đ · ${b.bang?.guiBoi ?? '—'} gửi`}
        stakes="vua"
        footer={
          <SheetActions
            stakes="vua"
            onCancel={() => lyDo.trim() && d.quyet(false, lyDo.trim())}
            onConfirm={() => d.quyet(true, lyDo.trim() || undefined)}
            confirmLabel="Duyệt bảng lương"
            cancelLabel="Trả lại (cần lý do)"
            busy={d.busy === 'quyet'}
          />
        }
      >
        <label className="text-k-sm mb-1 block font-semibold" htmlFor="bl-ly-do">
          Lý do trả lại / ghi chú
        </label>
        <TextArea
          id="bl-ly-do"
          aria-label="Lý do trả lại"
          value={lyDo}
          onChange={setLyDo}
          rows={3}
        />
        <Consequence>
          Duyệt: Kế toán chuyển khoản rồi đánh dấu đã chi. Trả lại: bảng về nháp kèm lý
          do.
        </Consequence>
      </Sheet>

      <Sheet
        open={d.hop === 'mo_lai'}
        onClose={dong}
        title="Rút bảng đã duyệt về nháp?"
        subtitle="Chỉ khi chưa chuyển khoản"
        stakes="nang"
        footer={
          <SheetActions
            stakes="nang"
            onCancel={dong}
            onConfirm={() => lyDo.trim().length >= 5 && d.moLai(lyDo.trim())}
            confirmLabel="Rút về nháp"
            cancelLabel="Giữ nguyên"
            busy={d.busy === 'mo_lai'}
          />
        }
      >
        <label className="text-k-sm mb-1 block font-semibold" htmlFor="bl-mo-lai">
          Lý do (bắt buộc)
        </label>
        <TextArea
          id="bl-mo-lai"
          aria-label="Lý do rút về nháp"
          value={lyDo}
          onChange={setLyDo}
          rows={3}
        />
        <Consequence>Mất duyệt của Giám đốc — sửa xong phải gửi duyệt lại.</Consequence>
      </Sheet>

      <Sheet
        open={d.hop === 'chi'}
        onClose={dong}
        title={`Đánh dấu đã chi lương kỳ ${kyVn(b.thang)}?`}
        subtitle={`${b.phieu.filter((p) => p.thucLinh > 0).length} người · ${tl} đ`}
        stakes="nang"
        footer={
          <SheetActions
            stakes="nang"
            onCancel={dong}
            onConfirm={d.chi}
            confirmLabel="Đã chi"
            cancelLabel="Chưa"
            busy={d.busy === 'chi'}
          />
        }
      >
        <Consequence>
          Sau bước này bảng lương và kỳ công không mở lại được nữa; sai sót ghi khoản Truy
          lĩnh / Truy thu ở kỳ sau.
        </Consequence>
      </Sheet>
    </>
  )
}
