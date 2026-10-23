'use client'

import { useState } from 'react'
import {
  Btn,
  Cell,
  Empty,
  Metric,
  MetricStrip,
  MiniBars,
  Row,
  ScreenFrame,
  Sheet,
  ScreenHeader,
  Tag,
  TFoot,
  THead,
  Table,
  useToast,
} from '@/components/kit'
import { addYm, dmy, shortMoney, vnd, WO_KIND, ymTxt, type WoKind } from '@/lib/may-moc'
import type { WorkOrderRow } from '@/modules/core/assets/assets.repo'
import { AssetCode } from '../_ui/shared'

type CostRow = WorkOrderRow & {
  asset_code: string
  asset_name: string
  dept_name: string | null
  tech_name: string | null
}

const KIND_TONE: Record<WoKind, 'done' | 'warn' | 'run'> = {
  BD: 'done',
  SC: 'warn',
  KD: 'run',
}

/**
 * CHI PHÍ BẢO TRÌ THÁNG (khuôn C có chân tổng) — "Tháng này sửa máy tốn bao
 * nhiêu, ở tổ nào?" Kế toán sao chép bảng (hoặc xuất Excel) để hạch toán MISA,
 * không nhập lại từ sổ tay. Không làm khấu hao / phân bổ — kế toán vẫn làm trên
 * MISA (như bản demo MOCA).
 */
export function ChiPhiScreen({
  month,
  current,
  rows,
  series,
  byDept,
}: {
  month: string
  current: string
  rows: CostRow[]
  series: { ym: string; bd: number; sc: number }[]
  byDept: { name: string; cost: number }[]
}) {
  const toast = useToast()
  // Trình duyệt chặn ghi clipboard (khung nhúng, http, quyền) → mở hộp chép tay.
  const [manual, setManual] = useState<string | null>(null)
  const total = rows.reduce((s, w) => s + w.cost, 0)
  const by = (k: WoKind) => rows.filter((w) => w.kind === k)
  const sum = (l: CostRow[]) => l.reduce((s, w) => s + w.cost, 0)
  const down = rows.reduce((s, w) => s + w.downtime_hours, 0)
  const prev = series.find((s) => s.ym === addYm(month, -1))
  const prevTotal = prev ? prev.bd + prev.sc : 0
  const maxMonth = Math.max(1, ...series.map((s) => s.bd + s.sc))
  const maxDept = Math.max(1, ...byDept.map((d) => d.cost))

  async function copy() {
    const head = [
      'Ngày',
      'Số phiếu',
      'Mã máy',
      'Tên máy',
      'Tổ',
      'Loại',
      'Nội dung',
      'Vật tư',
      'Giờ dừng',
      'Chi phí',
    ]
    const body = rows.map((w) => [
      dmy(w.done_on),
      w.no,
      w.asset_code,
      w.asset_name,
      w.dept_name ?? '',
      WO_KIND[w.kind].label,
      w.title,
      w.parts.map((p) => `${p.name} x${p.qty}`).join('; '),
      String(w.downtime_hours),
      String(w.cost),
    ])
    const tsv = [head, ...body]
      .map((r) => r.map((v) => v.replace(/[\t\n]/g, ' ')).join('\t'))
      .join('\n')
    try {
      await navigator.clipboard.writeText(tsv)
      toast.success(
        `Đã sao chép ${rows.length} phiếu tháng ${ymTxt(month)}`,
        'Dán vào Excel hoặc MISA.',
      )
    } catch {
      setManual(tsv)
    }
  }

  return (
    <ScreenFrame tableMin={960}>
      <ScreenHeader
        compact
        eyebrow="Máy móc & bảo trì"
        title={
          <span className="flex items-center gap-2">
            <Btn
              icon="truoc"
              aria-label="Tháng trước"
              href={`/may-moc/chi-phi?ym=${addYm(month, -1)}`}
            >
              {''}
            </Btn>
            <span>Chi phí bảo trì tháng {ymTxt(month)}</span>
            {month < current ? (
              <Btn
                icon="sau"
                aria-label="Tháng sau"
                href={`/may-moc/chi-phi?ym=${addYm(month, 1)}`}
              >
                {''}
              </Btn>
            ) : (
              <Tag tone="run">Tháng đang chạy</Tag>
            )}
          </span>
        }
        actions={
          <>
            <Btn
              primary
              icon="saoChep"
              onClick={() => void copy()}
              disabled={rows.length === 0}
            >
              Sao chép bảng cho MISA
            </Btn>
            <Btn icon="excel" href={`/api/may-moc/cost/export?ym=${month}`}>
              Xuất Excel
            </Btn>
          </>
        }
      />
      {/* ScreenFrame là cột flex cao đúng bằng cửa sổ: dải số không `shrink-0`
          thì bị biểu đồ 12 tháng bên dưới ép bẹp còn một vệt chữ (21/10/2026). */}
      <div className="shrink-0">
        <MetricStrip size="lg">
          <Metric
            label="Tổng chi phí"
            value={shortMoney(total)}
            basis={`${vnd(total)} đ · ${rows.length} phiếu · tháng trước ${shortMoney(prevTotal)}`}
          />
          <Metric
            label="Bảo dưỡng định kỳ"
            value={shortMoney(sum(by('BD')))}
            basis={`${by('BD').length} phiếu PBD`}
          />
          <Metric
            label="Sửa chữa đột xuất"
            value={shortMoney(sum(by('SC')))}
            basis={`${by('SC').length} phiếu PSC${total ? ` · ${Math.round((sum(by('SC')) / total) * 100)}% tổng` : ''}`}
            tone={total && sum(by('SC')) / total > 0.6 ? 'warn' : undefined}
          />
          <Metric
            label="Kiểm định"
            value={shortMoney(sum(by('KD')))}
            basis={`${by('KD').length} phiếu PKD`}
          />
          <Metric
            label="Giờ dừng máy"
            value={`${down.toLocaleString('vi-VN')} h`}
            basis="cộng từ mọi phiếu trong tháng"
          />
        </MetricStrip>
      </div>
      <div className="grid shrink-0 gap-4 border-b border-[var(--line)] px-[var(--gutter)] py-3 md:grid-cols-2">
        <div className="grid gap-2">
          <span className="text-k-label font-semibold tracking-wider text-[var(--ink-label)] uppercase">
            12 tháng gần nhất
          </span>
          {series.some((s) => s.bd + s.sc > 0) ? (
            <MiniBars
              label="Chi phí bảo trì 12 tháng"
              max={maxMonth}
              series={['Bảo dưỡng, kiểm định', 'Sửa chữa đột xuất']}
              rows={series.map((s) => ({
                id: s.ym,
                label: ymTxt(s.ym),
                value: s.bd,
                value2: s.sc,
                text: shortMoney(s.bd + s.sc),
              }))}
            />
          ) : (
            // 12 dòng toàn số 0 chiếm ~300px của bảng phiếu mà không nói thêm gì.
            <span className="text-k-sm text-[var(--ink-3)]">
              Chưa có chi phí nào trong 12 tháng gần nhất.
            </span>
          )}
        </div>
        <div className="grid content-start gap-2">
          <span className="text-k-label font-semibold tracking-wider text-[var(--ink-label)] uppercase">
            Theo tổ — để phân bổ chi phí sản xuất chung
          </span>
          {byDept.length === 0 ? (
            <span className="text-k-sm text-[var(--ink-3)]">
              Chưa có chi phí trong tháng.
            </span>
          ) : (
            <MiniBars
              label="Chi phí theo tổ"
              max={maxDept}
              rows={byDept.map((d) => ({
                id: d.name,
                label: d.name,
                value: d.cost,
                text: vnd(d.cost),
              }))}
            />
          )}
        </div>
      </div>
      {rows.length === 0 ? (
        <Empty
          headline={`Chưa có phiếu nào trong tháng ${ymTxt(month)}`}
          reason="Chi phí sinh ra khi Tổ Cơ điện ghi “Đã làm” một hạng mục bảo trì, hoặc “Sửa xong” một phiếu báo hỏng."
          next={<Btn href="/may-moc/bao-tri">Mở lịch bảo trì</Btn>}
        />
      ) : (
        <Table label={`Phiếu tháng ${ymTxt(month)}`}>
          <THead pinFirst>
            <th>Ngày</th>
            <th>Số phiếu</th>
            <th>Máy</th>
            <th>Tổ</th>
            <th>Loại</th>
            <th>Nội dung</th>
            <th>Vật tư</th>
            <th style={{ textAlign: 'right' }}>Giờ dừng</th>
            <th style={{ textAlign: 'right' }}>Chi phí (đ)</th>
          </THead>
          <tbody>
            {rows.map((w) => (
              <Row key={w.id}>
                <Cell pin num>
                  {dmy(w.done_on)}
                </Cell>
                <Cell num>{w.no}</Cell>
                <Cell>
                  <AssetCode code={w.asset_code} />
                  <span className="text-k-label block max-w-[200px] truncate text-[var(--ink-3)]">
                    {w.asset_name}
                  </span>
                </Cell>
                <Cell muted>{w.dept_name ?? '—'}</Cell>
                <Cell>
                  <Tag tone={KIND_TONE[w.kind]}>{WO_KIND[w.kind].label}</Tag>
                </Cell>
                <Cell grow title={w.title}>
                  {w.title}
                </Cell>
                <Cell muted title={w.parts.map((p) => `${p.name} ×${p.qty}`).join(', ')}>
                  {w.parts.length
                    ? w.parts.map((p) => `${p.name} ×${p.qty}`).join(', ')
                    : '—'}
                </Cell>
                <Cell num>{w.downtime_hours || ''}</Cell>
                <Cell num>{vnd(w.cost)}</Cell>
              </Row>
            ))}
          </tbody>
          <TFoot
            // Ô tổng phải đứng dưới hai cột CUỐI (Giờ dừng, Chi phí), mà `caveat` của
            // TFoot luôn vẽ SAU ô tổng — nên ghi chú đi cùng nhãn, chiếm cột Nội dung +
            // Vật tư. Để `caveat` thì số "6" rơi vào cột Vật tư, tiền vào cột Giờ dừng.
            label={
              <>
                <td colSpan={5}>Tổng {rows.length} phiếu</td>
                <td colSpan={2} className="text-k-sm font-normal text-[var(--ink-3)]">
                  không gồm vật tư xuất kho lý do “Sửa chữa · bảo trì” chưa ghi vào phiếu
                </td>
              </>
            }
            cells={
              <>
                <td className="num">{down.toLocaleString('vi-VN')}</td>
                <td className="num">{vnd(total)}</td>
              </>
            }
          />
        </Table>
      )}
      {manual != null && (
        <Sheet
          open
          onClose={() => setManual(null)}
          width={720}
          title="Sao chép thủ công"
          subtitle="Trình duyệt chặn sao chép tự động. Bảng đã được chọn sẵn — nhấn Ctrl + C rồi dán vào Excel hoặc MISA."
        >
          <textarea
            readOnly
            aria-label="Bảng chi phí dạng chữ để sao chép"
            value={manual}
            ref={(el) => el?.select()}
            className="text-k-sm min-h-[320px] w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-raised)] p-2 font-mono"
          />
        </Sheet>
      )}
    </ScreenFrame>
  )
}
