'use client'

import { useId, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDownToLine,
  BookOpen,
  Copy,
  Link2,
  Printer,
  Save,
  Send,
  Undo2,
  X,
  CheckCheck,
} from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { DE_NGHI_NHAN, dongTrong, tongDuKien, vuongGuiDuyet } from '@/lib/de-nghi'
import { useBeRong } from '@/lib/use-be-rong'
import { ApNhom, ApNut, DauTrang, KhoKhung, ThanhTT } from '../_erp/khung'
import { OTim } from '../_erp/o-tim'
import { HuyPhieuSheet } from './huy-phieu'
import { ChotPhieuSheet } from './chot-phieu'
import { LapLaiSheet } from './lap-lai'
import { ThongBaoPhieu } from './thong-bao-phieu'
import { TinhHinhNhap } from './tinh-hinh-nhap'
import { LuoiDeNghi } from './luoi-de-nghi'
import { DauPhieu, type DauPhieuState } from './dau-phieu'
import type { DongForm, GoiYMa, PhieuCu, PhieuForm } from './de-nghi.shared'

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })

type VatTuChon = { id: string; code: string; name: string; unit: string }
type Bao = { tone: 'ok' | 'warn' | 'stop'; text: string }
const BUOC = ['Nháp', 'Chờ duyệt', 'Đã duyệt', 'Đang nhập', 'Xong']
const BUOC_AT = { draft: 0, pending: 1, approved: 2, ordering: 3, done: 4, cancelled: 0 } as const // prettier-ignore
let khoaTam = 0

/**
 * ĐỀ NGHỊ MUA VẬT TƯ — Kho lập phiếu (0236 · Đ1, bản vẽ DN-1
 * https://claude.ai/artifact/6bFb19HuFtSzT8y2wqT17g), dựng lại trên khung Kho
 * lối ERP · B5 (https://claude.ai/artifact/F2uVKzc4tb28FhHZY6BDiR, 14/10/2026):
 * viết tay, không kit. Khuôn F: lưới là nhân vật chính, đầu phiếu một dải, thanh
 * chốt đáy nói vì sao chưa gửi được bằng câu bấm được.
 *
 * Sửa được khi phiếu còn NHÁP và người xem có quyền lập; còn lại chỉ xem. Đã
 * duyệt trở đi lưới đổi sang TÌNH HÌNH NHẬP (DN-5). Thông báo (lưu, gửi, lỗi)
 * hiện TẠI CHỖ trên thanh chốt, không toast tự tắt.
 */
export function DeNghiScreen({
  phieu,
  lsx,
  canManage,
  canNhap = false,
  phieuCu = [],
  lapLaiTu = null,
}: {
  phieu: PhieuForm
  lsx: { id: string; code: string }[]
  canManage: boolean
  /** Ghi phiếu nhập được (quản phiếu + ghi sổ kho) — nút "Nhập hàng đã mua" (0238). */
  canNhap?: boolean
  /** Phiếu cũ chọn được để "Lập lại từ phiếu cũ" (Đ8) — chỉ màn lập mới truyền. */
  phieuCu?: PhieuCu[]
  /** Mã phiếu nguồn khi màn đang là bản lập lại (`?tu=`). */
  lapLaiTu?: string | null
}) {
  const router = useRouter()
  const dsMucDich = useId()
  const sua = canManage && phieu.status === 'draft'
  const [head, setHead] = useState<DauPhieuState>({
    department: phieu.department,
    need_by: phieu.need_by,
    note: phieu.note,
    production_order_id: phieu.production_order_id,
    shipping_fee: phieu.shipping_fee,
  })
  const [rows, setRows] = useState<DongForm[]>(phieu.lines)
  const [busy, setBusy] = useState(false)
  const [dangTra, setDangTra] = useState(false)
  const [moHuy, setMoHuy] = useState(false)
  const [moChot, setMoChot] = useState(false)
  const [moLapLai, setMoLapLai] = useState(false)
  const [bao, setBao] = useState<Bao | null>(null)
  const daDuyet = ['approved', 'ordering', 'done'].includes(phieu.status)
  const dangNhap = phieu.status === 'approved' || phieu.status === 'ordering'
  const muaDong = phieu.lines.filter((l) => (l.can ?? 0) > 0)
  const thieu = muaDong.filter((l) => (l.da_nhap ?? 0) < (l.can ?? 0))
  const khung = useRef<HTMLDivElement>(null)
  const beRong = useBeRong(khung)
  const hep = beRong > 0 && beRong < 900

  const patch = (i: number, p: Partial<DongForm>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const tong = useMemo(
    () => tongDuKien(rows, head.shipping_fee),
    [rows, head.shipping_fee],
  )
  const vuong = useMemo(() => vuongGuiDuyet(rows), [rows])
  const soChuaMa = rows.filter((r) => !r.material_id && !dongTrong(r)).length

  async function timVatTu(q: string): Promise<VatTuChon[]> {
    const res = await api<{ rows: VatTuChon[] }>(
      `/api/dept/warehouse/materials?q=${encodeURIComponent(q)}&active_only=true&page_size=20`,
    )
    return res.rows.map((m) => ({ id: m.id, code: m.code, name: m.name, unit: m.unit }))
  }

  const focus = (id: string) =>
    setTimeout(() => {
      const el = document.getElementById(id) as HTMLInputElement | null
      el?.focus()
      el?.select?.()
    }, 40)

  async function chonVatTu(vt: VatTuChon) {
    const trung = rows.findIndex((r) => r.material_id === vt.id)
    if (trung >= 0) {
      setBao({ tone: 'warn', text: `${vt.code} đã có ở dòng ${trung + 1} — một mã một dòng, sửa số ở dòng đó.` }) // prettier-ignore
      focus(`dn-qty-${trung}`)
      return
    }
    setDangTra(true)
    let goiY: GoiYMa = { ton: 0, theo_doi: true, gia: null, trung: [], dang_ve: [] }
    try {
      const res = await api<{ goi_y: Record<string, GoiYMa> }>(
        `/api/dept/warehouse/de-nghi/goi-y?ids=${vt.id}${phieu.id ? `&tru=${phieu.id}` : ''}`,
      )
      goiY = res.goi_y[vt.id] ?? goiY
    } catch (e) {
      setBao({ tone: 'warn', text: `Không tra được tồn / giá gần nhất của ${vt.code}: ${apiErrorText(e)}` }) // prettier-ignore
    } finally {
      setDangTra(false)
    }
    const i = rows.length
    setRows((rs) => [
      ...rs,
      {
        key: `tam-${++khoaTam}`,
        material_id: vt.id,
        code: vt.code,
        name: vt.name,
        unit: vt.unit,
        ton: goiY.ton,
        qty: null,
        unit_price: goiY.gia?.unit_price ?? null,
        vat_rate: rows.at(-1)?.vat_rate ?? 0,
        purpose: '',
        note: '',
        gia_goi_y: goiY.gia,
        theo_doi: goiY.theo_doi,
        trung: goiY.trung,
        dang_ve: goiY.dang_ve,
      },
    ])
    focus(`dn-qty-${i}`)
  }

  const themDongTuDo = () => {
    const i = rows.length
    setRows((rs) => [
      ...rs,
      {
        key: `tam-${++khoaTam}`,
        material_id: null,
        code: null,
        name: '',
        unit: '',
        ton: null,
        qty: null,
        unit_price: null,
        vat_rate: rows.at(-1)?.vat_rate ?? 0,
        purpose: '',
        note: '',
        gia_goi_y: null,
      },
    ])
    focus(`dn-ten-${i}`)
  }

  const body = () => ({
    department: head.department.trim() || 'Kho vật tư',
    need_by: head.need_by || null,
    note: head.note.trim() || null,
    production_order_id: head.production_order_id,
    shipping_fee: head.shipping_fee || 0,
    lines: rows
      .filter((r) => !dongTrong(r))
      .map((r) => ({
        material_id: r.material_id,
        name: r.name.trim(),
        unit: r.unit.trim(),
        qty: r.qty ?? 0,
        unit_price: r.unit_price,
        vat_rate: r.vat_rate || 0,
        purpose: r.purpose.trim() || null,
        note: r.note.trim() || null,
      })),
  })

  /** Lưu nháp; trả id phiếu (phiếu mới thì vừa tạo). */
  async function luu(): Promise<string | null> {
    const b = body()
    if (b.lines.some((l) => !(l.qty > 0) || !l.name || !l.unit)) {
      const v = vuong.find((x) => x.dong != null)
      setBao({ tone: 'stop', text: `Chưa lưu được: ${v?.cau ?? 'có dòng chưa đủ tên / ĐVT / số lượng'}` }) // prettier-ignore
      if (v?.dong != null) focus(`dn-qty-${v.dong}`)
      return null
    }
    if (phieu.id) {
      await api(`/api/dept/warehouse/de-nghi/${phieu.id}`, { method: 'PUT', body: b })
      return phieu.id
    }
    const r = await api<{ id: string; code: string }>('/api/dept/warehouse/de-nghi', {
      method: 'POST',
      body: b,
    })
    return r.id
  }

  /** Chạy một việc có khoá `busy`, lỗi nói tại chỗ. */
  async function lam(viec: () => Promise<void>, loi: string) {
    setBusy(true)
    try {
      await viec()
    } catch (e) {
      setBao({ tone: 'stop', text: `${loi}: ${apiErrorText(e)}` })
    } finally {
      setBusy(false)
    }
  }

  const luuNhap = () =>
    lam(async () => {
      const id = await luu()
      if (!id) return
      setBao({ tone: 'ok', text: 'Đã lưu nháp — phiếu chưa gửi, lãnh đạo chưa thấy.' })
      if (!phieu.id) router.replace(`/warehouse/de-nghi/${id}`)
      else router.refresh()
    }, 'Lưu nháp không được')

  const nhayVuong = () => {
    const v = vuong[0]
    if (v?.dong != null) focus(rows[v.dong]?.name.trim() ? `dn-qty-${v.dong}` : `dn-ten-${v.dong}`) // prettier-ignore
  }

  const guiDuyet = () => {
    if (vuong.length > 0) return nhayVuong()
    return lam(async () => {
      const id = await luu()
      if (!id) return
      await api(`/api/dept/warehouse/de-nghi/${id}/gui`, { method: 'POST' })
      setBao({ tone: 'ok', text: 'Đã gửi lãnh đạo duyệt — phiếu khoá lại; muốn sửa thì rút về nháp.' }) // prettier-ignore
      if (!phieu.id) router.replace(`/warehouse/de-nghi/${id}`)
      else router.refresh()
    }, 'Gửi duyệt không được')
  }

  const rutVe = () =>
    lam(async () => {
      if (!phieu.id) return
      await api(`/api/dept/warehouse/de-nghi/${phieu.id}/rut`, { method: 'POST' })
      setBao({ tone: 'ok', text: 'Đã rút về nháp — sửa xong gửi lại.' })
      router.refresh()
    }, 'Rút về không được')

  async function chepLink() {
    const url = `${window.location.origin}/warehouse/de-nghi/${phieu.id}`
    try {
      await navigator.clipboard.writeText(url)
      setBao({ tone: 'ok', text: 'Đã chép đường dẫn — dán vào Zalo để lãnh đạo mở thẳng phiếu.' }) // prettier-ignore
    } catch {
      setBao({ tone: 'warn', text: `Không chép được, chép tay: ${url}` })
    }
  }

  const blocked = sua && vuong.length > 0 ? vuong[0].cau : undefined
  const dangBan = busy ? 'Đang lưu…' : null
  const at = BUOC_AT[phieu.status]

  return (
    <KhoKhung label={`Đề nghị mua vật tư ${phieu.code ?? 'mới'}`}>
      <DauTrang
        crumb="Kho › Đề nghị mua"
        title={
          <>
            Đề nghị mua vật tư{' '}
            <span className="kh-num" style={{ color: 'var(--kh-dnm)' }}>
              {phieu.code ?? 'phiếu mới'}
            </span>
          </>
        }
        ctx={
          phieu.status === 'cancelled' ? (
            <span className="kh-tag">{DE_NGHI_NHAN.cancelled}</span>
          ) : (
            <span className="kh-steps" aria-label={`Phiếu đang ở bước ${BUOC[at]}`}>
              {BUOC.map((b, i) => (
                <span key={b} className={i === at ? 'on' : i < at ? 'qua' : undefined}>
                  {b}
                </span>
              ))}
            </span>
          )
        }
        actions={
          <>
            <ApNhom>
              {sua && (
                <ApNut
                  primary
                  icon={<Send size={15} aria-hidden />}
                  onClick={() => void guiDuyet()}
                  why={dangBan}
                >
                  Gửi lãnh đạo duyệt
                </ApNut>
              )}
              {sua && (
                <ApNut
                  icon={<Save size={15} aria-hidden />}
                  onClick={() => void luuNhap()}
                  why={dangBan}
                >
                  Lưu nháp
                </ApNut>
              )}
              {canManage && phieu.status === 'pending' && (
                <ApNut
                  icon={<Undo2 size={15} aria-hidden />}
                  onClick={() => void rutVe()}
                  why={dangBan}
                >
                  Rút về nháp
                </ApNut>
              )}
              {canNhap && dangNhap && phieu.id && (
                <ApNut
                  primary
                  icon={<ArrowDownToLine size={15} aria-hidden />}
                  href={`/warehouse/de-nghi/${phieu.id}/nhap`}
                >
                  Nhập hàng đã mua
                </ApNut>
              )}
              {canManage && dangNhap && phieu.id && (
                <ApNut
                  icon={<CheckCheck size={15} aria-hidden />}
                  onClick={() => setMoChot(true)}
                >
                  Chốt xong…
                </ApNut>
              )}
              {canManage &&
                phieu.id &&
                (phieu.status === 'draft' || phieu.status === 'pending') && (
                  <ApNut
                    icon={<X size={15} aria-hidden />}
                    onClick={() => setMoHuy(true)}
                    why={dangBan}
                  >
                    Huỷ phiếu
                  </ApNut>
                )}
            </ApNhom>
            <ApNhom>
              {canManage &&
                (!phieu.id ? (
                  <ApNut
                    icon={<Copy size={15} aria-hidden />}
                    onClick={() => setMoLapLai(true)}
                  >
                    Lập lại từ phiếu cũ…
                  </ApNut>
                ) : (
                  phieu.submitted_at && (
                    <ApNut
                      icon={<Copy size={15} aria-hidden />}
                      href={`/warehouse/de-nghi/moi?tu=${phieu.id}`}
                    >
                      Lập lại phiếu này
                    </ApNut>
                  )
                ))}
              {phieu.id && phieu.status !== 'draft' && phieu.status !== 'cancelled' && (
                <ApNut
                  icon={<Link2 size={15} aria-hidden />}
                  onClick={() => void chepLink()}
                >
                  Chép đường dẫn
                </ApNut>
              )}
              {phieu.id && (
                <ApNut
                  icon={<Printer size={15} aria-hidden />}
                  onClick={() => window.open(`/print/de-nghi/${phieu.id}`, '_blank')}
                >
                  In giấy đề nghị
                </ApNut>
              )}
              <ApNut icon={<BookOpen size={15} aria-hidden />} href="/warehouse/de-nghi">
                Sổ đề nghị
              </ApNut>
            </ApNhom>
          </>
        }
      />

      <ThongBaoPhieu
        phieu={phieu}
        lapLaiTu={lapLaiTu}
        muaDong={muaDong.length}
        thieu={thieu.length}
      />

      <DauPhieu
        sua={sua}
        head={head}
        setHead={setHead}
        createdAt={phieu.created_at}
        lsx={lsx}
      />

      {sua && (
        <div className="kh-them">
          <span className="lbl">+ Thêm dòng</span>
          <OTim<VatTuChon>
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
              dangTra ? 'Đang tra tồn + giá…' : 'Gõ mã hoặc tên vật tư có trong danh mục'
            }
            label="Tìm vật tư để thêm dòng"
            disabled={dangTra}
            width={hep ? 280 : 420}
            rong="Không có vật tư nào khớp — thứ chưa có mã thì bấm “+ Dòng chưa có mã”"
          />
          <button
            type="button"
            className="kh-btn"
            style={{ border: '1px solid var(--kh-line)', background: 'var(--kh-card)' }}
            onClick={themDongTuDo}
          >
            + Dòng chưa có mã
          </button>
          <span className="kh-mut" style={{ marginLeft: 'auto' }}>
            {rows.length} dòng
          </span>
        </div>
      )}

      <div ref={khung} style={{ height: 0, width: '100%' }} aria-hidden />
      <div className="kh-grid">
        {daDuyet ? (
          <TinhHinhNhap rows={rows} hep={hep} daChot={!!phieu.closed_at} />
        ) : (
          <LuoiDeNghi
            rows={rows}
            sua={sua}
            hep={hep}
            patch={patch}
            xoa={(i) => setRows((rs) => rs.filter((_, j) => j !== i))}
            tong={tong}
            soChuaMa={soChuaMa}
            dsMucDich={dsMucDich}
          />
        )}
      </div>

      {(!daDuyet || bao) && (
        <div className="kh-commit" role="group" aria-label="Tổng phiếu đề nghị">
          {!daDuyet && (
            <>
              <span className="m">
                <span className="k">Dòng</span>
                <span className="v">{rows.length}</span>
              </span>
              {soChuaMa > 0 && (
                <span className="m">
                  <span className="k">Chưa có mã</span>
                  <span className="v" style={{ color: 'var(--kh-warn)' }}>
                    {soChuaMa}
                  </span>
                </span>
              )}
              <span className="m">
                <span className="k">Tiền hàng</span>
                <span className="v">{fmt(tong.hang)}</span>
              </span>
              <span className="m">
                <span className="k">VAT</span>
                <span className="v">{fmt(tong.vat)}</span>
              </span>
              <span className="m">
                <span className="k">Vận chuyển</span>
                <span className="v">{fmt(tong.vc)}</span>
              </span>
              <span className="m">
                <span className="k">Tổng dự kiến</span>
                <span className="v" style={{ color: 'var(--kh-dnm)' }}>
                  {fmt(tong.tong)}
                </span>
              </span>
            </>
          )}
          {bao ? (
            <span
              className="why"
              role="status"
              style={bao.tone === 'ok' ? { color: 'var(--kh-done)' } : bao.tone === 'warn' ? { color: 'var(--kh-warn)' } : undefined} // prettier-ignore
            >
              {bao.text}
            </span>
          ) : blocked ? (
            /* Lưu nháp vẫn được — chỉ GỬI DUYỆT bị chặn, nên câu nói "Chưa gửi được". */
            <button
              type="button"
              className="why"
              style={{ color: 'var(--kh-warn)' }}
              title={blocked}
              onClick={nhayVuong}
            >
              Chưa gửi được: {blocked} →
            </button>
          ) : (
            <span className="why" />
          )}
          {sua && (
            <span className="ghi">
              <button
                type="button"
                className="kh-btn"
                style={{
                  border: '1px solid var(--kh-line)',
                  background: 'var(--kh-card)',
                }}
                disabled={busy}
                onClick={() => void luuNhap()}
              >
                Lưu nháp
              </button>
              <button
                type="button"
                className="kh-btn p"
                disabled={busy || vuong.length > 0}
                title={blocked}
                onClick={() => void guiDuyet()}
              >
                Gửi lãnh đạo duyệt
              </button>
            </span>
          )}
        </div>
      )}

      <ThanhTT
        left="Đơn giá tự điền theo lần mua gần nhất (đơn VND) — sửa được · gửi rồi phiếu khoá, muốn sửa thì rút về nháp khi lãnh đạo chưa duyệt"
        right={<b>{rows.length} dòng</b>}
      />

      {moLapLai && (
        <LapLaiSheet
          rows={phieuCu}
          coDong={rows.some((r) => !dongTrong(r))}
          onClose={() => setMoLapLai(false)}
        />
      )}
      {moChot && phieu.id && (
        <ChotPhieuSheet
          id={phieu.id}
          code={phieu.code ?? ''}
          thieu={thieu.map(
            (l) => `${l.name} còn ${fmt((l.can ?? 0) - (l.da_nhap ?? 0))} ${l.unit}`,
          )}
          onClose={() => setMoChot(false)}
          onDone={(t) => {
            setMoChot(false)
            setBao({ tone: 'ok', text: t })
            router.refresh()
          }}
        />
      )}
      {moHuy && phieu.id && (
        <HuyPhieuSheet
          id={phieu.id}
          code={phieu.code ?? ''}
          onClose={() => setMoHuy(false)}
          onDone={(t) => {
            setMoHuy(false)
            setBao({ tone: 'ok', text: t })
            router.refresh()
          }}
        />
      )}
    </KhoKhung>
  )
}
