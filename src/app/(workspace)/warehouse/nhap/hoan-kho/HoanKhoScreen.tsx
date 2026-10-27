'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUpFromLine, Printer, X } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { isoToVn } from '@/lib/date-vn'
import { searchMatcher } from '@/lib/search-text'
import { useBeRong } from '@/lib/use-be-rong'
import {
  WarehouseDocPrintSheet,
  type WarehousePrintLine,
} from '@/app/print/warehouse/WarehouseDocPrintSheet'
import type { PrintCompany } from '@/app/print/PrintSheet'
import type { DocTemplate } from '@/lib/doc-templates'
import {
  kiemTruocGhiSoHoan,
  tinhTongHoan,
  vuotDaLinh,
  type DauPhieuHoan,
  type DongHoan,
} from '@/lib/kho-hoan-kho'
import { ApNhom, ApNut, DauTrang, KhoKhung, Rong, ThanhTT } from '../../_erp/khung'
import { GoiY, HopThoai, OChu, ONgay, OSo, docSoVn } from '../../_erp/o-nhap'
import { ChonMot, OTim } from '../../_erp/o-tim'
import { useCtrlEnter } from '../../_erp/useCtrlEnter'

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
const tenTo = (n: string) => n.replace(/^tổ\s+/i, '')

type LenhOpt = { id: string; code: string; customer_name: string | null; status: string }

const TRANG_THAI: Record<string, string> = {
  approved: 'đã duyệt',
  in_progress: 'đang SX',
  completed: 'đã xong',
}

/**
 * HOÀN KHO TỪ SẢN XUẤT — khuôn F. Kho lối ERP · B6 (bản vẽ
 * https://claude.ai/artifact/F2uVKzc4tb28FhHZY6BDiR): viết tay, không kit.
 * Gốc thiết kế: artboard 8 + 8b ở https://claude.ai/artifact/G9Zso3vzCHUYpNGRp9o7Nf
 *
 * KHÁC HẲN hai màn nhập kia: TẬP VẬT TƯ LÀ ĐÓNG. Không ô tìm mã — lưới điền
 * sẵn từ phần lệnh đã lĩnh chưa hoàn, trần từng dòng là chính con số đó.
 * Cũng không có cột Tình trạng: service chặn `qty_rejected` cho phiếu hoàn —
 * hàng lỗi xử ở xưởng, không đẩy sang kho thành "hàng khoá" rồi để đó.
 *
 * Đổi lệnh là đổi URL (page dựng lại màn bằng `key`). Ghi sổ chỉ ở thanh chốt
 * đáy; lỗi ghi hiện TẠI CHỖ, không toast.
 */
export function HoanKhoScreen({
  lsx,
  lsxId,
  rows: initialRows,
  to,
  today,
  nguoiNhan,
  canEdit,
  company,
  tpl,
}: {
  lsx: LenhOpt[]
  lsxId: string
  rows: DongHoan[]
  to: string[]
  today: string
  nguoiNhan: string
  canEdit: boolean
  company: PrintCompany
  tpl: DocTemplate
}) {
  const router = useRouter()
  const khung = useRef<HTMLDivElement>(null)
  const rong = useBeRong(khung)
  const dienThoai = rong > 0 && rong < 600

  const [rows, setRows] = useState(initialRows)
  const [head, setHead] = useState<DauPhieuHoan>({
    lsx_id: lsxId,
    to: '',
    doc_date: today,
    note: '',
  })
  const [xemIn, setXemIn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [daThu, setDaThu] = useState(false)
  const [loiGhi, setLoiGhi] = useState<string | null>(null)

  const dat = (p: Partial<DauPhieuHoan>) => setHead((h) => ({ ...h, ...p }))
  const patch = (i: number, p: Partial<DongHoan>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)))

  const tong = useMemo(() => tinhTongHoan(rows), [rows])
  const kiem = useMemo(() => kiemTruocGhiSoHoan(head, rows), [head, rows])
  const lenh = lsx.find((l) => l.id === head.lsx_id) ?? null
  const thieu = (o: 'lenh' | 'to') => daThu && !kiem.ok && kiem.focus === o
  const k = (need: boolean) => (need ? 'k need' : 'k')

  const doiLenh = (id: string) =>
    router.push(id ? `/warehouse/nhap/hoan-kho?lsx=${id}` : '/warehouse/nhap/hoan-kho')

  const nhayToi = () => {
    setDaThu(true)
    if (kiem.ok) return
    if (typeof kiem.focus === 'number') {
      const el = document.getElementById(`hoan-qty-${kiem.focus}`) as HTMLInputElement | null // prettier-ignore
      el?.focus()
      el?.select()
    } else document.getElementById(`hoan-${kiem.focus}`)?.focus()
  }

  const blocked = !canEdit
    ? 'Tài khoản này không có quyền ghi sổ kho'
    : busy
      ? 'Đang ghi sổ…'
      : !kiem.ok
        ? kiem.message
        : undefined
  const ghiDuoc = blocked == null

  async function ghiSo() {
    if (!ghiDuoc) return
    setBusy(true)
    setLoiGhi(null)
    try {
      const res = await api<{ id: string; code: string }>(
        '/api/dept/warehouse/docs/receipt',
        {
          method: 'POST',
          body: {
            // Hoàn kho: gắn LỆNH, KHÔNG gắn đơn mua. Service tự đặt mã lý do
            // N3 và trừ lại phần "đã cấp" của lệnh.
            po_id: null,
            production_order_id: head.lsx_id,
            counterparty: head.to.trim(),
            reason: `Hoàn kho từ sản xuất — ${lenh?.code ?? ''}`.trim(),
            doc_date: head.doc_date || null,
            note: head.note.trim() || null,
            lines: rows
              .filter((r) => r.qty > 0)
              .map((r) => ({
                material_id: r.material_id,
                qty: r.qty,
                note: r.note.trim() || null,
              })),
          },
        },
      )
      const q = new URLSearchParams({
        vua_ghi: res.id,
        ma: res.code,
        chi_tiet: `${tong.so_dong} dòng hoàn · ${fmt(tong.tong)} đơn vị về kho`,
      })
      router.push(`/warehouse/nhap?${q}`)
      router.refresh()
    } catch (e) {
      setLoiGhi(apiErrorText(e))
      setBusy(false)
    }
  }

  const bamGhi = () => {
    if (!canEdit || busy) return
    if (ghiDuoc) void ghiSo()
    else nhayToi()
  }
  const phimGhi = useCtrlEnter(bamGhi)

  const dauPhieu = (
    <div className="kh-hc" role="group" aria-label="Đầu phiếu hoàn kho">
      <div style={{ flex: '1 1 300px' }}>
        <span className={k(thieu('lenh'))}>
          <i className="kh-buoc">1</i>Lệnh sản xuất
        </span>
        <OTim<LenhOpt>
          id="hoan-lenh"
          items={lsx}
          khop={(l, q) => searchMatcher(q)([l.code, l.customer_name ?? ''])}
          keyOf={(l) => l.id}
          textOf={(l) => l.code}
          value={lenh}
          giuChu
          onPick={(l) => doiLenh(l.id)}
          render={(l) => (
            <span style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <b className="kh-ma">{l.code}</b>
              <span>{l.customer_name}</span>
              <span className="kh-mut" style={{ marginLeft: 'auto' }}>
                {TRANG_THAI[l.status] ?? l.status}
              </span>
            </span>
          )}
          label="Lệnh sản xuất"
          placeholder={`gõ số lệnh hoặc tên khách · ${lsx.length} lệnh`}
          tone={thieu('lenh') ? 'need' : undefined}
          disabled={busy}
          rong="Không có lệnh hoàn kho được nào khớp"
        />
        {lenh && (
          <GoiY tone="mut">
            {lenh.customer_name ?? '—'} · {TRANG_THAI[lenh.status] ?? lenh.status}
          </GoiY>
        )}
      </div>

      <div>
        <span className={k(thieu('to'))}>
          <i className="kh-buoc">2</i>Tổ trả
        </span>
        <span id="hoan-to" tabIndex={-1}>
          <ChonMot<string>
            value={head.to}
            label="Tổ trả"
            need={thieu('to')}
            options={to.map((t) => ({ value: t, label: tenTo(t) }))}
            onChange={(v) => dat({ to: v })}
            disabled={busy}
          />
        </span>
      </div>

      <div style={{ width: 140 }}>
        <span className="k">
          <i className="kh-buoc">3</i>Ngày{head.doc_date === today ? ' · hôm nay' : ''}
        </span>
        <ONgay
          value={head.doc_date}
          onChange={(v) => dat({ doc_date: v })}
          label="Ngày chứng từ"
          disabled={busy}
        />
        {head.doc_date && head.doc_date !== today && (
          <GoiY tone="warn">ghi lùi về {isoToVn(head.doc_date)}</GoiY>
        )}
      </div>

      <div style={{ flex: '1 1 260px' }}>
        <span className="k">Ghi chú phiếu</span>
        <OChu
          value={head.note}
          onCommit={(v) => dat({ note: v })}
          placeholder="ví dụ: tổ cắt dư sau khi đổi bản vẽ"
          label="Ghi chú phiếu"
          disabled={busy}
        />
      </div>

      <div>
        <span className="k">Người nhận</span>
        <span className="v">{nguoiNhan}</span>
      </div>
    </div>
  )

  const oHoan = (r: DongHoan, i: number) => {
    const vuot = vuotDaLinh(r)
    return (
      <>
        <OSo
          id={`hoan-qty-${i}`}
          value={String(r.qty)}
          onCommit={(v) => patch(i, { qty: docSoVn(v) })}
          label={`Hoàn ${r.code}`}
          tone={vuot != null ? 'need' : undefined}
          disabled={busy}
        />
        {vuot != null && (
          <GoiY tone="warn">
            lệnh chỉ còn ghi đã cấp {fmt(r.issued)} — thừa {fmt(vuot)}
          </GoiY>
        )}
      </>
    )
  }

  const luoi = dienThoai ? (
    <div className="kh-pl" aria-label="Dòng hoàn kho">
      {rows.map((r, i) => (
        <div key={r.material_id} className="kh-pl-dong">
          <span style={{ minWidth: 0 }}>
            <span className="kh-ma">{r.code}</span>
            <span style={{ display: 'block', fontWeight: 600 }}>{r.name}</span>
            <span className="kh-mut kh-num" style={{ display: 'block', fontSize: 12 }}>
              đã lĩnh còn {fmt(r.issued)} {r.unit}
            </span>
          </span>
          <span>{oHoan(r, i)}</span>
          <span className="full">
            <OChu
              value={r.note}
              onCommit={(v) => patch(i, { note: v })}
              placeholder="ghi chú (không bắt buộc)"
              label={`Ghi chú ${r.code}`}
              disabled={busy}
            />
          </span>
        </div>
      ))}
    </div>
  ) : (
    <div className="kh-grid">
      <table className="kh-tb" aria-label="Dòng hoàn kho">
        <colgroup>
          <col style={{ width: 34 }} />
          <col style={{ width: 104 }} />
          <col />
          <col style={{ width: 56 }} />
          <col style={{ width: 128 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: rong > 0 && rong < 1000 ? 200 : 320 }} />
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>Mã</th>
            <th>Tên vật tư</th>
            <th>ĐVT</th>
            <th className="r" title="Phần lệnh đã lĩnh chưa hoàn — trần của ô Hoàn">
              Đã lĩnh còn lại
            </th>
            <th className="r">Hoàn</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.material_id} className="d f">
              <td className="kh-num kh-mut">{i + 1}</td>
              <td className="kh-ma">{r.code}</td>
              <td title={r.name}>{r.name}</td>
              <td className="kh-mut">{r.unit}</td>
              <td className="r kh-num kh-mut">{fmt(r.issued)}</td>
              <td className="r go">{oHoan(r, i)}</td>
              <td className="go">
                <OChu
                  value={r.note}
                  onCommit={(v) => patch(i, { note: v })}
                  placeholder="ghi chú (không bắt buộc)"
                  label={`Ghi chú ${r.code}`}
                  disabled={busy}
                />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>Tổng · {rows.length} dòng</td>
            <td className="r kh-num">{fmt(tong.tong_da_linh)}</td>
            <td className="r kh-num">{fmt(tong.tong)}</td>
            <td style={{ fontWeight: 400 }}>
              {tong.so_dong} dòng hoàn · giá vốn theo lần cấp
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )

  return (
    <KhoKhung label="Hoàn kho từ sản xuất" onKeyDown={phimGhi}>
      <DauTrang
        crumb="Kho › Nhận hàng"
        title={
          <>
            Hoàn kho từ sản xuất
            {lenh && <span className="kh-num"> · {lenh.code}</span>}
          </>
        }
        ctx={
          <>
            Phiếu nhập kho · <span className="kh-tag done">N3</span> nhập lại vật tư thừa
            từ SX{lenh?.customer_name ? ` · ${lenh.customer_name}` : ''} · số PNK cấp khi
            ghi sổ
          </>
        }
        actions={
          <>
            <ApNhom>
              <ApNut
                icon={<Printer size={15} aria-hidden />}
                onClick={() => setXemIn(true)}
                why={rows.length === 0 ? 'Chưa có dòng nào để in' : null}
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
                icon={<ArrowUpFromLine size={15} aria-hidden />}
                href={head.lsx_id ? `/warehouse/xuat?lsx=${head.lsx_id}` : undefined}
                why={head.lsx_id ? null : 'Chọn lệnh trước'}
              >
                Lập phiếu xuất
              </ApNut>
            </ApNhom>
          </>
        }
      />

      {dauPhieu}
      <div ref={khung} style={{ height: 0, width: '100%' }} aria-hidden />

      {!head.lsx_id ? (
        <Rong
          tieuDe="Chọn lệnh sản xuất để xem có gì hoàn được"
          lyDo={`Chỉ trả lại được thứ lệnh đã lấy ra khỏi kho, nên lưới dựng từ chính lệnh. Đang có ${lsx.length} lệnh hoàn kho được (đã duyệt, đang SX, hoặc đã xong) — chọn ở ô “Lệnh sản xuất” phía trên.`}
        />
      ) : rows.length === 0 ? (
        <Rong
          tieuDe={`${lenh?.code} chưa lĩnh vật tư nào`}
          lyDo="Chỉ trả lại được thứ đã lấy ra khỏi kho. Sổ chưa ghi lần cấp nào cho lệnh này, nên không có gì để hoàn. Nếu tổ đang cầm vật tư thật thì lần cấp đó chưa được ghi sổ."
          tiep={
            <Link className="kh-btn p" href={`/warehouse/xuat?lsx=${head.lsx_id}`}>
              Lập phiếu xuất cho lệnh này
            </Link>
          }
        />
      ) : (
        <>
          <div className="kh-them">
            <span className="lbl">Lưới điền sẵn</span>
            <span className="kh-mut">
              từ <b>phần lệnh đã lĩnh chưa hoàn</b> — không có ô tìm mã: chỉ trả được thứ
              đã lấy
            </span>
            <span className="kh-mut" style={{ marginLeft: 'auto' }}>
              Tab sang ô kế · Ctrl+Enter ghi sổ
            </span>
          </div>

          {luoi}

          {/* THANH CHỐT ĐÁY — nói vì sao chưa ghi sổ được bằng câu BẤM ĐƯỢC. */}
          <div className="kh-commit" role="group" aria-label="Ghi sổ phiếu hoàn kho">
            <span className="m">
              <span className="k">Dòng hoàn</span>
              <span className="v">{tong.so_dong}</span>
            </span>
            <span className="m">
              <span className="k">Đã lĩnh</span>
              <span className="v">{fmt(tong.tong_da_linh)}</span>
            </span>
            <span className="m">
              <span className="k">Hoàn về kho</span>
              <span className="v">{fmt(tong.tong)}</span>
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
        </>
      )}

      <ThanhTT
        left="Mọi dòng mang mã N3 · hàng về khu tiếp nhận · không có cột Tình trạng — hàng lỗi xử ở xưởng · ghi sổ xong, phần “đã cấp” của lệnh giảm đúng bằng số hoàn"
        right={
          <b>{head.lsx_id ? `${rows.length} mã lệnh đang giữ` : `${lsx.length} lệnh`}</b>
        }
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
              counterparty: head.to.trim() || null,
              reason: `Hoàn kho từ sản xuất — ${lenh?.code ?? ''}`.trim(),
              note: head.note.trim() || null,
              creator_name: nguoiNhan,
            }}
            lines={rows
              .filter((r) => r.qty > 0)
              .map<WarehousePrintLine>((r) => ({
                id: r.material_id,
                material_code: r.code,
                material_name: r.name,
                material_unit: r.unit,
                // "Theo chứng từ" = phần lệnh đã lĩnh, "Thực nhập" = phần trả
                // lại. Hai cột của mẫu 01-VT ở đây đọc được đúng nghĩa.
                qty_doc: r.issued,
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
