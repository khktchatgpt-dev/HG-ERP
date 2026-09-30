'use client'

import { useState } from 'react'
import {
  Btn,
  Consequence,
  Empty,
  Field,
  FieldGroup,
  Grid,
  GridBody,
  GridBtn,
  GridHead,
  GridRow,
  NumInput,
  Pick,
  Sheet,
  SheetActions,
  Tag,
  Td,
  TextArea,
  Th,
} from '@/components/kit'
import {
  COMMIT_KIND_LABEL,
  ISSUE_KINDS,
  ISSUE_KIND_LABEL,
  lineConfirm,
  slipDays,
  type IssueKind,
} from '@/lib/po-tracking'
import type { CommitLogRow, PoIssue } from '@/modules/dept/supply/po-tracking.repo'

/**
 * THEO DÕI THỰC HIỆN ĐƠN (0213) — ba bảng trong mục "Giao & nhận":
 *   1. Xác nhận theo DÒNG: đặt / NCC hẹn / đã về / còn thiếu + đủ / một phần /
 *      không xác nhận / chưa phản hồi.
 *   2. Sổ hẹn giao: mình đề nghị → NCC cam kết → dời → huỷ → nhập kho thật.
 *   3. Sổ sự cố: sai quy cách, thiếu/dư, hỏng, trễ — ghi nhận sai lệch thay vì
 *      sửa đơn "cho khớp".
 */

const dmy = (iso: string | null | undefined) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—'
const dmyAt = (ts: string) => {
  const d = new Date(ts)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` // prettier-ignore
}
const num = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 3 })

export type TrackLine = { id: string; code: string | null; name: string; unit: string; qty_ordered: number } // prettier-ignore
type Status = { id: string; qty_received: number | null; qty_missing: number | null; closed_short_at: string | null } // prettier-ignore
type Ship = { id: string; status: string; expected_date: string; lines: { po_line_id: string; qty: number }[] } // prettier-ignore

/* ── 1 · XÁC NHẬN THEO DÒNG ─────────────────────────────────────────────── */
export function XacNhanTheoDongGrid({
  lines,
  status,
  shipments,
  po,
}: {
  lines: TrackLine[]
  status: Status[]
  shipments: Ship[]
  po: { status: string; confirmed_at: string | null }
}) {
  const st = new Map(status.map((s) => [s.id, s]))
  return (
    <Grid minWidth={820}>
      <GridHead>
        <Th>Vật tư</Th>
        <Th num width={100}>
          Đặt
        </Th>
        <Th num width={100}>
          NCC hẹn
        </Th>
        <Th num width={100}>
          Đã về
        </Th>
        <Th num width={100}>
          Còn thiếu
        </Th>
        <Th width={150}>NCC xác nhận</Th>
      </GridHead>
      <GridBody>
        {lines.map((l) => {
          const c = lineConfirm(l, po, shipments)
          const s = st.get(l.id)
          const got = Number(s?.qty_received ?? 0)
          const miss = Number(s?.qty_missing ?? l.qty_ordered - got)
          return (
            <GridRow key={l.id}>
              <Td>
                {l.code && <span className="num k-strong">{l.code}</span>}
                {l.code ? ' · ' : ''}
                {l.name}
              </Td>
              <Td num>
                {num(l.qty_ordered)} {l.unit}
              </Td>
              <Td
                num
                tone={
                  c && c.kind !== 'du' && c.kind !== 'chua_phan_hoi' ? 'warn' : undefined
                }
              >
                {c && c.kind !== 'chua_phan_hoi' ? num(c.committed) : '—'}
              </Td>
              <Td num>{got > 0 ? num(got) : '—'}</Td>
              <Td num tone={miss > 1e-6 && got > 0 ? 'warn' : undefined}>
                {s?.closed_short_at
                  ? `chốt thiếu ${num(miss)}`
                  : miss > 1e-6
                    ? num(miss)
                    : '—'}
              </Td>
              <Td>{c ? <Tag tone={c.tone}>{c.label}</Tag> : '—'}</Td>
            </GridRow>
          )
        })}
      </GridBody>
    </Grid>
  )
}

/* ── 2 · SỔ HẸN GIAO ────────────────────────────────────────────────────── */
export function SoHenGiaoGrid({
  commits,
  receipts,
  linesById,
  currentEarliest,
}: {
  commits: CommitLogRow[]
  /** Phiếu nhập thật — vế "thực tế" của sổ. */
  /** `at` = ngày hàng về, `entered_at` = lúc ghi máy (cột "Ghi lúc"). */
  receipts: { code: string; at: string; entered_at: string; qty_total: number }[]
  linesById: Map<string, TrackLine>
  /** Ngày đợt còn sống sớm nhất hiện tại — để tính NCC đã dời bao nhiêu ngày. */
  currentEarliest: string | null
}) {
  const slip = slipDays(commits, currentEarliest)
  type Row = { key: string; at: string; what: string; tone: 'neutral' | 'warn' | 'done' | 'stop'; dates: string; goods: string; reason: string; who: string } // prettier-ignore
  const goods = (ls: { po_line_id: string; qty: number }[]) =>
    ls.map((l) => `${linesById.get(l.po_line_id)?.name ?? '?'} ${num(l.qty)}`).join(' · ')
  const rows: Row[] = [
    ...commits.map((c) => ({
      key: c.id,
      at: c.created_at,
      what: COMMIT_KIND_LABEL[c.kind],
      tone: (c.kind === 'doi_hen' || c.kind === 'doi_hen_don' ? 'warn' : c.kind === 'huy_dot' ? 'stop' : c.kind === 'ncc_xac_nhan' || c.kind === 'them_dot' ? 'done' : 'neutral') as Row['tone'], // prettier-ignore
      dates: c.date_before && c.date_after ? `${dmy(c.date_before)} → ${dmy(c.date_after)}` : dmy(c.date_after ?? c.date_before), // prettier-ignore
      goods: goods(c.lines),
      reason: c.reason ?? '',
      who: c.created_by_name ?? '',
    })),
    ...receipts.map((r) => ({
      key: `pn-${r.code}`,
      // Bảng này là NHẬT KÝ theo lúc ghi — sắp + cột "Ghi lúc" dùng giờ ghi máy;
      // cột ngày bên cạnh mới là ngày hàng về.
      at: r.entered_at,
      what: 'Nhập kho thực tế',
      tone: 'done' as const,
      dates: dmy(r.at.slice(0, 10)),
      goods: `${r.code} · ${num(r.qty_total)} đơn vị`,
      reason: '',
      who: 'Kho',
    })),
  ].sort((a, b) => a.at.localeCompare(b.at))

  if (rows.length === 0) {
    return (
      <div className="px-[var(--gutter)] py-3">
        <Empty
          headline="Chưa có mốc hẹn giao nào"
          reason="Sổ bắt đầu ghi từ 27/09/2026: khi NCC xác nhận, thêm đợt, dời hay huỷ đợt, dời hẹn cả đơn."
          next="Bấm “NCC xác nhận” khi NCC chốt ngày giao."
        />
      </div>
    )
  }
  return (
    <>
      {slip != null && slip !== 0 && (
        <div className="text-k-sm border-b border-[var(--hair)] px-[var(--gutter)] py-1.5">
          <Tag tone={slip > 0 ? 'warn' : 'done'}>
            {slip > 0 ? `NCC đã dời ${slip} ngày` : `Sớm ${-slip} ngày`}
          </Tag>{' '}
          so với lần cam kết đầu tiên.
        </div>
      )}
      <Grid minWidth={900}>
        <GridHead>
          <Th width={100}>Lúc ghi</Th>
          <Th width={140}>Việc</Th>
          <Th width={170}>Ngày hẹn</Th>
          <Th>Hàng</Th>
          <Th>Lý do / ghi chú</Th>
          <Th width={140}>Người ghi</Th>
        </GridHead>
        <GridBody>
          {rows.map((r) => (
            <GridRow key={r.key}>
              <Td num>{dmyAt(r.at)}</Td>
              <Td>
                <Tag tone={r.tone}>{r.what}</Tag>
              </Td>
              <Td num>{r.dates}</Td>
              <Td>{r.goods || '—'}</Td>
              <Td>{r.reason || '—'}</Td>
              <Td>{r.who || '—'}</Td>
            </GridRow>
          ))}
        </GridBody>
      </Grid>
    </>
  )
}

/* ── 3 · SỔ SỰ CỐ ───────────────────────────────────────────────────────── */
export function SuCoGrid({
  issues,
  linesById,
  canEdit,
  onResolve,
}: {
  issues: PoIssue[]
  linesById: Map<string, TrackLine>
  canEdit: boolean
  onResolve: (i: PoIssue) => void
}) {
  if (issues.length === 0) {
    return (
      <div className="text-k-sm px-[var(--gutter)] pb-3 text-[var(--ink-2)]">
        Chưa ghi sự cố nào — hàng sai quy cách, thiếu, dư, hỏng hay giao trễ thì ghi ở đây
        thay vì sửa đơn cho khớp.
      </div>
    )
  }
  return (
    <Grid minWidth={900}>
      <GridHead>
        <Th width={100}>Lúc ghi</Th>
        <Th width={170}>Loại</Th>
        <Th>Dòng · mô tả</Th>
        <Th num width={90}>
          SL
        </Th>
        <Th width={200}>Xử lý</Th>
        {canEdit && <Th width={90} />}
      </GridHead>
      <GridBody>
        {issues.map((i) => {
          const l = i.po_line_id ? linesById.get(i.po_line_id) : null
          return (
            <GridRow key={i.id}>
              <Td num>{dmyAt(i.created_at)}</Td>
              <Td>
                <Tag tone={i.status === 'mo' ? 'stop' : 'done'}>
                  {ISSUE_KIND_LABEL[i.kind]}
                </Tag>
              </Td>
              <Td>
                {l ? <b>{l.name}: </b> : null}
                {i.description}
                {i.created_by_name ? (
                  <span className="k-t-mut"> · {i.created_by_name}</span>
                ) : null}
              </Td>
              <Td num>{i.qty != null ? num(i.qty) : '—'}</Td>
              <Td>
                {i.status === 'mo' ? (
                  <Tag tone="warn">Đang mở</Tag>
                ) : (
                  <>
                    {i.resolution}
                    <span className="k-t-mut">
                      {' '}
                      · {i.resolved_by_name ?? ''}{' '}
                      {i.resolved_at ? dmyAt(i.resolved_at) : ''}
                    </span>
                  </>
                )}
              </Td>
              {canEdit && (
                <Td>
                  {i.status === 'mo' && (
                    <GridBtn onClick={() => onResolve(i)}>Đóng</GridBtn>
                  )}
                </Td>
              )}
            </GridRow>
          )
        })}
      </GridBody>
    </Grid>
  )
}

export function GhiSuCoSheet({
  lines,
  busy,
  onClose,
  onSubmit,
}: {
  lines: TrackLine[]
  busy: boolean
  onClose: () => void
  onSubmit: (x: { kind: IssueKind; po_line_id: string | null; qty: number | null; description: string }) => Promise<boolean> // prettier-ignore
}) {
  const [kind, setKind] = useState<IssueKind>('sai_quy_cach')
  const [lineId, setLineId] = useState('')
  const [qty, setQty] = useState('')
  const [desc, setDesc] = useState('')
  const ok = desc.trim().length >= 5
  return (
    <Sheet
      open
      onClose={onClose}
      width={560}
      title="Ghi sự cố giao hàng"
      subtitle="Ghi nhận sai lệch — KHÔNG sửa đơn cho khớp. Đơn vẫn giữ đúng thứ đã đặt; sự cố là vết để đòi NCC và đánh giá NCC."
      footer={
        <SheetActions
          busy={busy}
          disabled={!ok || busy}
          onCancel={onClose}
          confirmLabel="Ghi sự cố"
          onConfirm={() =>
            ok &&
            void onSubmit({
              kind,
              po_line_id: lineId || null,
              qty:
                qty.trim() === ''
                  ? null
                  : Number(qty.replace(/\./g, '').replace(',', '.')),
              description: desc.trim(),
            }).then((r) => r && onClose())
          }
        />
      }
    >
      <FieldGroup title="Sự cố">
        <Field label="Loại">
          <Pick
            label="Loại sự cố"
            value={kind}
            onChange={(v) => setKind(v as IssueKind)}
            options={ISSUE_KINDS.map((k) => ({ value: k, label: ISSUE_KIND_LABEL[k] }))}
          />
        </Field>
        <Field label="Dòng hàng">
          <Pick
            label="Dòng hàng"
            value={lineId}
            onChange={setLineId}
            options={[{ value: '', label: '— cả đơn —' }, ...lines.map((l) => ({ value: l.id, label: `${l.code ? `${l.code} · ` : ''}${l.name}` }))]} // prettier-ignore
          />
        </Field>
        <Field label="Số lượng liên quan">
          <NumInput aria-label="Số lượng liên quan" value={qty} onCommit={setQty} />
        </Field>
      </FieldGroup>
      <FieldGroup title="Mô tả">
        <TextArea
          value={desc}
          onChange={setDesc}
          rows={3}
          placeholder="Ví dụ: đặt MDF 18mm, NCC giao 15mm — 40 tấm, đã để kệ khoá"
        />
      </FieldGroup>
      {!ok && <p className="text-k-sm k-t-mut">Mô tả ít nhất 5 ký tự.</p>}
    </Sheet>
  )
}

export function DongSuCoSheet({
  issue,
  busy,
  onClose,
  onSubmit,
}: {
  issue: PoIssue
  busy: boolean
  onClose: () => void
  onSubmit: (resolution: string) => Promise<boolean>
}) {
  const [text, setText] = useState('')
  const ok = text.trim().length >= 5
  return (
    <Sheet
      open
      onClose={onClose}
      width={520}
      title={`Đóng sự cố · ${ISSUE_KIND_LABEL[issue.kind]}`}
      subtitle={issue.description}
      footer={
        <SheetActions
          busy={busy}
          disabled={!ok || busy}
          onCancel={onClose}
          confirmLabel="Đóng sự cố"
          onConfirm={() => ok && void onSubmit(text.trim()).then((r) => r && onClose())}
        />
      }
    >
      <Consequence>
        Sự cố đóng lại vẫn nằm trong sổ, kèm cách xử lý và người đóng.
      </Consequence>
      <FieldGroup title="Đã xử lý thế nào">
        <TextArea
          value={text}
          onChange={setText}
          rows={3}
          placeholder="Ví dụ: NCC đổi hàng 15/10 · trả NCC phiếu XT-… · NCC giao bù đợt 3"
        />
      </FieldGroup>
      {!ok && <p className="text-k-sm k-t-mut">Ghi cách xử lý ít nhất 5 ký tự.</p>}
    </Sheet>
  )
}

/** Nút mở hộp ghi sự cố — dùng ở hàng nút của khối Giao & nhận. */
export function GhiSuCoBtn({
  disabled,
  why,
  onClick,
}: {
  disabled: boolean
  why?: string
  onClick: () => void
}) {
  return (
    <Btn icon="canhBao" disabled={disabled} title={why} onClick={onClick}>
      Ghi sự cố
    </Btn>
  )
}
