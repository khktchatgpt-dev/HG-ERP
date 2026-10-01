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
import { DangVeScreen } from '@/app/(mua-hang)/mua-hang/theo-doi/DangVeScreen'
import { PhieuNhapScreen } from '@/app/(workspace)/warehouse/nhap/[poId]/PhieuNhapScreen'
import nhanHang from '../_du-lieu/nhan-hang.json'
import daVe from '../_du-lieu/da-ve.json'
import { DaVeScreen } from '@/app/(mua-hang)/mua-hang/theo-doi/da-ve/DaVeScreen'
import duyetDonData from '../_du-lieu/duyet-don.json'
import { ApprovalDetailScreen } from '@/app/(workspace)/exec/ApprovalDetailScreen'

function duyetDon(code: keyof typeof duyetDonData, patch: Record<string, unknown> = {}) {
  const signed = 'status' in patch && patch.status !== 'pending_approval'
  return (
    <ApprovalDetailScreen
      kind="po"
      item={{ ...duyetDonData[code], ...patch } as never}
      nav={
        signed
          ? { index: 0, total: 5, prevHref: null, nextHref: null, sameLsxPending: 0 }
          : { index: 2, total: 5, prevHref: '#', nextHref: '#', sameLsxPending: 1 }
      }
      nowIso="2026-10-01T08:00:00.000Z"
    />
  )
}

/*
  VIỆC SAU CHỮ KÝ (0218) — cùng dữ liệu đóng băng PO-2026-0054, đặt vào từng chỗ
  đơn có thể đứng. Ngày giờ, câu hỏi và lý do gấp dưới đây là DỮ LIỆU MẪU để
  soi giao diện, không phải việc đã xảy ra.
*/
const KY = { approved_by_name: 'Vũ Phương Thảo', approved_at: '2026-10-01T05:55:00.000Z' }
const HOI = {
  id: 'q1',
  kind: 'ask',
  body: 'Nệm mê bank 1 giá 159.000, sao cao gấp 3 nệm ghế xoay? Đã hỏi nơi khác chưa?',
  author_id: 'u',
  author_name: 'Vũ Phương Thảo',
  created_at: '2026-10-01T05:12:00.000Z',
  resolved_at: null,
  resolved_how: null,
  answers: [],
}
const SAU_KY: Record<string, Record<string, unknown>> = {
  'duyet-don-hoi': { status: 'pending_approval', questions: [HOI] },
  'duyet-don-da-ky': { status: 'approved', ...KY, receipt_docs: 0 },
  'duyet-don-da-gui': {
    status: 'ordered',
    ...KY,
    ordered_at: '2026-10-01T06:30:00.000Z',
    adjusted_after_sign: { count: 1, delta: 4_200_000 },
    questions: [
      {
        ...HOI,
        kind: 'review',
        body: 'Đơn tăng 4,2 triệu sau khi ký — vì sao?',
        resolved_at: '2026-10-01T07:40:00.000Z',
        resolved_how: 'answered',
        answers: [
          {
            id: 'a1',
            body: 'NCC báo tăng giá mút từ 01/10, đã đối chiếu báo giá mới.',
            author_name: 'Đặng Thị Thanh Nga',
            created_at: '2026-10-01T07:40:00.000Z',
          },
        ],
      },
    ],
  },
  'duyet-don-gui-gap': {
    status: 'ordered',
    approved_by_name: null,
    approved_at: null,
    ordered_at: '2026-10-01T02:00:00.000Z',
    urgent: {
      at: '2026-10-01T02:00:00.000Z',
      by_name: 'Đặng Thị Thanh Nga',
      reason:
        'Xưởng hết nệm cho tổ bọc, ROSCO đóng cont 05/10 — anh Điền đã đồng ý qua điện thoại 08:30.',
    },
  },
}

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
  /*
    MÀN KÝ ĐƠN MUA của Giám đốc (01/10/2026) — dữ liệu đóng băng 01/10 từ
    `loadPendingPoDetail`: PO-2026-0054 đủ thông tin, ĐH02HGTĐ thiếu điều khoản
    thanh toán + trống người lập + quá hẹn.
  */
  'duyet-don': () => duyetDon('PO-2026-0054'),
  'duyet-don-thieu': () => duyetDon('ĐH02HGTĐ'),
  ...Object.fromEntries(
    Object.entries(SAU_KY).map(([k, patch]) => [
      k,
      () => duyetDon('PO-2026-0054', patch),
    ]),
  ),
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
  /*
    CUNG ỨNG NHẬN HÀNG THAY KHO (01/10/2026, bản vẽ F1 + F2) — dữ liệu đóng băng
    ngày 01/10, người xem = chị Nga (có vai Kho). `nhan-hang-kg` là đơn nhôm
    PO-2026-0077 (cột Kg cân bắt buộc).
  */
  'dang-ve': () => dangVe(null),
  'dang-ve-vua-ghi': () =>
    dangVe({ id: 'x', code: 'PNK-2026-0060', detail: '3 dòng · 127.890 đơn vị' }),
  // Theo dõi đơn hàng › Đã về (bản vẽ G3) — 45 phiếu thật từ 01/09, xem cả phòng.
  'da-ve': () => (
    <DaVeScreen
      rows={daVe.rows as any}
      today={daVe.today}
      truncatedAt={null}
      canWrite
      meId="x"
      defaultScope="phong"
      urlScope="phong"
      giaoNhan={null}
    />
  ),
  'nhan-hang': () => <PhieuNhapScreen {...(nhanHang['PO-2026-0085'] as any)} />,
  'nhan-hang-kg': () => <PhieuNhapScreen {...(nhanHang['PO-2026-0077'] as any)} />,
}

function dangVe(vuaGhi: { id: string; code: string; detail: string } | null) {
  const d = nhanHang.dangVe as any
  return (
    <DangVeScreen
      rows={d.rows}
      today={d.today}
      truncatedAt={null}
      meId={d.meId}
      defaultScope="phong"
      urlScope="phong"
      initialNhom={null}
      trips={[]}
      carriers={[]}
      canTrip
      canReceive
      vuaGhi={vuaGhi}
      giaoNhan={null}
    />
  )
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
  if (m) return <DonChungTuScreen {...(DON_CT[m[1]] as any)} initialMuc={m[2]} />
  /*
    ĐANG SOẠN (30/09/2026) — `don-sua`: đơn chờ duyệt đóng băng đổi về NHÁP, mở
    chế độ sửa; `don-moi`: màn TẠO đơn trống; `don-moi-co-dong`: tạo đơn nhân bản
    từ đơn đó (dòng bỏ id như `?tu=`). Hai chế độ này tự gọi API (nhu cầu lệnh,
    Trao đổi) — trang soi không đăng nhập nên chặn `/api/` trả rỗng, kẻo api()
    ăn 401 rồi đá sang /login.
  */
  const base = DON_CT['cho-duyet'] as any
  if (man === 'don-sua') {
    chanApi()
    return <DonChungTuScreen {...base} mode="edit" po={{ ...base.po, status: 'draft' }} initialMuc="dong-hang" /> // prettier-ignore
  }
  if (man === 'don-moi' || man === 'don-moi-co-dong') {
    chanApi()
    const lines =
      man === 'don-moi' ? [] : base.lines.map((l: any) => ({ ...l, id: undefined }))
    return <DonChungTuScreen {...base} mode="create" po={null} lines={lines} statusLines={[]} warehouseDocs={[]} shipments={[]} adjustments={[]} costs={[]} facts={null} supplier={null} position={null} seed={{ supplierId: base.po.supplier_id, lsxId: base.po.production_order_id }} /> // prettier-ignore
  }
  return null
}

/** Chặn API cho trang soi (không đăng nhập) — trả rỗng đúng dạng các lệnh màn soạn gọi. */
function chanApi() {
  if (typeof window === 'undefined') return
  const w = window as typeof window & { __chupApi?: boolean }
  if (w.__chupApi) return
  const goc = w.fetch.bind(w)
  w.fetch = (input, init) => {
    const u =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!u.includes('/api/')) return goc(input, init)
    const body = u.includes('/needs')
      ? { needs: [] }
      : u.includes('note')
        ? { notes: [] }
        : {}
    return Promise.resolve(new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })) // prettier-ignore
  }
  w.__chupApi = true
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
