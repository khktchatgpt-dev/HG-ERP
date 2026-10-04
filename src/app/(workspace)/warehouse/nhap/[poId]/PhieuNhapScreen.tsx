'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isoToVn } from '@/lib/date-vn'
import { lichDot, nhanDot, type DotGiao } from '@/lib/kho-dot-giao'
import { dotCuaPhieu } from '@/lib/phieu-nhap-cho'
import { canNhacSoNcc, ghiChuPhieu, nguoiGiaoBanDau } from '@/lib/phieu-nhap-dau'
import { ghiChuLuiNgay, kiemNgayChungTu, LUI_TU_DO } from '@/lib/ngay-chung-tu-nhap'
import { api, apiErrorText } from '@/lib/api'
import {
  WarehouseDocPrintSheet,
  type WarehousePrintLine,
} from '@/app/print/warehouse/WarehouseDocPrintSheet'
import type { PrintCompany } from '@/app/print/PrintSheet'
import type { DocTemplate } from '@/lib/doc-templates'
import {
  danhGiaVuot,
  kiemTruocGhiSo,
  sauPhieu,
  tinhTong,
  type DongNhan,
  type TinhTrang,
} from '@/lib/kho-phieu-nhap'
import { kgDuKien, lechKg } from '@/lib/can-kg'
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
  DocHead,
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
  ScreenFrame,
  Sheet,
  SheetActions,
  StatusBar,
  StatusTrack,
  Tag,
  TextArea,
  TextInput,
  Th,
  useToast,
} from '@/components/kit'
import { DUONG, type NoiNhan } from './duong'
import { DauPhieu, NhacSoNccSheet, O_LY_DO_LUI, O_SO_NCC } from './dau-phieu'

export type { NoiNhan }

const TINH_TRANG: { value: TinhTrang; label: string }[] = [
  { value: 'ok', label: 'Đạt' },
  { value: 'blocked', label: 'Sai quy cách' },
]

const fmt = (n: number) => n.toLocaleString('vi-VN')
/** Số kiểu VN: "1.390" = 1390 · "108,40" = 108,4. */
const docSo = (v: string) => Number(v.replace(/\./g, '').replace(',', '.')) || 0

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
  noi,
  suaLai = null,
  po,
  dot,
  dots,
  rows: initialRows,
  boQuaTuDo,
  today,
  nguoiNhan,
  canEdit,
  company,
  tpl,
}: {
  po: {
    id: string
    code: string
    supplier_name: string
    lsx_code: string | null
    /** Lệnh chính + lệnh gom (0125) — đơn nhiều lệnh in đủ. */
    lsx_codes: string[]
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
  company: PrintCompany
  tpl: DocTemplate
  /** Cửa vào: khu Kho hay khu Cung ứng (nhận thay Kho). */
  noi: NoiNhan
  /** SỬA PHIẾU NHẬP (02/10/2026): phiếu cũ đã đảo — form điền sẵn số của nó. */
  suaLai?: { id: string; code: string; daoBoi: string; docDate: string; supplierDocNo: string; counterparty: string } | null // prettier-ignore
}) {
  const duong = DUONG[noi]
  const router = useRouter()
  const toast = useToast()
  const [rows, setRows] = useState(initialRows)
  const [docDate, setDocDate] = useState(suaLai?.docDate ?? today)
  const [supplierDocNo, setSupplierDocNo] = useState(suaLai?.supplierDocNo ?? '')
  const [counterparty, setCounterparty] = useState(() => nguoiGiaoBanDau(suaLai, po.supplier_name)) // prettier-ignore
  const [ghiChu, setGhiChu] = useState('')
  /** Hộp nhắc số phiếu NCC (bản vẽ J1b) — mở khi bấm Ghi sổ mà ô còn trống. */
  const [nhacSoNcc, setNhacSoNcc] = useState(false)
  /** Lý do nhập lùi quá 7 ngày (05/10/2026) — chỉ hiện ô khi lùi xa. */
  const [lyDoLui, setLyDoLui] = useState('')
  const [overReason, setOverReason] = useState('')
  const [overDraft, setOverDraft] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  /** Xem bản in TRƯỚC khi ghi sổ — vẽ bằng ĐÚNG component của trang in. */
  const [xemIn, setXemIn] = useState(false)
  const [busy, setBusy] = useState(false)

  const patch = (i: number, p: Partial<DongNhan>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)))

  const tong = useMemo(() => tinhTong(rows), [rows])
  /** Cột Kg cân chỉ hiện khi đơn có dòng nhôm / thép trả tiền theo kg. */
  const coKg = rows.some((r) => r.can_kg)
  const conCho = rows.reduce((a, r) => a + (r.editable ? r.qty_open : 0), 0)
  const kgCan = rows.reduce(
    (a, r) => a + (r.can_kg && r.qty > 0 ? (r.kg_can ?? 0) : 0),
    0,
  )
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
  // Ngày chứng từ — luật chung với server (lib/ngay-chung-tu-nhap), báo NGAY tại ô.
  const ngay = kiemNgayChungTu({ docDate, today, lyDo: lyDoLui, laLapLai: !!suaLai })
  const luiXa = !suaLai && ngay.lui > LUI_TU_DO

  const nhayToi = () => {
    if (ngay.muc !== 'ok') {
      const sel =
        ngay.muc === 'can_ly_do' ? `#${O_LY_DO_LUI}` : 'input[aria-label="Ngày chứng từ"]'
      return (document.querySelector(sel) as HTMLInputElement | null)?.focus()
    }
    if (kiem.ok) return
    if (kiem.reason === 'vuot_dung_sai') return moHopLyDo()
    if (kiem.line == null || kiem.line < 0) return
    const o = kiem.reason === 'thieu_ghi_chu' ? 'ghi-chu' : 'lan-nay'
    const el = document.getElementById(`${o}-${kiem.line}`) as HTMLInputElement | null
    el?.focus()
    el?.select()
  }

  const blocked = !canEdit
    ? 'Tài khoản này không có quyền ghi sổ kho'
    : ngay.muc !== 'ok'
      ? ngay.message
      : !kiem.ok
        ? kiem.message
        : busy
          ? 'Đang ghi sổ…'
          : undefined
  const ghiDuoc = blocked == null

  /** Nút Ghi sổ / Ctrl+Enter: thiếu số phiếu NCC thì nhắc một lần trước (không chặn). */
  const bamGhiSo = () => {
    if (!ghiDuoc) return nhayToi()
    if (canNhacSoNcc(supplierDocNo)) return setNhacSoNcc(true)
    void ghiSo(supplierDocNo)
  }
  /*
    Ctrl+Enter khi con trỏ còn TRONG Ô (04/10/2026): ô kit chỉ chốt chữ lúc rời
    ô, nên gõ số phiếu NCC / ghi chú / Lần này rồi Ctrl+Enter là ghi sổ bằng số
    CŨ. Rời ô trước, rồi gọi bản bamGhiSo MỚI NHẤT (sau khi state đã nhận chữ)
    qua ref — closure của lần render này còn giữ số cũ.
  */
  const bamMoiNhat = useRef(bamGhiSo)
  useLayoutEffect(() => {
    bamMoiNhat.current = bamGhiSo
  })

  async function ghiSo(soNcc: string) {
    if (!ghiDuoc) return
    setNhacSoNcc(false)
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
            supplier_doc_no: soNcc.trim() || null,
            doc_date: docDate || null,
            backdate_reason: luiXa ? lyDoLui.trim() || null : null,
            fix_of_doc_id: suaLai?.id ?? null,
            note: ghiChuPhieu(suaLai, ghiChu),
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
                qty2_actual: r.can_kg ? r.kg_can : null,
              })),
          },
        },
      )
      /*
        Không ở lại form (ở lại là mời ghi sổ hai lần) NHƯNG phải giữ đường
        IN: mang mã phiếu về màn Hàng về qua URL, dải "Đã ghi sổ" ở đó có nút
        In phiếu. Toast tự tắt sau vài giây, không đủ để với tới chuột.
      */
      const q = new URLSearchParams({
        vua_ghi: res.id,
        ma: res.code,
        chi_tiet: `${tong.so_dong_nhan} dòng · ${fmt(tong.lan_nay)} đơn vị${tong.vao_khoa > 0 ? ` · ${fmt(tong.vao_khoa)} vào khoá` : ''}`,
      })
      const tiep = new URLSearchParams(window.location.search).get('tiep') // nhận LẦN LƯỢT nhiều đơn
      if (tiep) q.set('tiep', tiep)
      router.push(`${duong.home}?${q}`)
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
      className={duong.wrap}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault()
          if (nhacSoNcc) return
          ;(document.activeElement as HTMLElement | null)?.blur()
          setTimeout(() => bamMoiNhat.current(), 0)
        }
      }}
    >
      {/* ScreenFrame chốt chiều cao — cùng lỗi với màn Xuất kho 16/09 (wrapper không trần). */}
      <ScreenFrame>
        <Crumb path={[...duong.crumbs, `Nhận hàng ${po.code}`]} />
        <ActionPane>
          <ActionGroup label="Phiếu">
            <Action primary disabled={!ghiDuoc} title={blocked} onClick={bamGhiSo}>
              {busy ? 'Đang ghi sổ…' : 'Ghi sổ'}
            </Action>
            <Action icon="huy" disabled={busy} onClick={() => router.push(duong.home)}>
              Huỷ
            </Action>
          </ActionGroup>
          <ActionGroup label="Bản in">
            <Action icon="in" onClick={() => setXemIn(true)}>
              Xem bản in
            </Action>
          </ActionGroup>
          <ActionGroup label="Đơn">
            <Action icon="don" onClick={() => router.push(`/mua-hang/don/${po.id}`)}>
              Mở đơn mua
            </Action>
          </ActionGroup>
        </ActionPane>
        <DocHead
          compact
          kind={
            noi === 'cung-ung'
              ? 'Phiếu nhập kho · Cung ứng nhận thay Kho'
              : 'Phiếu nhập kho · theo đơn mua'
          }
          code={po.code}
          sub={`${po.supplier_name} · ${dotLabel} · số phiếu PNK cấp khi ghi sổ`}
        >
          <StatusTrack label="Phiếu" steps={['Đang lập', 'Đã ghi sổ']} at={0} />
        </DocHead>

        <DauPhieu
          po={po}
          dot={dot}
          lich={lich}
          dotLabel={dotLabel}
          phieuUrl={duong.phieu(po.id)}
          nguoiNhan={nguoiNhan}
          noi={noi}
          busy={busy}
          docDate={docDate}
          setDocDate={setDocDate}
          supplierDocNo={supplierDocNo}
          setSupplierDocNo={setSupplierDocNo}
          counterparty={counterparty}
          setCounterparty={setCounterparty}
          ghiChu={ghiChu}
          setGhiChu={setGhiChu}
          ngay={ngay}
          laLapLai={!!suaLai}
          lyDoLui={lyDoLui}
          setLyDoLui={setLyDoLui}
        />

        {suaLai && (
          <NoticeBar tone="neutral" tag="Sửa phiếu">
            Lập lại <b>{suaLai.code}</b> (đã đảo bởi {suaLai.daoBoi}) — số đã điền sẵn
            theo phiếu cũ, sửa chỗ sai rồi Ghi sổ.
          </NoticeBar>
        )}

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
            <b>{overReason.trim()}</b>. Ghi vào ghi chú phiếu, Cung ứng thấy khi đối
            chiếu.
          </NoticeBar>
        )}

        <GridToolbar
          count={`${rows.length} dòng · ${rows.filter((r) => !r.editable).length} đã đủ`}
        >
          <span className="text-k-sm text-[var(--ink-3)]">
            Nhận theo phần <b>còn mở</b> của {dot ? 'đợt' : 'đơn'} — dòng đã đủ không có ô
            nhập
          </span>
        </GridToolbar>

        <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
          <Grid minWidth={coKg ? 1220 : 1180}>
            <GridHead>
              <Th width={30}>#</Th>
              <Th width={96}>Mã</Th>
              <Th width={dots.length > 0 ? 128 : 56}>Đợt</Th>
              <Th>Tên vật tư</Th>
              <Th width={52}>ĐVT</Th>
              <Th num width={80}>
                Đặt
              </Th>
              <Th num width={80}>
                Đã về
              </Th>
              <Th num width={80}>
                Còn chờ
              </Th>
              <Th num width={120}>
                Lần này
              </Th>
              {coKg && (
                <Th num width={140}>
                  Kg cân (nếu có)
                </Th>
              )}
              <Th width={146}>Tình trạng</Th>
              <Th width={coKg ? 200 : 300}>Ghi chú</Th>
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
                    <td className="text-k-label">
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
                    <td
                      className="max-w-0"
                      title={r.chi_tiet ? `${r.name}\n${r.chi_tiet}` : r.name}
                    >
                      <div className="truncate">{r.name}</div>
                      {r.chi_tiet && (
                        <div className="text-k-label truncate text-[var(--ink-3)]">
                          {r.chi_tiet}
                        </div>
                      )}
                    </td>
                    <td className="text-[var(--ink-3)]">{r.unit}</td>
                    <td className="k-r num">{fmt(r.qty_ordered)}</td>
                    <td className="k-r num text-[var(--ink-3)]">{fmt(r.qty_received)}</td>
                    <td className="k-r num">
                      {r.editable ? (
                        fmt(r.qty_open)
                      ) : (
                        <span className="text-[var(--ink-empty)]">0</span>
                      )}
                    </td>
                    <td className="k-r">
                      {r.editable ? (
                        <>
                          <NumInput
                            id={`lan-nay-${i}`}
                            value={String(r.qty)}
                            disabled={busy}
                            onCommit={(v) => patch(i, { qty: docSo(v) })}
                            aria-label={`Lần này ${r.code}`}
                          />
                          {(() => {
                            // Thiếu KHÔNG chặn: đơn thành "Về một phần", người mua
                            // quyết giao bù / chốt thiếu ở trang đơn. Nói trước.
                            const sp = sauPhieu(r)
                            return sp?.kind === 'thieu' ? (
                              <CellHint tone="neutral">
                                còn thiếu {fmt(sp.n)} {r.unit}
                              </CellHint>
                            ) : null
                          })()}
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
                    {coKg && (
                      <td className="k-r">
                        {r.editable && r.can_kg ? (
                          <>
                            <NumInput
                              id={`kg-can-${i}`}
                              value={r.kg_can == null ? '' : String(r.kg_can)}
                              disabled={busy}
                              placeholder="cân rồi ghi"
                              onCommit={(v) =>
                                patch(i, { kg_can: v.trim() ? docSo(v) || null : null })
                              }
                              aria-label={`Kg cân thực ${r.code}`}
                            />
                            {(() => {
                              const du = kgDuKien(r.qty, {
                                qty_ordered: r.qty_ordered,
                                qty2: r.kg_don,
                              })
                              if (r.qty > 0 && !(r.kg_can! > 0))
                                return (
                                  <CellHint tone="warn">
                                    bắt buộc{du != null ? ` · đơn ~${fmt(du)} kg` : ''}
                                  </CellHint>
                                )
                              const l = r.kg_can ? lechKg(r.kg_can, du) : null
                              return l != null ? (
                                <CellHint tone={Math.abs(l) >= 3 ? 'warn' : 'neutral'}>
                                  đơn ~{fmt(du!)} kg · lệch {l > 0 ? '+' : ''}
                                  {l.toLocaleString('vi-VN')}%
                                </CellHint>
                              ) : null
                            })()}
                          </>
                        ) : (
                          <span className="text-[var(--ink-empty)]">—</span>
                        )}
                      </td>
                    )}
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
              <td className="k-r num">{fmt(conCho)}</td>
              <td className="k-r num">{fmt(tong.lan_nay)}</td>
              {coKg && (
                <td className="k-r num">{kgCan > 0 ? `${fmt(kgCan)} kg` : '—'}</td>
              )}
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
            ...(canNhacSoNcc(supplierDocNo)
              ? [
                  {
                    label: 'Số phiếu NCC',
                    value: (
                      <button
                        type="button"
                        className="font-semibold text-[var(--warn)] underline"
                        onClick={() => document.getElementById(O_SO_NCC)?.focus()}
                      >
                        chưa ghi — ghi ngay
                      </button>
                    ),
                  },
                ]
              : []),
          ]}
          grand={{ label: 'Dùng được', value: fmt(tong.dung_duoc) }}
          blocked={blocked}
          onGoBlocked={kiem.ok ? undefined : nhayToi}
          actions={
            <>
              <span className="text-k-label text-[var(--ink-3)]">Ctrl + Enter</span>
              <Action primary disabled={!ghiDuoc} title={blocked} onClick={bamGhiSo}>
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
              <div className="text-k-label mb-1 font-bold tracking-[.09em] text-[var(--ink-label)] uppercase">
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
              Đơn mua sẽ hiện phần nhận vượt cho Cung ứng đối chiếu hoá đơn. Không muốn
              nhận vượt thì sửa số Lần này về bằng phần còn mở.
            </Consequence>
          </Sheet>
        )}
        {nhacSoNcc && (
          <NhacSoNccSheet
            poCode={po.code}
            supplierName={po.supplier_name}
            onClose={() => setNhacSoNcc(false)}
            onGhiSo={(so) => {
              if (so) setSupplierDocNo(so)
              void ghiSo(so)
            }}
          />
        )}
        {xemIn && (
          <Sheet
            open
            onClose={() => setXemIn(false)}
            width={900}
            title="Xem trước phiếu nhập kho"
            subtitle="Dựng từ bản đang gõ — chưa ghi sổ, chưa có số phiếu. Đúng mẫu 01-VT sẽ in ra."
          >
            <WarehouseDocPrintSheet
              head={{
                kind: 'receipt',
                code: null,
                date: new Date(`${docDate}T00:00:00`),
                supplier_doc_no: supplierDocNo.trim() || null,
                counterparty: counterparty.trim() || null,
                creator_name: nguoiNhan,
                // Cùng cách server ghép: ghi chú phiếu, rồi lý do nhận vượt.
                note:
                  [
                    ghiChuPhieu(suaLai, ghiChu),
                    luiXa && lyDoLui.trim() ? ghiChuLuiNgay(ngay.lui, lyDoLui) : null,
                    dongVuot.length > 0 && coLyDoVuot
                      ? `[Nhận vượt] ${overReason.trim()}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || null,
                nhap_cho: {
                  ncc: [po.supplier_name],
                  don: [po.code],
                  lenh: po.lsx_codes,
                  dot: dotCuaPhieu(dot, dots.length),
                },
              }}
              lines={rows
                .filter((r) => r.qty > 0)
                .map<WarehousePrintLine>((r) => ({
                  id: r.po_line_id,
                  material_code: r.code,
                  material_name: r.name,
                  material_unit: r.unit,
                  qty_doc: r.qty_ordered,
                  qty: r.qty,
                  note:
                    r.status === 'blocked'
                      ? [`Sai quy cách`, r.note].filter(Boolean).join(' · ')
                      : r.note || null,
                }))}
              company={company}
              tpl={tpl}
            />
          </Sheet>
        )}
      </ScreenFrame>
    </div>
  )
}
