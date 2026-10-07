'use client'

import { Cell, Empty, Row, THead, TFoot, Table, Tag } from '@/components/kit'
import type { ImportPreview } from '@/modules/dept/technical/product-import.service'

/**
 * Bảng soi sheet "ĐÓNG GÓI" (08/10/2026) — mỗi dòng một SP có mặt ở sheet: thay
 * trọn bộ phương án đóng gói (cũ → mới), không đổi, hay lỗi (chỉ đúng hàng Excel).
 */

const TAG = {
  replace: { label: 'Thay đóng gói', tone: 'run' as const },
  same: { label: 'Không đổi', tone: 'neutral' as const },
  error: { label: 'Lỗi', tone: 'stop' as const },
}

export function BangDongGoi({ packing }: { packing: ImportPreview['packing'] }) {
  if (!packing.items.length) {
    return (
      <Empty
        headline="File không có dòng nào ở sheet Đóng gói"
        reason="Sheet Đóng gói trống hoặc đã bị xoá — đóng gói của mọi SP giữ nguyên."
        next="Muốn sửa phương án đóng gói: xuất lại file từ Thư viện, điền ở sheet Đóng gói (mỗi dòng một kiện)."
      />
    )
  }
  return (
    <Table label="Đóng gói theo SP">
      <THead pinFirst>
        <th>Mã nội bộ</th>
        <th>Việc</th>
        <th>Hàng Excel</th>
        <th style={{ width: 260 }}>Đang có</th>
        <th style={{ minWidth: 380 }}>Sau khi ghi / vì sao</th>
      </THead>
      <tbody>
        {packing.items.map((it, i) => (
          <Row key={`${it.code}-${i}`}>
            <Cell pin>
              <span className="font-[family-name:var(--font-mono)]">
                {it.code || '—'}
              </span>
            </Cell>
            <Cell>
              <Tag tone={TAG[it.action].tone}>{TAG[it.action].label}</Tag>
            </Cell>
            <Cell num>{it.rows.join(', ')}</Cell>
            <Cell muted title={it.before}>
              {it.before}
            </Cell>
            <Cell grow>
              {it.errors.length ? (
                <span className="k-t-stop" style={{ whiteSpace: 'normal' }}>
                  {it.errors
                    .map((e) => (e.row ? `Dòng ${e.row}: ${e.msg}` : e.msg))
                    .join(' · ')}
                </span>
              ) : (
                <span
                  className={
                    it.action === 'replace'
                      ? 'text-[var(--act-text)]'
                      : 'text-[var(--ink-3)]'
                  }
                  style={{ whiteSpace: 'normal' }}
                >
                  {it.after}
                </span>
              )}
            </Cell>
          </Row>
        ))}
      </tbody>
      {/* 5 cột = nhãn 2 + tổng 1 + caveat 2 (bẫy TFoot). */}
      <TFoot
        label={<td colSpan={2}>{packing.counts.products} SP</td>}
        caveatSpan={2}
        cells={<td>{packing.counts.replace} thay</td>}
        caveat="SP có mặt ở sheet Đóng gói thì đóng gói được THAY TRỌN BỘ; SP vắng mặt giữ nguyên."
      />
    </Table>
  )
}
