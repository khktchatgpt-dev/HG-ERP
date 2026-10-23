'use client'

import { useRouter } from 'next/navigation'
import { Btn, Empty, FilterBar, Pick, ScreenFrame, ScreenHeader } from '@/components/kit'

type Label = { id: string; code: string; name: string; dept: string | null; svg: string }

/**
 * Lưới tem để in. Khi in (`@media print`) chỉ còn lưới tem — vỏ app, đầu trang,
 * hàng lọc ẩn đi; mỗi tem đúng 50 × 30 mm, không vỡ ngang trang.
 */
export function TemScreen({
  labels,
  total,
  scope,
  depts,
  to,
}: {
  labels: Label[]
  total: number
  scope: string
  depts: { id: string; name: string }[]
  to: string
}) {
  const router = useRouter()
  return (
    <ScreenFrame>
      <style>{`
        @media print {
          @page { margin: 6mm; }
          body * { visibility: hidden; }
          #tem-in, #tem-in * { visibility: visible; }
          #tem-in { position: absolute; left: 0; top: 0; padding: 0 !important; }
        }
        .tem { width: 50mm; height: 30mm; break-inside: avoid; }
      `}</style>
      <div className="print:hidden">
        <ScreenHeader
          compact
          eyebrow="Máy móc & bảo trì"
          title="In tem QR"
          facts={[
            { label: 'Phạm vi', value: scope },
            {
              label: 'Số tem',
              value: `${labels.length}${total > labels.length ? ` / ${total} (tối đa 300 một lượt)` : ''}`,
            },
          ]}
          actions={
            <Btn
              primary
              icon="in"
              disabled={labels.length === 0}
              onClick={() => window.print()}
            >
              In {labels.length} tem
            </Btn>
          }
        />
        <FilterBar dense label="Lọc tem">
          <Pick
            label="Tổ"
            value={to}
            onChange={(v) => router.push(v ? `/may-moc/tem?to=${v}` : '/may-moc/tem')}
            options={[
              { value: '', label: 'Mọi tổ' },
              ...depts.map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
          <span className="text-k-sm text-[var(--ink-3)]">
            Khổ 50 × 30 mm · máy in tem nhiệt · chọn khổ giấy đúng trong hộp in
          </span>
        </FilterBar>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {labels.length === 0 ? (
          <Empty
            level={2}
            headline="Không có máy nào để in tem"
            reason="Phạm vi đang chọn chưa có máy hay dụng cụ nào trên sổ."
            next={<Btn href="/may-moc/may">Mở danh sách máy</Btn>}
          />
        ) : (
          <div id="tem-in" className="flex flex-wrap gap-[2mm] p-[var(--gutter)]">
            {labels.map((l) => (
              <div
                key={l.id}
                className="tem grid grid-cols-[26mm_minmax(0,1fr)] items-center gap-[2mm] overflow-hidden border border-[var(--line)] bg-white p-[2mm] text-black"
              >
                <div
                  className="h-[26mm] w-[26mm]"
                  dangerouslySetInnerHTML={{ __html: l.svg }}
                />
                <div className="min-w-0 leading-tight">
                  <div
                    style={{ fontSize: '6pt', letterSpacing: '0.08em' }}
                    className="uppercase"
                  >
                    Hoàng Gia · Cơ điện
                  </div>
                  <div style={{ fontSize: '9pt' }} className="font-mono font-bold">
                    {l.code}
                  </div>
                  <div style={{ fontSize: '7pt' }} className="line-clamp-2">
                    {l.name}
                  </div>
                  <div style={{ fontSize: '6pt' }}>{l.dept ?? ''}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScreenFrame>
  )
}
