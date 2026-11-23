'use client'

import './npl.css'
import { useLayoutEffect, useRef, useState } from 'react'
import type { NplConTT } from '@/lib/npl-con-phai-dat'
import type { NplLenh, NplRow } from '@/lib/npl-theo-lenh'
import type { SupplyScope } from '@/lib/supply-scope'
import type { NplCanData } from '@/modules/dept/supply/npl-theo-lenh.service'
import { LuoiCon } from './luoi-con'
import { LuoiNpl } from './luoi-npl'
import { coTre, soVn, TAB_XEM, TT_CON, type NplTabXem } from './npl.shared'
import { useNpl } from './useNpl'

/**
 * NPL THEO LỆNH (/mua-hang/npl) — khuôn C · Danh sách, lối ERP KHÔNG kit.
 * Bản vẽ 1 duyệt 20/11/2026: https://claude.ai/artifact/8J3ZmaBWGeFGiutrVCcrgY
 * Bản vẽ 2 duyệt 21/11/2026 (chủ dự án xem ở lưới 980px: "UI/UX rất rối"):
 * https://claude.ai/artifact/BTz7xg1pDUSuevLAmG3ec7 — Q1 Của tôi / Cả phòng,
 * Q2 đỏ chỉ khi trễ thật, Q3 tách mã/tên + cột theo tab, Q4 ▸ ở rãnh thay khung
 * "chia N", Q5 mã lệnh dẫn sang trang lệnh.
 *
 * Câu màn trả lời: lệnh nào còn NPL chưa đặt, chưa về đủ — mọi lệnh trên một
 * bảng, thay vì mở từng lệnh rồi từng đơn. Bốn tab theo dòng ĐƠN MUA (xếp tab /
 * chia hàng về / gộp dòng / phạm vi ở `lib/npl-theo-lenh`, có test).
 *
 * Bản vẽ 3 duyệt 21/11/2026 (https://claude.ai/artifact/7pdeBVx9PykFpfZAK8x33K):
 * tab đầu "Còn phải đặt" = cần theo định mức NGŨ KIM + BAO BÌ − đã lên đơn của
 * lệnh (`lib/npl-con-phai-dat`, có test), luôn cả phòng. Khung, gỗ không vào: chủ
 * dự án 21/11 — gỗ làm theo mẫu, chi tiết khung là để định hình, không đặt theo
 * định mức. Tab "Chưa đặt" đổi tên "Đơn nháp / chờ duyệt".
 */
export function NplScreen({
  rows,
  lenh,
  can,
  soDon,
  today,
  capNhat,
  tabDau,
  meId,
  phamViDau,
}: {
  rows: NplRow[]
  lenh: NplLenh[]
  can: NplCanData
  soDon: number
  today: string
  capNhat: string
  tabDau: NplTabXem
  meId: string | null
  phamViDau: SupplyScope
}) {
  const d = useNpl(rows, lenh, can, tabDau, meId, phamViDau)
  const laCon = d.tab === 'con'

  /* CHỐT CHIỀU CAO = 100dvh − đỉnh màn: chỉ lưới cuộn, đầu cột + chân tổng dính. */
  const goc = useRef<HTMLDivElement>(null)
  const [cao, setCao] = useState('calc(100dvh - 60px)')
  useLayoutEffect(() => {
    const el = goc.current
    if (!el) return
    const doi = () =>
      setCao(`calc(100dvh - ${Math.round(el.getBoundingClientRect().top)}px)`)
    doi()
    window.addEventListener('resize', doi)
    return () => window.removeEventListener('resize', doi)
  }, [])

  const soLenh = new Set(rows.map((r) => r.lsx_id)).size
  const nhomXem = laCon ? d.nhomCon : d.nhom
  const soGap = nhomXem.filter((g) => d.gap.has(g.lenh.id)).length
  const dangXem = nhomXem
    .filter((g) => !d.gap.has(g.lenh.id))
    .reduce((s, g) => s + g.rows.length, 0)
  const tongXem = laCon ? d.conXem.length : d.xem.length

  return (
    <div className="npl npl" ref={goc} style={{ height: cao }}>
      <div className="npl-ph">
        <span className="crumb">Mua hàng ›</span>
        <h1>NPL theo lệnh</h1>
        <span className="ctx">
          <b>{laCon ? lenh.length : soLenh}</b> lệnh đang chạy ·{' '}
          {laCon ? (
            <>cả phòng</>
          ) : d.phong ? (
            <>
              <b>{soVn(rows.length)}</b> dòng NPL trên <b>{soDon}</b> đơn
            </>
          ) : (
            <>
              của tôi <b>{soVn(d.soDongPhamVi)}</b> dòng
            </>
          )}
        </span>
      </div>

      <div className="npl-tabs" role="tablist" aria-label="Tình trạng NPL">
        {TAB_XEM.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            className="npl-tab"
            aria-selected={d.tab === t.key}
            onClick={() => d.setTab(t.key)}
          >
            {t.label}
            <span className="c">{soVn(d.dem[t.key])}</span>
            {t.key === 'thieu' && d.dem.tre > 0 && (
              <span className="tre">{d.dem.tre} trễ</span>
            )}
          </button>
        ))}
      </div>

      <div className="npl-fb">
        {laCon ? (
          // Q4 bản vẽ 3: số cần chưa thuộc người mua nào — luôn cả phòng.
          <span className="pv" title="Nhu cầu theo định mức chưa thuộc người mua nào">
            Cả phòng
          </span>
        ) : (
          <span className="seg" role="group" aria-label="Phạm vi">
            <button
              type="button"
              aria-pressed={!d.phong}
              onClick={() => d.setPhamVi('toi')}
              title="Đơn tôi phụ trách"
            >
              Của tôi
            </button>
            <button
              type="button"
              aria-pressed={d.phong}
              onClick={() => d.setPhamVi('phong')}
              title="Mọi đơn của phòng"
            >
              Cả phòng
            </button>
          </span>
        )}
        <input
          type="search"
          aria-label={laCon ? 'Tìm mã, tên NPL, mã SP' : 'Tìm mã, tên NPL, mã đơn'}
          placeholder={laCon ? 'Tìm mã, tên NPL, mã SP…' : 'Tìm mã, tên NPL, mã đơn…'}
          value={d.loc.q}
          onChange={(e) => d.datLoc({ q: e.target.value })}
        />
        <select
          aria-label="Lọc theo lệnh"
          className={d.loc.lsx ? 'on' : undefined}
          value={d.loc.lsx}
          onChange={(e) => d.datLoc({ lsx: e.target.value })}
        >
          <option value="">Lệnh</option>
          {d.chonLoc.lenh.map((l) => (
            <option key={l.id} value={l.id}>
              {l.code}
            </option>
          ))}
        </select>
        {!laCon && (
          <Chon
            label="NCC"
            value={d.loc.ncc}
            list={d.chonLoc.ncc}
            onChange={(v) => d.datLoc({ ncc: v })}
          />
        )}
        <Chon
          label="Nhóm VT"
          value={d.loc.nhom}
          list={d.chonLoc.nhom}
          onChange={(v) => d.datLoc({ nhom: v })}
        />
        {laCon && (
          <select
            aria-label="Lọc theo tình trạng"
            className={d.ttCon ? 'on' : undefined}
            value={d.ttCon}
            onChange={(e) => d.setTtCon(e.target.value as '' | NplConTT)}
          >
            <option value="">Tình trạng</option>
            {TT_CON.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        )}
        {d.phong && !laCon && (
          <Chon
            label="Phụ trách"
            value={d.loc.nguoi}
            list={d.chonLoc.nguoi}
            onChange={(v) => d.datLoc({ nguoi: v })}
          />
        )}
        {/* Trễ chỉ có ở dòng đang về; đang bật thì vẫn bày để còn tắt được. */}
        {(coTre(d.tab) || d.loc.quaHen) && (
          <label className="chk">
            <input
              type="checkbox"
              checked={d.loc.quaHen}
              onChange={(e) => d.datLoc({ quaHen: e.target.checked })}
            />
            Chỉ dòng trễ
          </label>
        )}
        {d.coLoc && (
          <button type="button" className="lnk" onClick={d.boLoc}>
            Bỏ lọc
          </button>
        )}
        {d.soNhom > 0 && (
          <span className="sp">
            <button type="button" className="lnk" onClick={d.gapHet}>
              {d.tatCaGap ? 'Mở tất cả' : 'Gập tất cả'}
            </button>
          </span>
        )}
      </div>

      {laCon ? <LuoiCon d={d} today={today} /> : <LuoiNpl d={d} today={today} />}

      <div className="npl-sb">
        <span>
          Đang xem <b>{soVn(dangXem)}</b> / {soVn(tongXem)} {laCon ? 'mã' : 'dòng'}
          {soGap > 0 && ` (${soGap} nhóm đang gập)`}
        </span>
        {laCon ? (
          <>
            <span>
              Cần = định mức × SL SP của lệnh ·{' '}
              {d.can.sp.xacNhan < d.can.sp.tong ? (
                <b>
                  định mức chưa xác nhận ({d.can.sp.xacNhan}/{d.can.sp.tong} SP đã xác
                  nhận)
                </b>
              ) : (
                'định mức đã xác nhận'
              )}
            </span>
            <span>Đã lên đơn: mọi đơn chưa huỷ của lệnh, gồm nháp</span>
          </>
        ) : (
          <span>Số lấy từ đơn mua, không gồm đơn đã huỷ và dòng phí</span>
        )}
        <span>Cập nhật {capNhat}</span>
      </div>
    </div>
  )
}

/** Ô chọn vuông của thanh lọc — đang lọc thì nền xanh nhạt. */
function Chon({
  label,
  value,
  list,
  onChange,
}: {
  label: string
  value: string
  list: string[]
  onChange: (v: string) => void
}) {
  return (
    <select
      aria-label={`Lọc theo ${label}`}
      className={value ? 'on' : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{label}</option>
      {list.map((x) => (
        <option key={x} value={x}>
          {x}
        </option>
      ))}
    </select>
  )
}
