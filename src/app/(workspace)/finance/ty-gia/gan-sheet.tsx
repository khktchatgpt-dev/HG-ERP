'use client'

import { useEffect, useState } from 'react'
import { Consequence, Grid, GridBody, GridHead, GridRow, Sheet, SheetActions, Tag, Td, Th } from '@/components/kit' // prettier-ignore
import { api, apiErrorText } from '@/lib/api'
import type { FxAssignPlan } from '@/lib/fx'

const dmy = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—')
const num = (n: number, digits = 2) =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: digits, minimumFractionDigits: 0 })

/**
 * HỘP "GÁN TỶ GIÁ CHO CHỨNG TỪ THIẾU" — bày kế hoạch TRƯỚC, ghi SAU.
 *
 * Mỗi dòng nói: chứng từ nào, chốt ngày nào, sẽ lấy dòng tỷ giá nào, quy VND ra
 * bao nhiêu. Dòng không gán được nói vì sao (chưa có dòng ≤ ngày chốt) và việc
 * phải làm (thêm dòng ≤ ngày đó). Không có "gán 55/55" mà không ai biết gán gì.
 */
export function GanTyGiaSheet({
  onClose,
  onDone,
}: {
  onClose: () => void
  /** Gọi sau khi ghi thật, kèm số đã gán — màn ngoài refresh + toast. */
  onDone: (assigned: number, skipped: number) => void
}) {
  const [plan, setPlan] = useState<FxAssignPlan[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  /*
   * Hộp được DỰNG MỚI mỗi lần mở (cha render có điều kiện), nên state khởi đầu
   * đã là "đang tính" — effect chỉ tải kế hoạch, không reset gì.
   */
  useEffect(() => {
    let alive = true
    api<{ plan: FxAssignPlan[] }>('/api/dept/accounting/ty-gia/gan', { method: 'POST', body: { dry: true } }) // prettier-ignore
      .then((r) => alive && setPlan(r.plan))
      .catch((e) => alive && setErr(apiErrorText(e)))
    return () => {
      alive = false
    }
  }, [])

  const ok = (plan ?? []).filter((p) => p.rate != null)
  const skipped = (plan ?? []).filter((p) => p.rate == null)
  /** Ngày chốt sớm nhất trong nhóm không gán được — gợi ý "thêm dòng ≤ ngày này". */
  const earliest = skipped.map((p) => p.fx_date).sort()[0] ?? null

  async function run(): Promise<void> {
    if (busy || ok.length === 0) return
    setBusy(true)
    try {
      const r = await api<{ assigned: number; skipped: number }>('/api/dept/accounting/ty-gia/gan', { method: 'POST', body: { dry: false } }) // prettier-ignore
      onDone(r.assigned, r.skipped)
      onClose()
    } catch (e) {
      setErr(apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      width={900}
      stakes="vua"
      title={
        plan
          ? `Gán tỷ giá cho ${plan.length} chứng từ đang thiếu`
          : 'Gán tỷ giá cho chứng từ thiếu'
      }
      subtitle="Mỗi chứng từ lấy dòng tỷ giá mới nhất có ngày ≤ ngày chốt của nó. Đơn mua chốt ngày Giám đốc duyệt, đơn bán chốt ngày xác nhận."
      footer={
        <SheetActions
          busy={busy}
          disabled={!plan || ok.length === 0 || busy}
          onCancel={onClose}
          cancelLabel="Để sau"
          confirmLabel={`Gán ${ok.length} chứng từ`}
          onConfirm={() => void run()}
        />
      }
    >
      <Consequence>
        Sau khi gán, tỷ giá <b>ghi cứng</b> lên chứng từ và không đổi theo bảng tỷ giá
        nữa.
        {skipped.length > 0 && earliest && (
          <>
            {' '}
            <b>{skipped.length}</b> chứng từ chốt trước dòng tỷ giá sớm nhất sẽ đứng yên —
            thêm một dòng ngày ≤ {dmy(earliest)} rồi mở hộp này gán lại.
          </>
        )}
      </Consequence>

      {err && <p className="text-k-sm k-t-stop mt-2">{err}</p>}
      {!plan && !err && <p className="text-k-sm k-t-mut mt-2">Đang tính…</p>}
      {plan && plan.length === 0 && (
        <p className="text-k-sm mt-2">Không còn chứng từ ngoại tệ nào thiếu tỷ giá.</p>
      )}

      {plan && plan.length > 0 && (
        <div className="mt-3">
          <Grid minWidth={820}>
            <GridHead>
              <Th width={70}>Loại</Th>
              <Th>Chứng từ</Th>
              <Th width={96}>Ngày chốt</Th>
              <Th num>Tiền gốc</Th>
              <Th num width={110}>
                Tỷ giá gán
              </Th>
              <Th num>Quy VND</Th>
              <Th>Kết quả</Th>
            </GridHead>
            <GridBody>
              {plan.map((p) => (
                <GridRow key={`${p.kind}-${p.id}`}>
                  <Td>{p.kind === 'po' ? 'Đơn mua' : 'Đơn bán'}</Td>
                  <Td>
                    <span className="num">{p.code}</span>
                  </Td>
                  <Td>
                    <span className="num">{dmy(p.fx_date)}</span>
                  </Td>
                  <Td num>
                    {num(p.amount)}{' '}
                    <span className="text-k-label text-[var(--ink-3)]">{p.currency}</span>
                  </Td>
                  <Td num>{p.rate != null ? num(p.rate, 4) : '—'}</Td>
                  <Td num>{p.base != null ? num(p.base, 0) : '—'}</Td>
                  <Td tone={p.rate == null ? 'warn' : undefined}>
                    {p.rate != null ? (
                      <>
                        <Tag tone="done">gán được</Tag>{' '}
                        <span className="text-k-label text-[var(--ink-3)]">
                          dòng {dmy(p.rate_date)}
                        </span>
                      </>
                    ) : (
                      <>
                        <Tag tone="warn">chưa có tỷ giá ≤ {dmy(p.fx_date)}</Tag>
                      </>
                    )}
                  </Td>
                </GridRow>
              ))}
            </GridBody>
          </Grid>
          <p className="text-k-sm k-t-mut mt-2">
            Gán được <b>{ok.length}</b> · không gán được <b>{skipped.length}</b>. Tiền gốc
            = Σ dòng × đơn giá, làm tròn từng dòng.
          </p>
        </div>
      )}
    </Sheet>
  )
}
