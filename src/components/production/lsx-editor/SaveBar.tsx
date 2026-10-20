'use client'

import { Fragment } from 'react'
import { Save, SendHorizontal, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import { Spinner } from '@/components/erp/Spinner'

/**
 * THANH LƯU ghim đáy màn soạn dòng lệnh — tách khỏi LsxSheetEditor 07/10/2026
 * (trần dòng). Lý do chỉnh sửa chỉ hiện (và bắt buộc) khi lệnh đã duyệt: mỗi
 * lần lưu là bản phát lại cho xưởng.
 */
export function SaveBar({
  isDraft,
  published,
  dirty,
  note,
  setNote,
  totalQty,
  groupCount,
  busy,
  blocked,
  onSave,
  onSubmit,
  onJump,
}: {
  isDraft: boolean
  published: boolean
  dirty: boolean
  note: string
  setNote: (v: string) => void
  totalQty: number
  groupCount: number
  busy: boolean
  blocked: { groupTitle: string; index: number; issues: string }[]
  onSave: () => void
  onSubmit: () => void
  onJump: (groupTitle: string, index: number) => void
}) {
  return (
    <div className="bg-card/95 sticky bottom-0 z-10 -mx-1 rounded-t-xl border px-3 py-2.5 shadow-xs backdrop-blur">
      <div className="flex flex-wrap items-end gap-2">
        {/* Lệnh NHÁP chưa ai duyệt nên chưa có gì để "chỉnh sửa" — ô lý do
                chỉ có nghĩa với lệnh đã qua duyệt (0117). */}
        {isDraft ? (
          <span className="text-muted-foreground flex-1 text-xs">
            Lệnh đang là <b className="text-foreground">nháp</b> — sửa thoải mái, Giám đốc
            chưa nhận được gì. Soạn xong bấm “Gửi GĐ duyệt”.
          </span>
        ) : published ? (
          <label className="text-muted-foreground flex min-w-56 flex-1 flex-col gap-1 text-xs">
            Lý do chỉnh sửa * (lệnh đã duyệt — mỗi lần lưu là bản phát lại, xưởng in lại)
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Khách chốt lại số lượng SIGRID, thêm bộ IMANI"
              className="bg-background h-8 text-xs"
            />
          </label>
        ) : (
          <span className="text-muted-foreground flex-1 text-xs">
            Lệnh chưa qua duyệt — sửa không tính là bản phát lại.
          </span>
        )}
        {dirty && (
          <span className="text-xs text-[var(--warn)]">Có thay đổi chưa lưu</span>
        )}
        <span className="text-muted-foreground text-xs">
          {totalQty.toLocaleString('vi-VN')} SP · {groupCount} nhóm
        </span>
        {/* "Lưu" KHÔNG BAO GIỜ bị chặn — bản dở phải cất được. */}
        <Button
          variant="outline"
          onClick={onSave}
          disabled={busy || (published && dirty && !note.trim())}
          title={
            published && dirty && !note.trim()
              ? 'Ghi lý do chỉnh sửa rồi mới lưu'
              : undefined
          }
        >
          {busy ? <Spinner size={14} /> : <Save />}
          Lưu dòng lệnh
        </Button>
        {isDraft && (
          <Button
            onClick={onSubmit}
            disabled={busy || blocked.length > 0}
            title={
              blocked.length
                ? `${blocked.length} dòng còn thiếu Mã SP / Số lượng / ĐVT`
                : undefined
            }
          >
            {busy ? <Spinner size={14} /> : <SendHorizontal />}
            Gửi GĐ duyệt
          </Button>
        )}

        {isDraft && blocked.length > 0 && (
          <div className="basis-full text-xs">
            <span className="font-medium text-red-600">
              <TriangleAlert className="mr-1 inline size-3.5" aria-hidden />
              Chưa gửi được: {blocked.length} dòng thiếu Mã SP / Số lượng / ĐVT
            </span>
            <span className="text-muted-foreground ml-2">
              {blocked.slice(0, 6).map((b, i) => (
                <Fragment key={`${b.groupTitle}-${b.index}`}>
                  {i > 0 && ' · '}
                  <button
                    onClick={() => onJump(b.groupTitle, b.index)}
                    className="hover:text-foreground underline underline-offset-2"
                    title={`Thiếu ${b.issues}`}
                  >
                    {b.groupTitle} #{b.index}
                  </button>
                </Fragment>
              ))}
              {blocked.length > 6 && ` … và ${blocked.length - 6} dòng nữa`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
