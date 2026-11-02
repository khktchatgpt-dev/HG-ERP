'use client'

import './ds.css'
import { useLayoutEffect, useRef, useState } from 'react'
import { FileDown, FileUp, PencilLine, Plus, Search } from 'lucide-react'
import {
  COT_TRONG,
  TAB_DS,
  VIEC_DS,
  type CotTrong,
  type TabDs,
} from '@/lib/nhan-su/danh-sach'
import { useNhanVienDs, type BoCot, type DsCtx, type TrangDs } from './useNhanVienDs'
import { LuoiDs, lop } from './luoi-ds'
import { HopTuyen } from './hop-tuyen'
import { HopNap } from './hop-nap'
import { ThanhChot } from './thanh-chot'

/**
 * NHÂN SỰ › HỒ SƠ NHÂN VIÊN — danh sách (B1, bản vẽ 02/11/2026
 * https://claude.ai/artifact/FUBArSLUXK9mVu2FSbsS93, Q1–Q7 theo đề xuất). Câu hỏi: "Trong 170
 * người, ô nào của ai còn trống, ai cần tôi động vào?".
 *
 * Viết tay, không kit (31/10/2026). Chép: Dynamics 365 list page (Action Pane, lưới dính đầu /
 * chân), SAP Fiori worklist (ô đếm là bộ lọc). Cột theo file DS CNV Nhân sự đang tự giữ, nhóm
 * theo bộ phận như file đó (Q1). Thanh "Hồ sơ x/12" bỏ (Q2) — 170/170 người đều "thiếu" nên nó
 * không chỉ ra ai; thay bằng lọc Ô trống + chân đếm trống mỗi cột.
 *
 * B2 "Sửa trên bảng" (Dynamics Edit in grid, SAP mass maintenance): gõ thẳng vào ô, dán vùng
 * Excel, lưu MỘT lần qua đường nạp hồ sơ — thanh chốt đáy là ngoại lệ duy nhất của luật "nút ở
 * góc trên" (bảng nhập liệu).
 */
export function NhanVienDsScreen({ h }: { h: TrangDs }) {
  const d = useNhanVienDs(h)
  const goc = useRef<HTMLDivElement>(null)
  const [cao, setCao] = useState('calc(100dvh - 48px)')
  // Chốt chiều cao = 100dvh − đỉnh màn: chỉ lưới cuộn, đầu cột và chân đếm dính được.
  useLayoutEffect(() => {
    const el = goc.current
    if (!el) return
    const doi = () =>
      setCao(`calc(100dvh - ${Math.round(el.getBoundingClientRect().top)}px)`)
    doi()
    window.addEventListener('resize', doi)
    return () => window.removeEventListener('resize', doi)
  }, [])
  const khoa = h.sua ? null : 'Phòng Nhân sự giữ quyền sửa hồ sơ'
  const sua = d.sb.dangSua
  const khoaSua = khoa ?? (sua ? 'Đang sửa trên bảng — lưu hoặc bỏ thay đổi trước' : null)
  const soBp = new Set(h.nv.ds.filter((n) => n.active).map((n) => n.boPhan)).size

  return (
    <div ref={goc} className="ns" style={{ height: cao }}>
      <div className="ns-ph">
        <h1>Hồ sơ nhân viên</h1>
        <span className="ctx">
          <b>{soBp}</b> bộ phận đang có người
        </span>
        <div className="ns-ap" role="toolbar" aria-label="Thao tác">
          <div>
            <Nut primary why={khoaSua} d={d} onClick={() => d.setMoTuyen(true)}>
              <Plus className="ico" aria-hidden />
              Tuyển vào
            </Nut>
          </div>
          <div>
            <Nut why={khoa} d={d} nhan={sua} onClick={d.sb.batSua}>
              <PencilLine className="ico" aria-hidden />
              {sua ? 'Đang sửa trên bảng' : 'Sửa trên bảng'}
            </Nut>
          </div>
          <div>
            <Nut why={khoaSua} d={d} onClick={() => d.setMoNap(true)}>
              <FileUp className="ico" aria-hidden />
              Nhập Excel
            </Nut>
            {/* Tải file: điều hướng thẳng tới route xuất, không qua router của Next. */}
            <button
              type="button"
              className="ns-btn"
              onClick={() =>
                window.location.assign('/api/dept/hr/cham-cong/nhan-vien/excel')
              }
            >
              <FileDown className="ico" aria-hidden />
              Xuất sổ lao động
            </button>
          </div>
        </div>
      </div>

      <div className="ns-tabs" role="tablist" aria-label="Tình trạng làm việc">
        {TAB_DS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="ns-tab"
            aria-selected={d.loc.tab === t.id}
            onClick={() => d.setTab(t.id as TabDs)}
          >
            {t.ten} <span className="n">{d.demTab[t.id]}</span>
          </button>
        ))}
      </div>

      {d.loc.tab !== 'da_nghi' && (
        <div className="ns-tiles" role="group" aria-label="Việc tồn">
          {VIEC_DS.map((v) => {
            const n = d.dem[v.id]
            return (
              <button
                key={v.id}
                type="button"
                className={lop('ns-tile', !n ? 'z' : v.w && 'w')}
                aria-pressed={d.loc.viec === v.id}
                onClick={() => d.setViec(v.id)}
              >
                <span className="d">{v.ten}</span>
                <span className="v">{n}</span>
              </button>
            )
          })}
        </div>
      )}

      {sua && (
        <div className="ns-mode">
          Đang sửa trên bảng
          <span>
            Gõ thẳng vào ô · Enter xuống dòng · Esc trả ô về cũ · Ctrl+V dán vùng chép từ
            Excel
          </span>
        </div>
      )}
      <ThanhLoc d={d} />
      {d.chon.size > 0 && !sua && <ThanhChon d={d} />}

      <div className="ns-grid">{d.ds.length ? <LuoiDs d={d} /> : <Rong d={d} />}</div>

      {sua ? (
        <ThanhChot d={d} />
      ) : (
        <div className="ns-sb" role="status">
          <span>
            Đang hiện <b>{d.ds.length}</b> / {d.demTab[d.loc.tab]}
          </span>
          <span>
            Đã chọn <b>{d.chon.size}</b>
          </span>
          {d.bao ? (
            <span className={d.bao.ok ? 'ok' : 'loi'}>{d.bao.text}</span>
          ) : (
            <span>Bấm một dòng để mở hồ sơ · bấm số &quot;trống&quot; ở chân để lọc</span>
          )}
        </div>
      )}

      {d.moTuyen && <HopTuyen d={d} />}
      {d.moNap && <HopNap d={d} />}
    </div>
  )
}

/** Nút Action Pane. Bị khoá vẫn nhìn thấy; bấm vào thì nói lý do ở thanh trạng thái. */
function Nut({
  children,
  primary = false,
  nhan,
  why,
  d,
  onClick,
}: {
  children: React.ReactNode
  primary?: boolean
  /** Nút bật / tắt: đang bật thì `aria-pressed`. */
  nhan?: boolean
  why: string | null
  d: DsCtx
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={primary ? 'ns-btn p' : 'ns-btn'}
      aria-disabled={why ? 'true' : undefined}
      aria-pressed={nhan}
      title={why ?? undefined}
      onClick={() => (why ? d.setBao({ ok: false, text: why }) : onClick())}
    >
      {children}
    </button>
  )
}

const BO_COT: { id: BoCot; ten: string; rieng?: boolean }[] = [
  { id: 'ds_cnv', ten: 'DS CNV' },
  { id: 'giay_to', ten: 'Giấy tờ', rieng: true },
  { id: 'lien_he', ten: 'Liên hệ', rieng: true },
  { id: 'cong_viec', ten: 'Công việc' },
]

function ThanhLoc({ d }: { d: DsCtx }) {
  const rieng = d.h.nv.rieng
  return (
    <div className="ns-fb">
      <Search className="ico" aria-hidden />
      <input
        id="ns-tim"
        type="search"
        value={d.loc.tim}
        onChange={(e) => d.setTim(e.target.value)}
        placeholder={rieng ? 'Mã, họ tên, SĐT, 4 số cuối CCCD' : 'Mã, họ tên, chức vụ'}
        aria-label="Tìm nhân viên"
      />
      <select
        id="ns-to"
        className={d.loc.to ? 'on' : undefined}
        value={d.loc.to}
        onChange={(e) => d.setTo(e.target.value)}
        aria-label="Bộ phận"
      >
        <option value="">Mọi bộ phận</option>
        <option value="__trong">(Chưa có bộ phận)</option>
        {d.h.nv.boPhan.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>
      <select
        id="ns-trong"
        className={d.loc.trong ? 'on' : undefined}
        value={d.loc.trong ?? ''}
        onChange={(e) => d.setTrong((e.target.value || null) as CotTrong | null)}
        aria-label="Lọc người còn trống một ô"
      >
        <option value="">Ô trống: —</option>
        {(Object.keys(COT_TRONG) as CotTrong[])
          .filter((c) => rieng || !COT_TRONG[c].rieng)
          .map((c) => (
            <option key={c} value={c}>
              Ô trống: {COT_TRONG[c].ten}
            </option>
          ))}
      </select>
      <span className="sp">
        Bộ cột
        <span className="ns-seg" role="group" aria-label="Bộ cột">
          {BO_COT.filter((b) => rieng || !b.rieng).map((b) => (
            <button
              key={b.id}
              type="button"
              aria-pressed={d.cot === b.id}
              onClick={() => d.setCot(b.id)}
            >
              {b.ten}
            </button>
          ))}
        </span>
        <span className="ns-seg">
          <button type="button" aria-pressed={d.nhom} onClick={() => d.setNhom(!d.nhom)}>
            Nhóm theo bộ phận
          </button>
        </span>
      </span>
    </div>
  )
}

/** Thanh khi chọn nhiều: đổi bộ phận / ca thường làm một lần (đường hàng loạt đang có). */
function ThanhChon({ d }: { d: DsCtx }) {
  const [to, setTo] = useState('')
  const [ca, setCa] = useState('')
  const khoa = d.h.sua ? null : 'Phòng Nhân sự giữ quyền sửa hồ sơ'
  return (
    <div className="ns-chon">
      <b>{d.chon.size} người đã chọn</b>
      <select
        id="ns-doi-to"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        aria-label="Đổi sang bộ phận"
      >
        <option value="">Đổi bộ phận…</option>
        {d.h.nv.boPhan.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>
      <Nut
        why={khoa ?? (!to ? 'Chọn bộ phận mới trước' : d.busy ? 'Đang lưu…' : null)}
        d={d}
        onClick={async () => {
          if (await d.hangLoat({ team: to }, 'bộ phận')) setTo('')
        }}
      >
        Đổi bộ phận
      </Nut>
      <select
        id="ns-doi-ca"
        value={ca}
        onChange={(e) => setCa(e.target.value)}
        aria-label="Đổi ca thường làm"
      >
        <option value="">Đổi ca…</option>
        {d.h.nv.cas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.ten} {c.gio}
          </option>
        ))}
      </select>
      <Nut
        why={khoa ?? (!ca ? 'Chọn ca mới trước' : d.busy ? 'Đang lưu…' : null)}
        d={d}
        onClick={async () => {
          if (await d.hangLoat({ shift_id: ca }, 'ca')) setCa('')
        }}
      >
        Đổi ca
      </Nut>
      <span className="sp">
        <button type="button" className="ns-lnk" onClick={d.boChon}>
          Bỏ chọn
        </button>
      </span>
    </div>
  )
}

/** Rỗng: nói vì sao (đang lọc gì) và bỏ được từng bộ lọc ngay tại chỗ. */
function Rong({ d }: { d: DsCtx }) {
  const l = d.loc
  const tab = TAB_DS.find((t) => t.id === l.tab)!.ten.toLowerCase()
  const dk = [
    l.to && (l.to === '__trong' ? 'chưa có bộ phận' : `ở ${l.to}`),
    l.viec && VIEC_DS.find((v) => v.id === l.viec)!.ten.toLowerCase(),
    l.trong && `trống ${COT_TRONG[l.trong].ten}`,
    l.tim && `khớp "${l.tim}"`,
  ].filter(Boolean)
  return (
    <div className="ns-rong">
      <b>
        {dk.length
          ? `Không có ai ${tab} ${dk.join(', ')}.`
          : `Chưa có ai trong tab ${tab}.`}
      </b>{' '}
      {l.trong && (
        <button type="button" className="ns-lnk" onClick={() => d.boLoc('trong')}>
          Bỏ lọc Ô trống
        </button>
      )}
      {l.viec && (
        <button type="button" className="ns-lnk" onClick={() => d.boLoc('viec')}>
          Bỏ ô việc tồn
        </button>
      )}
      {l.to && (
        <button type="button" className="ns-lnk" onClick={() => d.boLoc('to')}>
          Xem mọi bộ phận
        </button>
      )}
      {l.tim && (
        <button type="button" className="ns-lnk" onClick={() => d.boLoc('tim')}>
          Xoá ô tìm
        </button>
      )}
    </div>
  )
}
