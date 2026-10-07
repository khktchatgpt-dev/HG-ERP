'use client'

import {
  Btn,
  Cell,
  Code,
  NoticeBar,
  Row,
  Tag,
  TFoot,
  THead,
  Table,
} from '@/components/kit'
import { ACTION_TAG, GapText } from './nhap-excel.shared'
import { BangDongGoi } from './bang-dong-goi'
import type { NhapExcelCtx } from './useNhapExcel'

/**
 * Kết quả sau khi ghi (bản vẽ, trạng thái 5). Việc tiếp theo — tải file đã có mã —
 * nổi lên đầu; bảng nói SP nào vừa ghi còn thiếu ô LSX / báo giá cần (Q1).
 */
export function DaGhi({ d }: { d: NhapExcelCtx }) {
  const written = d.written ?? []
  const byRow = new Map(d.rows.map((r) => [r.row, r]))
  const nCreate = written.filter((w) => w.action === 'create').length
  const changedCells = written.reduce((s, w) => {
    const r = byRow.get(w.row)
    return s + (r ? (w.action === 'create' ? r.filled : r.changes).length : 0)
  }, 0)
  const images = written.filter((w) => byRow.get(w.row)?.newImage != null).length
  const lacking = written.filter(
    (w) => (byRow.get(w.row)?.gaps.core.length ?? 0) > 0,
  ).length
  const products = new Set([...written.map((w) => w.code), ...d.packed]).size
  const tiles: [string, number, string, string?][] = [
    ['Thêm mới', nCreate, 'SP'],
    ['Cập nhật', written.length - nCreate, `SP · ${changedCells} ô`],
    ['Ảnh đại diện mới', images, 'ảnh'],
    ['Thay đóng gói', d.packed.length, 'SP'],
    ['Còn thiếu cho LSX', lacking, `trong ${written.length} SP vừa ghi`, 'var(--warn)'],
  ]

  return (
    <>
      {d.failed ? (
        <NoticeBar tone="stop" tag="Dừng giữa chừng">
          {d.failed}. Đã ghi {written.length}/{d.toWrite.length} dòng ở các lô trước. Tải
          file đã có mã rồi tải lên lại: dòng đã ghi sẽ hiện “Không đổi”, chỉ phần còn lại
          được ghi tiếp — không thêm trùng.
        </NoticeBar>
      ) : null}
      {d.codeChanged.length > 0 && (
        <NoticeBar tone="warn" tag="Mã đổi">
          {d.codeChanged.length} SP mới được cấp mã khác bản soi vì vừa có người thêm SP
          cùng loại:{' '}
          {d.codeChanged
            .slice(0, 5)
            .map((c) => `dòng ${c.row} → ${c.code}`)
            .join(', ')}
          {d.codeChanged.length > 5 ? '…' : ''}
        </NoticeBar>
      )}

      <div className="grid grid-cols-5 border-b border-[var(--line)]">
        {tiles.map(([label, value, unit, color]) => (
          <div
            key={label}
            className="border-r border-[var(--hair)] px-3.5 py-2.5 last:border-r-0"
          >
            <b
              className="block font-[family-name:var(--font-mono)] text-[20px] font-semibold tabular-nums"
              style={{ color: color && value > 0 ? color : undefined }}
            >
              {value.toLocaleString('vi-VN')}
            </b>
            <span className="text-k-sm text-[var(--ink-3)]">
              {label} · {unit}
            </span>
          </div>
        ))}
      </div>

      {written.length > 0 && (
        <div className="flex items-center gap-3.5 border-b border-[var(--line)] bg-[var(--act-wash)] px-3.5 py-3">
          <p className="m-0 flex-1 text-[var(--ink-2)]">
            <b className="text-[var(--ink)]">Việc tiếp theo: tải file đã có mã</b> và lưu
            đè bản bên anh/chị. File điền sẵn mã của {nCreate} SP vừa thêm và phiên bản
            mới — lần sửa sau dùng tiếp chính file đó, không bị thêm trùng.
          </p>
          <Btn primary icon="excel" onClick={d.download} busy={d.busy}>
            Tải file đã có mã
          </Btn>
        </div>
      )}

      {written.length > 0 && (
        <Table label="Sản phẩm vừa ghi">
          <THead>
            <th style={{ textAlign: 'right', width: 56 }}>Dòng</th>
            <th style={{ width: 104 }}>Việc</th>
            <th style={{ width: 140 }}>Mã nội bộ</th>
            <th style={{ width: 300 }}>Tên SP</th>
            <th style={{ width: 150 }}>Đã ghi</th>
            <th>Còn thiếu cho LSX / báo giá</th>
          </THead>
          <tbody>
            {written.map((w) => {
              const r = byRow.get(w.row)
              const cells = r ? (w.action === 'create' ? r.filled : r.changes).length : 0
              return (
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
                  <Cell title={r?.name}>{r?.name ?? ''}</Cell>
                  <Cell muted>
                    {cells} ô{r?.newImage != null ? ' · ảnh' : ''}
                    {d.packed.includes(w.code) ? ' · đóng gói' : ''}
                  </Cell>
                  <Cell grow>{r ? <GapText gaps={r.gaps} /> : null}</Cell>
                </Row>
              )
            })}
          </tbody>
          <TFoot
            label={
              <td colSpan={4}>
                <b>{products} SP vừa ghi</b>
              </td>
            }
            cells={<td>{written.length} dòng SP</td>}
            caveatSpan={1}
            caveat="“Thiếu” đếm bằng đúng hàm màn LSX dùng: Tên nước ngoài, Barcode, Đóng gói, CBM; dòng nhạt là thông số in LSX còn trống."
          />
        </Table>
      )}

      {d.packed.length > 0 && d.preview && (
        <BangDongGoi
          items={d.preview.packing.items.filter((i) => d.packed.includes(i.code))}
          counts={{ ...d.preview.packing.counts, products: d.packed.length, replace: d.packed.length }} // prettier-ignore
        />
      )}
    </>
  )
}
