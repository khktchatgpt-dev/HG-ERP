'use client'

/**
 * HỒ SƠ MỘT NHÂN VIÊN — /hr/nhan-vien/[mã] (B2a, bản vẽ lượt 2 duyệt 19/10/2026, Q1–Q6
 * theo đề xuất). Khuôn E (chép /mua-hang/ncc/[id]): đầu trang + dải số, không vòng duyệt.
 * Câu hỏi: "Người này là ai, làm gì từ bao giờ, hồ sơ còn thiếu gì?".
 *
 * Chép: trang riêng có URL (Odoo, SuccessFactors, Dynamics, AMIS); sửa theo từng khối
 * (SuccessFactors); menu "Biến động" tách khỏi nút sửa (SuccessFactors Take Action);
 * ‹ › đi lần lượt trong tập đang lọc (Dynamics). Tab Cá nhân, Hợp đồng, Giấy tờ, Lương
 * thêm ở B2b / B3.
 */

import {
  Btn,
  Crumb,
  DocMenu,
  DocMenuPanel,
  Menu,
  Metric,
  MetricStrip,
  ScreenFrame,
  ScreenHeader,
} from '@/components/kit'
import { ngayVn, TEN_BIEN_DONG } from '@/lib/nhan-su/bien-dong'
import {
  conThieu,
  MUC_CA_NHAN,
  SO_MUC_HO_SO,
  TEN_THIEU,
  thamNien,
  type MucThieu,
} from '@/lib/nhan-su/ho-so'
import { hienSdt } from '@/lib/nhan-su/ca-nhan'
import type {
  HoSoNvTrang,
  KhoiCaNhan,
} from '@/modules/dept/hr/cham-cong/ho-so-nv.service'
import { HopChuyen, HopLamLai, HopNghi } from '../../cham-cong/bien-dong-nv'
import { dm } from '../../cham-cong/ky-cong.shared'
import { Avatar, TagTinhTrang } from '../nv.shared'
import { useHoSoNv, type HoSoCtx, type Muc } from './useHoSoNv'
import { Dong, Khoi, KhoiChamCong, KhoiCongViec, LUOI } from './khoi-cong-viec'
import { TabLichSu } from './tab-lich-su'
import { TabCaNhan } from './tab-ca-nhan'
import { TabLuong } from './tab-luong'
import { TabHopDong } from './tab-hop-dong'
import { TabGiayTo } from './tab-giay-to'
import { soNgay, tinhTrangHd } from '@/lib/nhan-su/hop-dong'

export function HoSoNvScreen({ h, muc }: { h: HoSoNvTrang; muc: Muc }) {
  const d = useHoSoNv(h, muc)
  const { n } = d
  const ca = h.cas.find((c) => c.id === n.shiftId)
  const huy = h.bienDong.filter((b) => !b.huyLuc).length
  const thieuCn = conThieu(n).filter((t) => MUC_CA_NHAN.includes(t)).length
  const ttHd = n.hd ? tinhTrangHd(n.hd, d.homNay) : null
  const hdTag =
    ttHd === 'sap_het'
      ? { text: 'sắp hết hạn', tone: 'warn' as const }
      : ttHd === 'het_han'
        ? { text: 'hết hạn', tone: 'stop' as const }
        : !n.hd
          ? { text: 'chưa có', tone: 'warn' as const }
          : null
  return (
    <ScreenFrame tableMin={0}>
      <Crumb
        path={[
          { label: 'Hồ sơ nhân viên', href: '/hr/nhan-vien' },
          `${n.code} ${n.hoTen}`,
        ]}
        position={d.viTri >= 0 ? [d.viTri + 1, d.tongTap] : undefined}
        onPrev={d.truoc}
        onNext={d.sau}
      />
      <ScreenHeader
        eyebrow="Nhân viên"
        title={
          <span className="flex items-center gap-3">
            <Avatar ten={n.hoTen} boPhan={n.boPhan} lon />
            <span>
              <span className="num mr-2 text-[var(--ink-3)]">{n.code}</span>
              {n.hoTen}
            </span>
          </span>
        }
        status={<TagTinhTrang n={n} homNay={d.homNay} />}
        facts={[
          {
            label: 'Tổ',
            value: n.boPhan ?? 'chưa có',
            tone: n.boPhan ? undefined : 'warn',
          },
          { label: 'Chức danh', value: n.chucDanh ?? 'chưa có' },
          { label: 'Ca', value: ca ? `${ca.ten} ${ca.gio}` : '—' },
          { label: 'Tài khoản ERP', value: n.taiKhoan?.email ?? 'chưa có' },
        ]}
        actions={
          <>
            <Btn href={`/hr/cham-cong/nguoi/${encodeURIComponent(n.code)}`}>
              Xem chấm công
            </Btn>
            <Menu label="Biến động ▾" ariaLabel="Biến động" items={mucBienDong(d)} />
          </>
        }
      />
      <DaiSo d={d} />
      <DocMenu
        label="Nội dung hồ sơ"
        value={d.muc}
        onValueChange={(m) => d.setMuc(m as Muc)}
        items={[
          { id: 'tong-quan', label: 'Tổng quan' },
          {
            id: 'ca-nhan',
            label: 'Cá nhân',
            ...(thieuCn
              ? { signal: { text: `thiếu ${thieuCn}`, tone: 'warn' as const } }
              : {}),
          },
          {
            id: 'hop-dong',
            label: 'Hợp đồng',
            ...(hdTag ? { signal: hdTag } : {}),
          },
          {
            id: 'giay-to',
            label: 'Giấy tờ',
            ...(h.giayTo?.length ? { signal: { text: String(h.giayTo.length) } } : {}),
          },
          // Lương là mật (0253): người không có quyền lương không thấy cả tên mục.
          ...(h.quyen.luong ? [{ id: 'luong', label: 'Lương & ngân hàng' }] : []),
          {
            id: 'lich-su',
            label: 'Lịch sử',
            ...(huy ? { signal: { text: String(huy) } } : {}),
          },
        ]}
      >
        <DocMenuPanel value="tong-quan">
          <TongQuan d={d} />
        </DocMenuPanel>
        <DocMenuPanel value="ca-nhan">
          <TabCaNhan d={d} />
        </DocMenuPanel>
        <DocMenuPanel value="hop-dong">
          <TabHopDong d={d} />
        </DocMenuPanel>
        <DocMenuPanel value="giay-to">
          <TabGiayTo d={d} />
        </DocMenuPanel>
        {h.quyen.luong && (
          <DocMenuPanel value="luong">
            <TabLuong d={d} />
          </DocMenuPanel>
        )}
        <DocMenuPanel value="lich-su">
          <TabLichSu d={d} />
        </DocMenuPanel>
      </DocMenu>

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
    </ScreenFrame>
  )
}

/** Các mục menu Biến động — mục không áp dụng thì khoá và NÓI vì sao. */
function mucBienDong(d: HoSoCtx) {
  const { n } = d
  const quyen = d.h.quyen.sua ? undefined : 'Phòng Nhân sự'
  const daNghi = !n.active
  const coNgay = !!n.ngayCuoi
  return [
    {
      label: 'Chuyển tổ / chức danh',
      blockedBy: quyen,
      why: daNghi ? 'Đã nghỉ việc — đi làm lại trước' : undefined,
      onClick: () => d.setHop('chuyen'),
    },
    {
      label: 'Cho nghỉ việc',
      blockedBy: quyen,
      why: daNghi
        ? 'Đã nghỉ việc'
        : coNgay
          ? `Đã có ngày làm cuối ${ngayVn(n.ngayCuoi)} — huỷ trước nếu ghi nhầm`
          : undefined,
      onClick: () => d.setHop('nghi'),
    },
    {
      label: 'Huỷ cho nghỉ',
      blockedBy: quyen,
      why: coNgay ? undefined : 'Chưa có ngày làm cuối để huỷ',
      onClick: () => d.bienDong(n.id, { viec: 'huy_nghi' }, `Đã huỷ cho nghỉ ${n.hoTen}`),
    },
    {
      label: 'Đi làm lại',
      blockedBy: quyen,
      why: daNghi ? undefined : 'Đang làm — chỉ dùng khi đã nghỉ',
      onClick: () => d.setHop('lam_lai'),
    },
  ]
}

/** Dải số đầu hồ sơ — mỗi ô có mẫu số; chưa đo được thì nói chưa đo được. */
function DaiSo({ d }: { d: HoSoCtx }) {
  const { n, h } = d
  const thieu = conThieu(n)
  const tn = thamNien(n.ngayVao, d.homNay)
  const tt = n.hd ? tinhTrangHd(n.hd, d.homNay) : null
  const kyVn = `${h.ky.thang.slice(5)}/${h.ky.thang.slice(0, 4)}`
  return (
    <MetricStrip>
      <Metric
        label="Thâm niên"
        value={tn}
        basis={n.ngayVao ? `từ ${ngayVn(n.ngayVao)}` : 'chưa có ngày vào làm'}
      />
      <Metric
        label={`Ngày có quẹt · kỳ ${kyVn}`}
        value={h.ky.coQuet == null ? null : String(h.ky.coQuet)}
        basis={
          n.khongChamCong
            ? 'không chấm công'
            : `trên ${h.ky.daLay} ngày đã lấy dữ liệu, ${dm(h.ky.tu)} – ${dm(h.ky.den < d.homNay ? h.ky.den : d.homNay)}`
        }
      />
      <Metric
        label="Quẹt gần nhất"
        value={n.lanCuoi ? dm(n.lanCuoi) : null}
        basis={n.khongChamCong ? 'không chấm công' : 'trong 45 ngày gần nhất'}
      />
      <Metric
        label="Hợp đồng"
        value={
          !n.hd
            ? null
            : !n.hd.denNgay
              ? 'không thời hạn'
              : tt === 'het_han'
                ? `hết ${ngayVn(n.hd.denNgay)}`
                : `còn ${soNgay(d.homNay, n.hd.denNgay)} ngày`
        }
        basis={
          !n.hd
            ? 'chưa có hợp đồng nào'
            : n.hd.denNgay
              ? `đến ${ngayVn(n.hd.denNgay)}`
              : `từ ${ngayVn(n.hd.tuNgay)}`
        }
        tone={tt === 'het_han' ? 'stop' : tt === 'sap_het' ? 'warn' : undefined}
      />
      <Metric
        label="Hồ sơ"
        value={`${SO_MUC_HO_SO - thieu.length}/${SO_MUC_HO_SO}`}
        basis="mục sổ quản lý lao động"
        tone={thieu.length ? 'warn' : 'done'}
      />
    </MetricStrip>
  )
}

function TongQuan({ d }: { d: HoSoCtx }) {
  const { n, h } = d
  const thieu = conThieu(n)
  const ganDay = h.bienDong.slice(0, 3)
  const duocSua = (t: MucThieu) =>
    KHOI_CUA[t] === 'cong_viec' ? h.quyen.sua && n.active : h.quyen.rieng
  return (
    <div className="flex min-h-0">
      <div className="min-w-0 flex-1">
        <KhoiCongViec d={d} />
        <KhoiLienHe d={d} />
        <KhoiChamCong d={d} />
      </div>
      <aside
        aria-label="Tóm tắt"
        className="text-k-sm w-[290px] shrink-0 border-l border-[var(--line)] px-3.5 py-2.5 text-[var(--ink-2)]"
      >
        <h2 className="text-k-label mb-1.5 font-semibold tracking-[.05em] text-[var(--ink-3)] uppercase">
          {thieu.length ? `Còn thiếu ${thieu.length} mục` : 'Hồ sơ đủ'}
        </h2>
        {thieu.length ? (
          <ul className="space-y-1">
            {thieu.map((t) => (
              <li key={t}>
                {t === 'ma_may' ? (
                  <a
                    href="/hr/cham-cong/ma-may"
                    className="text-[var(--act-text)] underline"
                  >
                    {TEN_THIEU[t]}
                  </a>
                ) : duocSua(t) ? (
                  <button
                    type="button"
                    className="text-left text-[var(--act-text)] underline"
                    onClick={() => d.moSua(KHOI_CUA[t])}
                  >
                    {TEN_THIEU[t]}
                  </button>
                ) : (
                  TEN_THIEU[t]
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>Đủ {SO_MUC_HO_SO} mục đang theo dõi.</p>
        )}
        <p className="text-k-label mt-1.5 text-[var(--ink-3)]">
          Hợp đồng, giấy tờ thêm ở bước sau. Bấm một mục để mở đúng khối.
        </p>

        <h2 className="text-k-label mt-4 mb-1.5 border-t border-[var(--line-faint)] pt-3 font-semibold tracking-[.05em] text-[var(--ink-3)] uppercase">
          Biến động gần nhất
        </h2>
        {ganDay.length ? (
          <ul className="space-y-1.5">
            {ganDay.map((b) => (
              <li key={b.id} className={b.huyLuc ? 'line-through opacity-70' : ''}>
                <span className="num mr-1.5">{ngayVn(b.ngay)}</span>
                {TEN_BIEN_DONG[b.loai]}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[var(--ink-3)]">Chưa có — có từ trước khi ghi biến động.</p>
        )}
        {h.bienDong.length > 3 && (
          <button
            type="button"
            className="text-k-label mt-1 text-[var(--act-text)] underline"
            onClick={() => d.setMuc('lich-su')}
          >
            Xem cả {h.bienDong.length}
          </button>
        )}

        <h2 className="text-k-label mt-4 mb-1.5 border-t border-[var(--line-faint)] pt-3 font-semibold tracking-[.05em] text-[var(--ink-3)] uppercase">
          Tài khoản ERP
        </h2>
        {n.taiKhoan ? (
          <p>
            <span className="num">{n.taiKhoan.email}</span>
            {!n.taiKhoan.mo && <span className="text-[var(--stop)]"> · đã khoá</span>}
          </p>
        ) : (
          <p>Chưa có. Admin cấp ở Admin › Nhân viên &amp; tài khoản.</p>
        )}
      </aside>
    </div>
  )
}

/** Mục thiếu → khối mở để sửa. */
const KHOI_CUA: Record<
  Exclude<MucThieu, 'ma_may'>,
  'cong_viec' | 'hop_dong' | KhoiCaNhan
> & {
  ma_may: 'cong_viec'
} = {
  ho_ten: 'cong_viec',
  to: 'cong_viec',
  chuc_danh: 'cong_viec',
  ngay_vao: 'cong_viec',
  ma_may: 'cong_viec',
  ngay_sinh: 'ca_nhan',
  trinh_do: 'ca_nhan',
  cccd: 'dinh_danh',
  dia_chi: 'dinh_danh',
  dien_thoai: 'lien_he',
  khan_cap: 'lien_he',
  hop_dong: 'hop_dong',
}

/** Liên hệ trên Tổng quan — chỉ xem; sửa ở tab Cá nhân. Không có quyền thì không hiện số. */
function KhoiLienHe({ d }: { d: HoSoCtx }) {
  const c = d.h.caNhan
  return (
    <Khoi ten="Liên hệ" sua={!!c && d.h.quyen.rieng} onSua={() => d.moSua('lien_he')}>
      {c ? (
        <div className={LUOI}>
          <Dong nhan="Điện thoại">
            {c.dienThoai ? (
              <span className="num">{hienSdt(c.dienThoai)}</span>
            ) : (
              <span className="text-[var(--warn)]">chưa có</span>
            )}
          </Dong>
          <Dong nhan="Thường trú">
            {c.thuongTru ?? <span className="text-[var(--warn)]">chưa có</span>}
          </Dong>
          <Dong nhan="Liên hệ khẩn cấp">
            {c.khanCapTen ? (
              <span>
                {c.khanCapTen}
                {c.khanCapQuanHe ? ` (${c.khanCapQuanHe})` : ''}
                {c.khanCapSdt && (
                  <span className="num ml-1.5">{hienSdt(c.khanCapSdt)}</span>
                )}
              </span>
            ) : (
              <span className="text-[var(--warn)]">chưa có</span>
            )}
          </Dong>
        </div>
      ) : (
        <p className="text-k-sm text-[var(--ink-3)]">
          Chỉ Phòng Nhân sự và Ban Giám đốc xem được số điện thoại, địa chỉ.
        </p>
      )}
    </Khoi>
  )
}
