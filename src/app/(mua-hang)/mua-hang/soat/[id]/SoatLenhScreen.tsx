'use client'

import { ngayGioVn } from '@/lib/date-vn'
import type { LenhDoiCuaLenh } from '@/modules/dept/supply/lenh-doi.service'
import { DauTrang, MenuBa, Nut, ThanhDuoi, Trang } from '../../_erp/ui'
import { dmy, so0 } from '../../bang-ke/[id]/ke-hoach.shared'
import { HopLichSu, HopSoat } from './khoi-soat'
import { TabDinhMuc } from './tab-dinh-muc'
import { TabLenh } from './tab-lenh'
import { TabVatTu } from './tab-vat-tu'
import { useSoatLenh, type LenhSoat, type SoatCtx, type TabSoat } from './useSoatLenh'

/**
 * SOÁT THAY ĐỔI MỘT LỆNH — trang riêng (T1, bản vẽ
 * https://claude.ai/artifact/FgRYhTxeBoK3JWH6HcRAqE, duyệt 02/11/2026).
 *
 * Câu trang trả lời: TỪ LẦN TÔI SOÁT, LỆNH NÀY ĐỔI GÌ (định mức, lệnh, đơn hàng)
 * VÀ TÔI PHẢI LÀM GÌ VỚI ĐƠN MUA. Tách khỏi Kế hoạch mua cho đỡ rối: bên kia
 * lo "còn phải mua gì, của ai, lên đơn"; bên này lo soát. Tab Vật tư cộng mọi
 * nguồn thành việc với đơn mua; các tab sau trả lời "vì sao".
 */
export function SoatLenhScreen({
  lsx,
  doi,
  canEdit,
}: {
  lsx: LenhSoat
  doi: LenhDoiCuaLenh
  canEdit: boolean
}) {
  const d = useSoatLenh({ lsx, doi, canEdit })
  const t = d.thayDoi
  const khoa = d.loi
    ? 'Chưa ghi được mốc soát — bảng 0282 chưa áp vào cơ sở dữ liệu'
    : canEdit
      ? undefined
      : 'Chỉ nhân viên phòng Cung ứng ghi mốc soát'
  const soVoi =
    t.moc.k === 'soat'
      ? `lần soát ${ngayGioVn(t.moc.luc)} · ${t.moc.boi ?? '—'}`
      : `lúc ${t.moc.laDuyet ? 'duyệt' : 'phát lệnh'} ${dmy(t.moc.luc)} · chưa soát lần nào`
  return (
    <Trang>
      <DauTrang
        eyebrow="Mua hàng · Soát thay đổi"
        title={<span className="font-mono">{lsx.code}</span>}
        actions={
          <>
            <Nut href={`/mua-hang/bang-ke/${lsx.id}`}>Mở kế hoạch mua</Nut>
            {t.choSoat && (
              <Nut chinh khoa={khoa} onClick={() => d.setMoSoat(true)}>
                {d.soDoi > 0 ? `Đã soát ${d.soDoi} thay đổi` : 'Đã soát'}
              </Nut>
            )}
            <MenuBa
              items={[{ label: 'Lịch sử soát', onClick: () => d.setMoLichSu(true) }]}
            />
          </>
        }
        facts={[
          { k: 'Khách', v: lsx.customer_name || '—' },
          { k: 'Ngày xuất', v: dmy(lsx.ship_date) },
          { k: 'Sản phẩm', v: `${lsx.so_sp} · ${so0(lsx.sl_sp)} cái` },
          { k: 'So với', v: soVoi, tone: t.choSoat ? 'warn' : undefined },
        ]}
      />
      <DaiTab d={d} />
      {d.tab === 'vat_tu' && <TabVatTu d={d} />}
      {d.tab === 'dinh_muc' && <TabDinhMuc d={d} />}
      {d.tab === 'lenh' && <TabLenh d={d} />}
      {d.loi && (
        <ThanhDuoi left={<span className="text-[var(--stop)]">Mốc soát: {d.loi}</span>} />
      )}
      {d.moSoat && <HopSoat d={d} />}
      {d.moLichSu && <HopLichSu d={d} />}
    </Trang>
  )
}

/**
 * Dải tab: mỗi tab một con số nói còn việc gì. Tab không có thay đổi vẫn hiện
 * (nhạt) để người soát biết nguồn đó ĐÃ được xem và không đổi.
 */
function DaiTab({ d }: { d: SoatCtx }) {
  const t = d.thayDoi
  const s = t.suaSauMoc
  const tabs: { k: TabSoat; ten: string; so: string; phu: string; co: boolean }[] = [
    {
      k: 'vat_tu',
      ten: 'Vật tư',
      so: so0(t.dong.length),
      phu: t.dong.length
        ? [d.dem.dat_them && `${d.dem.dat_them} phải đặt thêm`, d.dem.thua && `${d.dem.thua} thừa / dư`].filter(Boolean).join(' · ') || 'đã đủ' // prettier-ignore
        : 'không đổi',
      co: t.dong.length > 0,
    },
    {
      k: 'dinh_muc',
      ten: 'Định mức',
      so: so0(t.dinhMuc.length + (s?.dongDinhMuc ?? 0)),
      phu:
        [t.dinhMuc.length && `${t.dinhMuc.length} dòng cũ → mới`, s && `${so0(s.dongDinhMuc)} chưa có số cũ`].filter(Boolean).join(' · ') || 'không đổi', // prettier-ignore
      co: t.dinhMuc.length > 0 || !!s,
    },
    {
      k: 'lenh',
      ten: 'Lệnh SX',
      so: so0(t.lenh.length),
      phu: tomTatLenh(t.lenh) || 'không đổi',
      co: t.lenh.length > 0,
    },
  ]
  return (
    <div
      role="tablist"
      aria-label="Nguồn thay đổi"
      className="flex shrink-0 border-b border-[var(--line)] bg-[var(--surface-card)]"
    >
      {tabs.map((x) => {
        const on = d.tab === x.k
        return (
          <button
            key={x.k}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => d.setTab(x.k)}
            className={`grid min-w-[170px] gap-0.5 border-r border-b-[3px] border-r-[var(--hair)] px-4 py-2 text-left ${on ? 'border-b-[var(--act)] bg-[var(--act-wash)] text-[var(--act-text)]' : 'border-b-transparent hover:bg-[var(--surface-hover)]'} ${x.co || on ? 'font-semibold' : 'font-medium text-[var(--ink-3)]'}`}
          >
            <span>
              {x.ten} <span className="font-mono">· {x.so}</span>
            </span>
            <span
              className={`text-[11.5px] font-normal whitespace-nowrap ${x.co ? 'text-[var(--warn)]' : 'text-[var(--ink-3)]'}`}
            >
              {x.phu}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** "1 SL · 1 ngày · 1 SP mới" — tóm tắt thay đổi của lệnh cho dải tab. */
function tomTatLenh(ds: SoatCtx['thayDoi']['lenh']): string {
  const dem = (f: (x: (typeof ds)[number]) => boolean) => ds.filter(f).length
  const phan: [number, string][] = [
    [dem((x) => x.phan === 'dau' && x.truong === 'status'), 'huỷ'],
    [dem((x) => x.phan === 'dong' && x.loai === 'sua' && x.truong.includes('qty')), 'SL'],
    [dem((x) => x.phan === 'dau' && (x.truong === 'ship_date' || x.truong === 'materials_due_at')), 'ngày'], // prettier-ignore
    [dem((x) => x.phan === 'dong' && x.loai === 'them'), 'SP mới'],
    [dem((x) => x.phan === 'dong' && x.loai === 'bo'), 'SP bỏ'],
    [
      dem((x) => x.phan === 'dong' && x.loai === 'sua' && x.truong.includes('specs')),
      'quy cách',
    ],
  ]
  return phan
    .filter(([n]) => n > 0)
    .map(([n, t]) => `${n} ${t}`)
    .join(' · ')
}
