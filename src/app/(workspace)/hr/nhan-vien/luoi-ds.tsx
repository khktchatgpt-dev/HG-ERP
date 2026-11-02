'use client'

import Link from 'next/link'
import { useSyncExternalStore, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { ngayVn } from '@/lib/nhan-su/bien-dong'
import { hienSdt, QUAN_HE, TEN_GIOI_TINH, TRINH_DO } from '@/lib/nhan-su/ca-nhan'
import { nhanTinhTrang, thamNien } from '@/lib/nhan-su/ho-so'
import { COT_TRONG, demTrong, nhomBoPhan, type CotTrong } from '@/lib/nhan-su/danh-sach'
import {
  COT_CONG_VIEC,
  danVung,
  gocO,
  laVung,
  xetO,
  type CotSua,
} from '@/lib/nhan-su/sua-bang'
import type { NvLuoi } from '@/modules/dept/hr/cham-cong/ho-so-nv.service'
import type { BoCot, DsCtx } from './useNhanVienDs'

/**
 * Ghép lớp CSS riêng của màn. KHÔNG nối chuỗi trong className kiểu "a" + (x ? " b" : ""):
 * plugin Tailwind của Prettier cắt dấu cách đầu chuỗi, ra "ab" (đã dính 02/11/2026).
 */
export const lop = (...xs: (string | false | null | undefined)[]) =>
  xs.filter(Boolean).join(' ')

/** Một cột của lưới. Cột không có `w` chia phần bề ngang còn lại. */
type Cot = {
  k: string
  ten: string
  w?: number
  r?: boolean
  /** Chỉ có khi người xem có quyền xem thông tin riêng. */
  rieng?: boolean
  /** Cột có chân đếm trống + lọc "Ô trống". */
  trong?: CotTrong
  o: (n: NvLuoi, c: { homNay: string; ca: Map<string, string> }) => ReactNode
  /** Chữ đầy đủ khi ô bị cắt "…". */
  tt?: (n: NvLuoi) => string | null | undefined
  /** Ô sửa được ở chế độ Sửa trên bảng. */
  sua?: CotSua
}

const RONG = <span className="e">—</span>
const v = (x: ReactNode) => (x == null || x === '' ? RONG : x)
const so = (x: string | null | undefined) => (x ? <span className="num">{x}</span> : RONG)
const ngay = (x: string | null | undefined) => so(x ? ngayVn(x) : null)
const che = (x: string | null | undefined) => so(x ? `•••• ${x}` : null)

/**
 * Nhãn sau họ tên — chỉ trạng thái cần để ý mới có nhãn; "đang làm" không có. Tên máy đi kèm
 * vắng / mới thì gộp MỘT nhãn: hai nhãn rời tràn cột 214px ("tên máy" + "vắng 38 ngày").
 */
function Nhan({ n, homNay }: { n: NvLuoi; homNay: string }) {
  const t = nhanTinhTrang(n, homNay)
  const tenMay = n.tenTuMay && n.active
  const may = tenMay && <span className="ns-pill w">tên máy</span>
  if (tenMay && (t.kieu === 'vang' || t.kieu === 'moi'))
    return (
      <span className="ns-pill w">
        tên máy · {t.kieu === 'vang' ? 'vắng' : 'mới'} {t.ngay} ngày
      </span>
    )
  switch (t.kieu) {
    case 'da_nghi':
      return (
        <span className="ns-pill g">
          {t.ngay ? `nghỉ từ ${ngayVn(t.ngay)}` : 'đã nghỉ'}
        </span>
      )
    case 'sap_nghi':
      return <span className="ns-pill w">làm tới {ngayVn(t.ngay)}</span>
    case 'chua_vao':
      return <span className="ns-pill a">vào {ngayVn(t.ngay)}</span>
    case 'vang':
      return (
        <>
          {may}
          <span
            className="ns-pill w"
            title={
              t.quetCuoi ? `Quẹt cuối ${ngayVn(t.quetCuoi)}` : 'Không quẹt trong 45 ngày'
            }
          >
            vắng {t.ngay} ngày
          </span>
        </>
      )
    case 'moi':
      return (
        <>
          {may}
          <span className="ns-pill a">mới · {t.ngay} ngày</span>
        </>
      )
    default:
      return may || null
  }
}

const MA: Cot = {
  k: 'ma',
  ten: 'MSNV',
  w: 78,
  o: (n) => (
    <Link
      className="ma"
      href={`/hr/nhan-vien/${encodeURIComponent(n.code)}`}
      onClick={(e) => e.stopPropagation()}
    >
      {n.code}
    </Link>
  ),
}
const TEN: Cot = {
  k: 'ten',
  ten: 'Họ và tên',
  w: 206,
  o: (n, c) => (
    <>
      {n.hoTen}
      <Nhan n={n} homNay={c.homNay} />
    </>
  ),
  tt: (n) => n.hoTen,
}
const BP: Cot = {
  k: 'bp',
  ten: 'Bộ phận',
  w: 140,
  trong: 'bo_phan',
  o: (n) => v(n.boPhan),
  tt: (n) => n.boPhan,
}
const CV: Cot = {
  k: 'cv',
  sua: 'chucDanh',
  ten: 'Chức vụ',
  w: 116,
  trong: 'chuc_vu',
  o: (n) => v(n.chucDanh),
  tt: (n) => n.chucDanh,
}
const NV: Cot = {
  k: 'nv',
  sua: 'ngayVao',
  ten: 'Ngày vào',
  w: 96,
  trong: 'ngay_vao',
  o: (n) => ngay(n.ngayVao),
}
const TN: Cot = {
  k: 'tn',
  ten: 'Thâm niên',
  w: 92,
  r: true,
  o: (n, c) => so(thamNien(n.ngayVao, c.homNay)),
}
const GC: Cot = { k: 'gc', ten: 'Ghi chú', o: (n) => v(n.ghiChu), tt: (n) => n.ghiChu }
const GT: Cot = {
  k: 'gt',
  sua: 'gioiTinh',
  ten: 'GT',
  w: 44,
  rieng: true,
  trong: 'gioi_tinh',
  o: (n) => v(n.rieng?.gioiTinh && TEN_GIOI_TINH[n.rieng.gioiTinh]),
}
const NS: Cot = {
  k: 'ns',
  sua: 'ngaySinh',
  ten: 'Ngày sinh',
  w: 96,
  rieng: true,
  trong: 'ngay_sinh',
  o: (n) => ngay(n.rieng?.ngaySinh),
}
const CC: Cot = {
  k: 'cc',
  sua: 'cccd',
  ten: 'Số CCCD',
  w: 104,
  rieng: true,
  trong: 'cccd',
  o: (n) => che(n.rieng?.cccd4),
}
const DT: Cot = {
  k: 'dt',
  sua: 'dienThoai',
  ten: 'Điện thoại',
  w: 104,
  rieng: true,
  trong: 'dien_thoai',
  o: (n) => so(n.rieng?.dienThoai ? hienSdt(n.rieng.dienThoai) : null),
}
const NO: Cot = {
  k: 'no',
  sua: 'choO',
  ten: 'Nơi ở hiện tại',
  rieng: true,
  trong: 'cho_o',
  o: (n) => v(n.rieng?.choO),
  tt: (n) => n.rieng?.choO,
}
const NCAP: Cot = {
  k: 'ncap',
  sua: 'ngayCap',
  ten: 'Ngày cấp',
  w: 96,
  rieng: true,
  trong: 'ngay_cap',
  o: (n) => ngay(n.rieng?.ngayCap),
}
const NOICAP: Cot = {
  k: 'noicap',
  sua: 'noiCap',
  ten: 'Nơi cấp',
  w: 130,
  rieng: true,
  trong: 'noi_cap',
  o: (n) => v(n.rieng?.noiCap),
  tt: (n) => n.rieng?.noiCap,
}
const MST: Cot = {
  k: 'mst',
  sua: 'mst',
  ten: 'Mã số thuế',
  w: 104,
  rieng: true,
  trong: 'mst',
  o: (n) => che(n.rieng?.mst4),
}
const TT: Cot = {
  k: 'tt',
  sua: 'thuongTru',
  ten: 'Thường trú',
  rieng: true,
  trong: 'thuong_tru',
  o: (n) => v(n.rieng?.thuongTru),
  tt: (n) => n.rieng?.thuongTru,
}
const TD: Cot = {
  k: 'td',
  sua: 'trinhDo',
  ten: 'Trình độ',
  w: 130,
  rieng: true,
  trong: 'trinh_do',
  o: (n) => v(n.rieng?.trinhDo),
  tt: (n) => n.rieng?.trinhDo,
}
const KCT: Cot = {
  k: 'kct',
  sua: 'khanCapTen',
  ten: 'Người khẩn cấp',
  w: 160,
  rieng: true,
  trong: 'khan_cap',
  o: (n) => v(n.rieng?.khanCapTen),
  tt: (n) => n.rieng?.khanCapTen,
}
const KCQH: Cot = {
  k: 'kcqh',
  sua: 'khanCapQuanHe',
  ten: 'Quan hệ',
  w: 84,
  rieng: true,
  o: (n) => v(n.rieng?.khanCapQuanHe),
}
const KCS: Cot = {
  k: 'kcs',
  sua: 'khanCapSdt',
  ten: 'SĐT khẩn cấp',
  w: 112,
  rieng: true,
  o: (n) => so(n.rieng?.khanCapSdt ? hienSdt(n.rieng.khanCapSdt) : null),
}
const CA: Cot = {
  k: 'ca',
  ten: 'Ca thường làm',
  w: 150,
  o: (n, c) => v(c.ca.get(n.shiftId)),
}
const MM: Cot = {
  k: 'mm',
  ten: 'Mã trên máy',
  w: 120,
  o: (n) =>
    n.khongChamCong ? (
      <span className="e">không chấm công</span>
    ) : (
      so(n.ma.map((m) => m.ma).join(', '))
    ),
}
const TK: Cot = {
  k: 'tk',
  ten: 'Tài khoản ERP',
  o: (n) =>
    n.taiKhoan ? (
      <span className="num">
        {n.taiKhoan.email}
        {!n.taiKhoan.mo && ' · khoá'}
      </span>
    ) : (
      RONG
    ),
  tt: (n) => n.taiKhoan?.email,
}

/**
 * Bốn bộ cột (bản vẽ A; "Giấy tờ & liên hệ" tách đôi ở B2 để ô khẩn cấp có chỗ sửa). "DS CNV" theo đúng file Nhân sự đang giữ. Bỏ nhóm thì thêm cột Bộ
 * phận; bộ DS CNV khi đó — hoặc khi khung hẹp — bỏ Ghi chú cho Nơi ở còn chỗ đọc ở 1000px.
 */
export function cotCua(bo: BoCot, nhom: boolean, rieng: boolean, hep = false): Cot[] {
  const bp = nhom ? [] : [BP]
  const ds: Cot[] =
    bo === 'giay_to'
      ? [MA, TEN, CC, NCAP, NOICAP, MST, TD, TT]
      : bo === 'lien_he'
        ? [MA, TEN, DT, NO, KCT, KCQH, KCS]
        : bo === 'cong_viec'
          ? [MA, TEN, ...bp, CV, NV, TN, CA, MM, TK]
          : rieng
            ? [MA, TEN, ...bp, CV, GT, NS, NV, CC, DT, NO, ...(nhom && !hep ? [GC] : [])]
            : [MA, TEN, ...bp, CV, NV, TN, GC]
  return ds.filter((c) => rieng || !c.rieng)
}

/**
 * Khung dưới 1150px (laptop phóng 125% trừ thanh bên còn ~1.000px). Ẩn cột bằng CSS
 * display:none làm lệch bề rộng cột của table-layout:fixed, nên bỏ hẳn cột trong JSX.
 * Phía server coi là rộng — khung hẹp đổi ngay sau khi hydrate, không lệch HTML.
 */
const HEP = '(max-width: 1150px)'
function useHep() {
  return useSyncExternalStore(
    (doi) => {
      const mq = window.matchMedia(HEP)
      mq.addEventListener('change', doi)
      return () => mq.removeEventListener('change', doi)
    },
    () => window.matchMedia(HEP).matches,
    () => false,
  )
}

export function LuoiDs({ d }: { d: DsCtx }) {
  const cols = cotCua(d.cot, d.nhom, d.h.nv.rieng, useHep())
  const ctx = {
    homNay: d.h.homNay,
    ca: new Map(d.h.nv.cas.map((c) => [c.id, `${c.ten} ${c.gio}`])),
  }
  const nhom = d.nhom ? nhomBoPhan(d.ds) : [{ boPhan: null, ds: d.ds }]
  const tatCa = d.ds.length > 0 && d.ds.every((n) => d.chon.has(n.id))
  const soNhom = new Set(d.ds.map((n) => n.boPhan)).size
  const sua = d.sb.dangSua
  // Ô công việc cần quyền sửa hồ sơ; ô cá nhân cần thêm quyền thông tin riêng.
  const suaDuoc = (c: Cot) =>
    sua && !!c.sua && d.h.sua && (COT_CONG_VIEC.includes(c.sua) || d.h.nv.rieng)

  const dong = (n: NvLuoi) => {
    const loi = sua ? d.sb.tong.loi.filter((l) => l.id === n.id) : []
    return [
      <tr
        key={n.id}
        className={lop('d', d.chon.has(n.id) && 'on', !n.active && 'nghi')}
        tabIndex={sua ? undefined : 0}
        onClick={() => d.moHoSo(n.code)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target === e.currentTarget) d.moHoSo(n.code)
        }}
      >
        <td onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={d.chon.has(n.id)}
            onChange={() => d.batChon(n.id)}
            aria-label={`Chọn ${n.code} ${n.hoTen}`}
          />
        </td>
        {cols.map((c) =>
          suaDuoc(c) ? (
            <OSua key={c.k} d={d} n={n} c={c.sua!} ten={c.ten} />
          ) : (
            <td
              key={c.k}
              className={lop(`c-${c.k}`, c.r && 'r')}
              title={c.tt?.(n) ?? undefined}
            >
              {/* Đang sửa: mã là chữ thường — bấm dòng để gõ, không rời trang. */}
              {sua && c.k === 'ma' ? <span className="num">{n.code}</span> : c.o(n, ctx)}
            </td>
          ),
        )}
      </tr>,
      loi.length > 0 && (
        <tr key={`${n.id}-loi`} className="loi">
          <td colSpan={cols.length + 1}>
            {n.code} · {loi.map((l) => l.loi).join(' · ')}
          </td>
        </tr>
      ),
    ]
  }

  return (
    <>
      <table className="ns-tb">
        <colgroup>
          <col style={{ width: 32 }} />
          {cols.map((c) => (
            <col
              key={c.k}
              className={`c-${c.k}`}
              style={c.w ? { width: c.w } : undefined}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={tatCa}
                onChange={(e) => d.chonHet(e.target.checked)}
                aria-label="Chọn tất cả dòng đang hiện"
              />
            </th>
            {cols.map((c) => (
              <th key={c.k} className={lop(`c-${c.k}`, c.r && 'r')} title={c.ten}>
                {c.ten}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {nhom.map((g) => {
            if (!d.nhom) return g.ds.map(dong)
            const k = g.boPhan ?? '__trong'
            const mo = !d.dong.has(k)
            return [
              <tr key={`g-${k}`} className={lop('g', !g.boPhan && 'w')}>
                <td colSpan={cols.length + 1}>
                  <button type="button" aria-expanded={mo} onClick={() => d.batDong(k)}>
                    {mo ? (
                      <ChevronDown className="ico" aria-hidden />
                    ) : (
                      <ChevronRight className="ico" aria-hidden />
                    )}
                    {g.boPhan ?? 'Chưa có bộ phận'}
                  </button>
                  <span className="c">{g.ds.length} người</span>
                </td>
              </tr>,
              ...(mo ? g.ds.map(dong) : []),
            ]
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>
              {d.ds.length} người · {soNhom} bộ phận · ô trống ›
            </td>
            {cols.slice(2).map((c) => (
              <td key={c.k} className={`c-${c.k}`}>
                {c.trong ? <ChanTrong d={d} c={c.trong} /> : null}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      {sua && (
        <>
          <datalist id="ns-gy-chucDanh">
            {[...new Set(d.h.nv.ds.map((n) => n.chucDanh).filter(Boolean))].map((x) => (
              <option key={x} value={x!} />
            ))}
          </datalist>
          <datalist id="ns-gy-gioiTinh">
            <option value="Nam" />
            <option value="Nữ" />
          </datalist>
          <datalist id="ns-gy-trinhDo">
            {TRINH_DO.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          <datalist id="ns-gy-khanCapQuanHe">
            {QUAN_HE.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </>
      )}
    </>
  )
}

const GOI_Y: Partial<Record<CotSua, string>> = {
  chucDanh: 'ns-gy-chucDanh',
  gioiTinh: 'ns-gy-gioiTinh',
  trinhDo: 'ns-gy-trinhDo',
  khanCapQuanHe: 'ns-gy-khanCapQuanHe',
}
const SO: readonly CotSua[] = [
  'ngayVao',
  'ngaySinh',
  'ngayCap',
  'cccd',
  'mst',
  'dienThoai',
  'khanCapSdt',
]

function goiY(n: NvLuoi, c: CotSua): string {
  switch (c) {
    case 'cccd':
      return n.rieng?.cccd4 ? `•••• ${n.rieng.cccd4}` : '12 chữ số'
    case 'mst':
      return n.rieng?.mst4 ? `•••• ${n.rieng.mst4}` : '10 hoặc 13 số'
    case 'ngayVao':
    case 'ngaySinh':
    case 'ngayCap':
      return 'dd/mm/yyyy'
    case 'dienThoai':
    case 'khanCapSdt':
      return '09xx xxx xxx'
    default:
      return ''
  }
}

/**
 * Một ô nhập của chế độ sửa. Enter / Shift+Enter xuống / lên cùng cột, Esc trả ô về cũ, Ctrl+V
 * vùng nhiều ô từ Excel thì dán chạy sang phải + xuống dưới từ ô này (`danVung`).
 */
function OSua({ d, n, c, ten }: { d: DsCtx; n: NvLuoi; c: CotSua; ten: string }) {
  const goc = gocO(n, c)
  const go = d.sb.sua[n.id]?.[c]
  const x = go === undefined ? null : xetO(c, goc, go)
  return (
    <td
      className={lop('o', x?.kieu === 'doi' && 'doi', x?.kieu === 'loi' && 'sai')}
      title={x?.kieu === 'loi' ? x.loi : undefined}
    >
      <input
        data-id={n.id}
        data-cot={c}
        className={SO.includes(c) ? 'm' : undefined}
        value={go ?? goc}
        placeholder={goiY(n, c)}
        list={GOI_Y[c]}
        aria-label={`${ten} của ${n.code} ${n.hoTen}`}
        aria-invalid={x?.kieu === 'loi' || undefined}
        onChange={(e) => d.sb.datO(n.id, c, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            d.sb.traO(n.id, c)
          } else if (e.key === 'Enter') {
            e.preventDefault()
            e.stopPropagation()
            const cung = [
              ...(e.currentTarget
                .closest('table')
                ?.querySelectorAll<HTMLInputElement>(`input[data-cot="${c}"]`) ?? []),
            ]
            const i = cung.indexOf(e.currentTarget)
            cung[e.shiftKey ? i - 1 : i + 1]?.focus()
          }
        }}
        onPaste={(e) => {
          const t = e.clipboardData.getData('text/plain')
          if (!laVung(t)) return
          e.preventDefault()
          const bang = e.currentTarget.closest('table')
          const ids = [
            ...new Set(
              [...(bang?.querySelectorAll<HTMLInputElement>('input[data-id]') ?? [])].map(
                (i) => i.dataset.id!,
              ),
            ),
          ]
          const cots = [
            ...(e.currentTarget
              .closest('tr')
              ?.querySelectorAll<HTMLInputElement>('input[data-cot]') ?? []),
          ].map((i) => i.dataset.cot as CotSua)
          d.sb.dan(danVung(t, ids, cots, ids.indexOf(n.id), cots.indexOf(c)))
        }}
      />
    </td>
  )
}

/**
 * Chân đếm trống của một cột, đếm trên đúng các dòng đang hiện. Bấm = lọc "Ô trống" cột đó,
 * ra đúng số đã hiện. Đang lọc một cột khác thì số chỉ để đọc (bấm sẽ thay bộ lọc, ra số khác).
 */
function ChanTrong({ d, c }: { d: DsCtx; c: CotTrong }) {
  const n = demTrong(d.ds, c)
  const ten = `${n} người trống ${COT_TRONG[c].ten}`
  if (!n) return <span className="z">0</span>
  if (d.loc.trong)
    return (
      <span className={d.loc.trong === c ? 'num' : 'z'} title={ten}>
        {n}
      </span>
    )
  return (
    <button
      type="button"
      className="ns-lnk"
      title={`Lọc ${ten}`}
      aria-label={`Lọc ${ten}`}
      onClick={() => d.setTrong(c)}
    >
      {n}
    </button>
  )
}
