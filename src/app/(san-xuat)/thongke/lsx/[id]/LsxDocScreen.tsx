'use client'

import { Fragment, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Chip,
  DocBody,
  DocHead,
  DocScreen,
  FastTab,
  Grid,
  GridBody,
  GridHead,
  GridRow,
  GroupRow,
  HolderBar,
  Metric,
  MetricStrip,
  NoticeBar,
  StatusTrack,
  Tag,
  Td,
  Th,
  TextInput,
  type TrackTone,
} from '@/components/kit'
import { DocNotesPanel } from '@/components/doc/DocNotesPanel'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import { isStale, type Holder } from '@/lib/lsx-holder'
import type { WorklistRow } from '@/modules/dept/production/worklist.service'
import { PhieuTab, type DocRow } from './PhieuTab'

/**
 * M3 — CHI TIẾT LỆNH SẢN XUẤT (Khuôn D, trang chứng từ).
 *
 * Trả lời: "tờ này đang ở đâu, ai giữ, vướng gì?".
 *
 * BA THỨ KHUÔN D BẮT BUỘC, và bản cũ thiếu cả ba:
 *
 *  1. **Dải vòng đời có MỐC THẬT.** Không chỉ "đang ở bước 3" mà là bước đó
 *     xảy ra NGÀY NÀO. Mốc `undefined` = hệ thống không lưu mốc cho bước đó —
 *     khác hẳn `null` (có chỗ lưu mà trống). Dải suy từ `status` mà không có
 *     mốc sẽ khẳng định những việc chưa ai làm.
 *  2. **Thanh AI ĐANG GIỮ và đã bao lâu** (lib/lsx-holder). Thiếu nó thì "đã
 *     duyệt" là trạng thái chết — 13/19 lệnh nằm đó, không ai biết gọi ai.
 *  3. **Mỗi ô chỉ số kèm MẪU SỐ.** "1.700" một mình là con số mồ côi; "0 / 1.700
 *     bộ đặt" mới đọc được.
 *
 * Nội dung gấp bằng `FastTab` — dòng tiêu đề VẪN mang số liệu khi gấp, nên gấp
 * cả năm khối vẫn đọc được số quan trọng nhất của từng khối.
 */

type Stage = { code: string; label: string }
type Lsx = {
  id: string
  code: string
  customer_name: string
  order_codes: string[]
  ship_date: string | null
  status: string
  created_at: string
  approved_at: string | null
  completed_at: string | null
}

const fmt = (n: number) => n.toLocaleString('vi-VN')
const fmtDate = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

/**
 * Trạng thái lệnh → vị trí + MÀU trên dải.
 *
 * `wait` cho "chờ duyệt" và "đã duyệt": cả hai đều là ĐANG CHỜ AI ĐÓ, không
 * phải đang chạy. Tô `run` (xanh hành động) cho một lệnh nằm im 43 ngày là
 * dải nói dối bằng màu.
 */
const TRACK: Record<string, { at: number; tone: TrackTone }> = {
  draft: { at: 0, tone: 'idle' },
  pending_approval: { at: 1, tone: 'wait' },
  approved: { at: 2, tone: 'wait' },
  in_progress: { at: 3, tone: 'run' },
  completed: { at: 4, tone: 'done' },
  rejected: { at: 1, tone: 'stop' },
  cancelled: { at: 0, tone: 'stop' },
}

const STEP_LABEL = ['Nháp', 'Chờ GĐ duyệt', 'Đã duyệt', 'Đang sản xuất', 'Hoàn thành']

const ROW_TONE: Record<
  WorklistRow['status'],
  { tone: 'warn' | 'done' | 'neutral'; label: string }
> = {
  not_started: { tone: 'neutral', label: 'Chưa bắt đầu' },
  in_progress: { tone: 'warn', label: 'Đang làm' },
  done: { tone: 'done', label: 'Xong' },
}

export function LsxDocScreen({
  lsx,
  holder,
  stages,
  rows,
  docs,
  canRecord,
  canComplete,
  canForceComplete,
  imageByLine,
  meId,
  meName,
}: {
  lsx: Lsx
  holder: Holder
  stages: Stage[]
  rows: WorklistRow[]
  docs: DocRow[]
  canRecord: boolean
  canComplete: boolean
  canForceComplete: boolean
  imageByLine: Record<string, string>
  meId: string
  meName: string
}) {
  const router = useRouter()
  const toast = useToast()
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [stage, setStage] = useState('')
  const [closing, setClosing] = useState(false)
  /** Ô lý do chỉ mở khi người dùng chọn đường ép — mặc định không bày ra. */
  const [forceOpen, setForceOpen] = useState(false)
  const [forceNote, setForceNote] = useState('')

  const stagesInLsx = useMemo(
    () => stages.filter((s) => rows.some((r) => r.stage === s.code)),
    [stages, rows],
  )

  const shown = useMemo(
    () =>
      rows.filter(
        (r) => (!stage || r.stage === stage) && (!onlyOpen || r.status !== 'done'),
      ),
    [rows, stage, onlyOpen],
  )

  /** Gom theo SẢN PHẨM: đọc dọc là thấy SP đó đang nằm ở khâu nào. */
  const groups = useMemo(() => {
    const m = new Map<
      string,
      { code: string; name: string; qty: number; items: WorklistRow[] }
    >()
    for (const r of shown) {
      const g = m.get(r.order_line_id) ?? {
        code: r.product_code,
        name: r.product_name,
        qty: r.planned,
        items: [],
      }
      g.items.push(r)
      m.set(r.order_line_id, g)
    }
    return [...m.entries()].sort((a, b) => a[1].code.localeCompare(b[1].code))
  }, [shown])

  // Bao quát theo BỘ: xong = đã qua công đoạn CUỐI của từng dòng SP. Cộng số
  // của mọi công đoạn lại là đếm một bộ nhiều lần.
  const stageIdx = useMemo(() => new Map(stages.map((s, i) => [s.code, i])), [stages])
  const lastByLine = useMemo(() => {
    const m = new Map<string, { total: number; done: number; stage: string }>()
    for (const r of rows) {
      const cur = m.get(r.order_line_id)
      if (!cur || (stageIdx.get(r.stage) ?? 99) > (stageIdx.get(cur.stage) ?? 99)) {
        m.set(r.order_line_id, { total: r.planned, done: r.done, stage: r.stage })
      }
    }
    return m
  }, [rows, stageIdx])

  const totalSets = [...lastByLine.values()].reduce((a, x) => a + x.total, 0)
  const doneSets = [...lastByLine.values()].reduce((a, x) => a + x.done, 0)
  const openCount = rows.filter((r) => r.status !== 'done').length
  const defect = Math.round(docs.reduce((a, d) => a + d.total_defect, 0) * 100) / 100
  const rework = Math.round(docs.reduce((a, d) => a + d.total_rework, 0) * 100) / 100
  const drafts = docs.filter((d) => d.status === 'nhap' || d.status === 'tu_choi').length
  const shipLeft =
    lsx.ship_date != null
      ? Math.round(
          (new Date(`${lsx.ship_date}T00:00:00`).getTime() -
            new Date(new Date().setHours(0, 0, 0, 0)).getTime()) /
            86400000,
        )
      : null

  const track = TRACK[lsx.status] ?? { at: 0, tone: 'idle' as TrackTone }

  /**
   * ĐÓNG LỆNH (lỗ hổng B) — trước 18/09 không có đường nào, nên 5 lệnh đã quá
   * hạn xuất vẫn nằm ở "đang sản xuất" vĩnh viễn.
   *
   * Ba trạng thái, và thứ tự kiểm phải đúng như service:
   *  - chưa có việc nào  → lệnh chưa lên kế hoạch, đóng là đóng một cái vỏ;
   *  - còn việc chưa xong → chặn, nhưng nói RÕ còn bao nhiêu và cho xem ngay;
   *  - xong hết          → nút chính.
   * Ép qua chỉ dành cho admin/manager, và service bắt buộc có lý do.
   */
  const closable = lsx.status === 'approved' || lsx.status === 'in_progress'
  const noPlan = rows.length === 0
  const blocked = noPlan || openCount > 0

  async function doComplete(override: boolean) {
    if (override && !forceNote.trim()) {
      toast.error('Ép đóng lệnh phải ghi lý do')
      return
    }
    setClosing(true)
    try {
      await api(`/api/dept/production/lsx/${lsx.id}/complete`, {
        method: 'POST',
        body: { override, note: override ? forceNote.trim() : null },
      })
      setForceOpen(false)
      setForceNote('')
      toast.success(`Đã đóng lệnh ${lsx.code}`, 'Đơn hàng chuyển sang hoàn thành')
      router.refresh()
    } catch (e) {
      toast.error('Không đóng được lệnh', apiErrorText(e))
    } finally {
      setClosing(false)
    }
  }

  return (
    <DocScreen>
      <DocHead
        kind="Lệnh sản xuất"
        code={lsx.code}
        compact
        sub={
          <>
            {lsx.customer_name}
            {lsx.order_codes.length > 0 && ` · ĐH ${lsx.order_codes.join(' · ')}`}
            {lsx.ship_date && ` · xuất ${fmtDate(lsx.ship_date)}`}
          </>
        }
      >
        <StatusTrack
          label="Vòng đời"
          steps={STEP_LABEL}
          at={track.at}
          tone={track.tone}
          // `undefined` ở hai bước giữa là CỐ Ý: hệ thống không lưu mốc "gửi
          // duyệt" và "vào sản xuất", nên dải không được khẳng định chúng đã
          // xảy ra ngày nào.
          marks={[
            fmtDate(lsx.created_at),
            undefined,
            lsx.approved_at ? fmtDate(lsx.approved_at) : null,
            undefined,
            lsx.completed_at ? fmtDate(lsx.completed_at) : null,
          ]}
        />
      </DocHead>

      <HolderBar
        who={holder.who}
        what={holder.what}
        age={
          holder.days == null || holder.closed
            ? undefined
            : holder.days === 0
              ? 'từ hôm nay'
              : `đã ${holder.days} ngày${isStale(holder) ? ' · nằm im' : ''}`
        }
      />

      {canComplete && closable && !blocked && (
        <div className="flex items-center gap-[11px] border-b border-[var(--line)] px-[var(--gutter)] py-[9px]">
          <span className="text-[12.5px] text-[var(--ink-2)]">
            Mọi công việc đã xong — đóng lệnh để đơn hàng chuyển sang hoàn thành.
          </span>
          <Btn primary onClick={() => doComplete(false)} disabled={closing}>
            {closing ? 'Đang đóng…' : 'Đóng lệnh'}
          </Btn>
        </div>
      )}

      {canComplete && closable && blocked && (
        <>
          <NoticeBar
            tag="Chưa đóng được"
            action={
              noPlan
                ? undefined
                : forceOpen
                  ? undefined
                  : canForceComplete
                    ? { label: 'Ép đóng kèm lý do', onClick: () => setForceOpen(true) }
                    : { label: 'Xem việc còn lại', onClick: () => setOnlyOpen(true) }
            }
          >
            {noPlan
              ? 'Lệnh chưa có công việc nào — cần định hình chi tiết và lên kế hoạch trước.'
              : `Còn ${fmt(openCount)} việc chưa xong. Công đoạn tự chuyển sang “xong” khi sổ ghi đủ số.`}
          </NoticeBar>
          {forceOpen && (
            <div className="flex items-center gap-[9px] border-b border-[var(--line)] px-[var(--gutter)] py-[9px]">
              {/*
                `onCommit` chốt lúc RỜI Ô. Bấm "Ép đóng" vẫn lấy được chữ vừa
                gõ vì blur chạy trước click; nhưng gõ xong mà bấm Enter thì
                chưa chắc, nên service vẫn là hàng rào cuối (bắt buộc lý do).
              */}
              <TextInput
                value={forceNote}
                onCommit={setForceNote}
                placeholder={`Vì sao đóng lệnh khi còn ${fmt(openCount)} việc dở?`}
              />
              <Btn primary onClick={() => doComplete(true)} disabled={closing}>
                {closing ? 'Đang đóng…' : 'Ép đóng'}
              </Btn>
              <Btn onClick={() => setForceOpen(false)}>Thôi</Btn>
            </div>
          )}
        </>
      )}

      <MetricStrip>
        <Metric
          label="Bộ đã xong"
          value={fmt(doneSets)}
          basis={`/ ${fmt(totalSets)} bộ đặt`}
          tone={totalSets > 0 && doneSets >= totalSets ? 'done' : undefined}
        />
        <Metric
          label="Việc còn"
          value={fmt(openCount)}
          basis={`/ ${fmt(rows.length)} việc`}
          tone={openCount > 0 ? 'warn' : 'done'}
        />
        <Metric
          label="Phế luỹ kế"
          value={fmt(defect)}
          basis={`trên ${fmt(docs.length)} phiếu`}
          tone={defect > 0 ? 'warn' : undefined}
        />
        {/*
          Chỉ bày khi CÓ hàng chờ sửa. Một ô vĩnh viễn 0 làm loãng dải chỉ số,
          và ô này là lời nhắc có việc phải làm chứ không phải số thống kê.
        */}
        {rework > 0 && (
          <Metric
            label="Chờ sửa lại"
            value={fmt(rework)}
            basis="chưa tính vào đã xong"
            tone="warn"
          />
        )}
        <Metric
          label="Phiếu nháp"
          value={fmt(drafts)}
          basis={`/ ${fmt(docs.length)} phiếu`}
          tone={drafts > 0 ? 'warn' : undefined}
        />
        <Metric
          label="Hạn xuất"
          value={lsx.ship_date ? fmtDate(lsx.ship_date) : null}
          basis={
            shipLeft == null
              ? 'chưa có hạn'
              : shipLeft < 0
                ? `trễ ${fmt(-shipLeft)} ngày`
                : shipLeft === 0
                  ? 'HÔM NAY'
                  : `còn ${fmt(shipLeft)} ngày`
          }
          tone={
            shipLeft == null
              ? undefined
              : shipLeft < 0
                ? 'stop'
                : shipLeft <= 7
                  ? 'warn'
                  : undefined
          }
        />
      </MetricStrip>

      <DocBody>
        <FastTab
          title="Tiến độ theo sản phẩm"
          defaultOpen
          flush
          summary={[
            ['SP', fmt(lastByLine.size)],
            ['Bộ xong', `${fmt(doneSets)}/${fmt(totalSets)}`],
            ['Việc còn', fmt(openCount)],
          ]}
          actions={
            canRecord ? (
              <Btn primary href={`/thongke/ghi?lsx=${lsx.id}`}>
                Ghi sản lượng
              </Btn>
            ) : undefined
          }
        >
          <div className="flex flex-wrap gap-[6px] border-b border-[var(--line)] px-[var(--gutter)] py-[9px]">
            <Chip on={!stage} onClick={() => setStage('')}>
              Mọi công đoạn
            </Chip>
            {stagesInLsx.map((s) => (
              <Chip key={s.code} on={stage === s.code} onClick={() => setStage(s.code)}>
                {s.label}
              </Chip>
            ))}
            <span className="ml-auto">
              <Chip on={onlyOpen} onClick={() => setOnlyOpen((v) => !v)}>
                Chỉ việc chưa xong
              </Chip>
            </span>
          </div>

          <Grid minWidth={760}>
            <GridHead>
              <Th width={190}>Công đoạn</Th>
              <Th num>Kế hoạch</Th>
              <Th num>Đạt</Th>
              <Th num>Chờ duyệt</Th>
              <Th num>Còn</Th>
              <Th num>%</Th>
              <Th>Trạng thái</Th>
              <Th />
            </GridHead>
            <GridBody>
              {groups.map(([lineId, g]) => {
                const last = lastByLine.get(lineId)
                return (
                  <Fragment key={lineId}>
                    <GroupRow
                      name={`${g.code} · ${g.name}`}
                      meta={
                        <>
                          {fmt(g.qty)} bộ
                          {last && ` · xong ${fmt(last.done)}`}
                          {imageByLine[lineId] && ' · có ảnh'}
                        </>
                      }
                      cols={8}
                    />
                    {g.items.map((r) => (
                      <GridRow key={r.stage}>
                        <Td>{r.stage_label}</Td>
                        <Td num>{fmt(r.planned)}</Td>
                        <Td num>{fmt(r.done)}</Td>
                        <Td num tone={r.pending > 0 ? 'warn' : undefined}>
                          {r.pending > 0 ? `+${fmt(r.pending)}` : ''}
                        </Td>
                        <Td num tone={r.remaining > 0 ? 'warn' : 'done'}>
                          {r.remaining > 0 ? fmt(r.remaining) : 'đủ'}
                        </Td>
                        <Td num>{Math.round(r.pct * 100)}%</Td>
                        <Td>
                          <Tag tone={ROW_TONE[r.status].tone}>
                            {ROW_TONE[r.status].label}
                          </Tag>
                        </Td>
                        <Td>
                          {canRecord && r.status !== 'done' && (
                            <Btn href={`/thongke/ghi?lsx=${lsx.id}&stage=${r.stage}`}>
                              Ghi
                            </Btn>
                          )}
                        </Td>
                      </GridRow>
                    ))}
                  </Fragment>
                )
              })}
            </GridBody>
          </Grid>
        </FastTab>

        <FastTab
          title="Phiếu báo sản lượng"
          flush
          summary={[
            ['Phiếu', fmt(docs.length)],
            ['Nháp', fmt(drafts)],
            ['Phế', fmt(defect)],
          ]}
          actions={
            canRecord ? (
              <Btn href={`/thongke/lsx/${lsx.id}/dinh-hinh`}>Định hình</Btn>
            ) : undefined
          }
        >
          <PhieuTab
            docs={docs}
            stageLabels={Object.fromEntries(stages.map((s) => [s.code, s.label]))}
            canRecord={canRecord}
          />
        </FastTab>

        <FastTab
          id="trao-doi"
          title="Trao đổi trên lệnh"
          summary={[['Ghi chú', 'người viết']]}
        >
          <DocNotesPanel
            docType="lsx"
            docId={lsx.id}
            meId={meId}
            meName={meName}
            followerNames={[]}
            marks={[
              { key: 'created', at: lsx.created_at, label: 'Phát hành lệnh' },
              { key: 'approved', at: lsx.approved_at, label: 'Giám đốc duyệt' },
              { key: 'completed', at: lsx.completed_at, label: 'Đóng lệnh' },
            ]}
            emptyHint={
              <>
                Chưa ai ghi gì về lệnh này. Ghi lại những gì đang xảy ra ngoài hệ thống —
                tổ nào báo thiếu vật tư, vì sao công đoạn đứng — để tháng sau còn tra được
                vì sao lệnh trễ.
              </>
            }
          />
        </FastTab>
      </DocBody>
    </DocScreen>
  )
}
