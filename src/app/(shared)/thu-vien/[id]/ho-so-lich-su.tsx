'use client'

import { History } from 'lucide-react'
import { FIELD_LABELS } from '@/components/technical/revision-labels'
import { LIFECYCLE_LABEL, isLifecycle } from '@/lib/product-lifecycle'
import type { HoSoView } from './ho-so.shared'

function ttLabel(v: string | undefined): string {
  return v && isLifecycle(v) ? LIFECYCLE_LABEL[v] : (v ?? '—')
}

/** LỊCH SỬ — bản chốt (khoá), mở bản, chuyển trạng thái. Mỗi lần khoá là một bản #. */
export function HoSoLichSu({ d }: { d: HoSoView }) {
  const fmt = (s: string) => new Date(s).toLocaleString('vi-VN')
  return (
    <section
      aria-label="Lịch sử"
      id="lich-su"
      className="panel"
    >
      <h2 className="ph sec-ls">
        <span className="ic-sec">
          <History aria-hidden />
        </span>
        Lịch sử{' '}
        <span className="n">
          {d.revisions.length} mốc · bản hiện tại #{d.rev}
        </span>
      </h2>
      {d.revisions.length === 0 ? (
        <div className="pad">
          Hồ sơ chưa có bản chốt nào. Mỗi lần khoá hồ sơ là chốt một bản: hệ thống chụp
          lại thuộc tính + toàn bộ định mức lúc đó và ghi rõ so với bản trước đã đổi gì.
        </div>
      ) : (
        <table aria-label="Lịch sử hồ sơ">
          <thead>
            <tr>
              <th>Việc</th>
              <th>Khi nào</th>
              <th>Ai</th>
              <th>Đã đổi / lý do</th>
            </tr>
          </thead>
          <tbody>
            {d.revisions.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.action === 'lock' ? (
                    <span className="tag done">Chốt bản #{r.rev}</span>
                  ) : r.action === 'unlock' ? (
                    <span className="tag warn">Mở bản #{r.rev} để sửa</span>
                  ) : (
                    <span className="tag run">
                      {ttLabel(r.status?.from)} → {ttLabel(r.status?.to)}
                    </span>
                  )}
                </td>
                <td className="num">{fmt(r.created_at)}</td>
                <td>{r.by ?? '—'}</td>
                <td style={{ whiteSpace: 'normal' }}>
                  {r.action === 'lock' && (
                    <span className="muted">
                      định mức {r.parts} dòng
                      {r.changed_fields.length
                        ? ` · đổi: ${r.changed_fields.map((f) => FIELD_LABELS[f] ?? f).join(', ')}`
                        : ' · không đổi so với bản trước'}
                    </span>
                  )}
                  {r.reason && (
                    <span>
                      {r.action === 'lock' ? ' ' : ''}
                      {r.action === 'unlock'
                        ? 'Lý do mở: '
                        : r.action === 'status'
                          ? 'Lý do: '
                          : 'Ghi chú: '}
                      {r.reason}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
