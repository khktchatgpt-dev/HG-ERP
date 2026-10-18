'use client'

/**
 * KỲ CÔNG — B3, bản vẽ duyệt 18/10/2026 (artifact LKGE5vJ9…, Q1–Q7 theo đề xuất).
 * Câu hỏi của màn: "công kỳ này đã đủ, đúng và khoá để Kế toán tính lương chưa — nếu chưa
 * thì vướng ở tổ nào?".
 *
 * Khuôn D (chứng từ): dải vòng đời + người giữ bóng + điều kiện chốt + dòng thời gian. Chép
 * SAP payroll control record (khoá kỳ, mở lại có kiểm soát) và Dynamics "Calculate → Approve
 * → Transfer" (xác nhận theo nhóm trước khi chuyển sang lương).
 */

import {
  Btn,
  DocMenu,
  DocMenuPanel,
  HolderBar,
  Menu,
  NoticeBar,
  ScreenFrame,
  ScreenHeader,
  StatusTrack,
  Tag,
} from '@/components/kit'
import { cn } from '@/lib/utils'
import { TEN_TRANG_THAI } from '@/lib/cham-cong/ky-cong'
import { useKyCong, type KyCongCtx, type KyCongTrang, type MucKy } from './useKyCong'
import { NganTo } from './ngan-to'
import { NganNguoi, NganThoiGian } from './ngan-nguoi-tl'
import { HopChot, HopQuyet, HopXacNhan, HopXin } from './hop-ky'
import { lucVn, so } from './ky.shared'

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const congKy = (t: string, n: number) => {
  const [y, m] = t.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)
}
const ngayTu = (tu: string, den: string) =>
  Math.max(0, Math.round((Date.parse(den) - Date.parse(tu)) / 86400_000))

export function KyCongScreen({ k, muc }: { k: KyCongTrang; muc: MucKy }) {
  const d = useKyCong(k, muc)
  const thieu = k.nguoi.reduce((s, n) => s + n.thieu, 0)
  const tone =
    k.trangThai === 'open' ? 'warn' : k.trangThai === 'closed' ? 'done' : 'warn'
  return (
    <ScreenFrame tableMin={0}>
      <ScreenHeader
        compact
        eyebrow="Chấm công · Kỳ công"
        title={
          <span className="flex items-center gap-1.5">
            <Btn
              icon="truoc"
              aria-label="Kỳ trước"
              onClick={() => d.di(congKy(k.thang, -1))}
            >
              {''}
            </Btn>
            Kỳ {k.thang.slice(5)}/{k.thang.slice(0, 4)}
            <Btn icon="sau" aria-label="Kỳ sau" onClick={() => d.di(congKy(k.thang, 1))}>
              {''}
            </Btn>
          </span>
        }
        status={
          k.ngoaiErp ? (
            <Tag>Ngoài ERP</Tag>
          ) : (
            <Tag tone={tone}>{TEN_TRANG_THAI[k.trangThai]}</Tag>
          )
        }
        facts={[
          { label: '', value: `${dm(k.tu)} → ${dm(k.den)}/${k.den.slice(0, 4)}` },
          { label: 'Dữ liệu máy tới', value: k.ngayLay ? dm(k.ngayLay) : '—' },
          { label: 'Người', value: so(k.nguoi.length) },
          ...(k.trangThai === 'open'
            ? [
                {
                  label: 'Thiếu lượt',
                  value: so(thieu),
                  tone: thieu ? ('stop' as const) : undefined,
                },
              ]
            : [
                {
                  label: 'Chốt',
                  value: `lần ${k.ky?.lanChot} · ${lucVn(k.ky?.chotLuc ?? null)} · ${k.ky?.nguoiChot ?? '—'}`,
                },
              ]),
          {
            label: 'Công',
            value: so(Math.round(k.nguoi.reduce((s, n) => s + n.cong, 0) * 100) / 100, 2),
          },
          { label: 'Cách tính', value: k.ban ? `Bản ${k.ban}` : 'mặc định' },
        ]}
        actions={<HanhDong d={d} />}
      />
      {!k.ngoaiErp && (
        <div className="flex flex-wrap items-center gap-x-6 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1">
          <StatusTrack
            label="Vòng đời kỳ công"
            steps={['Đang mở', 'Đã chốt', 'Đã tính lương', 'Đã trả']}
            at={k.trangThai === 'open' ? 0 : 1}
            tone={
              k.trangThai === 'reopen_requested'
                ? 'wait'
                : k.trangThai === 'closed'
                  ? 'done'
                  : 'run'
            }
          />
          <NguoiGiu d={d} />
        </div>
      )}
      <DaiDieuKien d={d} />
      <ThanhBao d={d} />
      <DocMenu
        label="Nội dung kỳ công"
        value={d.muc}
        onValueChange={(v) => d.setMuc(v as MucKy)}
        items={[
          {
            id: 'theo-to',
            label: 'Theo tổ',
            icon: 'cot',
            signal: {
              text: `${k.to.filter((t) => t.xacNhan).length}/${k.to.length} xác nhận`,
            },
          },
          {
            id: 'theo-nguoi',
            label: 'Theo người',
            icon: 'so',
            signal: { text: so(k.nguoi.length) },
          },
          { id: 'dong-thoi-gian', label: 'Dòng thời gian', icon: 'lichSu' },
        ]}
      >
        <DocMenuPanel value="theo-to">
          <NganTo d={d} />
        </DocMenuPanel>
        <DocMenuPanel value="theo-nguoi">
          <NganNguoi d={d} />
        </DocMenuPanel>
        <DocMenuPanel value="dong-thoi-gian">
          <NganThoiGian d={d} />
        </DocMenuPanel>
      </DocMenu>
      <HopChot d={d} />
      <HopXacNhan
        key={d.sheet && typeof d.sheet === 'object' ? d.sheet.xacNhan : '-'}
        d={d}
      />
      <HopXin d={d} />
      <HopQuyet d={d} />
    </ScreenFrame>
  )
}

function NguoiGiu({ d }: { d: KyCongCtx }) {
  const { k } = d
  const chua = k.to.filter((t) => !t.xacNhan).length
  const thieu = k.nguoi.reduce((s, n) => s + n.thieu, 0)
  if (k.trangThai === 'closed')
    return (
      <HolderBar
        inline
        who="Tài Chính Kế Toán"
        what="tính lương kỳ này (bảng lương — bước sau)"
        age={
          k.ky?.chotLuc
            ? `${ngayTu(k.ky.chotLuc.slice(0, 10), k.homNay)} ngày`
            : undefined
        }
      />
    )
  if (k.trangThai === 'reopen_requested')
    return (
      <HolderBar
        inline
        who="Ban Giám Đốc"
        what="duyệt hoặc từ chối yêu cầu mở lại"
        age={
          k.ky?.xinLuc ? `${ngayTu(k.ky.xinLuc.slice(0, 10), k.homNay)} ngày` : undefined
        }
      />
    )
  return (
    <HolderBar
      inline
      who="Hành Chính Nhân Sự"
      what={
        [
          thieu ? `xử lý ${so(thieu)} ngày thiếu lượt` : '',
          chua ? `thu phiếu xác nhận của ${chua} tổ` : '',
          k.chuaCoTo ? `gán tổ cho ${k.chuaCoTo} người` : '',
        ]
          .filter(Boolean)
          .join(', ') || 'chốt kỳ'
      }
      age={`${ngayTu(k.tu, k.homNay)} ngày từ đầu kỳ`}
    />
  )
}

/** Năm ô điều kiện chốt — chỉ khi kỳ còn mở. Ô đỏ = còn chặn. */
function DaiDieuKien({ d }: { d: KyCongCtx }) {
  const { k } = d
  if (!d.mo) return null
  return (
    <div className="grid grid-cols-5 border-b border-[var(--line)] bg-[var(--surface-card)]">
      {k.dieuKien.map((x) => (
        <div
          key={x.ma}
          className="text-k-sm border-r border-[var(--line-faint)] px-[var(--gutter)] py-1.5 last:border-r-0"
        >
          <span className="text-[var(--ink-2)]">{x.ten}</span>
          <b
            className={cn(
              'text-k-body num block font-semibold',
              x.ok ? 'text-[var(--done)]' : 'text-[var(--stop)]',
            )}
          >
            {x.ok ? '✓ ' : ''}
            {x.chiTiet}
          </b>
        </div>
      ))}
    </div>
  )
}

function ThanhBao({ d }: { d: KyCongCtx }) {
  const { k } = d
  if (k.ngoaiErp)
    return (
      <NoticeBar tone="neutral" tag="Ngoài ERP">
        Kỳ này đã trả lương ngoài ERP — kỳ công trong ERP bắt đầu từ kỳ 10/2026. Số dưới
        đây chỉ để xem.
      </NoticeBar>
    )
  if (k.trangThai === 'reopen_requested')
    return (
      <NoticeBar tone="warn" tag="Chờ mở lại">
        {k.ky?.xinBoi ?? '—'} xin mở lại lúc {lucVn(k.ky?.xinLuc ?? null)}: “
        {k.ky?.xinLyDo}”. Kỳ vẫn khoá tới khi Giám đốc duyệt.
      </NoticeBar>
    )
  if (k.trangThai === 'closed')
    return (
      <NoticeBar tone="neutral" tag="Đã chốt">
        Số dưới đây là bản chốt lần {k.ky?.lanChot}. Phiếu điều chỉnh, tick làm trưa cho
        ngày {dm(k.tu)} → {dm(k.den)} đều bị khoá; muốn sửa thì xin mở lại.
      </NoticeBar>
    )
  if (d.chuaChot.length)
    return (
      <NoticeBar
        tone="warn"
        tag="Chưa chốt được"
        action={
          d.chuaChot.some((x) => x.ma === 'xac_nhan' || x.ma === 'chua_co_to')
            ? { label: 'Tới tổ còn vướng', onClick: () => d.setMuc('theo-to') }
            : undefined
        }
      >
        {d.chuaChot.map((x) => `${x.ten.toLowerCase()}: ${x.chiTiet}`).join(' · ')}.
      </NoticeBar>
    )
  return null
}

function HanhDong({ d }: { d: KyCongCtx }) {
  const { k } = d
  const excel = (to?: string) =>
    `/api/dept/hr/cham-cong/ky/${k.thang}/excel${to ? `?to=${encodeURIComponent(to)}` : ''}`
  const xuat = (
    <Btn icon="excel" href={excel()}>
      Xuất Excel{k.trangThai === 'open' ? '' : ' cho Kế toán'}
    </Btn>
  )
  if (k.ngoaiErp) return xuat
  if (k.trangThai === 'open')
    return (
      <>
        {xuat}
        <Btn
          primary
          icon="khoa"
          blockedBy={k.quyen.chot ? undefined : 'Trưởng phòng Hành Chính Nhân Sự'}
          aria-disabled={d.chuaChot.length > 0}
          onClick={() => (d.chuaChot.length ? d.setMuc('theo-to') : d.setSheet('chot'))}
        >
          Chốt kỳ
        </Btn>
      </>
    )
  if (k.trangThai === 'closed')
    return (
      <>
        {xuat}
        <Menu
          ariaLabel="Thêm tác vụ"
          items={[
            {
              label: 'Xin mở lại kỳ',
              onClick: () => d.setSheet('xin'),
              blockedBy: k.quyen.xinMo ? undefined : 'Hành Chính Nhân Sự',
            },
          ]}
        />
      </>
    )
  return (
    <>
      {xuat}
      {k.quyen.duyetMo && (
        <Btn primary icon="duyet" onClick={() => d.setSheet('quyet')}>
          Duyệt / từ chối mở lại
        </Btn>
      )}
      <Menu
        ariaLabel="Thêm tác vụ"
        items={[{ label: 'Rút yêu cầu mở lại', onClick: d.rutXin }]}
      />
    </>
  )
}
