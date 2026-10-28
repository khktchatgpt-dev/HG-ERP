'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isoToVn } from '@/lib/date-vn'
import { lichDot, nhanDot, type DotGiao } from '@/lib/kho-dot-giao'
import { dotCuaPhieu } from '@/lib/phieu-nhap-cho'
import { canNhacSoNcc, ghiChuPhieu, nguoiGiaoBanDau } from '@/lib/phieu-nhap-dau'
import {
  ghiChuLuiNgay,
  giuNgayPhieuCu,
  kiemNgayChungTu,
  LUI_TU_DO,
} from '@/lib/ngay-chung-tu-nhap'
import { api, apiErrorText } from '@/lib/api'
import {
  WarehouseDocPrintSheet,
  type WarehousePrintLine,
} from '@/app/print/warehouse/WarehouseDocPrintSheet'
import type { PrintCompany } from '@/app/print/PrintSheet'
import type { DocTemplate } from '@/lib/doc-templates'
import {
  CHO_GHI_HANG_KHOA,
  danhGiaVuot,
  kiemTruocGhiSo,
  tinhTong,
  type DongNhan,
} from '@/lib/kho-phieu-nhap'
import { ArrowLeft, ListChecks, Printer, TriangleAlert } from 'lucide-react'
import { ApNhom, ApNut, DauTrang, KhoKhung } from '../../_erp/khung'
import { HopThoai } from '../../_erp/o-nhap'
import { BaoSuCoSheet } from '../bao-su-co'
import { DUONG, type NoiNhan } from './duong'
import { DauPhieu, NhacSoNccSheet, O_LY_DO_LUI, O_SO_NCC } from './dau-phieu'
import { LuoiNhan } from './luoi-nhan'

export type { NoiNhan }

const fmt = (n: number) => n.toLocaleString('vi-VN')

/**
 * PHIẾU NHẬP THEO ĐƠN — màn chứng từ + lưới. Kho lối ERP · B2 (bản vẽ K-3
 * https://claude.ai/artifact/F2uVKzc4tb28FhHZY6BDiR, 14/10/2026): viết tay, không
 * kit — khung `../../_erp/khung.tsx`, ô nhập `../../_erp/o-nhap.tsx`. Gốc thiết
 * kế: https://claude.ai/artifact/G9Zso3vzCHUYpNGRp9o7Nf (artboard 2 + 2b).
 *
 * Ba cột số Đặt · Đã về · Lần này (SAP MIGO / BC). Tình trạng chỉ HAI giá trị
 * vì thủ kho vừa nhận vừa kiểm (chốt 15/09): Đạt → tồn dùng được; Sai quy
 * cách → vào kệ khoá, bắt ghi chú — lý do đi theo lô suốt đời nó. TẠM ẨN từ
 * 26/10/2026 (`CHO_GHI_HANG_KHOA`): lô khoá chưa có lối ra — hàng sai đi nút
 * "Báo sự cố" trên đầu phiếu (có lựa chọn từ chối nhận cả lô).
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
    /** Người phụ trách đơn — người nhận thông báo khi Kho báo sự cố. */
    assignee_name?: string | null
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
  /* Lỗi ghi sổ hiện ngay trên thanh chốt (không toast — toast tắt trước khi đọc xong). */
  const [loiGhi, setLoiGhi] = useState<string | null>(null)
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
  /** Hộp Báo sự cố ngay trên phiếu — đường của hàng sai quy cách khi "Sai quy cách" tạm ẩn. */
  const [suCo, setSuCo] = useState(false)
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
  const ngay = kiemNgayChungTu({ docDate, today, lyDo: lyDoLui, ngayPhieuCu: suaLai?.docDate }) // prettier-ignore
  const giuNgayCu = giuNgayPhieuCu(docDate, suaLai?.docDate)
  const luiXa = !giuNgayCu && ngay.lui > LUI_TU_DO

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
    // Lỗi máy chủ lần trước không che câu chặn / hộp hỏi của lần này (thử 28/10).
    setLoiGhi(null)
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
    setLoiGhi(null)
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
      setLoiGhi(apiErrorText(e))
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

  const dotNgan = dot
    ? `đợt ${dot.seq}/${dot.total} · hẹn ${isoToVn(dot.expected_date).slice(0, 5)}`
    : po.expected_at
      ? `hẹn ${isoToVn(po.expected_at).slice(0, 5)}`
      : 'chưa hẹn ngày'
  const dotLabel = dot
    ? `đợt ${dot.seq}/${dot.total} · hẹn ${isoToVn(dot.expected_date)}`
    : po.expected_at
      ? `không theo đợt · hẹn giao ${isoToVn(po.expected_at)}`
      : 'không theo đợt · chưa hẹn ngày'

  const nhanDu = () =>
    setRows((rs) => rs.map((r) => (r.editable ? { ...r, qty: r.qty_open } : r)))
  const xoaSo = () => setRows((rs) => rs.map((r) => (r.editable ? { ...r, qty: 0 } : r)))
  const chuaGhiSoNcc = canNhacSoNcc(supplierDocNo) && !blocked
  const dangGhi = busy ? 'Đang ghi sổ…' : null

  return (
    <KhoKhung
      label={`Nhận hàng ${po.code}`}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault()
          if (nhacSoNcc) return
          ;(document.activeElement as HTMLElement | null)?.blur()
          setTimeout(() => bamMoiNhat.current(), 0)
        }
      }}
    >
      {/* MỘT HÀNG ĐẦU: Ghi sổ chỉ ở thanh chốt đáy — màn gõ (khuôn F) có một chỗ chốt. */}
      <DauTrang
        crumb="Kho › Nhận hàng"
        title={
          <>
            Nhận hàng{' '}
            <span className="kh-num" style={{ color: 'var(--kh-nhap)' }}>
              {po.code}
            </span>
          </>
        }
        ctx={`phiếu nhập · người nhận ${nguoiNhan} · số PNK cấp khi ghi sổ`}
        actions={
          <>
            <ApNhom>
              <ApNut onClick={nhanDu} why={dangGhi}>
                Nhận đủ tất cả
              </ApNut>
              <ApNut onClick={xoaSo} why={dangGhi}>
                Xoá số đã gõ
              </ApNut>
            </ApNhom>
            <ApNhom>
              <ApNut
                icon={<TriangleAlert size={15} aria-hidden />}
                onClick={() => setSuCo(true)}
                why={!canEdit ? 'Chỉ người ghi kho báo được sự cố' : dangGhi}
              >
                Báo sự cố
              </ApNut>
              <ApNut
                icon={<Printer size={15} aria-hidden />}
                onClick={() => setXemIn(true)}
              >
                Xem bản in
              </ApNut>
              <ApNut
                icon={<ListChecks size={15} aria-hidden />}
                href={`/warehouse/nhap?don=${po.id}`}
                why={dangGhi}
              >
                Hàng của đơn
              </ApNut>
              <ApNut
                icon={<ArrowLeft size={15} aria-hidden />}
                href={duong.home}
                why={dangGhi}
              >
                Về danh sách nhận hàng
              </ApNut>
            </ApNhom>
          </>
        }
      />

      <DauPhieu
        po={po}
        dot={dot}
        lich={lich}
        dotLabel={dotLabel}
        phieuUrl={duong.phieu(po.id)}
        dotNgan={dotNgan}
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
        giuNgayCu={giuNgayCu}
        lyDoLui={lyDoLui}
        setLyDoLui={setLyDoLui}
      />

      {suaLai && (
        <div className="kh-note mut">
          <span className="tag">Sửa phiếu</span>
          <span>
            Lập lại <b>{suaLai.code}</b> (đã đảo bởi {suaLai.daoBoi}) — số đã điền sẵn
            theo phiếu cũ, sửa chỗ sai rồi Ghi sổ.
          </span>
        </div>
      )}
      {boQuaTuDo > 0 && (
        <div className="kh-note">
          <span className="tag">Dòng tự do</span>
          <span>
            Đơn có <b>{boQuaTuDo}</b> dòng tự do (gỗ / gia công không mã vật tư) — nghiệm
            thu ở trang đơn, không lên phiếu nhập.
          </span>
        </div>
      )}
      {dongVuot.length > 0 && coLyDoVuot && (
        <div className="kh-note">
          <span className="tag">Nhận vượt</span>
          <span>
            {dongVuot.map((x) => x.r.code).join(', ')} nhận vượt dung sai — lý do:{' '}
            <b>{overReason.trim()}</b>. Ghi vào ghi chú phiếu, Cung ứng thấy khi đối
            chiếu.{' '}
            <button
              type="button"
              className="kh-lnk"
              style={{ fontFamily: 'inherit' }}
              onClick={moHopLyDo}
            >
              Sửa lý do
            </button>
          </span>
        </div>
      )}

      <LuoiNhan
        rows={rows}
        nhan={nhan}
        hasDots={dots.length > 0}
        dangTheoDot={!!dot}
        coKg={coKg}
        busy={busy}
        patch={patch}
        moHopLyDo={moHopLyDo}
        coLyDoVuot={coLyDoVuot}
        tong={tong}
        conCho={conCho}
        kgCan={kgCan}
      />

      {/* THANH CHỐT ĐÁY — nói vì sao chưa ghi sổ được bằng một câu BẤM ĐƯỢC. */}
      <div className="kh-commit" role="group" aria-label="Ghi sổ phiếu nhập">
        <span className="m">
          <span className="k">Dòng nhận</span>
          <span className="v">{tong.so_dong_nhan}</span>
        </span>
        <span className="m">
          <span className="k">Lần này</span>
          <span className="v">{fmt(tong.lan_nay)}</span>
        </span>
        {/* Vào khoá / Dùng được chỉ có nghĩa khi còn cho chọn "Sai quy cách". */}
        {(CHO_GHI_HANG_KHOA || tong.vao_khoa > 0) && (
          <>
            <span className="m">
              <span className="k">Vào khoá</span>
              <span
                className="v"
                style={tong.vao_khoa > 0 ? { color: 'var(--kh-stop)' } : undefined}
              >
                {fmt(tong.vao_khoa)}
              </span>
            </span>
            <span className="m">
              <span className="k">Dùng được</span>
              <span className="v" style={{ color: 'var(--kh-done)' }}>
                {fmt(tong.dung_duoc)}
              </span>
            </span>
          </>
        )}
        {loiGhi ? (
          <span className="why" role="alert">
            Chưa ghi sổ được: {loiGhi}
          </span>
        ) : blocked && !busy ? (
          <button type="button" className="why" onClick={nhayToi}>
            Chưa lưu được: {blocked}
          </button>
        ) : chuaGhiSoNcc ? (
          <button
            type="button"
            className="why"
            style={{ color: 'var(--kh-warn)' }}
            onClick={() => document.getElementById(O_SO_NCC)?.focus()}
          >
            Số phiếu NCC chưa ghi — ghi ngay (không bắt buộc)
          </button>
        ) : (
          <span className="why" />
        )}
        <span className="ghi">
          <span className="kh-kbd">Ctrl + Enter</span>
          <button
            type="button"
            className="kh-btn p"
            aria-disabled={ghiDuoc ? undefined : true}
            title={blocked}
            onClick={bamGhiSo}
          >
            {busy ? 'Đang ghi sổ…' : 'Ghi sổ'}
          </button>
        </span>
      </div>

      {sheetOpen && (
        <HopThoai
          title="Nhận vượt dung sai"
          subtitle={`${dongVuot.length} dòng nhận nhiều hơn phần còn mở, quá ngưỡng của mã. Lý do đi vào ghi chú phiếu.`}
          onClose={() => setSheetOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="kh-btn"
                onClick={() => setSheetOpen(false)}
              >
                Quay lại sửa số
              </button>
              <button
                type="button"
                className="kh-btn p"
                disabled={overDraft.trim() === ''}
                onClick={() => {
                  setOverReason(overDraft)
                  setSheetOpen(false)
                }}
              >
                Xác nhận nhận vượt
              </button>
            </>
          }
        >
          <div className="kh-ds">
            {dongVuot.map(({ r, v }) => (
              <div key={r.po_line_id}>
                <span className="kh-ma">{r.code}</span>
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.name}
                </span>
                <b className="kh-num kh-warn">
                  +{fmt(v.vuot)} {r.unit} · {v.pct.toFixed(0)}%
                </b>
                <span className="note">
                  đặt {fmt(r.qty_ordered)} · còn mở {fmt(r.qty_open)} · lần này{' '}
                  {fmt(r.qty)} · dung sai {r.over_tolerance_pct}%
                </span>
              </div>
            ))}
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="kh-mut" style={{ fontSize: 11, fontWeight: 700 }}>
              LÝ DO NHẬN VƯỢT · BẮT BUỘC
            </span>
            <textarea
              className="kh-o"
              value={overDraft}
              onChange={(e) => setOverDraft(e.target.value)}
              rows={3}
              placeholder="ví dụ: NCC gộp phần thiếu của đợt trước, Cung ứng đã đồng ý"
              aria-label="Lý do nhận vượt"
            />
          </label>
          <div className="kh-hau">
            Đơn mua sẽ hiện phần nhận vượt cho Cung ứng đối chiếu hoá đơn. Không muốn nhận
            vượt thì sửa số Lần này về bằng phần còn mở.
          </div>
        </HopThoai>
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
      {suCo && (
        <BaoSuCoSheet
          data={{
            po: { ...po, assignee_name: po.assignee_name ?? null },
            lines: rows.map((r) => ({ id: r.po_line_id, code: r.code, name: r.name, unit: r.unit })), // prettier-ignore
          }}
          onClose={() => setSuCo(false)}
        />
      )}
      {xemIn && (
        <HopThoai
          title="Xem trước phiếu nhập kho"
          subtitle="Dựng từ bản đang gõ — chưa ghi sổ, chưa có số phiếu. Đúng mẫu 01-VT sẽ in ra."
          onClose={() => setXemIn(false)}
          width={900}
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
        </HopThoai>
      )}
    </KhoKhung>
  )
}
