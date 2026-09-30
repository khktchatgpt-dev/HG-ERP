'use client'

import { use } from 'react'
import { ApprovalCenterScreen } from '@/app/(workspace)/exec/approvals/ApprovalCenterScreen'
import { GiamSatMuaHangScreen } from '@/app/(workspace)/exec/purchasing/GiamSatMuaHangScreen'
import { DonScreen } from '@/app/(mua-hang)/mua-hang/don/DonScreen'
import { DEFAULT_VIEW } from '@/app/(mua-hang)/mua-hang/don/views'
import hopKy from '../_du-lieu/hop-ky.json'
import giamSat from '../_du-lieu/giam-sat.json'
import donMua from '../_du-lieu/don-mua.json'
import donChiTiet from '../_du-lieu/don-chi-tiet.json'
import { DonChungTuScreen } from '@/app/(mua-hang)/mua-hang/don/[id]/DonChungTuScreen'

/**
 * TRANG CHỤP MÀN — màn THẬT dựng bằng dữ liệu ĐÓNG BĂNG (28/09/2026).
 *
 * Để soi màn thật ở 1280×800 mà không cần đăng nhập: dữ liệu sống đổi hằng
 * ngày, dữ liệu ở `_du-lieu/*.json` là ảnh chụp DB thật ngày 28/09/2026 (script
 * đóng băng ghi ở docs của bước 2). Từng phục vụ bộ so ảnh Playwright — bộ đó
 * đã gỡ 30/09/2026, trang này giữ lại vì vẫn là cách nhanh nhất để nhìn màn và
 * vì `don-chi-tiet.json` là fixture của test phím tắt.
 *
 * Khung 1280×800 ghim cứng: `ScreenFrame` tự đặt cao theo cửa sổ, ở đây ghim
 * theo khung soi.
 */
const TODAY = '2026-09-28'

/* eslint-disable @typescript-eslint/no-explicit-any -- dữ liệu JSON đóng băng */
const MAN: Record<string, () => React.ReactNode> = {
  'hop-ky': () => <ApprovalCenterScreen box={hopKy as any} initialKind="all" />,
  'giam-sat': () => (
    <GiamSatMuaHangScreen
      w={giamSat.w as any}
      names={giamSat.names as any}
      oldestPendingDays={13}
      truncatedAt={null}
    />
  ),
  'don-mua': () => (
    <DonScreen
      today={TODAY}
      pos={donMua.pos as any}
      suppliers={donMua.suppliers}
      lsxs={donMua.lsxs as any}
      meId={donMua.meId}
      canEdit
      truncatedAt={null}
      initial={DEFAULT_VIEW}
      openId={null}
      defaultScope="toi"
      urlScope={null}
      people={donMua.people}
    />
  ),
}

/*
  TRANG CHI TIẾT ĐƠN — `don-ct-<đơn>-<mục>`: props ĐÓNG BĂNG của chính page.tsx
  (script gọi page với người xem = chị Nga), ba đơn ở ba bước vòng đời. Lưới an
  toàn cho việc tách file 4.384 dòng (bước 3): tách xong ảnh phải y hệt.
*/
const DON_CT: Record<string, unknown> = donChiTiet
function donCt(man: string): React.ReactNode | null {
  const m =
    /^don-ct-(da-gui|cho-duyet|ve-du)-(tong-quan|dong-hang|giao-nhan|tai-chinh|trao-doi|lich-su)$/.exec(
      man,
    )
  if (!m) return null
  return <DonChungTuScreen {...(DON_CT[m[1]] as any)} initialMuc={m[2]} />
}

export default function Page({ params }: { params: Promise<{ man: string }> }) {
  const { man } = use(params)
  const ve = MAN[man] ?? (donCt(man) ? () => donCt(man) : undefined)
  return (
    <>
      <style>
        {
          '.chup-khung > div { height: 800px !important; margin: 0 !important; } .lab-bar { display: none !important; }'
        }
      </style>
      <div
        className="kit chup-khung"
        data-chup={man}
        style={{
          width: 1280,
          height: 800,
          display: 'grid',
          gridTemplateRows: 'minmax(0,1fr)',
          overflow: 'hidden',
        }}
      >
        {ve ? ve() : <p>Không có màn “{man}”.</p>}
      </div>
    </>
  )
}
