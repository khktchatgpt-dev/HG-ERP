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
import { KhoiCongThem } from './ngan-cong-them'
import { HopChot, HopQuyet, HopXacNhan, HopXin } from './hop-ky'
import { HopKhoang } from './hop-khoang-ky'
import { soNgay } from '@/lib/cham-cong/khoang-ky'
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
          {
            label: '',
            value: (
              <span className="inline-flex items-baseline gap-2">
                {dm(k.tu)} → {dm(k.den)}/{k.den.slice(0, 4)}
                <span className="font-normal text-[var(--ink-3)]">
                  · {soNgay(k.tu, k.den)} ngày{k.khoangDaDat ? '' : ' · gợi ý'}
                </span>
                {k.quyen.datKhoang && !k.ngoaiErp && (
                  <button
                    type="button"
                    onClick={() => d.setSheet('khoang')}
                    className="font-sans font-normal text-[var(--act-text)] underline underline-offset-2 hover:text-[var(--act)]"
                  >
                    {k.trangThai === 'open' ? 'Đổi khoảng kỳ' : 'Khoảng kỳ đã khoá'}
                  </button>
                )}
              </span>
            ),
          },
          { label: 'Dữ liệu máy tới', value: k.ngayLay ? dm(k.ngayLay) : '—' },
          {
            label: 'Người trong kỳ',
            value: `${so(k.nguoi.length)}${k.nghiGiuaKy ? ` · ${k.nghiGiuaKy} nghỉ giữa kỳ` : ''}`,
          },
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
            at={
              k.bangLuong === 'paid'
                ? 3
                : k.bangLuong === 'approved'
                  ? 2
                  : k.trangThai === 'open'
                    ? 0
                    : 1
            }
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
          {
            id: 'nhap-tay',
            label: 'Công cộng thêm',
            icon: 'sua',
            signal: k.congThem.length ? { text: so(k.congThem.length) } : undefined,
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
        <DocMenuPanel value="nhap-tay">
          <div className="flex min-h-0 flex-col overflow-auto">
            <KhoiCongThem d={d} />
          </div>
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
      <HopKhoang d={d} />
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
        what="kiểm tra bảng lương hệ thống đã tính, rồi gửi Kế toán trưởng duyệt"
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
        who="Kế toán trưởng"
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
      what={viecTiep([
        thieu ? `xử lý ${so(thieu)} ngày thiếu lượt` : '',
        chua ? `thu phiếu xác nhận của ${chua} tổ` : '',
        k.chuaCoTo ? `gán tổ cho ${k.chuaCoTo} người` : '',
      ])}
      age={`${ngayTu(k.tu, k.homNay)} ngày từ đầu kỳ`}
    />
  )
}

/** Việc đầu tiên còn lại + "và N việc nữa" — dải người giữ việc chỉ một dòng (22/10/2026). */
function viecTiep(ds: string[]): string {
  const con = ds.filter(Boolean)
  if (!con.length) return 'chốt kỳ'
  return con.length === 1 ? con[0] : `${con[0]} và ${con.length - 1} việc nữa`
}

/**
 * Ô điều kiện chốt — chỉ khi kỳ còn mở. Mỗi ô hai dòng gọn (tên · chi tiết cắt bớt, đủ chữ ở
 * tooltip); ô còn chặn BẤM ĐƯỢC tới đúng chỗ gỡ. Thay cho dải "Chưa chốt được" trước đây nói
 * lại y hệt các ô này (22/10/2026: đầu trang chiếm 53 % màn hình).
 */
function DaiDieuKien({ d }: { d: KyCongCtx }) {
  const { k } = d
  if (!d.mo) return null
  const toi = (ma: string): (() => void) | string | null =>
    ma === 'xac_nhan' || ma === 'chua_co_to'
      ? () => d.setMuc('theo-to')
      : ma === 'cho_duyet'
          ? '/hr/cham-cong/dieu-chinh'
          : ma === 'may'
            ? `/hr/cham-cong/lay-du-lieu?thang=${k.thang}`
            : null
  return (
    <div
      className="grid border-b border-[var(--line)] bg-[var(--surface-card)]"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(170px, 1fr))` }}
    >
      {k.dieuKien.map((x) => {
        const di = x.ok ? null : toi(x.ma)
        const noiDung = (
          <>
            <span className="block truncate text-[var(--ink-2)]">
              <span
                aria-hidden
                className={x.ok ? 'text-[var(--done)]' : 'text-[var(--stop)]'}
              >
                {x.ok ? '✓' : '●'}
              </span>{' '}
              {x.ten}
            </span>
            <b
              className={cn(
                'num block truncate font-semibold',
                x.ok ? 'text-[var(--ink-2)]' : 'text-[var(--stop)]',
                di && 'underline decoration-dotted underline-offset-2',
              )}
            >
              {x.chiTiet}
            </b>
          </>
        )
        const lop =
          'text-k-sm min-w-0 border-r border-[var(--line-faint)] px-[var(--gutter)] py-1 text-left last:border-r-0'
        if (typeof di === 'function')
          return (
            <button
              key={x.ma}
              type="button"
              title={`${x.ten}: ${x.chiTiet} — bấm để tới chỗ gỡ`}
              onClick={di}
              className={cn(lop, 'hover:bg-[var(--surface-hover)]')}
            >
              {noiDung}
            </button>
          )
        if (typeof di === 'string')
          return (
            <a
              key={x.ma}
              href={di}
              title={`${x.ten}: ${x.chiTiet} — bấm để tới chỗ gỡ`}
              className={cn(lop, 'hover:bg-[var(--surface-hover)]')}
            >
              {noiDung}
            </a>
          )
        return (
          <div key={x.ma} title={`${x.ten}: ${x.chiTiet}`} className={lop}>
            {noiDung}
          </div>
        )
      })}
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
        {k.ky?.xinLyDo}”. Kỳ vẫn khoá tới khi Kế toán trưởng duyệt.
      </NoticeBar>
    )
  if (k.trangThai === 'closed')
    return (
      <NoticeBar tone="neutral" tag="Đã chốt">
        Số dưới đây là bản chốt lần {k.ky?.lanChot}. Phiếu điều chỉnh, tick làm trưa cho
        ngày {dm(k.tu)} → {dm(k.den)} đều bị khoá; muốn sửa thì xin mở lại.
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
          onClick={() => (!d.chuaChot.length ? d.setSheet('chot') : d.setMuc('theo-to'))}
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
