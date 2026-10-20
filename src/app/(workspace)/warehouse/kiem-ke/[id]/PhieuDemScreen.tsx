'use client'

import '../kiem-ke.css'
import { useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCheck,
  FileText,
  Play,
  Printer,
  Save,
  Send,
  Undo2,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useBeRong } from '@/lib/use-be-rong'
import {
  ApNhom,
  ApNut,
  DauTrang,
  KhoKhung,
  Rong,
  ThanhLoc,
  ThanhTT,
} from '../../_erp/khung'
import { OTim } from '../../_erp/o-tim'
import { TRANG_THAI } from '../kiem-ke.shared'
import { HopLyDo } from '../../de-nghi/huy-phieu'
import { DoiChieu, HopDuyet, useDoiChieu } from './doi-chieu'
import { DsDemDienThoai, LuoiDem } from './luoi-dem'
import { gioVn, type DoiChieuDl, type DongDem, type DotDem } from './phieu-dem.shared'
import { usePhieuDem } from './usePhieuDem'

type VatTu = { id: string; code: string; name: string; unit: string }

const DC_RONG: DoiChieuDl = { tu: '', den: '', theoDong: {}, lyDoTuDuyet: null }

const BUOC = [
  { key: 'open', nhan: 'Mở đợt' },
  { key: 'counting', nhan: 'Đang đếm' },
  { key: 'review', nhan: 'Đối chiếu' },
  { key: 'approved', nhan: 'Duyệt' },
] as const

/**
 * PHIẾU ĐẾM — khuôn F (Kho B7b, bản vẽ KK-3 duyệt 19/10/2026). Câu màn trả lời:
 * "mã nào trong đợt này tôi còn phải đếm, và đếm được bao nhiêu?".
 *
 * Mới mở → "Bắt đầu đếm" chốt sổ tại giờ server. Đang đếm → gõ số, tự lưu,
 * "Gửi đối chiếu" bị chặn tới khi mọi dòng có số (trống không phải là 0).
 * Chờ duyệt / đã duyệt → khối ĐỐI CHIẾU (B7c, bản vẽ KK-4): số sổ, chênh, tiền;
 * Duyệt (người đếm không tự duyệt — Q2) / Trả về đếm lại; đã duyệt thì in 05-VT.
 */
export function PhieuDemScreen({
  dot,
  dong,
  canWrite,
  canApprove,
  doiChieu,
}: {
  dot: DotDem
  dong: DongDem[]
  canWrite: boolean
  canApprove: boolean
  /** Có khi đợt đã gửi đối chiếu (chờ duyệt / đã duyệt). */
  doiChieu: DoiChieuDl | null
}) {
  const d = usePhieuDem(dot, dong)
  const t = useDoiChieu(dong, doiChieu ?? DC_RONG)
  const [mo, setMo] = useState<'duyet' | 'tra' | null>(null)
  const lyDoDuyet = !canApprove
    ? 'Chỉ Thủ kho / người có quyền duyệt kiểm kê'
    : (doiChieu?.lyDoTuDuyet ?? null)
  const khung = useRef<HTMLDivElement>(null)
  const beRong = useBeRong(khung)
  const hep = beRong > 0 && beRong < 700
  const tt = TRANG_THAI[dot.status]
  const khongQuyen = canWrite ? null : 'Chỉ phòng Kho đếm được'
  // Gõ sai báo TRƯỚC: ô "abc" cũng là ô chưa có số, nhưng cách gỡ khác hẳn.
  const chuaDemThat = d.chuaDem.length - d.sai.length
  const lyDoGui =
    d.sai.length > 0
      ? `${d.sai.length} ô gõ không phải số (vd 1.390 hoặc 12,5)${chuaDemThat > 0 ? ` · còn ${chuaDemThat} dòng chưa có số đếm` : ''}`
      : d.chuaDem.length > 0
        ? `Còn ${d.chuaDem.length} dòng chưa có số đếm`
        : null
  // Đã duyệt = mọi bước xong (không còn bước nào "đang đứng").
  const iBuoc =
    dot.status === 'approved' ? BUOC.length : BUOC.findIndex((b) => b.key === dot.status)

  async function timVatTu(q: string): Promise<VatTu[]> {
    const res = await api<{ rows: VatTu[] }>(
      `/api/dept/warehouse/materials?q=${encodeURIComponent(q)}&active_only=true&page_size=20`,
    )
    return res.rows.map((m) => ({ id: m.id, code: m.code, name: m.name, unit: m.unit }))
  }

  const phim = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!d.dangDem || !canWrite) return
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      void d.luu()
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void d.gui()
    }
  }

  return (
    <KhoKhung label={`Phiếu đếm ${dot.code}`} onKeyDown={phim}>
      <DauTrang
        crumb={<Link href="/warehouse/kiem-ke">Kho › Kiểm kê</Link>}
        title={<span className="kh-num">{dot.code}</span>}
        ctx={
          <>
            <span className={tt.lop}>{tt.nhan}</span>{' '}
            {dot.nhom.join(' · ') || 'Phạm vi riêng'}
            {dot.nguoi_dem && ` · người đếm ${dot.nguoi_dem}`}
          </>
        }
        actions={
          <>
            <ApNhom>
              {dot.status === 'open' && (
                <ApNut
                  primary
                  icon={<Play size={15} aria-hidden />}
                  onClick={() => void d.batDau()}
                  why={khongQuyen ?? (d.busy === 'start' ? 'Đang chốt sổ…' : null)}
                >
                  Bắt đầu đếm · chốt sổ
                </ApNut>
              )}
              {d.dangDem && (
                <>
                  <ApNut
                    icon={<Save size={15} aria-hidden />}
                    onClick={() => void d.luu()}
                    why={khongQuyen ?? (d.dangLuu ? 'Đang lưu…' : !d.dirty ? 'Không có số nào chưa lưu' : null)} // prettier-ignore
                  >
                    {d.dangLuu ? 'Đang lưu…' : 'Lưu số đã đếm'}
                  </ApNut>
                  <ApNut
                    primary
                    icon={<Send size={15} aria-hidden />}
                    onClick={() => void d.gui()}
                    why={khongQuyen ?? (d.busy === 'submit' ? 'Đang gửi…' : null)}
                  >
                    Gửi đối chiếu
                  </ApNut>
                </>
              )}
              {dot.status === 'review' && (
                <>
                  <ApNut
                    primary
                    icon={<CheckCheck size={15} aria-hidden />}
                    onClick={() => setMo('duyet')}
                    why={lyDoDuyet}
                  >
                    {`Duyệt · ghi ${t.thua.length + t.thieu.length} dòng chênh`}
                  </ApNut>
                  <ApNut
                    icon={<Undo2 size={15} aria-hidden />}
                    onClick={() => setMo('tra')}
                    why={canApprove ? null : 'Chỉ Thủ kho / người có quyền duyệt kiểm kê'}
                  >
                    Trả về đếm lại
                  </ApNut>
                </>
              )}
              {dot.status === 'approved' && dot.doc_id && (
                <>
                  <ApNut
                    primary
                    icon={<Printer size={15} aria-hidden />}
                    href={`/print/warehouse/${dot.doc_id}`}
                  >
                    In biên bản 05-VT
                  </ApNut>
                  <ApNut
                    icon={<FileText size={15} aria-hidden />}
                    href={`/warehouse/phieu/${dot.doc_id}`}
                  >
                    Phiếu {dot.doc_code}
                  </ApNut>
                </>
              )}
            </ApNhom>
            <ApNhom>
              <ApNut icon={<ArrowLeft size={15} aria-hidden />} href="/warehouse/kiem-ke">
                Sổ đợt
              </ApNut>
            </ApNhom>
          </>
        }
      />

      <div className="kk-track" role="list" aria-label="Bước của đợt">
        {BUOC.map((b, i) => (
          <span
            key={b.key}
            role="listitem"
            className={
              dot.status === 'cancelled'
                ? ''
                : i < iBuoc
                  ? 'xong'
                  : i === iBuoc
                    ? 'on'
                    : ''
            }
            aria-current={i === iBuoc ? 'step' : undefined}
          >
            {dot.status !== 'cancelled' && i < iBuoc ? '✓ ' : i === iBuoc ? '● ' : ''}
            {b.nhan}
          </span>
        ))}
        {dot.freeze_at && <span className="kk-moc">Sổ chốt {gioVn(dot.freeze_at)}</span>}
      </div>

      {d.bao && (
        <div className="kh-note ok" role="status">
          <span className="tag">Xong</span>
          <span>{d.bao}</span>
        </div>
      )}
      {d.loi && (
        <div className="kh-note stop" role="alert">
          <span className="tag">Không lưu được</span>
          <span>{d.loi}</span>
        </div>
      )}
      {d.dangDem && d.daThuGui && lyDoGui && (
        <div className="kh-note stop" role="alert">
          <span className="tag">Chưa gửi được</span>
          <span>
            {lyDoGui}. Hàng không còn thì gõ 0 — để trống không phải là số không.{' '}
            <button type="button" className="kh-lnk" onClick={d.toiChuaDem}>
              Nhảy tới dòng {(d.sai[0] ?? d.chuaDem[0])?.code}
            </button>
          </span>
        </div>
      )}
      {dot.status === 'open' && (
        <div className="kh-note mut">
          <span className="tag">Chưa chốt sổ</span>
          <span>
            Bấm “Bắt đầu đếm” khi người đếm đã ở kho: sổ chốt đúng giờ bấm, phiếu
            nhập/xuất sau mốc đó không làm sai chênh lệch.{' '}
            {dot.scope_count.toLocaleString('vi-VN')} mã sẽ vào phiếu đếm.
          </span>
        </div>
      )}
      {d.dangDem && dot.reject_reason && (
        <div className="kh-note">
          <span className="tag">Bị trả về</span>
          <span>
            Thủ kho trả về để đếm lại: “{dot.reject_reason}”. Sửa số rồi gửi đối chiếu
            lại.
          </span>
        </div>
      )}
      {dot.status === 'review' && lyDoDuyet && canApprove && (
        <div className="kh-note mut">
          <span className="tag">Không tự duyệt</span>
          <span>{lyDoDuyet}</span>
        </div>
      )}
      {dot.status === 'approved' && (
        <div className="kh-note ok">
          <span className="tag">Đã duyệt</span>
          <span>
            Duyệt {gioVn(dot.approved_at)} · sinh phiếu{' '}
            <b className="kh-num">{dot.doc_code}</b> ({t.thua.length} N4, {t.thieu.length}{' '}
            X5). Sai thì đảo phiếu KK ở Sổ phiếu, không huỷ đợt.
          </span>
        </div>
      )}
      {dot.status === 'cancelled' && (
        <div className="kh-note mut">
          <span className="tag">Đã huỷ</span>
          <span>{dot.reject_reason ? `Lý do: ${dot.reject_reason}` : 'Đợt đã huỷ.'}</span>
        </div>
      )}

      {dong.length > 0 && !doiChieu && (
        <ThanhLoc>
          <input
            type="search"
            value={d.q}
            onChange={(e) => d.setQ(e.target.value)}
            placeholder="Tìm mã, tên…"
            aria-label="Tìm mã hoặc tên vật tư trong phiếu"
          />
          {d.keDs.length > 1 && (
            <select
              value={d.ke}
              className={d.ke ? 'on' : undefined}
              onChange={(e) => d.setKe(e.target.value)}
              aria-label="Lọc theo kệ"
            >
              <option value="">Mọi kệ</option>
              {d.keDs.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          )}
          <label className="kk-chk">
            <input
              type="checkbox"
              checked={d.chiChua}
              onChange={(e) => d.setChiChua(e.target.checked)}
            />
            Chỉ dòng chưa đếm
          </label>
          {dot.blind && d.dangDem && (
            <span className="sp kh-mut">Đếm mù — số sổ không gửi về máy này</span>
          )}
        </ThanhLoc>
      )}

      {d.dangDem && canWrite && (
        <div className="kh-them">
          <span className="lbl">+ Thêm mã</span>
          <OTim<VatTu>
            id="kk-them"
            search={timVatTu}
            onPick={(vt) =>
              void d.themMa(vt.id).then((lineId) => {
                if (!lineId) return
                d.setBao(`Đã thêm ${vt.code} vào phiếu đếm — gõ số đếm ở dòng của nó.`)
                d.setQ(vt.code)
              })
            }
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
              d.busy === 'them'
                ? 'Đang thêm…'
                : 'Thấy hàng ngoài kệ mà phiếu không có? Gõ mã'
            }
            label="Tìm vật tư để thêm vào phiếu đếm"
            width={360}
          />
        </div>
      )}

      <div ref={khung} style={{ height: 0, width: '100%' }} aria-hidden />
      {doiChieu ? (
        <DoiChieu t={t} dc={doiChieu} hep={hep} />
      ) : dong.length === 0 ? (
        <Rong
          tieuDe={dot.status === 'open' ? 'Chưa có dòng đếm' : 'Đợt không có dòng nào'}
          lyDo={
            dot.status === 'open'
              ? 'Dòng đếm sinh ra lúc bấm “Bắt đầu đếm” — để sổ chốt đúng lúc người đếm bắt tay vào việc.'
              : 'Đợt này không có mã nào để đếm.'
          }
        />
      ) : d.hien.length === 0 ? (
        <Rong
          tieuDe="Không dòng nào khớp bộ lọc"
          lyDo={d.chiChua ? 'Mọi dòng đang lọc đều đã có số đếm.' : 'Không mã nào khớp tìm / kệ đang chọn.'} // prettier-ignore
          tiep={
            <button
              type="button"
              className="kh-btn"
              onClick={() => {
                d.setQ('')
                d.setKe('')
                d.setChiChua(false)
              }}
            >
              Bỏ lọc
            </button>
          }
        />
      ) : hep ? (
        <DsDemDienThoai d={d} />
      ) : (
        <LuoiDem d={d} />
      )}

      <ThanhTT
        left={
          d.dangDem
            ? `Đếm mù: số sổ không gửi về trình duyệt khi đợt đang đếm${d.dirty ? ' · có số chưa lưu' : ''}`
            : doiChieu
              ? 'Số sổ là tồn tại mốc chốt · chênh = đếm − sổ · tiền theo đơn giá bình quân kỳ'
              : 'Phiếu đếm chỉ xem'
        }
        right={
          <>
            <b>{(dong.length - d.chuaDem.length).toLocaleString('vi-VN')}</b> /{' '}
            {dong.length.toLocaleString('vi-VN')} đã đếm
          </>
        }
      />
      {mo === 'duyet' && (
        <HopDuyet
          dot={dot}
          t={t}
          onClose={() => setMo(null)}
          onDone={(bao) => {
            setMo(null)
            d.setBao(bao)
            d.refresh()
          }}
        />
      )}
      {mo === 'tra' && (
        <HopLyDo
          title={`Trả về đếm lại · ${dot.code}`}
          subtitle="Đợt quay về Đang đếm — số đã đếm giữ nguyên, người đếm sửa chỗ cần sửa."
          route={`/api/dept/warehouse/stocktakes/${dot.id}/reject`}
          nhanNut="Trả về"
          nhanO="Đếm lại chỗ nào, vì sao"
          placeholder="VD: NH-0003 lệch 100% — kiểm lại kệ NHOM-A và hàng đã cấp cho lệnh 06-MX"
          onClose={() => setMo(null)}
          onDone={() => {
            setMo(null)
            d.setBao(`Đã trả ${dot.code} về đếm lại.`)
            d.refresh()
          }}
        />
      )}
    </KhoKhung>
  )
}
