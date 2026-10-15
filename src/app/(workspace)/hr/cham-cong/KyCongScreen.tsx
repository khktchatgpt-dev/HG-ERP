'use client'

/**
 * KỲ CÔNG THÁNG — một trang động cho cả quy trình chấm công (bản vẽ vòng 3, chủ dự
 * án duyệt 12/10/2026: "nên là 1 trang dynamic thì vì tách trang trên menu phức
 * tạp"). Menu chỉ có một mục "Chấm công".
 *
 * - Đầu trang: kỳ (‹ tháng ›), trạng thái kỳ, dữ kiện; nút chính ở góc phải ĐỔI
 *   THEO BƯỚC; ⋯ mở phần thiết lập (Máy chấm công, Ca & cách tính).
 * - Thanh 5 bước ngay dưới đầu trang: vừa chỉ kỳ tới đâu, vừa là chỗ bấm đổi nội
 *   dung tại chỗ (`?buoc=` giữ trên URL).
 * - Thiết lập ít dùng mở thành ngăn kéo bên phải, không chiếm một bước.
 */

import { Btn, Empty, Menu, ScreenFrame, ScreenHeader, Tag } from '@/components/kit'
import { cn } from '@/lib/utils'
import { BuocDuLieu } from './buoc-du-lieu'
import { NganMay } from './ngan-may'
import { useKyCong, type KyCongCtx } from './useKyCong'
import {
  doiThang,
  dm,
  thangVn,
  type BuocId,
  type KyCong,
  type TrangThaiBuoc,
} from './ky-cong.shared'
import { so } from './cham-cong.shared'

export function KyCongScreen({ k, buocDau }: { k: KyCong; buocDau: BuocId }) {
  const d = useKyCong(k, buocDau)
  const coDuLieu = k.du.dong.length > 0
  const nguoi = new Set(k.du.dong.filter((r) => r.daGhep).map((r) => r.ma)).size
  const tongLuot = k.du.theoNgay.reduce(
    (s, n) => s + Object.values(n.theoMay).reduce((a, b) => a + b, 0),
    0,
  )
  const mayDay = k.du.may.find(
    (m) => m.luot != null && m.sucChua && m.luot / m.sucChua >= 0.85,
  )

  return (
    <ScreenFrame tableMin={1100}>
      <ScreenHeader
        compact
        eyebrow="Chấm công"
        title={
          <span className="flex items-center gap-1.5">
            <Btn
              icon="truoc"
              aria-label="Kỳ trước"
              onClick={() => d.xemThang(doiThang(k.thang, -1))}
            >
              {''}
            </Btn>
            Kỳ công <span className="num">{thangVn(k.thang)}</span>
            <Btn
              icon="sau"
              aria-label="Kỳ sau"
              onClick={() => d.xemThang(doiThang(k.thang, 1))}
            >
              {''}
            </Btn>
          </span>
        }
        status={coDuLieu ? <Tag tone="warn">Đang xử lý</Tag> : <Tag>Chưa có dữ liệu</Tag>}
        facts={[
          { label: 'Kỳ', value: `${dm(k.tu)} → ${dm(k.den)}` },
          { label: 'Lượt', value: so(tongLuot) },
          { label: 'Người', value: so(nguoi) },
        ]}
        actions={
          <>
            <NutChinh d={d} />
            <Menu
              ariaLabel="Thiết lập chấm công"
              items={[
                {
                  label: mayDay
                    ? `Máy chấm công — ${mayDay.ten} sắp đầy`
                    : 'Máy chấm công',
                  onClick: () => d.setNgan('may'),
                },
                { label: 'Ca & cách tính', why: 'Đang dựng — bước sau' },
              ]}
            />
          </>
        }
      >
        <ThanhBuoc d={d} />
      </ScreenHeader>

      {d.buoc === 'du-lieu' ? <BuocDuLieu d={d} /> : <SapCo d={d} />}

      <NganMay d={d} />
    </ScreenFrame>
  )
}

/** Nút chính góc phải — đổi theo bước. Bước chưa dựng thì không có nút chính. */
function NutChinh({ d }: { d: KyCongCtx }) {
  if (d.buoc === 'du-lieu') {
    return (
      <Btn
        primary
        icon="lamMoi"
        busy={d.dangLay}
        aria-disabled={!!d.loiKhoang}
        onClick={d.layVe}
      >
        {d.dangLay ? 'Đang đọc máy…' : 'Lấy về từ máy'}
      </Btn>
    )
  }
  return null
}

const CHAM: Record<TrangThaiBuoc, string> = {
  xong: 'bg-[var(--done)]',
  'luu-y': 'bg-[var(--warn)]',
  vuong: 'bg-[var(--stop)]',
  chua: 'bg-[var(--line)]',
}

/**
 * Thanh bước: chữ, không hộp đặc (CLAUDE.md nguyên tắc 5 — nền đặc = bấm được,
 * dải bước từng tô `--act` đặc bị chấm "khó phân biệt"). Bước đang mở có nền nhạt
 * + vạch dưới màu hành động; chấm tròn mã hoá tình trạng bước.
 */
function ThanhBuoc({ d }: { d: KyCongCtx }) {
  return (
    <nav aria-label="Các bước của kỳ công" className="-mb-px grid grid-cols-5">
      {d.buocs.map((b, i) => {
        const on = d.buoc === b.id
        return (
          <button
            key={b.id}
            type="button"
            aria-current={on ? 'step' : undefined}
            onClick={() => d.moBuoc(b.id)}
            className={cn(
              'relative grid min-w-0 gap-px border-b-2 px-3 pt-1 pb-1.5 text-left hover:bg-[var(--surface-hover)]',
              on ? 'border-[var(--act)] bg-[var(--act-wash)]' : 'border-transparent',
              i > 0 &&
                'before:absolute before:top-2 before:bottom-2 before:left-0 before:border-l before:border-[var(--line-faint)]/50',
            )}
          >
            <span
              className={cn(
                'text-k-body flex items-center gap-1.5 font-semibold',
                on && 'text-[var(--act-text)]',
              )}
            >
              <span
                aria-hidden
                className={cn('h-2 w-2 shrink-0 rounded-full', CHAM[b.trangThai])}
              />
              <span className="num text-k-label text-[var(--ink-3)]">{b.so}</span>
              {b.ten}
            </span>
            <span className="text-k-label truncate text-[var(--ink-2)]">
              {b.tinhTrang}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

/** Bước chưa dựng — nói thẳng, chỉ đường về bước đã có. */
function SapCo({ d }: { d: KyCongCtx }) {
  const b = d.buocs.find((x) => x.id === d.buoc)!
  return (
    <div className="flex-1 bg-[var(--surface-card)]">
      <Empty
        headline={`Bước ${b.so} · ${b.ten} đang dựng`}
        reason="Chấm công dựng lần lượt từng bước theo bản vẽ đã duyệt; bước này làm ở lượt sau."
        next={<Btn onClick={() => d.moBuoc('du-lieu')}>Về ① Dữ liệu</Btn>}
      />
    </div>
  )
}
