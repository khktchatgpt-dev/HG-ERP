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
import { conThieu, SO_MUC_HO_SO, TEN_THIEU, thamNien } from '@/lib/nhan-su/ho-so'
import type { HoSoNvTrang } from '@/modules/dept/hr/cham-cong/ho-so-nv.service'
import { HopChuyen, HopLamLai, HopNghi } from '../../cham-cong/bien-dong-nv'
import { dm } from '../../cham-cong/ky-cong.shared'
import { Avatar, TagTinhTrang } from '../nv.shared'
import { useHoSoNv, type HoSoCtx, type Muc } from './useHoSoNv'
import { KhoiChamCong, KhoiCongViec } from './khoi-cong-viec'
import { TabLichSu } from './tab-lich-su'

export function HoSoNvScreen({ h, muc }: { h: HoSoNvTrang; muc: Muc }) {
  const d = useHoSoNv(h, muc)
  const { n } = d
  const ca = h.cas.find((c) => c.id === n.shiftId)
  const huy = h.bienDong.filter((b) => !b.huyLuc).length
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
            <Avatar ten={n.hoTen} lon />
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
            id: 'lich-su',
            label: 'Lịch sử',
            ...(huy ? { signal: { text: String(huy) } } : {}),
          },
        ]}
      >
        <DocMenuPanel value="tong-quan">
          <TongQuan d={d} />
        </DocMenuPanel>
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
        label="Hồ sơ"
        value={`${SO_MUC_HO_SO - thieu.length}/${SO_MUC_HO_SO}`}
        basis="mục đang theo dõi"
        tone={thieu.length ? 'warn' : 'done'}
      />
    </MetricStrip>
  )
}

function TongQuan({ d }: { d: HoSoCtx }) {
  const { n, h } = d
  const thieu = conThieu(n)
  const ganDay = h.bienDong.slice(0, 3)
  return (
    <div className="flex min-h-0">
      <div className="min-w-0 flex-1">
        <KhoiCongViec d={d} />
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
                ) : h.quyen.sua && n.active ? (
                  <button
                    type="button"
                    className="text-left text-[var(--act-text)] underline"
                    onClick={() => d.setSuaCv(true)}
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
          Thông tin cá nhân, hợp đồng, giấy tờ thêm ở bước sau.
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
