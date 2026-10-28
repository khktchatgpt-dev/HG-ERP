'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import {
  WarehouseDocPrintSheet,
  type WarehousePrintLine,
} from '@/app/print/warehouse/WarehouseDocPrintSheet'
import type { PrintCompany } from '@/app/print/PrintSheet'
import type { DocTemplate } from '@/lib/doc-templates'
import {
  donMoCuaNcc,
  kiemTruocGhiSoNgoai,
  themDongNhan,
  timLyDoNgoaiDon,
  tinhTongNhan,
  type DauPhieuNgoai,
  type DongNhanNgoai,
  type VatTuNhan,
} from '@/lib/kho-nhap-ngoai-don'
import { CHO_GHI_HANG_KHOA } from '@/lib/kho-phieu-nhap'
import { ArrowDownToLine, Printer, X } from 'lucide-react'
import { ApNhom, ApNut, DauTrang, KhoKhung, ThanhTT } from '../../_erp/khung'
import { HopThoai } from '../../_erp/o-nhap'
import { OTim } from '../../_erp/o-tim'
import { useCtrlEnter } from '../../_erp/useCtrlEnter'
import { DauNgoai } from './dau-ngoai'
import { LuoiNgoai } from './luoi-ngoai'

const fmt = (n: number) => n.toLocaleString('vi-VN')

type Bao = { tone: 'ok' | 'warn' | 'stop'; text: string }

/**
 * NHẬN HÀNG KHÔNG THEO ĐƠN — khuôn F, anh em với `/warehouse/nhap/[poId]`.
 * Kho lối ERP · B6 (bản vẽ https://claude.ai/artifact/F2uVKzc4tb28FhHZY6BDiR):
 * viết tay, không kit — đầu phiếu `dau-ngoai.tsx`, lưới `luoi-ngoai.tsx`.
 * Gốc thiết kế: artboard 7 + 7b ở https://claude.ai/artifact/G9Zso3vzCHUYpNGRp9o7Nf
 *
 * Khác màn nhận theo đơn ở ba chỗ, và cả ba đều có lý do nghiệp vụ:
 *   · KHÔNG có cột Đặt / Đã về — không có đơn nào để so;
 *   · BẮT CHỌN vì sao không có đơn, vì đường này dễ bị dùng để né mở đơn mua;
 *   · NCC vừa gõ mà đang có đơn mở thì nói ngay, kèm đường sang đó.
 * Ghi sổ chỉ ở thanh chốt đáy; thông báo (trùng mã, lỗi ghi) hiện TẠI CHỖ.
 */
export function NhapNgoaiDonScreen({
  ncc,
  openPos,
  today,
  nguoiNhan,
  canEdit,
  company,
  tpl,
}: {
  ncc: { id: string; name: string; code: string | null }[]
  openPos: { code: string; supplier_name: string }[]
  today: string
  nguoiNhan: string
  canEdit: boolean
  company: PrintCompany
  tpl: DocTemplate
}) {
  const router = useRouter()

  const [head, setHead] = useState<DauPhieuNgoai>({
    nguoi_giao: '',
    ly_do: '',
    supplier_doc_no: '',
    doc_date: today,
    note: '',
  })
  const [rows, setRows] = useState<DongNhanNgoai[]>([])
  const [xemIn, setXemIn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dangTra, setDangTra] = useState(false)
  const [daThu, setDaThu] = useState(false)
  const [bao, setBao] = useState<Bao | null>(null)
  const [loiGhi, setLoiGhi] = useState<string | null>(null)

  const dat = (p: Partial<DauPhieuNgoai>) => setHead((h) => ({ ...h, ...p }))
  const patch = (i: number, p: Partial<DongNhanNgoai>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)))

  const tong = useMemo(() => tinhTongNhan(rows), [rows])
  const kiem = useMemo(() => kiemTruocGhiSoNgoai(head, rows), [head, rows])
  const lyDo = timLyDoNgoaiDon(head.ly_do)
  const donMo = useMemo(
    () => donMoCuaNcc(head.nguoi_giao, openPos),
    [head.nguoi_giao, openPos],
  )
  const thieu = (o: 'nguoi_giao' | 'ly_do' | 'ghi_chu') =>
    daThu && !kiem.ok && kiem.focus === o

  async function timVatTu(q: string): Promise<VatTuNhan[]> {
    const res = await api<{ rows: VatTuNhan[] }>(
      `/api/dept/warehouse/materials?q=${encodeURIComponent(q)}&active_only=true&page_size=20`,
    )
    return res.rows.map((m) => ({ id: m.id, code: m.code, name: m.name, unit: m.unit }))
  }

  async function chonVatTu(vt: VatTuNhan) {
    // Tồn hiện tại chỉ để ĐỐI CHIẾU BẰNG MẮT — nhập không có trần như xuất.
    // Tra được thì tốt, không tra được vẫn thêm dòng: đây không phải hàng rào.
    setDangTra(true)
    let ton: number | null = null
    try {
      const res = await api<{ rows: { material_id: string; on_hand: number }[] }>(
        `/api/dept/warehouse/stock/ton?ids=${vt.id}`,
      )
      ton = res.rows[0]?.on_hand ?? 0
    } catch (e) {
      ton = null
      setBao({
        tone: 'warn',
        text: `Không tra được tồn ${vt.code}: ${apiErrorText(e)} — vẫn thêm dòng.`,
      })
    } finally {
      setDangTra(false)
    }
    const r = themDongNhan(rows, vt, ton)
    if (r.trung)
      setBao({
        tone: 'warn',
        text: `${vt.code} đã có ở dòng ${r.index + 1} — một mã một dòng, sửa số ở dòng đó.`,
      })
    else setRows(r.rows)
    setTimeout(() => focusQty(r.index), 40)
  }

  const focusQty = (i: number) => {
    const el = document.getElementById(`nhan-qty-${i}`) as HTMLInputElement | null
    el?.focus()
    el?.select()
  }

  const nhayToi = () => {
    setDaThu(true)
    if (kiem.ok) return
    if (typeof kiem.focus === 'number') {
      if (kiem.focus < 0) {
        document.getElementById('ngoai-tim')?.focus()
        return
      }
      const id = kiem.reason === 'khoa_thieu_ly_do' ? 'nhan-note' : 'nhan-qty'
      const el = document.getElementById(`${id}-${kiem.focus}`) as HTMLInputElement | null
      el?.focus()
      el?.select()
      return
    }
    const el = document.getElementById(`head-${kiem.focus}`) as HTMLInputElement | null
    el?.focus()
  }

  const blocked = !canEdit
    ? 'Tài khoản này không có quyền ghi sổ kho'
    : busy
      ? 'Đang ghi sổ…'
      : !kiem.ok
        ? kiem.message
        : undefined
  const ghiDuoc = blocked == null
  /** Bấm Ghi sổ: được thì ghi, chưa được thì nhảy tới ô phải sửa. */
  const bamGhi = () => {
    if (!canEdit || busy) return
    // Lỗi máy chủ lần trước không che câu chặn của lần này (thử 28/10).
    setLoiGhi(null)
    if (ghiDuoc) void ghiSo()
    else nhayToi()
  }
  async function ghiSo() {
    if (!ghiDuoc || !lyDo) return
    setBusy(true)
    setLoiGhi(null)
    try {
      const res = await api<{ id: string; code: string }>(
        '/api/dept/warehouse/docs/receipt',
        {
          method: 'POST',
          body: {
            // po_id null = mua ngoài. Service tự gắn mã lý do N2 cho mọi dòng
            // không có po_line_id, và chặn nếu lỡ gửi kèm dòng đơn.
            po_id: null,
            counterparty: head.nguoi_giao.trim(),
            supplier_doc_no: head.supplier_doc_no.trim() || null,
            doc_date: head.doc_date || null,
            // Lý do đi vào ô `reason` dưới dạng NHÃN ĐÃ CHỌN, nên sổ phiếu đọc
            // ra câu người ta hiểu chứ không phải một mã nội bộ. Câu gõ thêm ở
            // lại ô ghi chú — hai thứ khác nhau, đừng dán vào một ô.
            reason: lyDo.nhan,
            note: head.note.trim() || null,
            lines: rows
              .filter((r) => r.qty > 0)
              .map((r) => ({
                material_id: r.id,
                qty: r.qty,
                stock_status: r.tinh_trang,
                note: r.note.trim() || null,
              })),
          },
        },
      )
      const q = new URLSearchParams({
        vua_ghi: res.id,
        ma: res.code,
        chi_tiet: `${tong.so_dong} dòng · ${fmt(tong.tong)} đơn vị${
          tong.vao_khoa > 0 ? ` · ${fmt(tong.vao_khoa)} vào khoá` : ''
        }`,
      })
      router.push(`/warehouse/nhap?${q}`)
      router.refresh()
    } catch (e) {
      setLoiGhi(apiErrorText(e))
      setBusy(false)
    }
  }
  const phimGhi = useCtrlEnter(bamGhi)

  return (
    <KhoKhung label="Nhận hàng không theo đơn" onKeyDown={phimGhi}>
      <DauTrang
        crumb="Kho › Nhận hàng"
        title="Nhận hàng không theo đơn"
        ctx={
          <>
            Phiếu nhập kho · <span className="kh-tag done">N2</span> nhập mua ngoài đơn ·
            số PNK cấp khi ghi sổ
          </>
        }
        actions={
          <>
            <ApNhom>
              <ApNut
                icon={<Printer size={15} aria-hidden />}
                onClick={() => setXemIn(true)}
              >
                Xem bản in
              </ApNut>
              <ApNut
                icon={<X size={15} aria-hidden />}
                href={busy ? undefined : '/warehouse/nhap'}
                why={busy ? 'Đang ghi sổ…' : null}
              >
                Huỷ
              </ApNut>
            </ApNhom>
            <ApNhom>
              <ApNut
                icon={<ArrowDownToLine size={15} aria-hidden />}
                href="/warehouse/nhap"
              >
                Nhận theo đơn mua
              </ApNut>
            </ApNhom>
          </>
        }
      />

      <DauNgoai
        head={head}
        dat={dat}
        ncc={ncc}
        today={today}
        nguoiNhan={nguoiNhan}
        thieu={thieu}
        busy={busy}
      />

      {donMo.length > 0 && (
        <div className="kh-note">
          <span className="tag">Có đơn thì nhận theo đơn</span>
          <span>
            <b>{head.nguoi_giao.trim()}</b> đang có <b>{donMo.length}</b> đơn mua còn mở (
            {donMo
              .slice(0, 3)
              .map((p) => p.code)
              .join(', ')}
            {donMo.length > 3 ? '…' : ''}). Nếu chuyến hàng này thuộc một trong số đó,
            nhận theo đơn — tờ ngoài đơn không vào đối chiếu công nợ của Cung ứng.{' '}
            <Link href="/warehouse/nhap?tab=all" className="kh-lnk">
              Xem hàng về
            </Link>
          </span>
        </div>
      )}

      {/* Ô tìm đứng NGOÀI khung cuộn của lưới — gợi ý rơi xuống lưới, không bị cắt. */}
      <div className="kh-them">
        <span className="lbl">+ Thêm dòng</span>
        <OTim<VatTuNhan>
          id="ngoai-tim"
          search={timVatTu}
          onPick={(vt) => void chonVatTu(vt)}
          keyOf={(m) => m.id}
          render={(m) => (
            <span style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <b className="kh-ma">{m.code}</b>
              <span>{m.name}</span>
              <span className="kh-mut" style={{ marginLeft: 'auto' }}>
                {m.unit}
              </span>
            </span>
          )}
          placeholder={
            dangTra ? 'Đang tra tồn…' : 'Gõ mã hoặc tên vật tư · Enter để thêm dòng'
          }
          label="Tìm vật tư để thêm dòng"
          disabled={dangTra || busy}
          width={420}
          rong="Không có vật tư nào khớp"
        />
        {bao && (
          <span
            className={`bao ${bao.tone === 'ok' ? 'kh-ok' : bao.tone === 'warn' ? 'kh-warn' : 'kh-stop'}`}
            role="status"
          >
            {bao.text}
          </span>
        )}
        <span className="kh-mut" style={{ marginLeft: 'auto' }}>
          Không có cột Đặt — không có đơn để so · Ctrl+Enter ghi sổ
        </span>
      </div>

      <LuoiNgoai
        rows={rows}
        patch={patch}
        xoa={(i) => setRows((rs) => rs.filter((_, j) => j !== i))}
        tong={tong}
        busy={busy}
      />

      {/* THANH CHỐT ĐÁY — nói vì sao chưa ghi sổ được bằng câu BẤM ĐƯỢC. */}
      <div className="kh-commit" role="group" aria-label="Ghi sổ phiếu nhập">
        <span className="m">
          <span className="k">Dòng</span>
          <span className="v">{tong.so_dong}</span>
        </span>
        <span className="m">
          <span className="k">Nhận</span>
          <span className="v">{fmt(tong.tong)}</span>
        </span>
        <span className="m">
          <span className="k">Vào khoá</span>
          <span className="v">{fmt(tong.vao_khoa)}</span>
        </span>
        <span className="m">
          <span className="k">Dùng được</span>
          <span className="v">{fmt(tong.dung_duoc)}</span>
        </span>
        {loiGhi ? (
          <span className="why" role="alert">
            Chưa ghi sổ được: {loiGhi}
          </span>
        ) : blocked && !busy && (daThu || !canEdit) ? (
          <button type="button" className="why" onClick={bamGhi}>
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
            onClick={bamGhi}
          >
            {busy ? 'Đang ghi sổ…' : 'Ghi sổ'}
          </button>
        </span>
      </div>

      <ThanhTT
        left={`Mọi dòng mang mã N2 · hàng đạt vào khu tiếp nhận · ${CHO_GHI_HANG_KHOA ? 'sai quy cách vào kệ khoá' : 'hàng sai quy cách không nhập'} · cất vào kệ thật là bước riêng`} // prettier-ignore
        right={<b>Không gắn đơn mua — Cung ứng KHÔNG đối chiếu công nợ tờ này</b>}
      />

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
              date: new Date(head.doc_date),
              supplier_doc_no: head.supplier_doc_no.trim() || null,
              counterparty: head.nguoi_giao.trim() || null,
              reason: lyDo?.nhan ?? null,
              note: head.note.trim() || null,
              creator_name: nguoiNhan,
            }}
            lines={rows
              .filter((r) => r.qty > 0)
              .map<WarehousePrintLine>((r) => ({
                id: r.id,
                material_code: r.code,
                material_name: r.name,
                material_unit: r.unit,
                // Không có đơn nên "theo chứng từ" chính là số thực nhận — in một
                // cột trống ở đó là mời người đọc đi tìm con số không tồn tại.
                qty_doc: r.qty,
                qty: r.qty,
                note:
                  r.tinh_trang === 'blocked'
                    ? ['Sai quy cách', r.note].filter(Boolean).join(' · ')
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
