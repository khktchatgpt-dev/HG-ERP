'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import {
  conPhaiNhap,
  kiemNhapDeNghi,
  mucVuot,
  tienNhap,
  VUOT_TU_DO,
  type DongNhapDeNghi,
} from '@/lib/de-nghi-nhap'
import { kiemNgayChungTu } from '@/lib/ngay-chung-tu-nhap'
import { useBeRong } from '@/lib/use-be-rong'
import { ArrowLeft } from 'lucide-react'
import { ApNhom, ApNut, DauTrang, KhoKhung, ThanhTT } from '../../../_erp/khung'
import { GoiY, OChu, ONgay, OSo } from '../../../_erp/o-nhap'
import { GanMaSheet, type MaGan } from './gan-ma'

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
/** Số kiểu VN: "1.390" = 1390 · "2,5" = 2,5. Rỗng = null. */
const docSo = (v: string): number | null => {
  const t = v.trim()
  if (!t) return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const pct = (x: number) => `${Math.round(x * 100)}%`

/** Một dòng phiếu đề nghị còn phải nhập — page dựng sẵn. */
export type DongCho = {
  line_id: string
  material_id: string | null
  code: string | null
  name: string
  unit: string
  can: number
  da_nhap: number
  /** Giá dự kiến trên phiếu đề nghị — mồi ô đơn giá thật (Q11). */
  gia_du_kien: number | null
}

type Dong = DongNhapDeNghi & {
  code: string | null
  /** Tên / ĐVT hiển thị (sau khi gắn mã = theo danh mục). */
  ten: string
  dvt: string
  /** ĐVT trên phiếu đề nghị — gắn mã khác ĐVT thì nói ra (số duyệt tính theo ĐVT cũ). */
  dvt_de_nghi: string
  gia_du_kien: number | null
  /** Mã vừa gắn ở màn này (dòng "chưa có mã" của phiếu). */
  ganMoi: boolean
}

/**
 * KHO NHẬP HÀNG ĐÃ MUA — khuôn F (0238 · Đ3, bản vẽ DN-3
 * https://claude.ai/artifact/6bFb19HuFtSzT8y2wqT17g, Q10–Q14 duyệt 13/10/2026).
 *
 * Chủ dự án 13/10: phiếu đề nghị duyệt xong thì KHO tự đi mua và tự nhập kho,
 * không qua Cung ứng. Lưới điền sẵn các dòng CÒN PHẢI NHẬP (số duyệt − đã nhập);
 * Kho ghi số thực nhận + đơn giá thật theo hoá đơn. Ghi sổ ra một PNK mã lý do
 * N2 có đơn giá (giá trị tồn đúng), in 01-VT, đảo được như mọi phiếu nhập.
 *
 * Luật chặn ở `lib/de-nghi-nhap` — cùng hàm service dùng, nên câu chặn ở thanh
 * đáy chính là lỗi server sẽ trả. Khung < 1000px: bỏ cột Đã nhập + Thành tiền
 * (đã nhập xuống thành gợi ý dưới Số duyệt, tổng ở thanh chốt).
 *
 * Dựng lại trên khung Kho lối ERP · B5 (14/10/2026): viết tay, không kit; thông
 * báo (trùng mã, lỗi ghi sổ) hiện tại chỗ thay toast.
 */
export function NhapDeNghiScreen({
  phieu,
  dong,
  nccGoiY,
  nhomOptions,
  canCreateMa,
  today,
  nguoiMua,
}: {
  phieu: { id: string; code: string; status: string; approved_by_name: string | null }
  dong: DongCho[]
  nccGoiY: string[]
  nhomOptions: string[]
  canCreateMa: boolean
  today: string
  nguoiMua: string
}) {
  const router = useRouter()
  const [bao, setBao] = useState<string | null>(null)
  const [head, setHead] = useState({
    noi_mua: '',
    supplier_doc_no: '',
    doc_date: today,
    backdate_reason: '',
    note: '',
  })
  const [rows, setRows] = useState<Dong[]>(() =>
    dong.map((d) => ({
      line_id: d.line_id,
      name: d.name,
      material_id: d.material_id,
      can: d.can,
      daNhap: d.da_nhap,
      qty: conPhaiNhap(d.can, d.da_nhap),
      unit_price: d.gia_du_kien,
      note: '',
      code: d.code,
      ten: d.name,
      dvt: d.unit,
      dvt_de_nghi: d.unit,
      gia_du_kien: d.gia_du_kien,
      ganMoi: false,
    })),
  )
  const [gan, setGan] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const khung = useRef<HTMLDivElement>(null)
  const beRong = useBeRong(khung)
  const hep = beRong > 0 && beRong < 1000

  const patch = (i: number, p: Partial<Dong>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const kiem = useMemo(
    () => kiemNhapDeNghi({ noi_mua: head.noi_mua }, rows),
    [head, rows],
  )
  const ngay = kiemNgayChungTu({
    docDate: head.doc_date,
    today,
    lyDo: head.backdate_reason,
  })
  const tien = tienNhap(rows)
  const coNhap = rows.filter((r) => r.qty > 0)
  const deSau = rows.filter((r) => !(r.qty > 0)).length

  const focus = (id: string) =>
    setTimeout(() => {
      const el = document.getElementById(id) as HTMLInputElement | null
      el?.focus()
      el?.select?.()
    }, 40)

  const chan = !kiem.ok ? kiem.message : ngay.muc !== 'ok' ? ngay.message : undefined

  function nhayToi() {
    if (!kiem.ok) {
      if (kiem.focus === 'noi_mua') return focus('nhap-noi-mua')
      if (kiem.o === 'ma') return setGan(kiem.focus)
      return focus(`nhap-${kiem.o ?? 'qty'}-${kiem.focus}`)
    }
    if (ngay.muc !== 'ok')
      focus(ngay.muc === 'can_ly_do' ? 'nhap-ly-do-lui' : 'nhap-ngay')
  }

  function ganMa(i: number, m: MaGan) {
    const trung = rows.findIndex((r, j) => j !== i && r.material_id === m.id)
    setBao(
      trung >= 0
        ? `${m.code} đã gắn ở dòng ${trung + 1} — vẫn gắn được, hai dòng đề nghị cùng một mã thì tồn cộng chung.`
        : null,
    )
    patch(i, { material_id: m.id, code: m.code, ten: m.name, dvt: m.unit, ganMoi: true })
    setGan(null)
    focus(`nhap-qty-${i}`)
  }

  async function ghi() {
    if (chan) return nhayToi()
    setBusy(true)
    setBao(null)
    try {
      await api<{ doc_id: string; code: string; status: string }>(
        `/api/dept/warehouse/de-nghi/${phieu.id}/nhap`,
        {
          method: 'POST',
          body: {
            noi_mua: head.noi_mua.trim(),
            supplier_doc_no: head.supplier_doc_no.trim() || null,
            doc_date: head.doc_date || null,
            backdate_reason: head.backdate_reason.trim() || null,
            note: head.note.trim() || null,
            lines: rows.map((r) => ({
              line_id: r.line_id,
              material_id: r.material_id,
              qty: r.qty > 0 ? r.qty : 0,
              unit_price: r.unit_price,
              note: r.note.trim() || null,
            })),
          },
        },
      )
      router.push(`/warehouse/de-nghi/${phieu.id}`)
      router.refresh()
    } catch (e) {
      setBao(`Chưa ghi sổ được: ${apiErrorText(e)}`)
      setBusy(false)
    }
  }

  const soCot = hep ? 8 : 10

  return (
    <KhoKhung
      label={`Nhập hàng đã mua theo ${phieu.code}`}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault()
          ;(document.activeElement as HTMLElement | null)?.blur()
          setTimeout(() => void ghi(), 0)
        }
      }}
    >
      <DauTrang
        crumb={`Kho › Đề nghị mua › ${phieu.code}`}
        title="Nhập hàng đã mua"
        ctx={
          <>
            <span className="kh-tag done">N2</span> mua theo {phieu.code} ·{' '}
            {phieu.approved_by_name ?? 'lãnh đạo'} đã duyệt · số PNK cấp khi ghi sổ
          </>
        }
        actions={
          <ApNhom>
            <ApNut
              icon={<ArrowLeft size={15} aria-hidden />}
              href={busy ? undefined : `/warehouse/de-nghi/${phieu.id}`}
              why={busy ? 'Đang ghi sổ…' : null}
            >
              Về phiếu {phieu.code}
            </ApNut>
          </ApNhom>
        }
      />

      <div className="kh-hc" role="group" aria-label="Đầu phiếu nhập">
        <div style={{ width: 230 }}>
          <span className={head.noi_mua.trim() ? 'k' : 'k need'}>Nơi mua</span>
          <input
            id="nhap-noi-mua"
            className={head.noi_mua.trim() ? 'kh-o' : 'kh-o nen'}
            list="nhap-ncc"
            value={head.noi_mua}
            onChange={(e) => setHead((h) => ({ ...h, noi_mua: e.target.value }))}
            placeholder="tên tiệm / NCC"
            aria-label="Nơi mua"
            disabled={busy}
          />
        </div>
        <div style={{ width: 150 }}>
          <span className="k">Số hoá đơn / biên nhận</span>
          <OChu
            value={head.supplier_doc_no}
            onCommit={(v) => setHead((h) => ({ ...h, supplier_doc_no: v }))}
            placeholder="không bắt buộc"
            mono
            label="Số hoá đơn / biên nhận"
            disabled={busy}
          />
        </div>
        <div style={{ width: 128 }}>
          <span className={ngay.muc === 'chan' ? 'k need' : 'k'}>Ngày nhập</span>
          <span id="nhap-ngay">
            <ONgay
              value={head.doc_date}
              onChange={(v) => setHead((h) => ({ ...h, doc_date: v }))}
              label="Ngày nhập"
              tone={ngay.muc === 'chan' ? 'need' : undefined}
            />
          </span>
        </div>
        {(ngay.muc === 'can_ly_do' || head.backdate_reason) && (
          <div style={{ width: 230 }}>
            <span className="k need">Lý do nhập lùi</span>
            <OChu
              id="nhap-ly-do-lui"
              value={head.backdate_reason}
              onCommit={(v) => setHead((h) => ({ ...h, backdate_reason: v }))}
              placeholder="lùi quá 7 ngày phải ghi lý do"
              label="Lý do nhập lùi ngày"
              disabled={busy}
              tone={head.backdate_reason.trim() ? undefined : 'need'}
            />
          </div>
        )}
        <div>
          <span className="k">Người mua</span>
          <span className="v">{nguoiMua}</span>
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <span className="k">Ghi chú</span>
          <OChu
            value={head.note}
            onCommit={(v) => setHead((h) => ({ ...h, note: v }))}
            placeholder="không bắt buộc"
            label="Ghi chú phiếu nhập"
            disabled={busy}
          />
        </div>
      </div>
      <datalist id="nhap-ncc">
        {nccGoiY.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      {kiem.ok && kiem.canhBao.length > 0 && (
        <div className="kh-note">
          <span className="tag">Nhập vượt</span>
          <span>
            {kiem.canhBao.map((c) => c.cau).join(' · ')} — trong ngưỡng {pct(VUOT_TU_DO)}{' '}
            (mua theo cuộn / thùng hay lố), ghi được; dòng sổ mang vết vượt để lãnh đạo
            thấy.
          </span>
        </div>
      )}

      <div ref={khung} style={{ height: 0, width: '100%' }} aria-hidden />
      <div className="kh-grid">
        <table className="kh-tb" aria-label="Dòng nhập theo phiếu đề nghị">
          <colgroup>
            <col style={{ width: 34 }} />
            <col style={{ width: hep ? 104 : 124 }} />
            <col />
            <col style={{ width: 60 }} />
            <col style={{ width: 86 }} />
            {!hep && <col style={{ width: 86 }} />}
            <col style={{ width: 112 }} />
            <col style={{ width: 120 }} />
            {!hep && <col style={{ width: 116 }} />}
            <col style={{ width: hep ? 150 : 210 }} />
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              <th>Mã</th>
              <th>Tên vật tư</th>
              <th>ĐVT</th>
              <th className="r">Số duyệt</th>
              {!hep && <th className="r">Đã nhập</th>}
              <th className="r">Nhận lần này</th>
              <th className="r">Đơn giá thật</th>
              {!hep && <th className="r">Thành tiền</th>}
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const v = mucVuot(r.can, r.daNhap, r.qty)
              const lechDvt = r.ganMoi && r.dvt.trim().toLowerCase() !== r.dvt_de_nghi.trim().toLowerCase() // prettier-ignore
              return (
                <tr key={r.line_id} className="d f">
                  <td className="kh-num kh-mut">{i + 1}</td>
                  <td>
                    {r.code && <span className="kh-ma">{r.code}</span>}
                    {(!r.code || r.ganMoi) && (
                      <button
                        type="button"
                        className="kh-lnk"
                        style={{ fontFamily: 'inherit', marginLeft: r.code ? 6 : 0 }}
                        disabled={busy}
                        title={
                          r.code
                            ? 'Đổi mã vừa gắn'
                            : 'Dòng chưa có mã — gắn mã trước khi ghi sổ'
                        }
                        onClick={() => setGan(i)}
                      >
                        {r.code ? 'đổi' : 'gắn mã'}
                      </button>
                    )}
                  </td>
                  <td className="go" title={r.ten}>
                    <span
                      style={{
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {r.ten}
                    </span>
                    {r.ganMoi && r.ten !== r.name && (
                      <span className="kh-hint" style={{ textAlign: 'left' }}>
                        đề nghị ghi: {r.name}
                      </span>
                    )}
                  </td>
                  <td className="kh-mut go">
                    {r.dvt}
                    {lechDvt && <GoiY tone="warn">đề nghị: {r.dvt_de_nghi}</GoiY>}
                  </td>
                  <td className="r kh-num go">
                    {fmt(r.can)}
                    {hep && r.daNhap > 0 && <GoiY>đã nhập {fmt(r.daNhap)}</GoiY>}
                  </td>
                  {!hep && (
                    <td className="r kh-num kh-mut">
                      {r.daNhap > 0 ? fmt(r.daNhap) : '—'}
                    </td>
                  )}
                  <td className="r go">
                    <OSo
                      id={`nhap-qty-${i}`}
                      value={String(r.qty)}
                      onCommit={(x) => patch(i, { qty: docSo(x) ?? 0 })}
                      disabled={busy}
                      label={`Nhận lần này ${r.code ?? r.name}`}
                    />
                    {!(r.qty > 0) ? (
                      <GoiY>để chuyến sau</GoiY>
                    ) : v > 0 ? (
                      <GoiY tone="warn">
                        vượt {pct(v)}
                        {v > VUOT_TU_DO ? ' · cần lý do' : ''}
                      </GoiY>
                    ) : null}
                  </td>
                  <td className="r go">
                    <OSo
                      id={`nhap-gia-${i}`}
                      value={r.unit_price == null ? '' : String(r.unit_price)}
                      onCommit={(x) => patch(i, { unit_price: docSo(x) })}
                      disabled={busy}
                      label={`Đơn giá thật ${r.code ?? r.name}`}
                    />
                    {r.gia_du_kien != null && r.unit_price !== r.gia_du_kien && (
                      <GoiY>dự kiến {fmt(r.gia_du_kien)}</GoiY>
                    )}
                  </td>
                  {!hep && (
                    <td className="r kh-num">
                      {r.qty > 0 && r.unit_price != null ? (
                        fmt(Math.round(r.qty * r.unit_price))
                      ) : (
                        <span className="kh-empty">—</span>
                      )}
                    </td>
                  )}
                  <td className="go">
                    <OChu
                      id={`nhap-note-${i}`}
                      value={r.note}
                      onCommit={(x) => patch(i, { note: x })}
                      placeholder={
                        v > VUOT_TU_DO
                          ? 'bắt buộc: vì sao vượt'
                          : r.unit_price === 0
                            ? 'bắt buộc: vì sao giá 0'
                            : 'không bắt buộc'
                      }
                      label={`Ghi chú ${r.code ?? r.name}`}
                      disabled={busy}
                      tone={(v > VUOT_TU_DO || r.unit_price === 0) && !r.note.trim() ? 'need' : undefined} // prettier-ignore
                    />
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={soCot}
                  className="kh-mut"
                  style={{ textAlign: 'center', padding: 22 }}
                >
                  Không còn dòng nào phải nhập — mọi dòng đã nhập đủ số duyệt. Quay lại
                  phiếu {phieu.code} để xem tình hình nhập.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={hep ? 7 : 8}>
                {coNhap.length} dòng nhập lần này
                {deSau > 0 && ` · ${deSau} dòng để chuyến sau (nhận 0)`}
              </td>
              {!hep && <td className="r kh-num">{fmt(tien)}</td>}
              <td style={{ fontWeight: 400 }}>{hep ? `${fmt(tien)} · ` : ''}chưa VAT</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* THANH CHỐT ĐÁY — câu chặn chính là lỗi server sẽ trả (cùng hàm lib/de-nghi-nhap). */}
      <div className="kh-commit" role="group" aria-label="Ghi phiếu nhập kho">
        <span className="m">
          <span className="k">Dòng nhập</span>
          <span className="v">{coNhap.length}</span>
        </span>
        {deSau > 0 && (
          <span className="m">
            <span className="k">Để sau</span>
            <span className="v">{deSau}</span>
          </span>
        )}
        <span className="m">
          <span className="k">Tiền phiếu nhập (chưa VAT)</span>
          <span className="v" style={{ color: 'var(--kh-done)' }}>
            {fmt(tien)}
          </span>
        </span>
        {bao ? (
          <span className="why" role="alert">
            {bao}
          </span>
        ) : chan ? (
          <button type="button" className="why" title={chan} onClick={nhayToi}>
            Chưa ghi sổ được: {chan} →
          </button>
        ) : (
          <span className="why" />
        )}
        <span className="ghi">
          <span className="kh-kbd">Ctrl + Enter</span>
          <button
            type="button"
            className="kh-btn p"
            aria-disabled={busy || undefined}
            title={chan}
            onClick={() => void ghi()}
          >
            {busy ? 'Đang ghi sổ…' : 'Ghi phiếu nhập kho'}
          </button>
        </span>
      </div>
      <ThanhTT
        left="Hàng vào khu tiếp nhận · cất kệ là bước riêng · phiếu nhập có đơn giá thật → giá trị tồn đúng; đảo được như mọi PNK"
        right="Không qua Cung ứng — Kho tự mua theo số duyệt"
      />
      {gan != null && rows[gan] && (
        <GanMaSheet
          ten={rows[gan].name}
          dvt={rows[gan].dvt_de_nghi}
          nhomOptions={nhomOptions}
          canCreate={canCreateMa}
          onClose={() => setGan(null)}
          onDone={(m) => ganMa(gan, m)}
        />
      )}
    </KhoKhung>
  )
}
