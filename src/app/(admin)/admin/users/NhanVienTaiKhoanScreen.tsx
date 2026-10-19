'use client'

/**
 * ADMIN › NHÂN VIÊN & TÀI KHOẢN — bản vẽ duyệt 19/10/2026 (artifact 8tbgx45C…, Q1–Q5 theo
 * đề xuất). Thay trang Người dùng cũ.
 * Câu hỏi của màn: "Công ty có những ai, ai trong số đó dùng ERP, với tài khoản nào — và
 * tài khoản nào không biết là của ai?".
 *
 * Nhân viên (Nhân sự quản) là gốc, mỗi người một dòng dù có tài khoản hay không; tài khoản
 * ERP gắn vào (0247). Admin không thêm nhân viên — chỉ cấp, gắn, khoá tài khoản.
 */

import {
  Btn,
  NoticeBar,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  Tag,
  Tick,
} from '@/components/kit'
import { cn } from '@/lib/utils'
import {
  demLoc,
  LOC,
  TEN_LOC,
  type DongNvTk,
  type TkGoc,
} from '@/lib/nhan-vien-tai-khoan'
import { useNhanVienTaiKhoan, type NvTkCtx, type TrangNvTk } from './useNhanVienTaiKhoan'
import { HopCap, HopGan, HopGoiY, HopTaoChung } from './hop-cap'
import { HopTaiKhoan } from './hop-tai-khoan'
import { ngayVn, ROLE_LABEL, TD, TH } from './nv-tk.shared'

export function NhanVienTaiKhoanScreen({ h }: { h: TrangNvTk }) {
  const d = useNhanVienTaiKhoan(h)
  const dangLam = h.dong.filter((x) => x.kieu === 'nv' && x.nv.dangLam).length
  // Ô đầu trang đếm bằng ĐÚNG hàm chip (không bật hiện hết) — cùng tên thì cùng số.
  const goc = demLoc(h.dong, false)
  return (
    <ScreenFrame tableMin={0}>
      <ScreenHeader
        compact
        eyebrow="Admin"
        title="Nhân viên & tài khoản"
        facts={[
          { label: 'Nhân viên đang làm', value: String(dangLam) },
          { label: 'Có tài khoản', value: String(goc.co_tk) },
          { label: 'Tài khoản dùng chung', value: String(goc.dung_chung) },
          {
            label: 'Tài khoản chưa gắn người',
            value: String(goc.chua_gan),
            tone: goc.chua_gan ? 'warn' : undefined,
          },
        ]}
        actions={
          <>
            {h.goiY.length > 0 && (
              <Btn onClick={() => d.setHop({ kieu: 'goi_y' })}>
                Gắn theo họ tên ({h.goiY.length})
              </Btn>
            )}
            <Btn icon="them" onClick={() => d.setHop({ kieu: 'tao_chung' })}>
              Tạo tài khoản dùng chung
            </Btn>
          </>
        }
      />
      {d.dem.nghi_con_tk > 0 && (
        <NoticeBar
          tone="stop"
          tag="Người đã nghỉ còn đăng nhập được"
          action={{ label: 'Lọc', onClick: () => d.setLoc('nghi_con_tk') }}
        >
          {d.dem.nghi_con_tk} tài khoản của nhân viên đã nghỉ việc vẫn mở — khoá ngay.
        </NoticeBar>
      )}
      {d.dem.chua_gan > 0 && (
        <NoticeBar
          tone="warn"
          tag="Cần gắn"
          action={{
            label: `Lọc ${d.dem.chua_gan} tài khoản`,
            onClick: () => d.setLoc('chua_gan'),
          }}
        >
          {d.dem.chua_gan} tài khoản cá nhân chưa biết là của nhân viên nào — gắn, hoặc
          nhờ Nhân sự thêm người đó vào danh sách.
        </NoticeBar>
      )}
      <ThanhLoc d={d} />
      <Bang d={d} />
      <HopCap d={d} />
      <HopGan d={d} />
      <HopTaoChung d={d} />
      <HopGoiY d={d} />
      <HopTaiKhoan d={d} />
    </ScreenFrame>
  )
}

function ThanhLoc({ d }: { d: NvTkCtx }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1.5">
      {LOC.map((l) => {
        const bao = (l === 'chua_gan' || l === 'nghi_con_tk') && d.dem[l] > 0
        return (
          <button
            key={l}
            type="button"
            aria-pressed={d.loc === l}
            onClick={() => d.setLoc(l)}
            className={cn(
              'text-k-sm border px-2 py-0.5 whitespace-nowrap',
              d.loc === l
                ? 'border-[var(--act-line)] bg-[var(--act-wash)] font-semibold text-[var(--act-text)]'
                : 'border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--surface-hover)]',
            )}
          >
            {TEN_LOC[l]}{' '}
            <span
              className={cn('num', bao ? 'text-[var(--stop)]' : 'text-[var(--ink-3)]')}
            >
              {d.dem[l]}
            </span>
          </button>
        )
      })}
      <span className="ml-auto flex items-center gap-3">
        <span className="text-k-sm flex items-center gap-1.5 text-[var(--ink-2)]">
          <Tick
            checked={d.hienHet}
            onChange={d.setHienHet}
            label="Hiện người đã nghỉ và tài khoản đã xoá"
          />
          Hiện đã nghỉ & đã xoá
        </span>
        <SearchInput
          value={d.tim}
          onChange={d.setTim}
          placeholder="Tìm mã, tên, email"
          width={200}
          label="Tìm người hoặc tài khoản"
        />
      </span>
    </div>
  )
}

const NHOM: Record<'chua_gan' | 'dung_chung', string> = {
  chua_gan: 'Tài khoản chưa gắn người',
  dung_chung: 'Dùng chung',
}

function Bang({ d }: { d: NvTkCtx }) {
  const soNhom = (k: DongNvTk['kieu']) => d.ds.filter((x) => x.kieu === k).length
  const soNv = soNhom('nv')
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-[var(--surface-card)]">
      <table className="text-k-sm w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={TH}>Mã · Họ tên</th>
            <th className={TH}>Tổ (Nhân sự)</th>
            <th className={TH}>Tài khoản</th>
            <th className={TH}>Vai trò · Phòng</th>
            <th className={TH}>Đăng nhập cuối</th>
            <th className={TH} />
          </tr>
        </thead>
        <tbody>
          {d.ds.map((x, i) => {
            const dauNhom =
              x.kieu !== 'nv' && (i === 0 || d.ds[i - 1].kieu !== x.kieu) ? x.kieu : null
            return [
              dauNhom && (
                <tr key={`nhom-${dauNhom}`}>
                  <td
                    colSpan={6}
                    className="text-k-label border-b border-[var(--line)] bg-[var(--surface-raised)] px-2.5 py-1 font-semibold text-[var(--ink-2)]"
                  >
                    {NHOM[dauNhom]} · {soNhom(dauNhom)}
                  </td>
                </tr>
              ),
              <Dong key={x.kieu === 'nv' ? x.nv.id : x.tk.id} d={d} x={x} />,
            ]
          })}
        </tbody>
        <tfoot>
          <tr>
            <td
              colSpan={6}
              className={cn(
                TD,
                'sticky bottom-0 bg-[var(--surface-raised)] whitespace-normal text-[var(--ink-3)]',
              )}
            >
              {soNv} nhân viên · {soNhom('chua_gan')} tài khoản chưa gắn người ·{' '}
              {soNhom('dung_chung')} tài khoản dùng chung.{' '}
              {d.hienHet
                ? 'Đang hiện cả người đã nghỉ và tài khoản đã xoá.'
                : 'Người đã nghỉ việc và tài khoản rời đã khoá/xoá ẩn mặc định.'}{' '}
              Thêm hoặc sửa nhân viên ở Nhân sự › Hồ sơ nhân viên.
            </td>
          </tr>
        </tfoot>
      </table>
      {d.ds.length === 0 && (
        <p className="text-k-sm px-[var(--gutter)] py-6 text-[var(--ink-3)]">
          Không có dòng nào khớp bộ lọc — chọn &quot;Tất cả&quot; hoặc xoá ô tìm.
        </p>
      )}
    </div>
  )
}

function TrangThaiTk({ tk }: { tk: TkGoc }) {
  if (tk.xoaLuc) return <Tag tone="neutral">đã xoá</Tag>
  if (!tk.dangMo) return <Tag tone="stop">đã khoá</Tag>
  if (tk.doiMk) return <Tag tone="warn">chưa đổi MK tạm</Tag>
  return null
}

function Dong({ d, x }: { d: NvTkCtx; x: DongNvTk }) {
  const tk = x.tk
  const nv = x.kieu === 'nv' ? x.nv : null
  const mo = () =>
    tk
      ? d.setHop({ kieu: 'tk', tk, nv })
      : nv && nv.dangLam && d.setHop({ kieu: 'cap', nv })
  return (
    <tr
      onClick={mo}
      className={cn(
        'cursor-pointer hover:bg-[var(--surface-hover)]',
        nv && !nv.dangLam && 'text-[var(--ink-3)]',
      )}
    >
      <td className={TD}>
        {nv ? (
          <>
            <span className="num mr-1.5 text-[var(--ink-3)]">{nv.ma}</span>
            {nv.ten}
            {!nv.dangLam && (
              <span className="ml-1.5">
                <Tag tone="neutral">đã nghỉ</Tag>
              </span>
            )}
          </>
        ) : x.kieu === 'dung_chung' ? (
          <>
            <span className="mr-1.5">
              <Tag tone="run">dùng chung</Tag>
            </span>
            {tk!.ten ?? tk!.email}
          </>
        ) : (
          <>
            <span className="mr-1.5">
              <Tag tone="warn">chưa gắn</Tag>
            </span>
            {tk!.ten ?? tk!.email}
          </>
        )}
      </td>
      <td className={cn(TD, 'text-[var(--ink-2)]')}>
        {nv ? (
          (nv.to ?? '(chưa có tổ)')
        ) : x.kieu === 'dung_chung' ? (
          tk!.nguoiCam ? (
            `${tk!.nguoiCam} đang cầm`
          ) : (
            <span className="text-[var(--warn)]">chưa ghi ai cầm</span>
          )
        ) : (
          <span className="text-[var(--ink-3)]">không có trong danh sách Nhân sự</span>
        )}
      </td>
      <td className={TD}>
        {tk ? (
          <span className="flex items-center gap-1.5">
            <span className={cn('num', tk.xoaLuc && 'line-through')}>{tk.email}</span>
            <TrangThaiTk tk={tk} />
          </span>
        ) : (
          <span className="text-[var(--ink-3)]">— chưa có</span>
        )}
      </td>
      <td className={cn(TD, 'text-[var(--ink-2)]')}>
        {tk ? `${ROLE_LABEL[tk.role] ?? tk.role} · ${d.tenPhong(tk.phongId)}` : ''}
      </td>
      <td className={cn(TD, 'num text-[var(--ink-2)]')}>
        {tk ? ngayVn(tk.dangNhap) : ''}
      </td>
      <td className={cn(TD, 'text-right')} onClick={(e) => e.stopPropagation()}>
        {x.kieu === 'chua_gan' && !tk!.xoaLuc && (
          <Btn onClick={() => d.setHop({ kieu: 'gan', tk: tk! })}>
            Gắn nhân viên
          </Btn>
        )}{' '}
        {tk ? (
          <Btn onClick={mo}>
            Sửa
          </Btn>
        ) : (
          nv?.dangLam && (
            <Btn primary onClick={mo}>
              Cấp tài khoản
            </Btn>
          )
        )}
      </td>
    </tr>
  )
}
