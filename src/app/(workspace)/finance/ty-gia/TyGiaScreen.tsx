'use client'

import { Fragment, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  DateInput,
  Empty,
  Grid,
  GridBody,
  GridHead,
  GridRow,
  Metric,
  MetricStrip,
  NoticeBar,
  NumInput,
  Pick,
  ScreenFrame,
  ScreenHeader,
  Tag,
  Td,
  TextInput,
  Th,
  WhyBox,
  useToast,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { FX_WARN_PCT, fxDeviationPct, rateRowFor } from '@/lib/fx'
import { parseNum } from '@/lib/cut-plan/paste'
import { FX_SOURCES, FX_SOURCE_LABEL } from '@/modules/dept/accounting/fx-rates.schema'
import type { FxBoard, FxRateScreenRow } from '@/modules/dept/accounting/fx-rates.service'
import { GanTyGiaSheet } from './gan-sheet'

const dmy = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—')
/** Tỷ giá bày tối đa 4 lẻ (cột numeric(18,4)) — 25.400 hiện "25.400", 25.412,5 giữ lẻ. */
const rate = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
const pct = (p: number) =>
  `${p > 0 ? '+' : ''}${p.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`
const sourceLabel = (s: string | null) =>
  (FX_SOURCE_LABEL as Record<string, string>)[s ?? ''] ?? s ?? '—'

type Draft = {
  /** Dòng đang sửa (null = thêm mới). Sửa thì ngoại tệ + ngày khoá. */
  id: string | null
  currency: string
  date: string
  rate: string
  source: (typeof FX_SOURCES)[number]
  note: string
}

/**
 * TỶ GIÁ — Khuôn C với một hàng nhập ở đầu (SAP OB08, Odoo currency rates).
 *
 * Câu hỏi: *"tỷ giá đang áp dụng là bao nhiêu, và chứng từ ngoại tệ nào còn
 * chưa có tỷ giá?"* Hai con số "thiếu tỷ giá" ở dải trên đếm bằng CHUNG hàm
 * server với hộp gán (`fxRatesService`), không đếm riêng ở màn.
 *
 * Chặn / cảnh báo nói TẠI CHỖ, trước khi bấm: trùng ngày thì nút khoá và câu
 * đỏ chỉ sang dòng đã có; lệch quá 3% thì KHÔNG chặn nhưng nút đổi chữ thành
 * "Lưu dù lệch" để người bấm biết mình đang vượt cảnh báo.
 */
export function TyGiaScreen({
  board,
  canManage,
}: {
  board: FxBoard
  canManage: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [ganOpen, setGanOpen] = useState(false)
  const firstCur = board.currencies[0]?.code ?? 'USD'
  const [draft, setDraft] = useState<Draft>({
    id: null,
    currency: firstCur,
    date: board.today,
    rate: '',
    source: 'vcb',
    note: '',
  })

  const currencyOptions = useMemo(() => {
    const codes = new Set(['USD', ...board.currencies.map((c) => c.code)])
    return [...codes].sort().map((c) => ({ value: c, label: c }))
  }, [board.currencies])

  /* ── Kiểm tại chỗ ──────────────────────────────────────────────────────── */
  const rateNum = parseNum(draft.rate)
  const dup = draft.id
    ? null
    : (board.rows.find((r) => r.currency === draft.currency && r.rate_date === draft.date) ?? null) // prettier-ignore
  /** Dòng gần nhất TRƯỚC ngày đang nhập (bỏ chính dòng đang sửa). */
  const prev = useMemo(() => {
    const others = board.rows.filter((r) => r.id !== draft.id && r.rate_date < draft.date)
    return rateRowFor(others, draft.currency, draft.date) as FxRateScreenRow | null
  }, [board.rows, draft.currency, draft.date, draft.id])
  const deviation = rateNum != null ? fxDeviationPct(rateNum, prev?.rate ?? null) : null
  const tooFar = deviation != null && Math.abs(deviation) > FX_WARN_PCT
  const rateBad = draft.rate.trim() !== '' && (rateNum == null || rateNum < 1)
  /*
   * Dải "trùng ngày" chỉ hiện khi người dùng ĐÃ GÕ tỷ giá: hàng nhập mặc định
   * là hôm nay, nên ngay sau khi lưu dòng hôm nay (hoặc mở màn vào ngày đã có
   * dòng) mà đã đỏ "trùng ngày" là mắng người ta vì một việc họ chưa định làm.
   * Nút Lưu thì vẫn khoá từ đầu.
   */
  const showDup = !!dup && draft.rate.trim() !== ''
  const canSave =
    canManage && !busy && !dup && !rateBad && rateNum != null && draft.date !== ''

  function startEdit(r: FxRateScreenRow): void {
    setDraft({
      id: r.id,
      currency: r.currency,
      date: r.rate_date,
      rate: rate(r.rate),
      source: (FX_SOURCES as readonly string[]).includes(r.source ?? '')
        ? (r.source as Draft['source'])
        : 'khac',
      note: r.note ?? '',
    })
  }
  function reset(): void {
    setDraft({ id: null, currency: firstCur, date: board.today, rate: '', source: 'vcb', note: '' }) // prettier-ignore
  }

  async function save(): Promise<void> {
    if (!canSave || rateNum == null) return
    setBusy(true)
    try {
      if (draft.id) {
        await api('/api/dept/accounting/ty-gia', {
          method: 'PATCH',
          body: {
            id: draft.id,
            rate: rateNum,
            source: draft.source,
            note: draft.note || null,
          },
        })
        toast.success(
          `Đã sửa dòng ${draft.currency} ${dmy(draft.date)} → ${rate(rateNum)}`,
        )
      } else {
        await api('/api/dept/accounting/ty-gia', {
          method: 'POST',
          body: {
            currency: draft.currency,
            rate_date: draft.date,
            rate: rateNum,
            source: draft.source,
            note: draft.note || null,
          },
        })
        toast.success(
          `Đã thêm ${draft.currency} ${rate(rateNum)} từ ${dmy(draft.date)} — chứng từ chốt từ ngày đó trở đi lấy tỷ giá này; chứng từ đã có tỷ giá không đổi`,
        )
      }
      reset()
      router.refresh()
    } catch (e) {
      toast.error(apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const missing = board.missing_total

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <ScreenFrame>
        <ScreenHeader
          compact
          eyebrow="Tài chính · Kế toán"
          title="Tỷ giá"
          actions={
            <>
              {missing > 0 && (
                <Btn
                  icon="dao"
                  onClick={() => setGanOpen(true)}
                  blockedBy={canManage ? undefined : 'Kế toán'}
                >
                  Gán tỷ giá cho {missing} chứng từ thiếu
                </Btn>
              )}
              <Btn icon="baoCao" href="/finance/theo-lenh">
                Tiền theo lệnh
              </Btn>
            </>
          }
        />

        {/*
          Dải hiệu suất theo từng ngoại tệ (thường chỉ USD). Mỗi ô kèm mẫu số:
          "19 / 19 đơn USD đã duyệt" — không có mẫu số thì 19 không nói gì.
        */}
        <MetricStrip>
          {board.currencies.length === 0 && (
            <Metric
              label="Ngoại tệ"
              value={null}
              basis="chưa có đơn hay dòng tỷ giá ngoại tệ nào"
            />
          )}
          {board.currencies.map((c) => (
            <Fragment key={c.code}>
              <Metric
                key={`${c.code}-cur`}
                label={`${c.code} đang áp dụng`}
                value={c.current ? rate(c.current.rate) : null}
                basis={
                  c.current
                    ? `từ ${dmy(c.current.rate_date)} · ${sourceLabel(c.current.source)}`
                    : 'chưa có dòng nào — thêm ở hàng dưới'
                }
                tone={c.current ? undefined : 'warn'}
              />
              <Metric
                key={`${c.code}-prev`}
                label="Dòng trước"
                value={c.previous ? rate(c.previous.rate) : '—'}
                basis={
                  c.previous && c.current
                    ? `${dmy(c.previous.rate_date)} · lệch ${pct(fxDeviationPct(c.current.rate, c.previous.rate) ?? 0)}`
                    : 'chưa có'
                }
              />
              <Metric
                key={`${c.code}-po`}
                label={`Đơn mua ${c.code} thiếu tỷ giá`}
                value={String(c.missing_po)}
                basis={`/ ${c.total_po} đơn ${c.code} đã duyệt, chưa huỷ`}
                tone={c.missing_po > 0 ? 'warn' : c.total_po > 0 ? 'done' : undefined}
              />
              <Metric
                key={`${c.code}-so`}
                label={`Đơn bán ${c.code} thiếu tỷ giá`}
                value={String(c.missing_so)}
                basis={`/ ${c.total_so} đơn bán ${c.code} · doanh thu chưa quy VND được`}
                tone={c.missing_so > 0 ? 'warn' : c.total_so > 0 ? 'done' : undefined}
              />
            </Fragment>
          ))}
        </MetricStrip>

        {/* ── Hàng nhập: một ngoại tệ, một ngày, một tỷ giá ─────────────────── */}
        <div className="flex flex-wrap items-end gap-2 border-b border-[var(--hair)] bg-[var(--surface-raised)] px-[var(--gutter)] py-2">
          <label className="flex flex-col gap-1">
            <span className="text-k-label text-[var(--ink-label)]">Ngoại tệ</span>
            <Pick
              label="Ngoại tệ"
              width={90}
              value={draft.currency}
              disabled={!canManage || busy || !!draft.id}
              onChange={(v) => setDraft((d) => ({ ...d, currency: v }))}
              options={currencyOptions}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-k-label text-[var(--ink-label)]">Ngày áp dụng</span>
            <DateInput
              label="Ngày áp dụng"
              value={draft.date}
              disabled={!canManage || busy || !!draft.id}
              onChange={(iso) => setDraft((d) => ({ ...d, date: iso }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-k-label text-[var(--ink-label)]">
              1 {draft.currency} = ? VND
            </span>
            <NumInput
              aria-label={`1 ${draft.currency} bằng bao nhiêu VND`}
              value={draft.rate}
              placeholder="25.600"
              disabled={!canManage || busy}
              style={{ width: 120 }}
              onCommit={(v) => setDraft((d) => ({ ...d, rate: v }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-k-label text-[var(--ink-label)]">Nguồn</span>
            <Pick
              label="Nguồn tỷ giá"
              width={140}
              value={draft.source}
              disabled={!canManage || busy}
              onChange={(v) => setDraft((d) => ({ ...d, source: v as Draft['source'] }))}
              options={FX_SOURCES.map((s) => ({ value: s, label: FX_SOURCE_LABEL[s] }))}
            />
          </label>
          <label className="flex min-w-[200px] flex-1 flex-col gap-1">
            <span className="text-k-label text-[var(--ink-label)]">Ghi chú</span>
            <TextInput
              label="Ghi chú"
              value={draft.note}
              disabled={!canManage || busy}
              placeholder="VD: tuần 40, VCB bán ra sáng thứ Hai"
              onCommit={(v) => setDraft((d) => ({ ...d, note: v }))}
            />
          </label>
          {draft.id && (
            <Btn onClick={reset} disabled={busy}>
              Thôi sửa
            </Btn>
          )}
          <Btn
            icon="ghiSo"
            primary
            busy={busy}
            disabled={!canSave}
            blockedBy={canManage ? undefined : 'Kế toán'}
            onClick={() => void save()}
          >
            {draft.id ? 'Lưu sửa' : tooFar ? 'Lưu dù lệch' : 'Lưu'}
          </Btn>
        </div>

        {/*
          Chặn và cảnh báo TẠI CHỖ. Thứ tự: trùng ngày (chặn) → số sai (chặn) →
          lệch quá ngưỡng (cảnh báo, vẫn lưu được).
        */}
        {showDup && dup && (
          <NoticeBar
            tone="stop"
            tag="Trùng ngày"
            action={{
              label: `Sửa dòng ${dmy(dup.rate_date)}`,
              onClick: () => startEdit(dup),
            }}
          >
            Ngày {dmy(dup.rate_date)} đã có dòng {dup.currency} {rate(dup.rate)}
            {dup.created_by_name ? ` (${dup.created_by_name})` : ''}. Một ngày chỉ một tỷ
            giá — sửa dòng đó hoặc chọn ngày khác.
          </NoticeBar>
        )}
        {!dup && rateBad && (
          <NoticeBar tone="stop" tag="Số sai">
            Tỷ giá phải là số lớn hơn 1, nhập theo chiều 1 {draft.currency} = ? VND (ví dụ
            25.600).
          </NoticeBar>
        )}
        {!dup && !rateBad && tooFar && prev && rateNum != null && (
          <NoticeBar tone="warn" tag="Lệch nhiều">
            {rate(rateNum)} lệch <b>{pct(deviation!)}</b> so với dòng{' '}
            {dmy(prev.rate_date)} ({rate(prev.rate)}).{' '}
            {Math.abs(deviation!) > 50 ? 'Thường là thiếu một số 0. ' : ''}
            Kiểm lại trước khi lưu — vẫn lưu được nếu đúng.
          </NoticeBar>
        )}
        {draft.id && !dup && (
          <NoticeBar tone="neutral" tag="Đang sửa">
            Dòng {draft.currency} {dmy(draft.date)} chưa chứng từ nào dùng nên sửa được.
            Ngoại tệ và ngày không đổi — khác ngày là một dòng khác.
          </NoticeBar>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {board.rows.length === 0 ? (
            <Empty
              headline={`Chưa có tỷ giá ${firstCur} nào`}
              reason={
                missing > 0
                  ? `${board.currencies.map((c) => `${c.missing_po} đơn mua và ${c.missing_so} đơn bán ${c.code}`).join('; ')} đang hiện "chưa quy đổi được" ở Tiền theo lệnh và Công nợ NCC. Tổng VND ở các màn đó đang KHÔNG gồm phần ngoại tệ.`
                  : 'Chưa có chứng từ ngoại tệ nào, nên chưa cần tỷ giá. Có đơn USD đầu tiên thì thêm ở hàng trên.'
              }
              next={
                <span className="text-k-sm text-[var(--ink-3)]">
                  Gợi ý: tỷ giá bán ra Vietcombank hôm nay, nguồn “VCB bán ra” — nhập ở
                  hàng trên.
                </span>
              }
            />
          ) : (
            <Grid minWidth={1100}>
              <GridHead>
                <Th width={190}>Ngày áp dụng</Th>
                <Th width={70}>Ngoại tệ</Th>
                <Th num width={120}>
                  Tỷ giá (VND)
                </Th>
                <Th num width={130}>
                  Lệch dòng trước
                </Th>
                <Th width={110}>Nguồn</Th>
                <Th width={140}>Người nhập</Th>
                <Th num width={110}>
                  Chứng từ dùng
                </Th>
                <Th>Ghi chú</Th>
                <Th width={70}>
                  <span className="sr-only">Sửa</span>
                </Th>
              </GridHead>
              <GridBody>
                {board.rows.map((r) => (
                  <GridRow key={r.id} selected={draft.id === r.id}>
                    <Td>
                      <span className="num">{dmy(r.rate_date)}</span>{' '}
                      {r.current && <Tag tone="done">đang áp dụng</Tag>}
                    </Td>
                    <Td>{r.currency}</Td>
                    <Td num>{rate(r.rate)}</Td>
                    <Td
                      num
                      tone={
                        r.deviation_pct != null && Math.abs(r.deviation_pct) > FX_WARN_PCT
                          ? 'warn'
                          : undefined
                      }
                    >
                      {r.deviation_pct == null ? '—' : pct(r.deviation_pct)}
                    </Td>
                    <Td>{sourceLabel(r.source)}</Td>
                    <Td>
                      {r.created_by_name ?? (
                        <span className="text-[var(--ink-3)]">—</span>
                      )}
                    </Td>
                    <Td num>{r.used_by}</Td>
                    <Td>
                      <span className="text-[var(--ink-2)]">{r.note ?? '—'}</span>
                    </Td>
                    <Td>
                      {canManage && r.used_by === 0 ? (
                        <Btn icon="sua" onClick={() => startEdit(r)} disabled={busy}>
                          Sửa
                        </Btn>
                      ) : canManage ? (
                        <span
                          className="text-k-label text-[var(--ink-3)]"
                          title="Đã có chứng từ ghi cứng tỷ giá này"
                        >
                          khoá
                        </span>
                      ) : null}
                    </Td>
                  </GridRow>
                ))}
              </GridBody>
            </Grid>
          )}
        </div>

        <div className="px-[var(--gutter)] py-3">
          <WhyBox
            lines={[
              `${board.rows.length} dòng · chỉ ngoại tệ — VND luôn là 1 và không khai ở đây`,
              'Chứng từ lấy dòng MỚI NHẤT có ngày ≤ ngày chốt của nó; không lấy tỷ giá tương lai',
              'Đơn mua chốt lúc Giám đốc duyệt · đơn bán chốt lúc xác nhận · hoá đơn và phiếu trả chốt lúc ghi sổ',
              '"Chứng từ dùng" = đơn mua + đơn bán + hoá đơn + phiếu trả đã ghi cứng đúng tỷ giá của dòng; có chứng từ dùng thì dòng khoá sửa',
              `Lệch quá ${FX_WARN_PCT}% so với dòng trước chỉ cảnh báo, không chặn — nút đổi thành "Lưu dù lệch"`,
            ]}
            result={`${missing} chứng từ ngoại tệ đang thiếu tỷ giá`}
          />
        </div>
      </ScreenFrame>

      {/* Dựng lại từ đầu mỗi lần mở: kế hoạch gán phải tính lại theo bảng hiện tại. */}
      {ganOpen && (
        <GanTyGiaSheet
          onClose={() => setGanOpen(false)}
          onDone={(assigned, skipped) => {
            toast.success(
              skipped > 0
                ? `Đã gán ${assigned} chứng từ · ${skipped} chứng từ chưa có tỷ giá trước ngày chốt, thêm dòng rồi gán lại`
                : `Đã gán tỷ giá cho ${assigned} chứng từ`,
            )
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
