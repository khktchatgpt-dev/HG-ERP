'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { Download, FileUp, Save, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TopProgressBar } from '@/components/erp/Spinner'
import { useNhapExcel, type Loc } from './useNhapExcel'

const EXPORT = '/api/dept/technical/products/sp-excel/export'

const TEN_VIEC: Record<string, { label: string; cls: string }> = {
  create: { label: 'Thêm mới', cls: 'run' },
  update: { label: 'Cập nhật', cls: 'done' },
  unchanged: { label: 'Không đổi', cls: '' },
  error: { label: 'Lỗi', cls: 'stop' },
}

/**
 * MÀN NHẬP EXCEL — ba bước trên một trang: ① lấy file, ② chọn file đã sửa,
 * ③ soi rồi ghi. Chưa ghi gì cho tới khi bấm Ghi; còn dòng lỗi thì nút Ghi khoá
 * và nói vì sao. Ghi xong: tải lại file đã có mã để lần sau sửa tiếp trên đó.
 */
export function NhapExcelScreen({ canUse }: { canUse: boolean }) {
  const d = useNhapExcel()
  const inputRef = useRef<HTMLInputElement>(null)
  const p = d.preview
  const seGhi = p ? p.counts.create + p.counts.update : 0
  const chips: { k: Loc; label: string; n: number }[] = p
    ? [
        { k: 'all', label: 'Tất cả', n: p.rows.length },
        { k: 'create', label: 'Thêm mới', n: p.counts.create },
        { k: 'update', label: 'Cập nhật', n: p.counts.update },
        { k: 'unchanged', label: 'Không đổi', n: p.counts.unchanged },
        { k: 'error', label: 'Lỗi', n: p.counts.error },
        { k: 'image', label: 'Ảnh mới', n: p.counts.image },
      ]
    : []
  const codeOf = new Map((d.written ?? []).map((w) => [w.row, w]))

  return (
    <>
      <TopProgressBar active={d.busy} />
      <header className="head2">
        <div style={{ minWidth: 0 }}>
          <div className="crumb">
            <Link href="/thu-vien">Thư viện sản phẩm</Link> › Nhập Excel
          </div>
          <h1>Nhập và cập nhật sản phẩm bằng Excel</h1>
        </div>
        <div className="head-r">
          <a
            className="btn"
            href={`${EXPORT}?blank=1`}
            title="Tải file mẫu trống để thêm SP mới"
          >
            <Download size={14} aria-hidden />
            <span className="t">Tải file mẫu trống</span>
          </a>
          <a
            className="btn"
            href={`${EXPORT}?tt=active`}
            title="Xuất mọi SP đang dùng, kèm ảnh, để sửa trên Excel"
          >
            <Download size={14} aria-hidden />
            <span className="t">Xuất SP đang dùng</span>
          </a>
        </div>
      </header>

      {!canUse ? (
        <div className="blocked" role="status">
          <div>
            <b>Chỉ Kỹ thuật, Bán hàng, Giám đốc</b> thêm hoặc sửa sản phẩm. Bạn vẫn tải
            file xuất được để xem.
          </div>
        </div>
      ) : (
        <div className="steps">
          <div className="step">
            <span className="n">1</span>
            <b>Lấy file</b>
            <p>
              Mẫu trống để thêm mới, hoặc xuất SP đang có (kèm ảnh) để sửa trên Excel. Ở
              thư viện, nút Excel xuất đúng tập đang lọc.
            </p>
          </div>
          <div className={cn('step', !p && 'on')}>
            <span className="n">2</span>
            <b>Chọn file đã sửa</b>
            {d.file ? (
              <p>
                {d.file.name} · {(d.file.size / 1024 / 1024).toFixed(1)} MB ·{' '}
                {p?.rows.length ?? 0} dòng · {p?.columns.length ?? 0}/
                {p?.totalColumns ?? 36} cột
              </p>
            ) : (
              <p>File .xlsx theo đúng mẫu (hàng 2 là tiêu đề cột).</p>
            )}
            <div className="row">
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx"
                className="sr"
                id="sp-excel-file"
                onChange={(e) => {
                  void d.chonFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
              <label
                htmlFor="sp-excel-file"
                className="btn pri"
                style={{ cursor: 'pointer' }}
              >
                <FileUp size={14} aria-hidden />
                {d.file ? 'Chọn file khác' : 'Chọn file'}
              </label>
              {d.file && (
                <button
                  type="button"
                  className="btn"
                  onClick={d.boFile}
                  disabled={d.busy}
                >
                  <X size={14} aria-hidden />
                  Bỏ
                </button>
              )}
            </div>
          </div>
          <div className={cn('step', p && 'on')}>
            <span className="n">3</span>
            <b>Soi rồi ghi</b>
            <p>
              Chưa ghi gì cho tới khi bấm Ghi. Còn dòng lỗi thì không ghi được — sửa trong
              file, tải lại.
            </p>
          </div>
        </div>
      )}

      {d.tienDo && (
        <div className="notice" role="status">
          {d.tienDo}
        </div>
      )}
      {d.loi && (
        <div className="blocked" role="alert">
          <div>
            <b>Chưa đọc / ghi được:</b> {d.loi}
          </div>
        </div>
      )}
      {d.doneUrl && (
        <div
          className="editbar"
          style={{
            position: 'static',
            background: 'var(--done-wash)',
            borderColor: 'var(--done-line)',
            color: 'var(--done)',
          }}
          role="status"
        >
          <b>Đã ghi {d.written?.length ?? 0} dòng</b>
          <span>
            · {d.written?.filter((w) => w.action === 'create').length ?? 0} mã mới cấp
          </span>
          <span className="r">
            <a className="btn pri" href={d.doneUrl}>
              <Download size={14} aria-hidden />
              Tải lại file đã có mã
            </a>
          </span>
        </div>
      )}

      {p && (
        <>
          <div className="strip">
            {chips
              .filter((c) => c.k !== 'all')
              .map((c) => (
                <button
                  key={c.k}
                  type="button"
                  className={cn(
                    'metric',
                    c.k === 'create' && 'act',
                    c.k === 'update' && 'done',
                    c.k === 'error' && c.n > 0 && 'stop',
                  )}
                  onClick={() => d.setLoc(d.loc === c.k ? 'all' : c.k)}
                >
                  <span className="l">{c.label}</span>
                  <b>{c.n}</b>
                </button>
              ))}
            <span className="hint">Bấm ô để lọc bảng dưới</span>
          </div>
          <div className="bar">
            {chips.map((c) => (
              <button
                key={c.k}
                type="button"
                className={cn('chip', d.loc === c.k && 'on')}
                onClick={() => d.setLoc(c.k)}
              >
                {c.label} <span className="n">{c.n}</span>
              </button>
            ))}
          </div>
          <div className="scroll" style={{ flex: '1 1 auto' }}>
            <table className="soi" aria-label="Soi từng dòng">
              <thead>
                <tr>
                  <th className="num" style={{ width: 52 }}>
                    Dòng
                  </th>
                  <th style={{ width: 70 }}>Ảnh</th>
                  <th style={{ width: 130 }}>Mã</th>
                  <th>Tên SP</th>
                  <th style={{ width: 96 }}>Việc</th>
                  <th>Thay đổi (cũ → mới)</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => {
                  const w = codeOf.get(r.row)
                  const v = TEN_VIEC[r.action]
                  return (
                    <tr key={r.row}>
                      <td className="num muted">{r.row}</td>
                      <td>
                        {r.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- ảnh qua /api/files/[id]/img
                          <img className="thumb" src={r.imageUrl} alt="" />
                        ) : (
                          <span className="thumb none" />
                        )}
                        {r.newImage && (
                          <span className="tag run" style={{ marginLeft: 4 }}>
                            mới
                          </span>
                        )}
                      </td>
                      <td>
                        {w ? (
                          <Link className="code" href={`/thu-vien/${w.id}`}>
                            {w.code}
                          </Link>
                        ) : r.id ? (
                          <Link className="code" href={`/thu-vien/${r.id}`}>
                            {r.code}
                          </Link>
                        ) : (
                          <span className="muted">
                            tự cấp {r.type ?? '?'}…HG-{r.material ?? '?'}
                          </span>
                        )}
                      </td>
                      <td title={r.name} style={{ maxWidth: 360 }}>
                        {r.name || <span className="muted">—</span>}
                      </td>
                      <td>
                        <span className={cn('tag', w ? 'done' : v.cls)}>
                          {w ? 'Đã ghi' : v.label}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'normal' }}>
                        {r.action === 'error' ? (
                          <span className="loi">{r.errors.join(' · ')}</span>
                        ) : r.action === 'create' ? (
                          <span className="muted">
                            SP mới{r.newImage ? ' · có ảnh' : ''}
                          </span>
                        ) : r.changes.length ? (
                          <span className="diff">
                            {r.changes.map((c) => (
                              <span
                                key={c.key}
                                className={cn(c.key === 'image' && 'img')}
                              >
                                {c.label} {c.old} → {c.new}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="muted">mọi ô trùng giá trị đang có</span>
                        )}
                        {r.warnings.length > 0 && (
                          <div className="warn-t">{r.warnings.join(' · ')}</div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {d.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted" style={{ textAlign: 'center' }}>
                      Không có dòng nào ở mục này
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="foot" style={{ borderTop: '2px solid var(--act)' }}>
            <span>
              <b>{seGhi}</b> dòng sẽ ghi
              {p.counts.error > 0 && (
                <span className="loi"> · {p.counts.error} dòng lỗi chặn cả file</span>
              )}
              {p.counts.unchanged > 0 && (
                <span className="muted">
                  {' '}
                  · {p.counts.unchanged} dòng không đổi, bỏ qua
                </span>
              )}
            </span>
            <span className="r" style={{ marginLeft: 'auto' }}>
              <button
                type="button"
                className="btn pri"
                disabled={
                  d.busy || !canUse || seGhi === 0 || p.counts.error > 0 || !!d.doneUrl
                }
                onClick={() => void d.ghi()}
                title={
                  p.counts.error > 0
                    ? `Còn ${p.counts.error} dòng lỗi — sửa trong file rồi tải lại`
                    : 'Ghi mọi dòng thêm mới + cập nhật'
                }
              >
                <Save size={14} aria-hidden />
                {d.doneUrl ? 'Đã ghi' : `Ghi ${seGhi} dòng`}
              </button>
            </span>
          </div>
        </>
      )}
    </>
  )
}
