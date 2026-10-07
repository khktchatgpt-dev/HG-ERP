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
import { ApiError } from '@/lib/api'
import type { ImportField, ImportStatus, PlannedRow } from '@/lib/product-import'
import type { ImportPreview } from '@/modules/dept/technical/product-import.service'

/**
 * THÊM SẢN PHẨM HÀNG LOẠT TỪ EXCEL — màn soi trước (07/10/2026, bản vẽ "Nhập SP
 * từ Excel" được duyệt theo đề xuất).
 *
 * Khuôn F (bảng nhập) làm điểm xuất phát: lưới là nhân vật chính, thanh chốt đáy
 * nói vì sao chưa thêm được bằng một câu bấm được. Khác khuôn F ở chỗ lưới CHỈ
 * ĐỌC — sửa ở file Excel của người dùng, vì file đó là bản họ giữ (Kỹ thuật:
 * "để anh lưu bên anh chỉnh sửa"). Sửa tại chỗ ở đây thì file bên họ lệch với
 * thứ đã thêm.
 */

const API = '/api/dept/technical/products/import-excel'

type Filter = 'all' | ImportStatus
type Result = { created: { row: number; code: string; id: string }[]; file: string }

const STATUS_TAG: Record<
  ImportStatus,
  { label: string; tone: 'done' | 'warn' | 'stop' }
> = {
  ok: { label: 'Thêm được', tone: 'done' },
  warn: { label: 'Cảnh báo', tone: 'warn' },
  error: { label: 'Lỗi', tone: 'stop' },
}

/** Gửi file lên — `api()` chỉ nói JSON nên multipart đi `fetch` thẳng, đọc lỗi cùng kiểu. */
async function postFile<T>(path: string, file: File): Promise<T> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(path, { method: 'POST', body: fd })
  if (res.status === 401) {
    window.location.href = '/login'
    throw new ApiError(401, 'Unauthorized')
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string }
  if (!res.ok)
    throw new ApiError(res.status, body.error ?? `Lỗi ${res.status}`, body.code)
  return body as T
}

function saveBase64(b64: string, name: string) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  )
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Ô có lỗi ở đúng cột này thì tô chữ đỏ — người dùng thấy ngay phải sửa ô nào. */
function fieldCell(r: PlannedRow, f: ImportField, value: string) {
  const bad = r.errors.some((e) => e.field === f)
  return bad ? <span className="k-t-stop">{value || '(trống)'}</span> : value
}

export function NhapExcelScreen() {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const top = useRef<HTMLDivElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [busy, setBusy] = useState(false)

  const rows = preview?.rows ?? []
  // Tối đa 500 dòng — lọc mỗi lượt vẽ rẻ hơn giữ một useMemo đúng phụ thuộc.
  const shown = filter === 'all' ? rows : rows.filter((r) => r.status === filter)
  const errorRows = rows.filter((r) => r.status === 'error').map((r) => r.row)
  const addable = rows.length - errorRows.length
  const byType = Object.entries(preview?.byType ?? {})
    .map(([t, n]) => `${t} ${n}`)
    .join(' · ')

  const downloadTemplate = () => {
    window.location.href = API
  }
  const pick = () => input.current?.click()

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setBusy(true)
    try {
      const p = await postFile<ImportPreview>(`${API}/preview`, f)
      setFile(f)
      setPreview(p)
      setResult(null)
      setFilter(p.counts.error > 0 ? 'error' : 'all')
    } catch (err) {
      toast.error('Không đọc được file', err instanceof Error ? err.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function commit() {
    if (!file || !preview) return
    setBusy(true)
    try {
      const r = await postFile<Result>(API, file)
      setResult(r)
      toast.success(
        `Đã thêm ${r.created.length} sản phẩm`,
        'Tải file đã có mã để lưu bên mình',
      )
    } catch (err) {
      toast.error('Chưa thêm được', err instanceof Error ? err.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  /** Mã cấp lúc thêm khác bản soi — có người vừa thêm SP cùng loại trong lúc soi. */
  const changed = useMemo(() => {
    if (!result || !preview) return []
    const before = new Map(preview.rows.map((r) => [r.row, r.code]))
    return result.created.filter((c) => before.get(c.row) !== c.code)
  }, [result, preview])
  const nameByRow = new Map(rows.map((r) => [r.row, r.name]))

  const fileName = file?.name.replace(/\.xlsx$/i, '') ?? 'san-pham'

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <input
        ref={input}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={onPick}
        aria-label="Chọn file Excel đã điền"
      />
      <ScreenFrame tableMin={1080}>
        <ScreenHeader
          compact
          eyebrow="Hồ sơ sản phẩm"
          title="Thêm sản phẩm từ Excel"
          facts={
            file && preview
              ? [
                  { label: 'File', value: file.name },
                  { label: 'Sheet', value: preview.sheet },
                ]
              : undefined
          }
          actions={
            <>
              <Btn icon="excel" onClick={downloadTemplate}>
                Tải file mẫu
              </Btn>
              <Btn primary={!preview} icon="them" onClick={pick} busy={busy && !preview}>
                {preview ? 'Chọn file khác' : 'Chọn file đã điền…'}
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
            reason="Tải file mẫu, điền mỗi dòng một sản phẩm ở máy mình (Loại, Vật liệu, Tên… như form Thêm sản phẩm), lưu lại sửa dần bao lâu cũng được."
            next={
              <>
                Xong thì bấm <b>Chọn file đã điền</b> — hệ thống soi trước từng dòng, chưa
                ghi gì cho tới khi anh/chị bấm Thêm.
              </>
            }
          />
        ) : rows.length === 0 ? (
          <Empty
            headline="File không có dòng sản phẩm nào"
            reason={`Sheet "${preview.sheet}" từ hàng 3 trở xuống đang trống.`}
            next="Điền từ hàng 3 của file mẫu (hàng 1–2 là tiêu đề và ghi chú) rồi chọn lại file."
          />
        ) : result ? (
          <>
            <NoticeBar tone="done" tag="Đã thêm">
              {result.created.length} sản phẩm, mã <b>{result.created[0]?.code}</b>
              {result.created.length > 1 && (
                <>
                  {' '}
                  … <b>{result.created.at(-1)?.code}</b>
                </>
              )}
              . Tải file đã có mã để lưu đè bản bên mình.
            </NoticeBar>
            {changed.length > 0 && (
              <NoticeBar tone="warn" tag="Mã đổi">
                {changed.length} dòng được cấp mã khác bản soi vì vừa có người thêm SP
                cùng loại:{' '}
                {changed
                  .slice(0, 5)
                  .map((c) => `dòng ${c.row} → ${c.code}`)
                  .join(', ')}
                {changed.length > 5 ? '…' : ''}
              </NoticeBar>
            )}
            <Table label="Sản phẩm vừa thêm">
              <THead>
                <th>Dòng</th>
                <th>Mã nội bộ</th>
                <th>Tên SP</th>
              </THead>
              <tbody>
                {result.created.map((c) => (
                  <Row key={c.row}>
                    <Cell num>{c.row}</Cell>
                    <Cell>
                      <Code as="a" href={`/products/${c.id}`}>
                        {c.code}
                      </Code>
                    </Cell>
                    <Cell grow>{nameByRow.get(c.row) ?? ''}</Cell>
                  </Row>
                ))}
              </tbody>
            </Table>
            <CommitBar
              totals={[]}
              grand={{ label: 'Đã thêm', value: `${result.created.length} SP` }}
              actions={
                <>
                  <Btn href="/products">Về thư viện</Btn>
                  <Btn
                    primary
                    icon="excel"
                    onClick={() => saveBase64(result.file, `${fileName}_da-co-ma.xlsx`)}
                  >
                    Tải file đã có mã
                  </Btn>
                </>
              }
            />
          </>
        ) : (
          <>
            <FilterBar label="Lọc dòng theo tình trạng">
              <Chip
                on={filter === 'all'}
                count={rows.length}
                onClick={() => setFilter('all')}
              >
                Tất cả dòng
              </Chip>
              <Chip
                on={filter === 'ok'}
                count={preview.counts.ok}
                onClick={() => setFilter('ok')}
              >
                Thêm được
              </Chip>
              <Chip
                on={filter === 'warn'}
                count={preview.counts.warn}
                onClick={() => setFilter('warn')}
              >
                Có cảnh báo (vẫn thêm)
              </Chip>
              <Chip
                on={filter === 'error'}
                count={preview.counts.error}
                onClick={() => setFilter('error')}
              >
                Lỗi — phải sửa
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
                reason="Bộ lọc đang chọn không khớp dòng nào trong file."
                next="Bấm “Tất cả dòng” để xem cả file."
              />
            ) : (
              <Table label="Các dòng trong file">
                <THead pinFirst>
                  <th style={{ textAlign: 'right' }}>Dòng</th>
                  <th>Tình trạng</th>
                  <th>Loại</th>
                  <th>VL</th>
                  <th>Mã nội bộ</th>
                  {/*
                    Bề rộng cột ĐẶT TAY: để bảng tự chia thì cột Tên (grow) ăn 394px
                    còn "Vì sao" còn 200px, câu lý do gãy 7 dòng, mỗi dòng cao 133px
                    (đo 07/10 ở 1280px). Lý do là thứ người dùng đến đây để đọc.
                  */}
                  <th style={{ width: 220 }}>Tên SP (tiếng Việt)</th>
                  <th style={{ width: 150 }}>Tên theo khách</th>
                  <th>Khách</th>
                  <th>ĐVT</th>
                  <th style={{ minWidth: 360 }}>Vì sao</th>
                </THead>
                <tbody>
                  {shown.map((r) => {
                    const why = [...r.errors, ...r.warnings].map((x) => x.msg).join(' · ')
                    return (
                      <Row key={r.row}>
                        <Cell num pin>
                          {r.row}
                        </Cell>
                        <Cell>
                          <Tag tone={STATUS_TAG[r.status].tone}>
                            {STATUS_TAG[r.status].label}
                          </Tag>
                        </Cell>
                        <Cell title={r.raw.type}>
                          {r.type ?? fieldCell(r, 'type', r.raw.type)}
                        </Cell>
                        <Cell title={r.raw.material}>
                          {r.material ?? fieldCell(r, 'material', r.raw.material)}
                        </Cell>
                        <Cell
                          title={r.codeAuto ? 'Mã tự cấp — có thể đổi nếu có người thêm SP cùng loại trước khi bấm Thêm' : undefined} // prettier-ignore
                        >
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
                            >
                              {r.code}
                            </span>
                          ) : (
                            <span className="text-[var(--ink-3)]">—</span>
                          )}
                        </Cell>
                        <Cell title={r.name}>{fieldCell(r, 'name', r.name)}</Cell>
                        <Cell muted title={r.name_foreign ?? undefined}>
                          {r.name_foreign ?? ''}
                        </Cell>
                        <Cell title={r.customer ?? undefined}>{r.customer ?? ''}</Cell>
                        <Cell>{r.unit}</Cell>
                        <Cell grow title={why}>
                          <span
                            className={
                              r.errors.length
                                ? 'k-t-stop'
                                : r.warnings.length
                                  ? 'k-t-warn'
                                  : 'text-[var(--ink-3)]'
                            }
                            style={{ whiteSpace: 'normal' }}
                          >
                            {why || (r.codeAuto ? 'Mã tự cấp' : 'Mã gõ tay')}
                          </span>
                        </Cell>
                      </Row>
                    )
                  })}
                </tbody>
                {/* 10 cột = nhãn 4 + tổng 3 + caveat 3 — lệch là cột thừa chữ xếp dọc (bẫy TFoot). */}
                <TFoot
                  label={<td colSpan={4}>{rows.length} dòng</td>}
                  caveatSpan={3}
                  cells={
                    <td colSpan={3}>
                      {addable} mã sẽ cấp{byType ? ` (${byType})` : ''}
                      {errorRows.length > 0
                        ? ` — không gồm ${errorRows.length} dòng lỗi`
                        : ''}
                    </td>
                  }
                  caveat="Mã tự cấp được tính lại lúc bấm Thêm: ai vừa thêm SP cùng loại thì số có thể nhích lên, màn sẽ báo dòng nào đổi."
                />
              </Table>
            )}

            <CommitBar
              totals={[
                { label: 'Dòng', value: rows.length },
                { label: 'Cảnh báo', value: preview.counts.warn },
              ]}
              grand={{ label: 'Sẽ thêm', value: `${addable} SP` }}
              blocked={
                errorRows.length > 0
                  ? `${errorRows.length} dòng lỗi (dòng ${errorRows.slice(0, 6).join(', ')}${errorRows.length > 6 ? '…' : ''}) — sửa trong file rồi bấm “Chọn file khác”`
                  : undefined
              }
              onGoBlocked={() => {
                setFilter('error')
                top.current?.scrollIntoView({ block: 'start' })
              }}
              actions={
                <Btn
                  primary
                  icon="them"
                  onClick={commit}
                  busy={busy}
                  disabled={errorRows.length > 0 || busy}
                >
                  Thêm {addable} sản phẩm
                </Btn>
              }
            />
          </>
        )}
      </ScreenFrame>
    </div>
  )
}
