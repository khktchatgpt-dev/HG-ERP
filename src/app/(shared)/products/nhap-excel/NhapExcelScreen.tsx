'use client'

import { useMemo, useRef, useState } from 'react'
import {
  Btn,
  Cell,
  Chip,
  Code,
  CommitBar,
  Empty,
  FilterBar,
  NoticeBar,
  Row,
  ScreenFrame,
  ScreenHeader,
  THead,
  TFoot,
  Table,
  Tag,
  useToast,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import type { RowAction } from '@/lib/product-import'
import type {
  ImportPreview,
  PreviewRow,
  WrittenRow,
} from '@/modules/dept/technical/product-import.service'

/**
 * THÊM + CẬP NHẬT SẢN PHẨM BẰNG EXCEL — màn soi trước và ghi (07/10/2026, B1
 * của bản vẽ "Nhập SP từ Excel" vòng 2, duyệt theo đề xuất).
 *
 * Khuôn F (bảng nhập) làm điểm xuất phát: lưới là nhân vật chính, thanh chốt
 * đáy nói vì sao chưa ghi được bằng một câu bấm được. Khác khuôn F: lưới CHỈ
 * ĐỌC — sửa ở file Excel người dùng giữ ("lưu bên anh chỉnh sửa"); sửa tại chỗ
 * ở đây thì file bên họ lệch với thứ đã ghi.
 *
 * File đi THẲNG lên Storage bằng URL ký (Vercel cắt thân request ~4,5 MB); mọi
 * bước sau chỉ gửi đường dẫn. Ghi theo lô 50 dòng (giới hạn thời gian một lần gọi).
 */

const API = '/api/dept/technical/products/import-excel'
const CHUNK = 50
const SHOW_CHANGES = 6

type Filter = 'write' | 'all' | RowAction | 'warn'
type Progress = { done: number; total: number; lot: number; lots: number }

const ACTION_TAG: Record<
  RowAction,
  { label: string; tone: 'done' | 'run' | 'neutral' | 'stop' }
> = {
  create: { label: 'Thêm mới', tone: 'done' },
  update: { label: 'Cập nhật', tone: 'run' },
  same: { label: 'Không đổi', tone: 'neutral' },
  error: { label: 'Lỗi', tone: 'stop' },
}

const matches = (r: PreviewRow, f: Filter) =>
  f === 'all'
    ? true
    : f === 'write'
      ? r.action === 'create' || r.action === 'update'
      : f === 'warn'
        ? r.warn
        : r.action === f

/** Cột "Thay đổi / Vì sao" của một dòng. */
function WhyCell({ r }: { r: PreviewRow }) {
  if (r.errors.length) {
    return <span className="k-t-stop">{r.errors.map((e) => e.msg).join(' · ')}</span>
  }
  const warn = r.warnings.length ? (
    <div className="k-t-warn">{r.warnings.map((w) => w.msg).join(' · ')}</div>
  ) : null
  if (r.action === 'create') {
    return (
      <div style={{ whiteSpace: 'normal' }}>
        <span className="text-[var(--ink-3)]">
          {r.codeAuto ? 'Mã tự cấp' : 'Mã gõ tay'}
        </span>
        {warn}
      </div>
    )
  }
  if (r.action === 'same')
    return <span className="text-[var(--ink-3)]">Không ô nào khác</span>
  const shown = r.changes.slice(0, SHOW_CHANGES)
  const more = r.changes.length - shown.length
  return (
    <div
      style={{ whiteSpace: 'normal' }}
      title={r.changes.map((c) => `${c.label}: ${c.before} → ${c.after}`).join('\n')}
    >
      {shown.map((c) => (
        <div key={c.key}>
          <span className="text-[var(--ink-3)]">{c.label}:</span>{' '}
          <span className="text-[var(--ink-3)] line-through">{c.before}</span> →{' '}
          <b className="text-[var(--act-text)]">{c.after}</b>
        </div>
      ))}
      {more > 0 && (
        <div className="text-[var(--ink-3)]">+{more} ô khác (rê chuột để xem đủ)</div>
      )}
      {warn}
    </div>
  )
}

export function NhapExcelScreen() {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const top = useRef<HTMLDivElement>(null)
  const [file, setFile] = useState<{ name: string; path: string } | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [filter, setFilter] = useState<Filter>('write')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [written, setWritten] = useState<WrittenRow[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  const rows = useMemo(() => preview?.rows ?? [], [preview])
  const shown = rows.filter((r) => matches(r, filter))
  const errorRows = rows.filter((r) => r.action === 'error').map((r) => r.row)
  const toWrite = rows.filter((r) => r.action === 'create' || r.action === 'update')
  const count = (f: Filter) => rows.filter((r) => matches(r, f)).length

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!/\.xlsx$/i.test(f.name)) {
      toast.error(
        'Chỉ nhận file .xlsx',
        'File .xls cũ hãy mở bằng Excel rồi lưu lại thành .xlsx',
      )
      return
    }
    setBusy(true)
    try {
      // 1) Xin chỗ trên Storage, 2) PUT thẳng file lên đó, 3) server đọc + soi.
      const { path, uploadUrl } = await api<{ path: string; uploadUrl: string }>(`${API}/upload-url`, { method: 'POST' }) // prettier-ignore
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': f.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, // prettier-ignore
        body: f,
      })
      if (!put.ok) throw new Error(`Tải file lên không được (${put.status})`)
      const p = await api<ImportPreview>(`${API}/preview`, {
        method: 'POST',
        body: { path },
      })
      setFile({ name: f.name, path })
      setPreview(p)
      setWritten(null)
      setFailed(null)
      setDownloadUrl(null)
      setProgress(null)
      setFilter(p.counts.error > 0 ? 'error' : 'write')
    } catch (err) {
      toast.error('Không đọc được file', apiErrorText(err, err instanceof Error ? err.message : 'Có lỗi')) // prettier-ignore
    } finally {
      setBusy(false)
    }
  }

  async function commit() {
    if (!file || !preview || !toWrite.length) return
    setBusy(true)
    setFailed(null)
    const lots: number[][] = []
    for (let i = 0; i < toWrite.length; i += CHUNK) lots.push(toWrite.slice(i, i + CHUNK).map((r) => r.row)) // prettier-ignore
    const done: WrittenRow[] = []
    try {
      for (let i = 0; i < lots.length; i++) {
        setProgress({
          done: done.length,
          total: toWrite.length,
          lot: i + 1,
          lots: lots.length,
        })
        const r = await api<{ written: WrittenRow[] }>(`${API}/commit`, {
          method: 'POST',
          body: {
            path: file.path,
            rows: lots[i],
            written: done.filter((w) => w.action === 'create').map((w) => ({ row: w.row, code: w.code })), // prettier-ignore
          },
        })
        done.push(...r.written)
      }
      setProgress(null)
      setWritten(done)
      const c = done.filter((w) => w.action === 'create').length
      toast.success(
        `Đã ghi ${done.length} sản phẩm`,
        `${c} thêm mới · ${done.length - c} cập nhật`,
      )
    } catch (err) {
      setProgress(null)
      setWritten(done)
      setFailed(apiErrorText(err))
    } finally {
      setBusy(false)
    }
  }

  async function download() {
    if (!file || !written) return
    if (downloadUrl) {
      window.location.href = downloadUrl
      return
    }
    setBusy(true)
    try {
      const { url } = await api<{ url: string }>(`${API}/finish`, {
        method: 'POST',
        body: {
          path: file.path,
          filename: file.name,
          written: written.map((w) => ({ row: w.row, code: w.code, version: w.version })),
        },
      })
      setDownloadUrl(url)
      window.location.href = url
    } catch (err) {
      toast.error('Không tạo được file', apiErrorText(err))
    } finally {
      setBusy(false)
    }
  }

  /** Mã thêm mới lúc ghi khác bản soi — có người vừa thêm SP cùng loại. */
  const codeChanged = useMemo(() => {
    if (!written) return []
    const before = new Map(rows.map((r) => [r.row, r.code]))
    return written.filter((w) => w.action === 'create' && before.get(w.row) !== w.code)
  }, [written, rows])
  const nameOf = new Map(rows.map((r) => [r.row, r.name]))
  const nCreate = written?.filter((w) => w.action === 'create').length ?? 0

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <input
        ref={input}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={onPick}
        aria-label="Chọn file Excel đã sửa"
      />
      <ScreenFrame tableMin={980}>
        <ScreenHeader
          compact
          eyebrow="Hồ sơ sản phẩm"
          title="Thêm và cập nhật sản phẩm bằng Excel"
          facts={
            file && preview
              ? [
                  { label: 'File', value: file.name },
                  // Mã + Phiên bản là cột máy, không phải ô thông tin.
                  {
                    label: 'Cột',
                    value: `${preview.columns.filter((k) => k !== 'code' && k !== 'version').length} ô thông tin`,
                  },
                ]
              : undefined
          }
          actions={
            <>
              <Btn icon="excel" onClick={() => (window.location.href = API)}>
                Tải file mẫu trống
              </Btn>
              <Btn
                primary={!preview}
                icon="them"
                onClick={() => input.current?.click()}
                busy={busy && !preview}
                disabled={!!progress}
              >
                {preview ? 'Chọn file khác' : 'Chọn file đã sửa…'}
              </Btn>
              <Btn icon="quayLai" href="/products">
                Về thư viện
              </Btn>
            </>
          }
        />
        <div ref={top} />

        {!preview ? (
          <Empty
            headline="Chưa chọn file"
            reason="Sửa SP đang có: ở Thư viện sản phẩm lọc rồi bấm Excel → Xuất SP đang xem, sửa ở máy mình. Thêm SP mới: dòng để trống Mã, hoặc tải file mẫu trống."
            next={
              <>
                Xong thì bấm <b>Chọn file đã sửa</b> — hệ thống soi từng dòng (thêm mới /
                cập nhật ô nào, cũ → mới / lỗi), chưa ghi gì cho tới khi anh/chị bấm Ghi.
              </>
            }
          />
        ) : rows.length === 0 ? (
          <Empty
            headline="File không có dòng sản phẩm nào"
            reason={`Sheet "${preview.sheet}" từ hàng 4 trở xuống đang trống.`}
            next="Điền từ hàng 4 (hàng 1–3 là nhóm, tiêu đề, ghi chú) rồi chọn lại file."
          />
        ) : written ? (
          <>
            {failed ? (
              <NoticeBar tone="stop" tag="Dừng giữa chừng">
                {failed}. Đã ghi {written.length}/{toWrite.length} dòng ở các lô trước.
                Tải file đã có mã rồi tải lên lại: dòng đã ghi sẽ hiện &quot;Không
                đổi&quot;, chỉ phần còn lại được ghi tiếp — không thêm trùng.
              </NoticeBar>
            ) : (
              <NoticeBar tone="done" tag="Đã ghi">
                {nCreate} thêm mới · {written.length - nCreate} cập nhật. Tải file đã có
                mã để lưu đè bản bên mình — lần sửa sau dùng tiếp chính file đó.
              </NoticeBar>
            )}
            {codeChanged.length > 0 && (
              <NoticeBar tone="warn" tag="Mã đổi">
                {codeChanged.length} SP mới được cấp mã khác bản soi vì vừa có người thêm
                SP cùng loại:{' '}
                {codeChanged
                  .slice(0, 5)
                  .map((c) => `dòng ${c.row} → ${c.code}`)
                  .join(', ')}
                {codeChanged.length > 5 ? '…' : ''}
              </NoticeBar>
            )}
            <Table label="Sản phẩm vừa ghi">
              <THead>
                <th style={{ textAlign: 'right' }}>Dòng</th>
                <th>Việc</th>
                <th>Mã nội bộ</th>
                <th>Tên SP</th>
              </THead>
              <tbody>
                {written.map((w) => (
                  <Row key={w.row}>
                    <Cell num>{w.row}</Cell>
                    <Cell>
                      <Tag tone={ACTION_TAG[w.action].tone}>
                        {ACTION_TAG[w.action].label}
                      </Tag>
                    </Cell>
                    <Cell>
                      <Code as="a" href={`/products/${w.id}`}>
                        {w.code}
                      </Code>
                    </Cell>
                    <Cell grow>{nameOf.get(w.row) ?? ''}</Cell>
                  </Row>
                ))}
              </tbody>
            </Table>
            <CommitBar
              totals={[
                { label: 'Thêm mới', value: nCreate },
                { label: 'Cập nhật', value: written.length - nCreate },
              ]}
              grand={{ label: 'Đã ghi', value: `${written.length} SP` }}
              actions={
                <>
                  <Btn href="/products">Về thư viện</Btn>
                  <Btn primary icon="excel" onClick={download} busy={busy}>
                    Tải file đã có mã
                  </Btn>
                </>
              }
            />
          </>
        ) : (
          <>
            {progress && (
              <NoticeBar tone="neutral" tag="Đang ghi">
                Lô {progress.lot}/{progress.lots} · {progress.done}/{progress.total} dòng
                — đừng đóng trang.
              </NoticeBar>
            )}
            <FilterBar label="Lọc dòng theo việc">
              <Chip
                on={filter === 'write'}
                count={count('write')}
                onClick={() => setFilter('write')}
              >
                Sẽ ghi
              </Chip>
              <Chip
                on={filter === 'create'}
                count={count('create')}
                onClick={() => setFilter('create')}
              >
                Thêm mới
              </Chip>
              <Chip
                on={filter === 'update'}
                count={count('update')}
                onClick={() => setFilter('update')}
              >
                Cập nhật
              </Chip>
              <Chip
                on={filter === 'warn'}
                count={count('warn')}
                onClick={() => setFilter('warn')}
              >
                Có cảnh báo
              </Chip>
              <Chip
                on={filter === 'error'}
                count={count('error')}
                onClick={() => setFilter('error')}
              >
                Lỗi — phải sửa
              </Chip>
              <Chip
                on={filter === 'same'}
                count={count('same')}
                onClick={() => setFilter('same')}
              >
                Không đổi
              </Chip>
              <Chip
                on={filter === 'all'}
                count={rows.length}
                onClick={() => setFilter('all')}
              >
                Tất cả dòng
              </Chip>
              {preview.blank > 0 && (
                <span className="text-k-sm ml-auto text-[var(--ink-3)]">
                  Bỏ qua {preview.blank} dòng trống
                </span>
              )}
            </FilterBar>

            {shown.length === 0 ? (
              <Empty
                headline="Không có dòng nào ở mục này"
                reason={
                  filter === 'write'
                    ? 'Mọi dòng trong file đều y như dữ liệu đang có — không có gì để ghi.'
                    : 'Bộ lọc đang chọn không khớp dòng nào trong file.'
                }
                next="Bấm “Tất cả dòng” để xem cả file."
              />
            ) : (
              <Table label="Các dòng trong file">
                <THead pinFirst>
                  <th style={{ textAlign: 'right' }}>Dòng</th>
                  <th>Việc</th>
                  <th>Mã nội bộ</th>
                  <th style={{ width: 240 }}>Tên SP</th>
                  <th style={{ width: 110 }}>Khách</th>
                  {/* Cột người dùng đến đây để đọc — bề rộng đặt tay (bài học vòng 1:
                      để bảng tự chia thì câu lý do gãy 7 dòng). */}
                  <th style={{ minWidth: 420 }}>Thay đổi (cũ → mới) / vì sao</th>
                </THead>
                <tbody>
                  {shown.map((r) => (
                    <Row key={r.row}>
                      <Cell num pin>
                        {r.row}
                      </Cell>
                      <Cell>
                        <span className="inline-flex flex-col items-start gap-0.5">
                          <Tag tone={ACTION_TAG[r.action].tone}>
                            {ACTION_TAG[r.action].label}
                          </Tag>
                          {r.action === 'update' && (
                            <span className="text-k-label text-[var(--ink-3)]">
                              {r.changes.length} ô
                            </span>
                          )}
                          {r.warn && <Tag tone="warn">Cảnh báo</Tag>}
                        </span>
                      </Cell>
                      <Cell>
                        {r.code ? (
                          <span
                            className="font-[family-name:var(--font-mono)]"
                            style={{
                              color: r.errors.some((e) => e.field === 'code')
                                ? 'var(--stop)'
                                : r.codeAuto
                                  ? 'var(--act-text)'
                                  : undefined,
                            }}
                            title={r.codeAuto ? 'Mã tự cấp — có thể nhích lên nếu có người thêm SP cùng loại trước khi ghi' : undefined} // prettier-ignore
                          >
                            {r.code}
                          </span>
                        ) : (
                          <span className="text-[var(--ink-3)]">—</span>
                        )}
                      </Cell>
                      <Cell title={r.name}>
                        {r.name || <span className="k-t-stop">(trống)</span>}
                      </Cell>
                      <Cell muted title={r.customer ?? undefined}>
                        {r.customer ?? ''}
                      </Cell>
                      <Cell grow>
                        <WhyCell r={r} />
                      </Cell>
                    </Row>
                  ))}
                </tbody>
                {/* 6 cột = nhãn 3 + tổng 1 + caveat 2 — lệch là cột thừa chữ xếp dọc (bẫy TFoot). */}
                <TFoot
                  label={<td colSpan={3}>{rows.length} dòng</td>}
                  caveatSpan={2}
                  cells={
                    <td colSpan={1}>
                      Sẽ ghi {toWrite.length}: {preview.counts.create} thêm mới ·{' '}
                      {preview.counts.update} cập nhật ({preview.changedCells} ô)
                    </td>
                  }
                  caveat={`${preview.counts.same} dòng không đổi không đụng tới${errorRows.length ? ` · không gồm ${errorRows.length} dòng lỗi` : ''}. Mã tự cấp tính lại lúc ghi.`}
                />
              </Table>
            )}

            <CommitBar
              totals={[
                { label: 'Thêm mới', value: preview.counts.create },
                {
                  label: 'Cập nhật',
                  value: `${preview.counts.update} (${preview.changedCells} ô)`,
                },
                { label: 'Không đổi', value: preview.counts.same },
              ]}
              grand={{ label: 'Sẽ ghi', value: `${toWrite.length} SP` }}
              blocked={
                errorRows.length > 0
                  ? `${errorRows.length} dòng lỗi (dòng ${errorRows.slice(0, 6).join(', ')}${errorRows.length > 6 ? '…' : ''}) — sửa trong file rồi bấm “Chọn file khác”`
                  : toWrite.length === 0
                    ? 'File không có gì khác dữ liệu đang có'
                    : undefined
              }
              onGoBlocked={
                errorRows.length > 0
                  ? () => {
                      setFilter('error')
                      top.current?.scrollIntoView({ block: 'start' })
                    }
                  : undefined
              }
              actions={
                <Btn
                  primary
                  icon="ghiSo"
                  onClick={commit}
                  busy={busy && !!progress}
                  disabled={errorRows.length > 0 || toWrite.length === 0 || busy}
                >
                  Ghi {toWrite.length} sản phẩm
                </Btn>
              }
            />
          </>
        )}
      </ScreenFrame>
    </div>
  )
}
