'use client'

/**
 * HỒ SƠ LƯƠNG — B4, bản vẽ duyệt 18/10/2026 (artifact JHfwCzTe…, Q1–Q7 theo đề xuất).
 * Câu hỏi của màn: "mỗi người được trả theo cách nào, bao nhiêu, đóng BH trên mức nào, nhận
 * tiền vào tài khoản nào — và ai còn thiếu trước khi tính lương kỳ này?".
 *
 * Khuôn C (danh sách) + ngăn hồ sơ một người bên phải. Danh mục CÓ HIỆU LỰC theo kỳ (chép
 * Odoo Contract / SAP infotype 0008): không vòng duyệt, mỗi lần đổi là một bản "từ kỳ X".
 */

import {
  Btn,
  Menu,
  NoticeBar,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  Tag,
} from '@/components/kit'
import { cn } from '@/lib/utils'
import { TEN_CACH_TRA } from '@/lib/luong/ho-so-luong'
import { useHoSoLuong, LOC, type HoSoLuongCtx, type HoSoTrang } from './useHoSoLuong'
import { NganNguoi } from './ngan-nguoi'
import { HopNap } from './hop-nap'
import { HopDonGiaTo, HopPhuCap } from './hop-khac'
import { kyVn, so, TD, TH } from './luong.shared'

const congKy = (t: string, n: number) => {
  const [y, m] = t.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)
}
const R = { textAlign: 'right' as const }

export function HoSoLuongScreen({
  h,
  moNv = null,
}: {
  h: HoSoTrang
  moNv?: string | null
}) {
  const d = useHoSoLuong(h, moNv)
  return (
    <ScreenFrame tableMin={0}>
      <ScreenHeader
        compact
        eyebrow="Nhân sự · Kế toán"
        title={
          <span className="flex items-center gap-1.5">
            Hồ sơ lương
            <Btn
              icon="truoc"
              aria-label="Kỳ trước"
              onClick={() => d.xemKy(congKy(h.thang, -1))}
            >
              {''}
            </Btn>
            <span className="text-k-body font-semibold">áp cho kỳ {kyVn(h.thang)}</span>
            <Btn
              icon="sau"
              aria-label="Kỳ sau"
              onClick={() => d.xemKy(congKy(h.thang, 1))}
            >
              {''}
            </Btn>
          </span>
        }
        facts={[
          { label: 'Đang làm', value: so(h.dong.length) },
          { label: 'Đủ thông tin', value: so(h.dong.length - d.thieuAi) },
          { label: 'Thiếu', value: so(d.thieuAi), tone: d.thieuAi ? 'stop' : undefined },
          ...(h.kyChotCuoi
            ? [{ label: 'Kỳ chốt gần nhất', value: kyVn(h.kyChotCuoi) }]
            : []),
        ]}
        actions={
          <>
            <Btn icon="excel" onClick={() => d.setSheet('nap')}>
              Nạp từ Excel
            </Btn>
            <Btn icon="tien" onClick={() => d.setSheet('to')}>
              Đặt đơn giá cho cả tổ
            </Btn>
            <Menu
              ariaLabel="Thêm tác vụ"
              items={[
                { label: 'Danh mục phụ cấp', onClick: () => d.setSheet('phu_cap') },
              ]}
            />
          </>
        }
      />
      {d.thieuAi > 0 && (
        <NoticeBar
          tone="warn"
          tag="Chưa đủ để tính lương"
          action={{
            label: 'Lọc người còn thiếu',
            onClick: () => d.setLoc('thieu_luong'),
          }}
        >
          {d.thieuAi} người còn thiếu đơn giá / lương tháng, số tài khoản hoặc lương đóng
          BH.
        </NoticeBar>
      )}
      <ThanhLoc d={d} />
      <div className="flex min-h-0 flex-1">
        <Bang d={d} />
        {d.chon && <NganNguoi key={d.chon} d={d} />}
      </div>
      <HopNap d={d} />
      <HopDonGiaTo d={d} />
      <HopPhuCap d={d} />
    </ScreenFrame>
  )
}

function ThanhLoc({ d }: { d: HoSoLuongCtx }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1.5">
      {LOC.map((l) => (
        <button
          key={l.id}
          type="button"
          aria-pressed={d.loc === l.id}
          onClick={() => d.setLoc(l.id)}
          className={cn(
            'text-k-sm border px-2 py-0.5 whitespace-nowrap',
            d.loc === l.id
              ? 'border-[var(--act-line)] bg-[var(--act-wash)] font-semibold text-[var(--act-text)]'
              : 'border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--surface-hover)]',
          )}
        >
          {l.ten}{' '}
          <span
            className={cn(
              'num',
              l.bao && d.dem[l.id] ? 'text-[var(--stop)]' : 'text-[var(--ink-3)]',
            )}
          >
            {d.dem[l.id]}
          </span>
        </button>
      ))}
      <span className="ml-auto">
        <SearchInput
          value={d.tim}
          onChange={d.setTim}
          placeholder="Tìm mã, tên"
          width={180}
          label="Tìm người"
        />
      </span>
    </div>
  )
}

function Bang({ d }: { d: HoSoLuongCtx }) {
  const tongBh = d.ds.reduce((s, x) => s + (x.ban?.luongBh ?? 0), 0)
  const tongPc = d.ds.reduce(
    (s, x) => s + Object.values(x.ban?.phuCap ?? {}).reduce((a, b) => a + b, 0),
    0,
  )
  const theoCong = d.ds.filter((x) => x.ban?.cachTra === 'daily').length
  const theoThang = d.ds.filter((x) => x.ban?.cachTra === 'monthly').length
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-[var(--surface-card)]">
      <table className="text-k-sm w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={TH}>Mã · Họ tên</th>
            <th className={TH}>Tổ</th>
            <th className={TH}>Cách trả</th>
            <th className={TH} style={R}>
              Đơn giá / lương tháng
            </th>
            <th className={TH} style={R}>
              Lương đóng BH
            </th>
            <th className={TH} style={R}>
              Phụ cấp
            </th>
            <th className={TH} style={R}>
              NPT
            </th>
            <th className={TH}>Tài khoản</th>
            <th className={TH}>Hiệu lực từ</th>
          </tr>
        </thead>
        <tbody>
          {d.ds.map((x) => {
            const b = x.ban
            const pc = Object.values(b?.phuCap ?? {}).reduce((a, c) => a + c, 0)
            return (
              <tr
                key={x.employeeId}
                onClick={() => d.chonNguoi(x.employeeId)}
                className={cn(
                  'cursor-pointer hover:bg-[var(--surface-hover)]',
                  d.chon === x.employeeId && 'bg-[var(--act-wash)]',
                )}
              >
                <td className={TD}>
                  <button
                    type="button"
                    className="text-left hover:underline"
                    onClick={() => d.chonNguoi(x.employeeId)}
                  >
                    <span className="num mr-1.5 text-[var(--ink-3)]">{x.ma}</span>
                    {x.ten}
                  </button>
                </td>
                <td className={cn(TD, 'text-[var(--ink-2)]')}>
                  {x.to ?? '(chưa có tổ)'}
                </td>
                <td className={TD}>
                  {b ? (
                    TEN_CACH_TRA[b.cachTra]
                  ) : (
                    <span className="text-[var(--stop)]">chưa có</span>
                  )}
                  {x.khongCham && (
                    <span className="text-k-label ml-1.5 text-[var(--ink-3)]">
                      không chấm công
                    </span>
                  )}
                </td>
                <td
                  className={cn(TD, 'num', x.thieu.luong && 'text-[var(--stop)]')}
                  style={R}
                >
                  {b?.cachTra === 'daily' && b.donGia != null
                    ? `${so(b.donGia)} /công`
                    : b?.cachTra === 'monthly' && b.luongThang != null
                      ? `${so(b.luongThang)} /tháng`
                      : '—'}
                </td>
                <td
                  className={cn(TD, 'num', x.thieu.bh && 'text-[var(--stop)]')}
                  style={R}
                >
                  {b?.luongBh != null
                    ? so(b.luongBh)
                    : b && !b.coBh
                      ? 'không đóng'
                      : b
                        ? 'chưa có'
                        : '—'}
                </td>
                <td className={cn(TD, 'num')} style={R}>
                  {pc ? so(pc) : ''}
                </td>
                <td className={cn(TD, 'num')} style={R}>
                  {b ? b.npt : ''}
                </td>
                <td className={TD}>
                  {x.stkChe ? (
                    <span className="num">
                      {x.nganHang ?? ''} {x.stkChe}
                    </span>
                  ) : (
                    <Tag tone="stop">thiếu STK</Tag>
                  )}
                </td>
                <td className={TD}>
                  {b ? `kỳ ${kyVn(b.tuKy)}` : '—'}
                  {x.doiTuKyNay && (
                    <span className="ml-1.5">
                      <Tag tone="warn">mới</Tag>
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className={cn(TD, 'sticky bottom-0 bg-[var(--surface-raised)]')}>
              {d.ds.length} người
            </td>
            <td className={cn(TD, 'sticky bottom-0 bg-[var(--surface-raised)]')} />
            <td className={cn(TD, 'sticky bottom-0 bg-[var(--surface-raised)]')}>
              {theoCong} theo công · {theoThang} theo tháng
            </td>
            <td className={cn(TD, 'sticky bottom-0 bg-[var(--surface-raised)]')} />
            <td
              className={cn(TD, 'num sticky bottom-0 bg-[var(--surface-raised)]')}
              style={R}
            >
              {so(tongBh)}
            </td>
            <td
              className={cn(TD, 'num sticky bottom-0 bg-[var(--surface-raised)]')}
              style={R}
            >
              {so(tongPc)}
            </td>
            <td className={cn(TD, 'sticky bottom-0 bg-[var(--surface-raised)]')} />
            <td className={cn(TD, 'sticky bottom-0 bg-[var(--surface-raised)]')}>
              {d.ds.filter((x) => x.thieu.stk).length} thiếu STK
            </td>
            <td className={cn(TD, 'sticky bottom-0 bg-[var(--surface-raised)]')} />
          </tr>
          <tr>
            <td
              colSpan={9}
              className={cn(
                TD,
                'sticky bottom-0 bg-[var(--surface-raised)] whitespace-normal text-[var(--ink-3)]',
              )}
            >
              Tổng lương đóng BH là cơ sở trích 21,5 % doanh nghiệp + 10,5 % người lao
              động (trần 50,6 triệu/người từ 01/7/2026). Không gồm tăng ca — tăng ca lấy
              từ bản chốt kỳ công × hệ số ở bảng lương.
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
