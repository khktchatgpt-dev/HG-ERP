'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, ListChecks, Printer, RotateCcw } from 'lucide-react'
import { ApiError, api, apiErrorText } from '@/lib/api'
import {
  WarehouseDocPrintSheet,
  type WarehousePrintLine,
} from '@/app/print/warehouse/WarehouseDocPrintSheet'
import type { PrintCompany } from '@/app/print/PrintSheet'
import type { DocTemplate } from '@/lib/doc-templates'
import {
  LY_DO_XUAT_LE,
  kiemTruocGhiSoXuat,
  lyDoCanLenh,
  themDong,
  themTuLenh,
  tinhTongXuat,
  type DauPhieuXuat,
  type DongXuat,
} from '@/lib/kho-phieu-xuat'
import { goiYTon, latTich, taoDemTim, type VatTuTon } from '@/lib/kho-chon-vat-tu'
import { ApNhom, ApNut, DaGhiSo, DauTrang, KhoKhung, ThanhTT } from '../_erp/khung'
import { HopThoai } from '../_erp/o-nhap'
import { OTim } from '../_erp/o-tim'
import { useCtrlEnter } from '../_erp/useCtrlEnter'
import { DauXuat, type LsxOpt } from './dau-xuat'
import { LuoiXuat } from './luoi-xuat'
import { HangLenh, type LayHang } from './hang-lenh'
import { ChonNhieuHop } from './chon-nhieu'

const fmt = (n: number) => n.toLocaleString('vi-VN')
const fmtSo = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
const KHONG_CO = new Set<string>()

type Bao = { tone: 'ok' | 'warn' | 'stop'; text: string }

/**
 * PHIẾU XUẤT — khuôn F. Kho lối ERP · B3 (bản vẽ
 * https://claude.ai/artifact/F2uVKzc4tb28FhHZY6BDiR, 14/10/2026): viết tay,
 * không kit — khung `../_erp`, đầu phiếu `dau-xuat.tsx`, lưới `luoi-xuat.tsx`.
 * Gốc thiết kế: artboard 3 · 3b · 3c ở https://claude.ai/artifact/G9Zso3vzCHUYpNGRp9o7Nf
 *
 * Đầu phiếu đi theo thứ tự câu hỏi thật (xuất cho → lệnh / lý do → tổ → ngày).
 * Thêm dòng bằng ô tìm TRÊN lưới (ngoài khung cuộn — danh sách gợi ý không bị
 * cắt); chọn lệnh thì có "Lấy hàng của lệnh" đưa cả loạt vào lưới. Một mã một dòng.
 *
 * CHỌN VẬT TƯ (27/10/2026 — "chọn loại vật tư quá chậm"): trang nạp sẵn các mã
 * CÒN TỒN kèm tồn dùng được (`tonSan`). Ô tìm lọc tại máy — gõ không gọi API,
 * gợi ý ghi tồn + kệ, mã của lệnh lên đầu; chọn xong không phải tra tồn. Chỉ khi
 * không mã còn tồn nào khớp mới hỏi `stock/tim` (có đệm theo chữ gõ). Nhiều mã
 * một lượt: Shift+Enter (hoặc bấm ô vuông) TÍCH ở gợi ý — qua nhiều lần gõ — rồi
 * một Enter thêm cả loạt; hoặc hộp "Chọn nhiều từ tồn kho". Enter ở ô số → dòng
 * dưới / về ô tìm.
 *
 * GHI SỔ = một POST `docs/issue` — chỉ ở thanh chốt đáy (màn gõ một chỗ chốt).
 * Server vẫn là người quyết (guard trạng thái lệnh, tồn, giữ chỗ; mã X1 tự gắn).
 * Ghi xong: dải "Đã ghi sổ" có nút In và phiếu mới trống — thủ kho thường ghi
 * liền cho mấy tổ. Thông báo (trùng mã, tra tồn lỗi, lỗi ghi) hiện TẠI CHỖ,
 * không toast tự tắt.
 */
export function XuatScreen({
  lsx,
  to,
  phong,
  tonSan,
  today,
  nguoiLap,
  canEdit,
  company,
  tpl,
}: {
  lsx: LsxOpt[]
  /** Tên các tổ sản xuất — dải nút "Tổ lấy". */
  to: string[]
  /** Mọi phòng ban — ô "Bộ phận nhận" khi xuất lẻ. */
  phong: string[]
  /** Mã còn tồn dùng được, nạp sẵn — ô thêm dòng + hộp chọn nhiều lọc tại máy. */
  tonSan: VatTuTon[]
  today: string
  nguoiLap: string
  canEdit: boolean
  company: PrintCompany
  tpl: DocTemplate
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [head, setHead] = useState<DauPhieuXuat>({
    loai: 'lsx',
    /* `?lsx=<id>` — Tồn kho theo lệnh / Hoàn kho dẫn sang đây. Id lạ thì rỗng. */
    lsx_id: lsx.some((l) => l.id === params.get('lsx')) ? params.get('lsx')! : '',
    ly_do: '',
    to: '',
    nguoi_lay: '',
    doc_date: today,
  })
  const [rows, setRows] = useState<DongXuat[]>([])
  const [chonNhieu, setChonNhieu] = useState(false)
  /** Mã đang TÍCH ở ô gợi ý (Shift+Enter) — theo thứ tự tích; Enter thêm cả loạt. */
  const [tich, setTich] = useState<Map<string, VatTuTon>>(() => new Map())
  /** Mã đã về cho lệnh — `HangLenh` báo lên; chỉ dùng khi đúng lệnh đang chọn. */
  const [hangLenhCua, setHangLenhCua] = useState<{ lsx: string; ids: Set<string> } | null>(null) // prettier-ignore
  /** Đã bấm Ghi sổ ít nhất một lần — từ đó ô thiếu mới đỏ. */
  const [daThu, setDaThu] = useState(false)
  const [xemIn, setXemIn] = useState(false)
  const [busy, setBusy] = useState(false)
  /** Câu của server khi lấn phần giữ cho LSX khác — mở hộp xin lý do. */
  const [lanSheet, setLanSheet] = useState<string | null>(null)
  const [lanDraft, setLanDraft] = useState('')
  const [bao, setBao] = useState<Bao | null>(null)
  const [loiGhi, setLoiGhi] = useState<string | null>(null)
  /** Phiếu VỪA GHI — dải có nút In (toast tắt trước khi với tới chuột). */
  const [vuaGhi, setVuaGhi] = useState<{ id: string; code: string; dong: number; to: string } | null>(null) // prettier-ignore

  const setH = (p: Partial<DauPhieuXuat>) => setHead((h) => ({ ...h, ...p }))
  const patch = (i: number, p: Partial<DongXuat>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)))

  const tong = useMemo(() => tinhTongXuat(rows), [rows])
  const kiem = useMemo(() => kiemTruocGhiSoXuat(head, rows), [head, rows])
  const canLenh = head.loai === 'lsx' || lyDoCanLenh(head.ly_do)
  const lsxChon = lsx.find((l) => l.id === head.lsx_id) ?? null
  const thieu = (o: 'lenh' | 'ly_do' | 'to') => daThu && !kiem.ok && kiem.focus === o
  const lyDoChon = LY_DO_XUAT_LE.find((x) => x.ma === head.ly_do)
  const cuaLenh =
    canLenh && hangLenhCua && hangLenhCua.lsx === head.lsx_id ? hangLenhCua.ids : KHONG_CO
  /** id → số dòng (1-based) — gợi ý và hộp chọn nhiều nói "đã có ở dòng N". */
  const trongPhieu = useMemo(() => new Map(rows.map((r, i) => [r.id, i + 1])), [rows])

  // Đệm câu tìm server theo chữ gõ — làm mới khi trang nạp lại tồn (sau Ghi sổ).
  const demTim = useMemo(() => taoDemTim<VatTuTon[]>(), [tonSan]) // eslint-disable-line react-hooks/exhaustive-deps -- tonSan đổi = tồn đã đổi, bỏ đệm cũ

  /** Đường lùi: không mã còn tồn nào khớp → tìm cả danh mục, trả luôn tồn. */
  async function timVatTu(q: string): Promise<VatTuTon[]> {
    const co = demTim.lay(q)
    if (co) return co
    const res = await api<{ rows: VatTuTon[] }>(
      `/api/dept/warehouse/stock/tim?q=${encodeURIComponent(q)}`,
    )
    demTim.dat(q, res.rows)
    return res.rows
  }

  const focusQty = (i: number) => {
    const el = document.getElementById(`xuat-qty-${i}`) as HTMLInputElement | null
    el?.focus()
    el?.select()
  }

  /*
    Ô cần đưa con trỏ tới SAU khi lưới vẽ xong dòng mới. Không dùng setTimeout:
    gõ số nhanh hơn hẹn giờ là số rơi vào ô tìm thay vì ô Lần này (bắt được khi
    thử bằng bàn phím 27/10). Layout effect chạy ngay sau lượt vẽ, trước phím kế.
  */
  const choFocus = useRef<string | null>(null)
  useLayoutEffect(() => {
    const id = choFocus.current
    if (!id) return
    choFocus.current = null
    const el = document.getElementById(id) as HTMLInputElement | null
    el?.focus()
    el?.select()
  })

  /** Tồn đã đi kèm mã (nạp sẵn / `stock/tim`) — thêm dòng không phải hỏi server nữa. */
  function chonVatTu(vt: VatTuTon) {
    const r = themDong(rows, { id: vt.id, code: vt.code, name: vt.name, unit: vt.unit }, vt.qty_ok) // prettier-ignore
    if (r.trung)
      setBao({
        tone: 'warn',
        text: `${vt.code} đã có ở dòng ${r.index + 1} — một mã một dòng, sửa số ở dòng đó.`,
      })
    else {
      setRows(r.rows)
      if (vt.qty_ok <= 0)
        setBao({
          tone: 'warn',
          text: `${vt.code} kho hết trên máy — ghi sổ sẽ bị chặn. Nhận hàng hoặc Cập nhật số thực tế trước.`,
        })
    }
    choFocus.current = `xuat-qty-${r.index}`
  }

  /** Shift+Enter / bấm ô vuông ở gợi ý. Mã đã có trong phiếu thì không tích — nói dòng nào. */
  const lat = (vt: VatTuTon) => {
    const dong = trongPhieu.get(vt.id)
    if (dong) {
      setBao({ tone: 'warn', text: `${vt.code} đã có ở dòng ${dong} — một mã một dòng.` })
      return
    }
    setTich((t) => latTich(t, vt))
  }

  /**
   * Enter khi đang tích: thêm CẢ LOẠT theo thứ tự tích, số để 0 — con trỏ vào ô
   * số dòng mới đầu tiên, Enter đi dọc cột số rồi về ô tìm (`LuoiXuat.sangO`).
   */
  const themTich = () => {
    const ds = [...tich.values()]
    if (ds.length === 0) return
    const truoc = rows.length
    const r = themTuLenh(
      rows,
      ds.map((vt) => ({ id: vt.id, code: vt.code, name: vt.name, unit: vt.unit, qty_ok: vt.qty_ok, qty: 0 })), // prettier-ignore
    )
    setRows(r.rows)
    setTich(new Map())
    const het = ds.filter((vt) => vt.qty_ok <= 0).map((vt) => vt.code)
    setBao({
      tone: het.length > 0 ? 'warn' : 'ok',
      text: `Đã thêm ${r.them} dòng — gõ số Lần này, Enter xuống dòng dưới.${het.length > 0 ? ` ${het.join(', ')} kho hết: ghi sổ sẽ bị chặn.` : ''}`,
    })
    choFocus.current = `xuat-qty-${truoc}`
  }

  // "Chọn nhiều từ tồn kho": đưa cả loạt (đã có số) vào lưới, giữ dòng đã có.
  const layNhieu = (chon: LayHang[]) => {
    const r = themTuLenh(rows, chon)
    setRows(r.rows)
    setChonNhieu(false)
    setBao({
      tone: 'ok',
      text: `Đã đưa ${r.them} dòng vào phiếu${r.trung > 0 ? ` · ${r.trung} mã đã có, giữ dòng cũ` : ''}.`,
    })
    choFocus.current = 'xuat-tim'
  }

  // "Lấy hàng của lệnh": đưa cả loạt vào lưới, giữ dòng đã có.
  const layHangLenh = (chon: LayHang[]) => {
    const r = themTuLenh(rows, chon)
    setRows(r.rows)
    setBao({
      tone: 'ok',
      text: `Đã đưa ${r.them} dòng vào phiếu${r.trung > 0 ? ` · ${r.trung} mã đã có trong phiếu, giữ dòng cũ` : ''} — sửa số thực lấy rồi Ghi sổ.`,
    })
  }

  /*
    MỞ TỪ MÀN TỒN KHO (`?ma=`): thêm sẵn mã đó thành dòng đầu. Chạy ĐÚNG MỘT LẦN
    cho mỗi mã (ref canh) — chạy lại là gọi API thừa + báo trùng vô cớ.
  */
  const maUrl = params.get('ma')
  const daPrefill = useRef<string | null>(null)
  useEffect(() => {
    if (!maUrl || daPrefill.current === maUrl) return
    daPrefill.current = maUrl
    void (async () => {
      try {
        // Mã còn tồn có sẵn tại máy; không có mới hỏi server.
        const vt =
          tonSan.find((m) => m.code === maUrl) ??
          (await timVatTu(maUrl).then((f) => f.find((m) => m.code === maUrl) ?? f[0]))
        if (vt) chonVatTu(vt)
        else
          setBao({ tone: 'warn', text: `Không thấy mã ${maUrl} — gõ lại ở ô Thêm dòng.` })
      } catch (e) {
        setBao({ tone: 'warn', text: `Không tìm được mã ${maUrl}: ${apiErrorText(e)}` })
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chạy theo mã trên URL, các hàm kia ổn định trong lượt
  }, [maUrl])

  const lamMoi = () => {
    setRows([])
    setTich(new Map())
    setHead({
      loai: 'lsx',
      lsx_id: '',
      ly_do: '',
      to: '',
      nguoi_lay: '',
      doc_date: today,
    })
    setDaThu(false)
    setBao(null)
    setLoiGhi(null)
  }

  /**
   * Ghi sổ — một POST `docs/issue`. `lan` = xác nhận lấn phần đang giữ cho LSX
   * khác (409 RESERVED_CONFLICT) — gửi lại kèm lý do, service ghi vết vào ghi chú.
   */
  async function guiPhieu(lan?: string) {
    setBusy(true)
    setLoiGhi(null)
    try {
      const res = await api<{ id: string; code: string }>(
        '/api/dept/warehouse/docs/issue',
        {
          method: 'POST',
          body: {
            kind: head.loai,
            production_order_id:
              head.loai === 'lsx' || lyDoCanLenh(head.ly_do) ? head.lsx_id : null,
            // Người NHẬN trên mẫu 02-VT: tổ, kèm tên người lấy nếu có khai.
            counterparty: [head.to, head.nguoi_lay.trim()].filter(Boolean).join(' · '),
            // Xuất theo lệnh luôn là X1 — service bỏ qua reason_code ở đường đó.
            reason_code: head.loai === 'daily' ? head.ly_do : null,
            reason:
              head.loai === 'daily' && lyDoChon
                ? `${lyDoChon.ma} · ${lyDoChon.nhan}`
                : null,
            doc_date: head.doc_date || null,
            override_reserved: !!lan,
            override_reason: lan ?? null,
            lines: rows
              .filter((r) => r.qty > 0)
              .map((r) => ({
                material_id: r.id,
                qty: r.qty,
                note: r.note.trim() || null,
              })),
          },
        },
      )
      setVuaGhi({ id: res.id, code: res.code, dong: tong.so_dong, to: head.to })
      setLanSheet(null)
      setLanDraft('')
      lamMoi()
      router.refresh()
    } catch (e) {
      // Lấn phần giữ cho lệnh khác: mở hộp xin lý do, mang NGUYÊN câu server nói.
      if (e instanceof ApiError && e.code === 'RESERVED_CONFLICT') {
        setLanSheet(e.message)
        setLanDraft('')
      } else setLoiGhi(apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const ghiSo = () => {
    if (!canEdit || busy) return
    setDaThu(true)
    // Lỗi máy chủ của lần ghi TRƯỚC không được che câu chặn của lần này (thử 28/10:
    // đổi sang xuất lẻ chưa chọn lý do mà thanh đáy vẫn "Có lỗi, thử lại").
    setLoiGhi(null)
    if (!kiem.ok) {
      if (typeof kiem.focus === 'number') {
        if (kiem.focus >= 0) focusQty(kiem.focus)
        else document.getElementById('xuat-tim')?.focus()
      } else document.getElementById(`xuat-${kiem.focus}`)?.focus()
      return
    }
    void guiPhieu()
  }
  const phimGhi = useCtrlEnter(ghiSo)

  const tieuDe =
    head.loai === 'lsx'
      ? lsxChon
        ? `Cấp cho lệnh ${lsxChon.code} · ${lsxChon.customer_name}`
        : 'Cấp cho lệnh sản xuất'
      : lyDoChon
        ? `Xuất lẻ · ${lyDoChon.nhan}`
        : 'Xuất lẻ'
  const blocked = !canEdit
    ? 'Tài khoản này không có quyền ghi sổ kho'
    : busy
      ? 'Đang ghi sổ…'
      : daThu && !kiem.ok
        ? kiem.message
        : undefined
  const trong = rows.length === 0 && !head.to && !head.lsx_id

  return (
    <KhoKhung label="Xuất hàng" onKeyDown={phimGhi}>
      <DauTrang
        title="Xuất hàng"
        ctx={`${tieuDe} · số PXK cấp khi ghi sổ · người lập ${nguoiLap}`}
        actions={
          <>
            <ApNhom>
              <ApNut
                icon={<RotateCcw size={15} aria-hidden />}
                onClick={lamMoi}
                why={busy ? 'Đang ghi sổ…' : trong ? 'Phiếu đang trống' : null}
              >
                Làm mới
              </ApNut>
              <ApNut
                icon={<Printer size={15} aria-hidden />}
                onClick={() => setXemIn(true)}
              >
                Xem bản in
              </ApNut>
            </ApNhom>
            <ApNhom>
              <ApNut
                icon={<BookOpen size={15} aria-hidden />}
                href="/warehouse/phieu?ro=issue"
              >
                Phiếu xuất đã ghi
              </ApNut>
            </ApNhom>
          </>
        }
      />

      {vuaGhi && (
        <DaGhiSo
          code={vuaGhi.code}
          docId={vuaGhi.id}
          detail={`${vuaGhi.dong} dòng · ${vuaGhi.to} — tồn đã trừ. Phiếu mới đã sẵn, ghi tiếp cho tổ khác.`}
          soPhieuHref="/warehouse/phieu?ro=issue"
          onClose={() => setVuaGhi(null)}
        />
      )}

      <DauXuat
        head={head}
        setH={setH}
        lsx={lsx}
        to={to}
        phong={phong}
        today={today}
        canLenh={canLenh}
        thieu={thieu}
      />

      {canLenh && lsxChon && (
        <HangLenh
          key={lsxChon.id}
          lsx={lsxChon}
          today={today}
          onLay={layHangLenh}
          onRows={(ids) => setHangLenhCua({ lsx: lsxChon.id, ids: new Set(ids) })}
        />
      )}

      {/* Ô tìm đứng NGOÀI khung cuộn của lưới — gợi ý rơi xuống lưới, không bị cắt. */}
      <div className="kh-them">
        <span className="lbl">+ Thêm dòng</span>
        <OTim<VatTuTon>
          id="xuat-tim"
          loc={(q) => goiYTon(tonSan, q, cuaLenh)}
          search={timVatTu}
          onPick={chonVatTu}
          onLat={lat}
          dangTich={tich.size > 0}
          onXongTich={themTich}
          keyOf={(m) => m.id}
          render={(m) => {
            const dong = trongPhieu.get(m.id)
            const on = tich.has(m.id)
            return (
              <span className="kh-goi-y-vt">
                {dong ? (
                  <span className="kh-tich co" title={`Đã có ở dòng ${dong}`}>
                    ✓
                  </span>
                ) : (
                  // Bấm ô vuông = tích (giống Shift+Enter), danh sách vẫn mở.
                  <span
                    className={on ? 'kh-tich on' : 'kh-tich'}
                    title={on ? 'Bỏ tích' : 'Tích để thêm cùng lúc (Shift+Enter)'}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      lat(m)
                    }}
                  >
                    ✓
                  </span>
                )}
                <b className="kh-ma">{m.code}</b>
                <span className="ten">
                  {cuaLenh.has(m.id) && <span className="kh-tag run">của lệnh</span>}
                  {m.name}
                  {m.ke && <span className="kh-mut"> · kệ {m.ke}</span>}
                </span>
                <span className="ton">
                  {dong ? <span className="kh-mut">đã có ở dòng {dong} · </span> : null}
                  {m.qty_ok > 0 ? (
                    <>
                      tồn <b className="kh-num">{fmtSo(m.qty_ok)}</b>{' '}
                      <span className="kh-mut">{m.unit}</span>
                    </>
                  ) : (
                    <span className="kh-warn">kho hết · {m.unit}</span>
                  )}
                </span>
              </span>
            )
          }}
          cuoi={(tuServer) =>
            tich.size > 0
              ? `Đang tích ${tich.size} mã · Enter thêm ${tich.size} dòng · Shift+Enter / bấm dòng để tích thêm hoặc bỏ · gõ chữ khác vẫn giữ mã đã tích`
              : tuServer
                ? 'Không mã còn tồn nào khớp — đây là mã trong cả danh mục. Mã kho hết ghi sổ sẽ bị chặn.'
                : `Chỉ bày mã còn tồn (${tonSan.length} mã) · Enter thêm 1 dòng · Shift+Enter tích nhiều mã rồi Enter thêm cả loạt`
          }
          placeholder={
            tich.size > 0
              ? `Đang tích ${tich.size} mã — gõ tìm tiếp, hoặc Enter để thêm`
              : 'Gõ mã, tên hoặc kệ · Enter thêm · Shift+Enter tích nhiều'
          }
          label="Tìm vật tư để thêm dòng"
          width={420}
          rong="Không có vật tư nào khớp trong cả danh mục"
        />
        {tich.size > 0 ? (
          <span className="kh-dang-tich" role="status">
            Đang tích <b className="kh-num">{tich.size}</b> mã:{' '}
            <span className="ds">
              {[...tich.values()].map((vt) => vt.code).join(', ')}
            </span>
            <button type="button" className="kh-btn" onClick={themTich}>
              Thêm {tich.size} dòng
            </button>
            <button
              type="button"
              className="kh-lnk"
              style={{ fontFamily: 'inherit' }}
              onClick={() => setTich(new Map())}
            >
              bỏ tích
            </button>
          </span>
        ) : (
          <button type="button" className="kh-btn" onClick={() => setChonNhieu(true)}>
            <ListChecks size={15} aria-hidden />
            Chọn nhiều từ tồn kho ({tonSan.length})
          </button>
        )}
        {bao && (
          <span
            className={`bao ${bao.tone === 'ok' ? 'kh-ok' : bao.tone === 'warn' ? 'kh-warn' : 'kh-stop'}`}
            role="status"
          >
            {bao.text}
          </span>
        )}
        <span className="kh-mut" style={{ marginLeft: 'auto' }}>
          Shift+Enter tích nhiều · Enter ở ô số xuống dòng · Ctrl+Enter ghi sổ
        </span>
      </div>

      <LuoiXuat
        rows={rows}
        patch={patch}
        xoa={(i) => setRows((rs) => rs.filter((_, j) => j !== i))}
        tong={tong}
      />

      {/* THANH CHỐT ĐÁY — nói vì sao chưa ghi sổ được bằng câu BẤM ĐƯỢC. */}
      <div className="kh-commit" role="group" aria-label="Ghi sổ phiếu xuất">
        <span className="m">
          <span className="k">Dòng</span>
          <span className="v">{rows.length}</span>
        </span>
        {lsxChon && (
          <span className="m">
            <span className="k">Lệnh</span>
            <span className="v" style={{ fontSize: 13 }}>
              {lsxChon.code}
            </span>
          </span>
        )}
        {head.to && (
          <span className="m">
            <span className="k">{head.loai === 'lsx' ? 'Tổ' : 'Nhận'}</span>
            <span className="v" style={{ fontSize: 13, fontFamily: 'inherit' }}>
              {head.to}
            </span>
          </span>
        )}
        <span className="m">
          <span className="k">Tổng lượng</span>
          <span className="v">{fmt(tong.tong)}</span>
        </span>
        {loiGhi ? (
          <span className="why" role="alert">
            Chưa ghi sổ được: {loiGhi}
          </span>
        ) : blocked && !busy ? (
          <button type="button" className="why" onClick={ghiSo}>
            Chưa lưu được: {blocked}
          </button>
        ) : (
          <span className="why" />
        )}
        <span className="ghi">
          <span className="kh-kbd">Ctrl + Enter</span>
          <button
            type="button"
            className="kh-btn p"
            aria-disabled={!canEdit || busy || undefined}
            title={blocked}
            onClick={ghiSo}
          >
            {busy ? 'Đang ghi sổ…' : 'Ghi sổ'}
          </button>
        </span>
      </div>

      <ThanhTT
        left={
          head.loai === 'lsx'
            ? 'Mã lý do X1 tự gắn · tiền vào giá thành lệnh · tồn chỉ đổi khi ghi sổ'
            : 'Xuất lẻ: mã lý do người chọn, không vào giá thành lệnh · tồn chỉ đổi khi ghi sổ'
        }
        right={<b>{rows.length} dòng</b>}
      />

      {chonNhieu && (
        <ChonNhieuHop
          ds={tonSan}
          cuaLenh={cuaLenh}
          lsxCode={canLenh ? (lsxChon?.code ?? null) : null}
          trongPhieu={trongPhieu}
          onClose={() => setChonNhieu(false)}
          onLay={layNhieu}
        />
      )}

      {lanSheet && (
        <HopThoai
          title="Xuất lấn phần đang giữ cho lệnh khác"
          subtitle="Tồn còn đủ, nhưng phần này đã hứa cho lệnh sản xuất khác đã duyệt."
          onClose={() => setLanSheet(null)}
          footer={
            <>
              <button type="button" className="kh-btn" onClick={() => setLanSheet(null)}>
                Quay lại sửa số
              </button>
              <button
                type="button"
                className="kh-btn p"
                disabled={busy || lanDraft.trim() === ''}
                onClick={() => void guiPhieu(lanDraft.trim())}
              >
                {busy ? 'Đang ghi sổ…' : 'Vẫn xuất'}
              </button>
            </>
          }
        >
          {/* Câu NGUYÊN VĂN của server: mã nào, cần bao nhiêu, khả dụng bao nhiêu. */}
          <div className="kh-hau" style={{ borderLeftColor: 'var(--kh-stop)' }}>
            {lanSheet}
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="kh-mut" style={{ fontSize: 11, fontWeight: 700 }}>
              LÝ DO VẪN XUẤT · BẮT BUỘC
            </span>
            <textarea
              className="kh-o"
              value={lanDraft}
              onChange={(e) => setLanDraft(e.target.value)}
              rows={3}
              placeholder="ví dụ: lệnh kia chưa vào chuyền, tổ trưởng hai bên đã thống nhất"
              aria-label="Lý do xuất lấn phần đang giữ"
            />
          </label>
          <p className="kh-mut" style={{ fontSize: 12 }}>
            Lý do ghi vào ghi chú phiếu để hậu kiểm biết ai lấy của ai. Lệnh bị lấn sẽ
            thiếu đúng phần này khi tới lượt cấp.
          </p>
        </HopThoai>
      )}

      {xemIn && (
        <HopThoai
          title="Xem trước phiếu xuất kho"
          subtitle="Dựng từ bản đang gõ — chưa ghi sổ, chưa có số phiếu. Đúng mẫu 02-VT sẽ in ra."
          onClose={() => setXemIn(false)}
          width={900}
        >
          <WarehouseDocPrintSheet
            head={{
              kind: 'issue',
              code: null,
              date: new Date(head.doc_date),
              counterparty:
                [head.to, head.nguoi_lay.trim()].filter(Boolean).join(' · ') || null,
              reason:
                head.loai === 'lsx'
                  ? `Cấp cho lệnh ${lsxChon?.code ?? ''}`.trim()
                  : lyDoChon
                    ? `${lyDoChon.ma} · ${lyDoChon.nhan}`
                    : null,
              creator_name: nguoiLap,
            }}
            lines={rows.map<WarehousePrintLine>((r) => ({
              id: r.id,
              material_code: r.code,
              material_name: r.name,
              material_unit: r.unit,
              qty_doc: null,
              qty: r.qty,
              note: r.note || null,
            }))}
            company={company}
            tpl={tpl}
          />
        </HopThoai>
      )}
    </KhoKhung>
  )
}
