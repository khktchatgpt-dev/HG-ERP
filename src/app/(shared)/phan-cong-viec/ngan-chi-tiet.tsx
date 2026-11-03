'use client'

import { useEffect, useState } from 'react'
import { api, apiErrorText } from '@/lib/api'
import { taskAttachBlock } from '@/lib/task-flow'
import type { TaskFileItem } from '@/modules/core/files/files.service'
import type { Comment } from '@/modules/workflow/tasks/comments.repo'
import { dmVn } from './phan-cong.shared'
import { tinhTrang } from './pc-viec'
import { TepDinhKem } from './tep-dinh-kem'
import type { PhanCongCtx } from './usePhanCong'

/**
 * NGĂN PHẢI — chi tiết dòng đang chọn (bản vẽ 3, Q2: luôn mở). Phẳng: dải nhãn–giá
 * trị, khối ngăn vạch mảnh. Khi Action Pane bấm Báo hoàn thành / Trả lại / Huỷ, ô gõ
 * câu (hoặc xác nhận) hiện ĐẦU ngăn — người dùng không phải đi tìm.
 *
 * Màn cha đặt `key={việc}` nên đổi dòng là ngăn dựng lại, tệp + trao đổi tải mới.
 */

const KIND: Partial<Record<Comment['kind'], string>> = {
  progress_report: 'báo hoàn thành',
  rejection: 'trả lại',
  approval: 'duyệt Đạt',
}

/** dd/mm hh:mm giờ VN — ghép tay (vi-VN của Intl ra "hh:mm dd-mm"). */
function luc(at: string): string {
  const t = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(at))
  return `${dmVn(at)} ${t}`
}

export function NganChiTiet({
  d,
  meId,
  meRole,
}: {
  d: PhanCongCtx
  meId: string
  meRole: string
}) {
  const t = d.chon
  const [files, setFiles] = useState<TaskFileItem[] | null>(null)
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [tick, setTick] = useState(0)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [guiLoi, setGuiLoi] = useState<string | null>(null)

  const id = t?.id
  useEffect(() => {
    if (!id) return
    let live = true
    Promise.all([
      api<{ files: TaskFileItem[] }>(`/api/tasks/${id}/files`),
      api<{ comments: Comment[] }>(`/api/tasks/${id}/comments`),
    ])
      .then(([f, c]) => {
        if (!live) return
        setFiles(f.files)
        setComments(c.comments)
        setLoadErr(null)
      })
      .catch((e) => live && setLoadErr(apiErrorText(e, 'Chưa tải được chi tiết việc')))
    return () => {
      live = false
    }
  }, [id, tick])

  if (!t) {
    return (
      <aside className="pc-fx" aria-label="Chi tiết việc">
        <div className="pc-fx-h">
          <span className="t mut">Chi tiết việc</span>
        </div>
        <p className="pc-rong">Lưới chưa có việc nào để xem.</p>
      </aside>
    )
  }

  const tt = tinhTrang(t)
  const block = taskAttachBlock(t, { id: meId, role: meRole })
  const mo = t.status !== 'done' && t.status !== 'cancelled'

  async function guiNote() {
    if (!note.trim() || !t) return
    setGuiLoi(null)
    try {
      await api(`/api/tasks/${t.id}/comments`, {
        method: 'POST',
        body: { body: note.trim(), kind: 'comment' },
      })
      setNote('')
      setTick((x) => x + 1)
    } catch (e) {
      setGuiLoi(apiErrorText(e, 'Chưa gửi được — thử lại'))
    }
  }

  const ma = t.task_code ?? 'việc này'
  const buoc = d.buoc
  const nhanBuoc =
    buoc === 'submit' ? 'Báo hoàn thành' : buoc === 'reject' ? 'Trả lại' : 'Huỷ việc'

  return (
    <aside className="pc-fx" aria-label={`Chi tiết việc ${t.title}`}>
      <div className="pc-fx-h">
        <span className="ma">{t.task_code}</span>
        <span className="t" title={t.title}>
          {t.title}
        </span>
        {t.priority === 'urgent' && <span className="gap">GẤP</span>}
      </div>

      <div className="pc-fx-b">
        {buoc && (
          <section className="blk" aria-label={nhanBuoc}>
            <h2>
              <span>{nhanBuoc}</span>
              <span className="ma">{t.task_code}</span>
            </h2>
            {buoc === 'cancel' ? (
              <p className="txt">
                Huỷ {ma}? {t.assignee_name ?? 'Người nhận'} được báo trên chuông.
              </p>
            ) : (
              <div className="wr">
                <label htmlFor="pc-cau" className="sr-only">
                  {buoc === 'submit' ? 'Kết quả' : 'Lý do trả lại'}
                </label>
                <textarea
                  id="pc-cau"
                  className="in"
                  rows={3}
                  maxLength={2000}
                  autoFocus
                  placeholder={
                    buoc === 'submit'
                      ? 'Kết quả: đã làm gì, còn gì chưa xong…'
                      : 'Lý do trả lại: cần sửa gì…'
                  }
                  value={d.cau}
                  onChange={(e) => d.setCau(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') d.huyBuoc()
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) d.guiBuoc()
                  }}
                />
              </div>
            )}
            <div className="wr">
              <button
                type="button"
                className="b p"
                aria-disabled={(buoc !== 'cancel' && !d.cau.trim()) || d.busy}
                onClick={d.guiBuoc}
              >
                {d.busy ? 'Đang ghi…' : nhanBuoc}
              </button>
              <button type="button" className="b k" onClick={d.huyBuoc}>
                {buoc === 'cancel' ? 'Giữ việc' : 'Thôi'}
              </button>
            </div>
          </section>
        )}

        <dl className="kv">
          <dt>Tình trạng</dt>
          <dd className={`st ${tt.tone}`}>{tt.label}</dd>
          <dt>Người làm</dt>
          <dd title={`${t.assignee_name ?? ''} · ${t.department_name ?? ''}`}>
            {t.assignee_name ?? '—'}
            {t.department_name && <span className="mut"> · {t.department_name}</span>}
          </dd>
          <dt>Giao bởi</dt>
          <dd>
            {t.assigner_name ?? '—'}
            <span className="mut num"> · {dmVn(t.created_at)}</span>
          </dd>
          <dt>Hạn</dt>
          <dd className="num">{t.due_date ? dmVn(t.due_date) : '—'}</dd>
        </dl>

        <section className="blk" aria-label="Mô tả">
          <h2>
            <span>Mô tả</span>
          </h2>
          {t.description ? (
            <p className="txt">{t.description}</p>
          ) : (
            <p className="txt mut">Không có mô tả.</p>
          )}
        </section>

        {files === null ? (
          <p className="txt mut">{loadErr ?? 'Đang tải tệp…'}</p>
        ) : (
          <TepDinhKem
            taskId={t.id}
            files={files}
            canAdd={block === null}
            blockReason={block}
            onChanged={() => {
              setTick((x) => x + 1)
              d.refresh()
            }}
          />
        )}

        <section className="blk" aria-label="Trao đổi">
          <h2>
            <span>Trao đổi</span>
          </h2>
          {comments === null ? (
            <p className="txt mut">{loadErr ?? 'Đang tải…'}</p>
          ) : comments.length === 0 ? (
            <p className="txt mut">Chưa có trao đổi.</p>
          ) : (
            comments.map((c) => (
              <div
                key={c.id}
                className={
                  c.kind === 'rejection'
                    ? 'tl back'
                    : c.kind === 'progress_report' || c.kind === 'approval'
                      ? 'tl res'
                      : 'tl'
                }
              >
                <span>{luc(c.created_at)}</span>
                <span>
                  <b>{c.user_name ?? c.user_email}</b>
                  {KIND[c.kind] ? ` ${KIND[c.kind]}: ` : ': '}
                  {c.body}
                </span>
              </div>
            ))
          )}
          {mo && (
            <div className="wr">
              <label htmlFor="pc-note" className="sr-only">
                Viết trao đổi
              </label>
              <textarea
                id="pc-note"
                className="in"
                rows={1}
                maxLength={4000}
                placeholder="Viết trao đổi…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void guiNote()
                }}
              />
              <button
                type="button"
                className="b k"
                aria-disabled={!note.trim()}
                onClick={() => void guiNote()}
              >
                Gửi
              </button>
            </div>
          )}
          {guiLoi && (
            <p role="alert" className="txt bad-t">
              {guiLoi}
            </p>
          )}
        </section>
      </div>
    </aside>
  )
}
