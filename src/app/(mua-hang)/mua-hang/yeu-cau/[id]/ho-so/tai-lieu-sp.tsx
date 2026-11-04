'use client'

import { api, ApiError } from '@/lib/api'
import type { TaiLieuRow } from '@/lib/lsx-tai-lieu'
import { Btn, Cell, Code, Empty, Row, Table, Tag, THead, showNum } from '@/components/kit'
import { useToast } from '@/components/ui/Toast'

const mb = (b: number) => (b / 1048576).toFixed(1).replace('.', ',')

/**
 * TAB "TÀI LIỆU SP" của Hồ sơ lệnh (04/11/2026, bản vẽ GTwUMER4sxSA8dHyZb8uRN).
 *
 * Mỗi mã SP một dòng: file BOM sẽ vào zip, số ảnh, các loại khác, số dòng định
 * mức đã nạp. CÙNG luật chọn với route zip (`lib/lsx-tai-lieu`) — dòng này nói
 * "lấy bản mới nhất" thì zip cũng lấy đúng bản đó.
 *
 * Màn mẹ dùng kit nên khối này cũng kit: một màn một hệ.
 */
export function TaiLieuSp({ lsxId, rows }: { lsxId: string; rows: TaiLieuRow[] }) {
  const toast = useToast()
  async function taiVe(id: string, name: string) {
    try {
      const r = await api<{ url: string }>(`/api/files/${id}?download=1`)
      window.open(r.url, '_blank', 'noopener')
    } catch (e) {
      toast.error('Không tải được file', e instanceof ApiError ? e.message : name)
    }
  }

  if (rows.length === 0)
    return (
      <Empty
        headline="Lệnh chưa có dòng sản phẩm nào"
        reason="Tài liệu lấy theo sản phẩm trên dòng lệnh. Lệnh không có dòng thì không có hồ sơ SP nào để gom."
        next={
          <Btn icon="vattu" href={`/mua-hang/yeu-cau/${lsxId}`}>
            Xem vật tư của lệnh
          </Btn>
        }
      />
    )

  const tongFile = rows.reduce((a, r) => a + r.picked.length, 0)
  const tongAnh = rows.reduce((a, r) => a + r.images, 0)
  const tongDm = rows.reduce((a, r) => a + r.parts, 0)
  const coBom = rows.filter((r) => r.bom).length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="text-k-sm flex flex-wrap gap-x-6 gap-y-1 border-b border-[var(--line)] px-[var(--gutter)] py-1.5 text-[var(--ink-2)]">
        <span>
          File BOM{' '}
          <b className="text-[var(--ink)] tabular-nums">
            {coBom}/{rows.length}
          </b>{' '}
          SP
        </span>
        <span>
          Bản vẽ{' '}
          <b className="text-[var(--ink)] tabular-nums">
            {rows.filter((r) => r.hasDrawing).length}/{rows.length}
          </b>
        </span>
        <span>
          Định mức đã nạp{' '}
          <b className="text-[var(--ink)] tabular-nums">
            {rows.filter((r) => r.parts > 0).length}/{rows.length}
          </b>
        </span>
        <span>
          Gói zip{' '}
          <b className="text-[var(--ink)] tabular-nums">
            {tongFile} file ·{' '}
            {mb(
              rows.reduce(
                (a, r) => a + r.picked.reduce((x, f) => x + f.size_bytes, 0),
                0,
              ),
            )}{' '}
            MB
          </b>
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <Table>
          <THead pinFirst>
            <th>Mã SP</th>
            <th>Tên</th>
            <th style={{ textAlign: 'right' }}>SL</th>
            <th>File BOM (bản vào zip)</th>
            <th style={{ textAlign: 'right' }}>Ảnh</th>
            <th>Khác</th>
            <th style={{ textAlign: 'right' }}>Dòng định mức</th>
          </THead>
          <tbody>
            {rows.map((r) => (
              <Row key={r.product_id ?? r.product_code}>
                <Cell pin rowHeader>
                  <Code>{r.product_code}</Code>
                </Cell>
                <Cell grow title={r.name}>
                  {r.name}
                </Cell>
                <Cell num>
                  {showNum(r.qty)} {r.unit}
                </Cell>
                <Cell className="whitespace-normal">
                  {r.bom ? (
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <button
                        type="button"
                        className="block max-w-[280px] cursor-pointer truncate text-left text-[var(--act)] underline underline-offset-2"
                        onClick={() => taiVe(r.bom!.id, r.bom!.filename)}
                        title={`Tải ${r.bom.filename}`}
                      >
                        {r.bom.filename}
                      </button>
                      {r.bomVersions > 1 && (
                        <Tag tone="warn">
                          {r.bomVersions} bản ·{' '}
                          {r.bomGuessed
                            ? 'chưa chọn bản dùng, lấy bản mới nhất'
                            : 'lấy bản đang dùng'}
                        </Tag>
                      )}
                    </span>
                  ) : r.product_id ? (
                    <span
                      className="whitespace-nowrap text-[var(--stop)]"
                      title="Kỹ thuật chưa nạp file BOM vào hồ sơ SP"
                    >
                      chưa có BOM ·{' '}
                      <a className="underline" href={`/products/${r.product_id}`}>
                        hồ sơ SP
                      </a>
                    </span>
                  ) : (
                    <span className="text-[var(--stop)]">
                      dòng lệnh chưa gắn hồ sơ SP
                    </span>
                  )}
                </Cell>
                <Cell num>{r.images || '—'}</Cell>
                <Cell muted title={r.others.join(' · ')}>
                  {r.others.join(' · ') || '—'}
                </Cell>
                <Cell num>
                  {r.parts || <span className="text-[var(--stop)]">0</span>}
                </Cell>
              </Row>
            ))}
          </tbody>
          <tfoot>
            <tr className="[&_td]:border-t [&_td]:border-[var(--line)] [&_td]:bg-[var(--surface-raised)] [&_td]:px-[var(--pad-x)] [&_td]:py-1.5 [&_td]:font-semibold">
              <td colSpan={3}>{rows.length} SP · bấm tên file để tải từng file</td>
              <td>{coBom} file BOM</td>
              <td className="num">{tongAnh}</td>
              <td />
              <td className="num">{showNum(tongDm)}</td>
            </tr>
          </tfoot>
        </Table>
      </div>
    </div>
  )
}
