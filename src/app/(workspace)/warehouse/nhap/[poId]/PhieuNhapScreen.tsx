'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isoToVn } from '@/lib/date-vn'
import { lichDot, nhanDot, type DotGiao } from '@/lib/kho-dot-giao'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  danhGiaVuot,
  kiemTruocGhiSo,
  tinhTong,
  type DongNhan,
  type TinhTrang,
} from '@/lib/kho-phieu-nhap'
import {
  Action,
  ActionGroup,
  ActionPane,
  Affected,
  CellHint,
  Code,
  CommitBar,
  Consequence,
  Crumb,
  DateInput,
  DocHead,
  FastTab,
  Field,
  FieldGrid,
  Grid,
  GridBody,
  GridFoot,
  GridHead,
  GridRow,
  GridToolbar,
  LineStatus,
  NoticeBar,
  NumInput,
  Pick,
  Sheet,
  SheetActions,
  StatusBar,
  StatusTrack,
  Tag,
  TextArea,
  TextInput,
  Th,
} from '@/components/kit'

const TINH_TRANG: { value: TinhTrang; label: string }[] = [
  { value: 'ok', label: 'Đạt' },
  { value: 'blocked', label: 'Sai quy cách' },
]

const fmt = (n: number) => n.toLocaleString('vi-VN')

/**
 * PHIẾU NHẬP THEO ĐƠN — màn chứng từ + lưới (Bước 1 Kho). Bản thiết kế:
 * https://claude.ai/artifact/G9Zso3vzCHUYpNGRp9o7Nf (artboard 2 + 2b).
 *
 * Ba cột số Đặt · Đã về · Lần này (SAP MIGO / BC). Tình trạng chỉ HAI giá trị
 * vì thủ kho vừa nhận vừa kiểm (chốt 15/09): Đạt → tồn dùng được; Sai quy
 * cách → vào kệ khoá, bắt ghi chú — lý do đi theo lô suốt đời nó.
 *
 * Cảnh báo hiện NGAY DƯỚI Ô khi gõ (CellHint), thanh chốt nói vì sao chưa ghi
 * sổ được bằng câu bấm được (nhảy tới ô phải sửa, hoặc mở hộp lý do nhận
 * vượt). Không lưu nháp: phiếu lập trong ba phút, nháp là chỗ quên.
 *
 * GHI SỔ = một POST `docs/receipt` (route 12 dòng khôi phục ở việc 1) —
 * server vẫn là người quyết: khớp dòng đơn, dung sai cộng dồn, khoá bắt ghi
 * chú, đợt giao → received, trạng thái đơn tính lại. Màn chỉ nói trước.
 */
export function PhieuNhapScreen({
  po,
  dot,
  dots,
  rows: initialRows,
  boQuaTuDo,
  today,
  nguoiNhan,
  canEdit,
}: {
  po: {
    id: string
    code: string
    supplier_name: string
    lsx_code: string | null
    expected_at: string | null
  }
  dot: { id: string; seq: number; total: number; expected_date: string } | null
  /** Mọi đợt giao của đơn (việc 6) — để nhãn từng dòng và dải lịch giao. */
  dots: DotGiao[]
  rows: DongNhan[]
  boQuaTuDo: number
  today: string
  nguoiNhan: string
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [rows, setRows] = useState(initialRows)
  const [docDate, setDocDate] = useState(today)
  const [supplierDocNo, setSupplierDocNo] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [overReason, setOverReason] = useState('')
  const [overDraft, setOverDraft] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const patch = (i: number, p: Partial<DongNhan>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)))

  const tong = useMemo(() => tinhTong(rows), [rows])
  const coLyDoVuot = overReason.trim() !== ''
  const kiem = useMemo(() => kiemTruocGhiSo(rows, coLyDoVuot), [rows, coLyDoVuot])
  const dongVuot = useMemo(
    () =>
      rows
        .map((r) => ({ r, v: r.editable ? danhGiaVuot(r) : null }))
        .filter(
          (x): x is { r: DongNhan; v: NonNullable<ReturnType<typeof danhGiaVuot>> } =>
            x.v != null && !x.v.trong_dung_sai,
        ),
    [rows],
  )

  const moHopLyDo = () => {
    setOverDraft(overReason)
    setSheetOpen(true)
  }

  // Nhảy tới ô phải sửa bằng id: kit `NumInput`/`TextInput` là hàm thường,
  // không forwardRef, mà `id` thì đi qua `...rest` xuống <input>.
  const nhayToi = () => {
    if (kiem.ok) return
    if (kiem.reason === 'vuot_dung_sai') return moHopLyDo()
    if (kiem.line == null || kiem.line < 0) return
    const el = document.getElementById(
      `${kiem.reason === 'thieu_ghi_chu' ? 'ghi-chu' : 'lan-nay'}-${kiem.line}`,
    ) as HTMLInputElement | null
    el?.focus()
    el?.select()
  }

  const blocked = !canEdit
    ? 'Tài khoản này không có quyền ghi sổ kho'
    : !kiem.ok
      ? kiem.message
      : busy
        ? 'Đang ghi sổ…'
        : undefined
  const ghiDuoc = blocked == null

  async function ghiSo() {
    if (!ghiDuoc) return
    setBusy(true)
    try {
      const res = await api<{ id: string; code: string; po_status: string | null }>(
        '/api/dept/warehouse/docs/receipt',
        {
          method: 'POST',
          body: {
            po_id: po.id,
            shipment_id: dot?.id ?? null,
            counterparty: counterparty.trim() || null,
            supplier_doc_no: supplierDocNo.trim() || null,
            doc_date: docDate || null,
            allow_over: dongVuot.length > 0 && coLyDoVuot,
            over_reason: dongVuot.length > 0 && coLyDoVuot ? overReason.trim() : null,
            lines: rows
              .filter((r) => r.qty > 0)
              .map((r) => ({
                material_id: r.material_id,
                po_line_id: r.po_line_id,
                qty: r.qty,
                stock_status: r.status,
                note: r.note.trim() || null,
              })),
          },
        },
      )
      toast.success(
        `Đã ghi sổ ${res.code}`,
        `${tong.so_dong_nhan} dòng · ${fmt(tong.lan_nay)} đơn vị${tong.vao_khoa > 0 ? ` · ${fmt(tong.vao_khoa)} vào khoá` : ''} — xem lại ở Sổ phiếu`,
      )
      // Không ở lại form: ở lại là mời ghi sổ hai lần.
      router.push('/warehouse/nhap')
      router.refresh()
    } catch (e) {
      // Server là người quyết: OVER_RECEIPT (409) tới đây khi dung sai server
      // khác số màn đoán — câu của server nói rõ dòng nào, vượt bao nhiêu.
      toast.error('Chưa ghi sổ được', apiErrorText(e))
      setBusy(false)
    }
  }

  // Dòng này thuộc đợt nào — nói ra thay vì để ô Lần này = 0 câm lặng.
  const nhan = useMemo(
    () =>
      nhanDot(
        rows.map((r) => r.po_line_id),
        dots,
        dot?.id ?? null,
      ),
    [rows, dots, dot],
  )
  const lich = useMemo(() => lichDot(dots, dot?.id ?? null, today), [dots, dot, today])

  const dotLabel = dot
    ? `đợt ${dot.seq}/${dot.total} · hẹn ${isoToVn(dot.expected_date)}`
    : po.expected_at
      ? `không theo đợt · hẹn giao ${isoToVn(po.expected_at)}`
      : 'không theo đợt · chưa hẹn ngày'

  return (
    <div
      className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault()
          if (ghiDuoc) void ghiSo()
          else nhayToi()
        }
      }}
    >
      <Crumb
        path={[
          { label: 'Kho', href: '/warehouse/nhap' },
          { label: 'Hàng về', href: '/warehouse/nhap' },
          `Nhận hàng ${po.code}`,
        ]}
      />
      <ActionPane>
        <ActionGroup label="Phiếu">
          <Action
            primary
            disabled={!ghiDuoc}
            title={blocked}
            onClick={() => void ghiSo()}
          >
            {busy ? 'Đang ghi sổ…' : 'Ghi sổ'}
          </Action>
          <Action disabled={busy} onClick={() => router.push('/warehouse/nhap')}>
            Huỷ
          </Action>
        </ActionGroup>
        <ActionGroup label="Đơn">
          <Action onClick={() => router.push(`/mua-hang/don/${po.id}`)}>
            Mở đơn mua
          </Action>
        </ActionGroup>
      </ActionPane>
      <DocHead
        compact
        kind="Phiếu nhập kho · theo đơn mua"
        code={po.code}
        sub={`${po.supplier_name} · ${dotLabel} · số phiếu PNK cấp khi ghi sổ`}
      >
        <StatusTrack label="Phiếu" steps={['Đang lập', 'Đã ghi sổ']} at={0} />
      </DocHead>

      <FastTab title="Đầu phiếu" defaultOpen>
        <FieldGrid
          note={
            lich.length > 0 ? (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold text-[var(--ink-label)]">
                  Lịch giao cả đơn
                </span>
                {lich.map((d) => {
                  const text = `Đợt ${d.seq} · ${isoToVn(d.date).slice(0, 5)} · ${d.label}`
                  const tone =
                    d.tone === 'done' || d.tone === 'stop' || d.tone === 'warn'
                      ? d.tone
                      : 'neutral'
                  // Đợt còn nhận được mà không phải đợt đang mở → bấm là đổi đợt.
                  return d.current || d.status === 'received' ? (
                    <span key={d.id} className={d.current ? 'font-semibold' : undefined}>
                      <Tag tone={tone}>{text}</Tag>
                    </span>
                  ) : (
                    <Code key={d.id} as="a" href={`/warehouse/nhap/${po.id}?dot=${d.id}`}>
                      {text}
                    </Code>
                  )
                })}
              </span>
            ) : (
              'Đơn chưa khai đợt giao — nhận theo phần còn mở của cả đơn; Cung ứng khai đợt ở trang đơn mua.'
            )
          }
        >
          <Field label="Đơn mua">
            <Code as="a" href={`/mua-hang/don/${po.id}`}>
              {po.code}
            </Code>
          </Field>
          <Field label="Nhà cung cấp">{po.supplier_name}</Field>
          <Field label="Lệnh SX">
            {po.lsx_code ? (
              <span className="num">{po.lsx_code}</span>
            ) : (
              <span className="text-[var(--ink-3)]">không theo lệnh</span>
            )}
          </Field>
          <Field label="Đợt giao">{dotLabel}</Field>
          <Field label="Ngày chứng từ">
            <DateInput value={docDate} onChange={setDocDate} label="Ngày chứng từ" />
          </Field>
          <Field label="Số phiếu giao NCC">
            <TextInput
              value={supplierDocNo}
              onCommit={setSupplierDocNo}
              placeholder="số trên phiếu của NCC"
              mono
              label="Số phiếu giao NCC"
            />
          </Field>
          <Field label="Người giao">
            <TextInput
              value={counterparty}
              onCommit={setCounterparty}
              placeholder="tên tài xế / NV giao"
              label="Người giao"
            />
          </Field>
          <Field label="Người nhận">
            <span className="text-[var(--ink-3)]">
              {nguoiNhan} · theo phiên đăng nhập
            </span>
          </Field>
        </FieldGrid>
      </FastTab>

      {boQuaTuDo > 0 && (
        <NoticeBar tone="warn" tag="Dòng tự do" action={{ label: 'Xem ở đơn mua' }}>
          Đơn có <b>{boQuaTuDo}</b> dòng tự do (gỗ / gia công không mã vật tư) — nghiệm
          thu ở trang đơn, không lên phiếu nhập.
        </NoticeBar>
      )}

      {dongVuot.length > 0 && coLyDoVuot && (
        <NoticeBar
          tone="warn"
          tag="Nhận vượt"
          action={{ label: 'Sửa lý do', onClick: moHopLyDo }}
        >
          {dongVuot.map((x) => x.r.code).join(', ')} nhận vượt dung sai — lý do:{' '}
          <b>{overReason.trim()}</b>. Ghi vào ghi chú phiếu, Cung ứng thấy khi đối chiếu.
        </NoticeBar>
      )}

      <GridToolbar
        count={`${rows.length} dòng · ${rows.filter((r) => !r.editable).length} đã đủ`}
      >
        <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">
          Nhận theo phần <b>còn mở</b> của {dot ? 'đợt' : 'đơn'} — dòng đã đủ không có ô
          nhập
        </span>
      </GridToolbar>

      <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
        <Grid minWidth={1100}>
          <GridHead>
            <Th width={30}>#</Th>
            <Th width={96}>Mã</Th>
            <Th width={128}>Đợt</Th>
            <Th>Tên vật tư</Th>
            <Th width={52}>ĐVT</Th>
            <Th num width={80}>
              Đặt
            </Th>
            <Th num width={80}>
              Đã về
            </Th>
            <Th num width={110}>
              Lần này
            </Th>
            <Th width={146}>Tình trạng</Th>
            <Th width={300}>Ghi chú</Th>
          </GridHead>
          <GridBody>
            {rows.map((r, i) => {
              const vuot = r.editable ? danhGiaVuot(r) : null
              return (
                <GridRow key={r.po_line_id}>
                  <td className="k-c-n">{i + 1}</td>
                  <td>
                    <Code>{r.code}</Code>
                  </td>
                  <td className="text-[var(--fs-micro)]">
                    {(() => {
                      const n = nhan.get(r.po_line_id) ?? { kind: 'none' as const }
                      if (n.kind === 'this')
                        return (
                          <Tag tone="neutral">
                            đợt {n.seq} · {fmt(n.qty)} {r.unit}
                          </Tag>
                        )
                      if (n.kind === 'other')
                        return (
                          <span className="text-[var(--ink-3)]">
                            đợt {n.seq} · {isoToVn(n.date).slice(0, 5)}
                            {n.arrived ? ' · xe đã tới' : ''}
                          </span>
                        )
                      if (n.kind === 'done')
                        return <Tag tone="done">đã nhận đợt {n.seq}</Tag>
                      return (
                        <span className="text-[var(--ink-empty)]">
                          {dots.length > 0 ? 'chưa xếp đợt' : '—'}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="max-w-0 truncate" title={r.name}>
                    {r.name}
                  </td>
                  <td className="text-[var(--ink-3)]">{r.unit}</td>
                  <td className="k-r num">{fmt(r.qty_ordered)}</td>
                  <td className="k-r num text-[var(--ink-3)]">{fmt(r.qty_received)}</td>
                  <td className="k-r">
                    {r.editable ? (
                      <>
                        <NumInput
                          id={`lan-nay-${i}`}
                          value={String(r.qty)}
                          disabled={busy}
                          onCommit={(v) =>
                            patch(i, {
                              qty: Number(v.replace(/\./g, '').replace(',', '.')) || 0,
                            })
                          }
                          aria-label={`Lần này ${r.code}`}
                        />
                        {r.status === 'blocked' && r.qty > 0 && (
                          <CellHint tone="warn">
                            {fmt(r.qty)} {r.unit} vào KHOÁ
                          </CellHint>
                        )}
                        {vuot &&
                          (vuot.trong_dung_sai ? (
                            <CellHint tone="neutral">
                              vượt {vuot.pct.toFixed(0)}% · trong dung sai{' '}
                              {r.over_tolerance_pct}%
                            </CellHint>
                          ) : (
                            <CellHint
                              tone="warn"
                              onClick={moHopLyDo}
                              title="Vượt ngưỡng của mã — bấm để ghi lý do nhận vượt"
                            >
                              vượt {vuot.pct.toFixed(0)}% · dung sai{' '}
                              {r.over_tolerance_pct}% ·{' '}
                              {coLyDoVuot ? 'đã có lý do' : 'ghi lý do'}
                            </CellHint>
                          ))}
                      </>
                    ) : (
                      <LineStatus kind={r.closed_short ? 'short' : 'done'}>
                        {r.closed_short ? 'đã chốt thiếu' : 'đã đủ'}
                      </LineStatus>
                    )}
                  </td>
                  <td>
                    {r.editable ? (
                      <Pick
                        value={r.status}
                        onChange={(v) => patch(i, { status: v as TinhTrang })}
                        options={TINH_TRANG}
                        label={`Tình trạng ${r.code}`}
                        width={130}
                        disabled={busy}
                      />
                    ) : (
                      <span className="text-[var(--ink-empty)]">—</span>
                    )}
                  </td>
                  <td>
                    {r.editable ? (
                      <TextInput
                        id={`ghi-chu-${i}`}
                        value={r.note}
                        onCommit={(v) => patch(i, { note: v })}
                        disabled={busy}
                        placeholder={
                          r.status === 'blocked'
                            ? 'bắt buộc: vì sao sai quy cách'
                            : 'ghi chú (không bắt buộc)'
                        }
                        label={`Ghi chú ${r.code}`}
                      />
                    ) : (
                      <span className="text-[var(--ink-empty)]">—</span>
                    )}
                  </td>
                </GridRow>
              )
            })}
          </GridBody>
          <GridFoot>
            <td colSpan={5}>Tổng</td>
            <td className="k-r num">{fmt(tong.tong_dat)}</td>
            <td className="k-r num">{fmt(tong.tong_da_ve)}</td>
            <td className="k-r num">{fmt(tong.lan_nay)}</td>
            <td colSpan={2} className="font-normal text-[var(--ink-3)]">
              {tong.so_dong_nhan} dòng nhận · {fmt(tong.vao_khoa)} vào khoá ·{' '}
              {fmt(tong.dung_duoc)} dùng được
            </td>
          </GridFoot>
        </Grid>
      </div>

      <CommitBar
        totals={[
          { label: 'Dòng nhận', value: tong.so_dong_nhan },
          { label: 'Lần này', value: fmt(tong.lan_nay) },
          { label: 'Vào khoá', value: fmt(tong.vao_khoa) },
        ]}
        grand={{ label: 'Dùng được', value: fmt(tong.dung_duoc) }}
        blocked={blocked}
        onGoBlocked={kiem.ok ? undefined : nhayToi}
        actions={
          <>
            <span className="text-[var(--fs-micro)] text-[var(--ink-3)]">
              Ctrl + Enter
            </span>
            <Action
              primary
              disabled={!ghiDuoc}
              title={blocked}
              onClick={() => void ghiSo()}
            >
              {busy ? 'Đang ghi sổ…' : 'Ghi sổ'}
            </Action>
          </>
        }
      />
      <StatusBar
        left={[
          'Hàng đạt vào khu tiếp nhận · hàng sai quy cách vào kệ khoá · tồn chỉ đổi khi ghi sổ',
          'Số Đặt / Đã về cùng nguồn với trang đơn mua',
        ]}
        right={`${rows.length} dòng`}
      />

      {sheetOpen && (
        <Sheet
          open
          onClose={() => setSheetOpen(false)}
          stakes="vua"
          title="Nhận vượt dung sai"
          subtitle={`${dongVuot.length} dòng nhận nhiều hơn phần còn mở, quá ngưỡng của mã. Lý do đi vào ghi chú phiếu.`}
          footer={
            <SheetActions
              onCancel={() => setSheetOpen(false)}
              onConfirm={() => {
                setOverReason(overDraft)
                setSheetOpen(false)
              }}
              confirmLabel="Xác nhận nhận vượt"
              cancelLabel="Quay lại sửa số"
              disabled={overDraft.trim() === ''}
            />
          }
        >
          <Affected
            items={dongVuot.map(({ r, v }) => ({
              code: r.code,
              label: r.name,
              amount: `+${fmt(v.vuot)} ${r.unit} · ${v.pct.toFixed(0)}%`,
              note: `đặt ${fmt(r.qty_ordered)} · còn mở ${fmt(r.qty_open)} · lần này ${fmt(r.qty)} · dung sai ${r.over_tolerance_pct}%`,
            }))}
          />
          <div className="mt-3">
            <div className="mb-1 font-bold tracking-[.09em] text-[var(--fs-label)] text-[var(--ink-label)] uppercase">
              Lý do nhận vượt · bắt buộc
            </div>
            <TextArea
              value={overDraft}
              onChange={setOverDraft}
              rows={3}
              placeholder="ví dụ: NCC gộp phần thiếu của đợt trước, Cung ứng đã đồng ý"
              aria-label="Lý do nhận vượt"
            />
          </div>
          <Consequence>
            Đơn mua sẽ hiện phần nhận vượt cho Cung ứng đối chiếu hoá đơn. Không muốn nhận
            vượt thì sửa số Lần này về bằng phần còn mở.
          </Consequence>
        </Sheet>
      )}
    </div>
  )
}
