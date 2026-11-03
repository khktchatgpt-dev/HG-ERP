'use client'

import '../ds.css'
import './hs.css'
import Link from 'next/link'
import { useState } from 'react'
import { Check, ChevronDown, ChevronLeft, ChevronRight, PencilLine } from 'lucide-react'
import { ngayVn } from '@/lib/nhan-su/bien-dong'
import { nhanTinhTrang } from '@/lib/nhan-su/ho-so'
import { tinhTrangHd } from '@/lib/nhan-su/hop-dong'
import type { HoSoNvTrang } from '@/modules/dept/hr/cham-cong/ho-so-nv.service'
import { HopChuyen, HopLamLai, HopNghi } from '../../cham-cong/bien-dong-nv'
import { lop } from '../luoi-ds'
import { useCaoKhung } from '../khung'
import { useHoSoNv, type HoSoCtx, type Muc } from './useHoSoNv'
import { TabThongTin } from './tab-thong-tin'
import { TabLichSu } from './tab-lich-su'
import { TabLuong } from './tab-luong'
import { TabHopDong } from './tab-hop-dong'
import { TabGiayTo } from './tab-giay-to'

/**
 * HỒ SƠ MỘT NHÂN VIÊN — /hr/nhan-vien/[mã]. B4 (bản vẽ 02/11/2026 mục D, Q1–Q7 theo đề
 * xuất): "Người này là ai, làm gì từ bao giờ?" trên MỘT trang Thông tin, sửa bằng MỘT nút.
 *
 * Viết tay, không kit (31/10/2026) — đầu trang + tab theo khung danh sách (ds.css). Bỏ dải 5 ô
 * số (thâm niên, ngày quẹt, hợp đồng, hồ sơ x/12) và khối "Còn thiếu N mục". Tab Hợp đồng,
 * Giấy tờ, Lương, Lịch sử và các hộp Biến động giữ nguyên (còn kit, chưa có việc chạm tới).
 * Chép: SuccessFactors / Dynamics Edit (sửa cả trang, Lưu ở Action Pane), menu Biến động tách
 * khỏi nút sửa (SuccessFactors Take Action), ‹ › trong tập đang lọc (Dynamics).
 */
export function HoSoNvScreen({ h, muc }: { h: HoSoNvTrang; muc: Muc }) {
  const d = useHoSoNv(h, muc)
  const khung = useCaoKhung()
  const { n } = d
  const tt = nhanTinhTrang(n, d.homNay)
  const ttHd = n.hd ? tinhTrangHd(n.hd, d.homNay) : null
  const huy = h.bienDong.filter((b) => !b.huyLuc).length
  const why = d.dangSua ? 'Đang sửa thông tin — Lưu hoặc Huỷ trước' : null

  const tabs: { id: Muc; ten: string; dem?: string; w?: boolean }[] = [
    { id: 'thong-tin', ten: 'Thông tin' },
    { id: 'lich-su', ten: 'Lịch sử', dem: huy ? String(huy) : undefined },
    {
      id: 'hop-dong',
      ten: 'Hợp đồng',
      ...(ttHd === 'sap_het' || ttHd === 'het_han'
        ? { dem: ttHd === 'het_han' ? 'hết hạn' : 'sắp hết', w: true }
        : {}),
    },
    {
      id: 'giay-to',
      ten: 'Giấy tờ',
      dem: h.giayTo?.length ? String(h.giayTo.length) : undefined,
    },
    // Lương là mật (0255): người không có quyền lương không thấy cả tên mục.
    ...(h.quyen.luong ? [{ id: 'luong' as const, ten: 'Lương & ngân hàng' }] : []),
  ]

  return (
    <div {...khung} className="ns">
      <div className="ns-ph">
        <span className="crumb">
          <Link href="/hr/nhan-vien">Hồ sơ nhân viên</Link>
          {n.boPhan && ` › ${n.boPhan}`} ›
        </span>
        <h1>
          <span className="num ma">{n.code}</span>
          {n.hoTen}
        </h1>
        {tt.kieu !== 'dang_lam' && (
          <span className={lop('ns-pill', tt.kieu === 'da_nghi' ? 'g' : 'w')}>
            {tt.kieu === 'da_nghi'
              ? tt.ngay
                ? `nghỉ từ ${ngayVn(tt.ngay)}`
                : 'đã nghỉ'
              : tt.kieu === 'sap_nghi'
                ? `làm tới ${ngayVn(tt.ngay)}`
                : tt.kieu === 'chua_vao'
                  ? `vào ${ngayVn(tt.ngay)}`
                  : tt.kieu === 'vang'
                    ? `vắng ${tt.ngay} ngày`
                    : `mới · ${tt.ngay} ngày`}
          </span>
        )}
        {d.viTri >= 0 && (
          <span className="pager" aria-label="Người trước / sau trong danh sách đang lọc">
            <button
              type="button"
              aria-label="Người trước"
              disabled={!d.truoc}
              onClick={d.truoc}
            >
              <ChevronLeft className="ico" aria-hidden />
            </button>
            <span className="num">
              {d.viTri + 1} / {d.tongTap}
            </span>
            <button
              type="button"
              aria-label="Người sau"
              disabled={!d.sau}
              onClick={d.sau}
            >
              <ChevronRight className="ico" aria-hidden />
            </button>
          </span>
        )}
        <div className="ns-ap" role="toolbar" aria-label="Thao tác">
          {d.dangSua ? (
            <div>
              <button
                type="button"
                className="ns-btn p"
                aria-disabled={d.busy || d.loi.length ? 'true' : undefined}
                title={d.loi[0]?.loi}
                onClick={d.luuThongTin}
              >
                <Check className="ico" aria-hidden />
                {d.busy ? 'Đang lưu…' : d.so ? `Lưu ${d.so} ô` : 'Xong'}
              </button>
              <button type="button" className="ns-btn" onClick={d.huySua}>
                Huỷ
              </button>
            </div>
          ) : (
            <div>
              <button
                type="button"
                className="ns-btn p"
                aria-disabled={d.suaDuoc ? undefined : 'true'}
                title={d.suaDuoc ? undefined : 'Phòng Nhân sự giữ quyền sửa hồ sơ'}
                onClick={() =>
                  d.suaDuoc
                    ? d.batSua()
                    : d.setBao({ ok: false, text: 'Phòng Nhân sự giữ quyền sửa hồ sơ' })
                }
              >
                <PencilLine className="ico" aria-hidden />
                Sửa thông tin
              </button>
            </div>
          )}
          <div>
            <MenuBienDong d={d} why={why} />
            <Link
              className="ns-btn"
              href={`/hr/cham-cong/nguoi/${encodeURIComponent(n.code)}`}
            >
              Chấm công
            </Link>
          </div>
        </div>
      </div>

      {(d.bao || (d.dangSua && d.thu && d.loi[0])) && (
        <div
          className={lop(
            'hs-bao',
            d.dangSua && d.thu && d.loi[0] ? 'loi' : d.bao?.ok ? 'ok' : 'loi',
          )}
        >
          {d.dangSua && d.thu && d.loi[0] ? (
            <button type="button" className="ns-lnk" onClick={() => d.toi(d.loi[0].o)}>
              {d.loi.length} ô sai: {d.loi[0].loi} — bấm để tới ô
            </button>
          ) : (
            d.bao?.text
          )}
        </div>
      )}

      <div className="ns-tabs" role="tablist" aria-label="Nội dung hồ sơ">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="ns-tab"
            aria-selected={d.muc === t.id}
            onClick={() => d.setMuc(t.id)}
          >
            {t.ten}
            {t.dem && <span className={lop('n', t.w && 'w')}>{t.dem}</span>}
          </button>
        ))}
      </div>

      <div className="hs-than">
        {d.muc === 'thong-tin' && <TabThongTin d={d} />}
        {d.muc === 'lich-su' && <TabLichSu d={d} />}
        {d.muc === 'hop-dong' && <TabHopDong d={d} />}
        {d.muc === 'giay-to' && <TabGiayTo d={d} />}
        {d.muc === 'luong' && h.quyen.luong && <TabLuong d={d} />}
      </div>

      {/* Hộp Chuyển tổ / chức danh gợi ý theo hai danh sách này. */}
      <datalist id="hr-bo-phan">
        {h.boPhan.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
      <datalist id="hr-chuc-danh">
        {h.chucDanh.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
      {d.hop === 'nghi' && <HopNghi v={d} n={n} dong={() => d.setHop(null)} />}
      {d.hop === 'lam_lai' && <HopLamLai v={d} n={n} dong={() => d.setHop(null)} />}
      {d.hop === 'chuyen' && <HopChuyen v={d} n={n} dong={() => d.setHop(null)} />}
    </div>
  )
}

/** Menu Biến động — mục không áp dụng thì khoá và NÓI vì sao ngay trong menu. */
function MenuBienDong({ d, why }: { d: HoSoCtx; why: string | null }) {
  const [mo, setMo] = useState(false)
  const { n } = d
  const quyen = d.h.quyen.sua ? null : 'Phòng Nhân sự giữ quyền'
  const daNghi = !n.active
  const coNgay = !!n.ngayCuoi
  const muc: { ten: string; why: string | null; lam: () => void }[] = [
    {
      ten: 'Chuyển tổ / chức danh',
      why: quyen ?? (daNghi ? 'Đã nghỉ việc — đi làm lại trước' : null),
      lam: () => d.setHop('chuyen'),
    },
    {
      ten: 'Cho nghỉ việc',
      why:
        quyen ??
        (daNghi
          ? 'Đã nghỉ việc'
          : coNgay
            ? `Đã có ngày làm cuối ${ngayVn(n.ngayCuoi)} — huỷ trước nếu ghi nhầm`
            : null),
      lam: () => d.setHop('nghi'),
    },
    {
      ten: 'Huỷ cho nghỉ',
      why: quyen ?? (coNgay ? null : 'Chưa có ngày làm cuối để huỷ'),
      lam: () => d.bienDong(n.id, { viec: 'huy_nghi' }, `Đã huỷ cho nghỉ ${n.hoTen}`),
    },
    {
      ten: 'Đi làm lại',
      why: quyen ?? (daNghi ? null : 'Đang làm — chỉ dùng khi đã nghỉ'),
      lam: () => d.setHop('lam_lai'),
    },
  ]
  return (
    <span
      className="hs-menu"
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setMo(false)}
    >
      <button
        type="button"
        className="ns-btn"
        aria-haspopup="menu"
        aria-expanded={mo}
        aria-disabled={why ? 'true' : undefined}
        title={why ?? undefined}
        onClick={() => (why ? d.setBao({ ok: false, text: why }) : setMo(!mo))}
      >
        Biến động
        <ChevronDown className="ico" aria-hidden />
      </button>
      {mo && (
        <span className="ds" role="menu">
          {muc.map((m) => (
            <button
              key={m.ten}
              type="button"
              role="menuitem"
              aria-disabled={m.why ? 'true' : undefined}
              onClick={() => {
                if (m.why) return
                setMo(false)
                m.lam()
              }}
            >
              {m.ten}
              {m.why && <small>{m.why}</small>}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}
