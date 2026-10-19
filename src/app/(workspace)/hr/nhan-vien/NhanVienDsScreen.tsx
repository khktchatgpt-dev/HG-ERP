'use client'

/**
 * NHÂN SỰ › HỒ SƠ NHÂN VIÊN — danh sách (B2a, bản vẽ lượt 2 duyệt 19/10/2026, Q1–Q6 theo
 * đề xuất). Khuôn C. Câu hỏi: "Trong 152 người, ai cần tôi động vào?".
 *
 * Cột là thông tin về NGƯỜI. Việc dọn mã máy (tên lấy từ máy, ca mặc định, mã chưa ghép)
 * đã dời sang Chấm công › Mã trên máy & ca. Bấm dòng mở trang hồ sơ riêng (Q1); không còn ô
 * sửa trên dòng — đổi cho nhiều người thì chọn rồi dùng thanh xanh.
 */

import { useState } from 'react'
import { Btn, Pick, ScreenFrame, ScreenHeader, SearchInput, Tick } from '@/components/kit'
import { cn } from '@/lib/utils'
import { ngayVn } from '@/lib/nhan-su/bien-dong'
import { conThieu, LOC_NV, SO_MUC_HO_SO, thamNien } from '@/lib/nhan-su/ho-so'
import { useNhanVienDs, type DsCtx, type TrangDs } from './useNhanVienDs'
import { Avatar, TagTinhTrang, TD, TH } from './nv.shared'
import { HopTuyen } from './hop-tuyen'

export function NhanVienDsScreen({ h }: { h: TrangDs }) {
  const d = useNhanVienDs(h)
  return (
    <ScreenFrame tableMin={0}>
      <ScreenHeader
        compact
        eyebrow="Nhân sự"
        title="Hồ sơ nhân viên"
        facts={[
          { label: 'Đang làm', value: String(d.dem.dang_lam) },
          { label: 'Mới vào 30 ngày', value: String(d.dem.moi_vao) },
          { label: 'Có ngày nghỉ', value: String(d.dem.co_ngay_nghi) },
        ]}
        actions={
          <Btn
            primary
            icon="them"
            blockedBy={h.sua ? undefined : 'Phòng Nhân sự'}
            onClick={() => d.setMoTuyen(true)}
          >
            Tuyển vào
          </Btn>
        }
      />
      <ThanhLoc d={d} />
      {d.chon.size > 0 && <ThanhChon d={d} />}
      <Bang d={d} />
      {d.moTuyen && <HopTuyen d={d} />}
    </ScreenFrame>
  )
}

function ThanhLoc({ d }: { d: DsCtx }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1.5">
      {LOC_NV.map((l) => {
        const bao = 'bao' in l && l.bao && d.dem[l.id] > 0
        return (
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
              className={cn('num', bao ? 'text-[var(--warn)]' : 'text-[var(--ink-3)]')}
            >
              {d.dem[l.id]}
            </span>
          </button>
        )
      })}
      <span className="ml-auto flex items-center gap-2">
        <Pick
          label="Tổ"
          width={190}
          value={d.to}
          onChange={d.setTo}
          options={[
            { value: '', label: 'Mọi tổ' },
            { value: '__trong', label: '(chưa có tổ)' },
            ...d.h.nv.boPhan.map((b) => ({ value: b, label: b })),
          ]}
        />
        <SearchInput
          value={d.tim}
          onChange={d.setTim}
          placeholder="Mã, tên, tổ, chức danh"
          width={200}
          label="Tìm nhân viên"
        />
      </span>
    </div>
  )
}

/** Thanh xanh khi chọn nhiều: đổi tổ / ca thường làm một lần. */
function ThanhChon({ d }: { d: DsCtx }) {
  const [to, setTo] = useState('')
  const [ca, setCa] = useState('')
  return (
    <div className="text-k-sm flex flex-wrap items-center gap-2 border-b border-[var(--act-line)] bg-[var(--act-wash)] px-[var(--gutter)] py-1.5 text-[var(--act-text)]">
      <b>{d.chon.size} người đã chọn</b>
      <Pick
        label="Đổi tổ"
        width={180}
        value={to}
        onChange={setTo}
        options={[
          { value: '', label: 'Đổi tổ…' },
          ...d.h.nv.boPhan.map((b) => ({ value: b, label: b })),
        ]}
      />
      <Btn
        disabled={!to}
        busy={d.busy}
        blockedBy={d.h.sua ? undefined : 'Phòng Nhân sự'}
        onClick={async () => {
          if (await d.hangLoat({ team: to })) setTo('')
        }}
      >
        Đổi tổ
      </Btn>
      <Pick
        label="Đổi ca thường làm"
        width={180}
        value={ca}
        onChange={setCa}
        options={[
          { value: '', label: 'Đổi ca…' },
          ...d.h.nv.cas.map((c) => ({ value: c.id, label: `${c.ten} ${c.gio}` })),
        ]}
      />
      <Btn
        disabled={!ca}
        busy={d.busy}
        blockedBy={d.h.sua ? undefined : 'Phòng Nhân sự'}
        onClick={async () => {
          if (await d.hangLoat({ shift_id: ca })) setCa('')
        }}
      >
        Đổi ca
      </Btn>
      <span className="ml-auto">
        <Btn onClick={d.boChon}>Bỏ chọn</Btn>
      </span>
    </div>
  )
}

function Bang({ d }: { d: DsCtx }) {
  const homNay = d.h.homNay
  const tatCa = d.ds.length > 0 && d.ds.every((n) => d.chon.has(n.id))
  const coNgayVao = d.ds.filter((n) => n.ngayVao).length
  const thieu = d.ds.filter((n) => conThieu(n).length > 0).length
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-[var(--surface-card)]">
      <table className="text-k-sm w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={cn(TH, 'w-8')}>
              <Tick
                checked={tatCa}
                onChange={d.chonHet}
                label="Chọn tất cả dòng đang hiện"
              />
            </th>
            <th className={TH}>Mã · Họ tên</th>
            <th className={TH}>Tổ</th>
            <th className={TH}>Chức danh</th>
            <th className={TH}>Ngày vào</th>
            <th className={TH} style={{ textAlign: 'right' }}>
              Thâm niên
            </th>
            <th className={TH}>Tình trạng</th>
            <th
              className={TH}
              title={`Số mục đã có trên ${SO_MUC_HO_SO} mục sổ quản lý lao động`}
            >
              Hồ sơ
            </th>
            <th className={TH}>Tài khoản ERP</th>
          </tr>
        </thead>
        <tbody>
          {d.ds.map((n) => {
            const t = conThieu(n)
            const tn = thamNien(n.ngayVao, homNay)
            return (
              <tr
                key={n.id}
                onClick={() => d.moHoSo(n.code)}
                className={cn(
                  'cursor-pointer hover:bg-[var(--surface-hover)]',
                  d.chon.has(n.id) && 'bg-[var(--act-wash)]',
                )}
              >
                <td className={TD}>
                  <Tick
                    checked={d.chon.has(n.id)}
                    onChange={() => d.batChon(n.id)}
                    label={`Chọn ${n.code} ${n.hoTen}`}
                  />
                </td>
                <td className={cn(TD, 'min-w-[200px] whitespace-normal')}>
                  <span className="flex items-center gap-2">
                    <Avatar ten={n.hoTen} />
                    <a
                      href={`/hr/nhan-vien/${encodeURIComponent(n.code)}`}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        d.moHoSo(n.code)
                      }}
                      className="hover:underline"
                    >
                      <span className="num mr-1.5 text-[var(--ink-3)]">{n.code}</span>
                      {n.hoTen}
                    </a>
                    {n.tenTuMay && (
                      <span className="text-k-label text-[var(--warn)]">tên máy</span>
                    )}
                  </span>
                </td>
                <td className={cn(TD, !n.boPhan && 'text-[var(--warn)]')}>
                  {n.boPhan ?? '(chưa có tổ)'}
                </td>
                <td className={cn(TD, !n.chucDanh && 'text-[var(--ink-3)]')}>
                  {n.chucDanh ?? '—'}
                </td>
                <td className={cn(TD, 'num', !n.ngayVao && 'text-[var(--ink-3)]')}>
                  {n.ngayVao ? ngayVn(n.ngayVao) : '—'}
                </td>
                <td className={cn(TD, 'num')} style={{ textAlign: 'right' }}>
                  {tn ?? '—'}
                </td>
                <td className={TD}>
                  <span className="flex flex-col items-start gap-0.5">
                    <TagTinhTrang n={n} homNay={homNay} />
                    {n.khongChamCong && (
                      <span className="text-k-label text-[var(--ink-3)]">
                        không chấm công
                      </span>
                    )}
                  </span>
                </td>
                <td
                  className={cn(
                    TD,
                    'num',
                    t.length ? 'text-[var(--warn)]' : 'text-[var(--done)]',
                  )}
                  title={
                    t.length ? `Còn thiếu ${t.length} mục` : 'Đủ các mục đang theo dõi'
                  }
                >
                  {SO_MUC_HO_SO - t.length}/{SO_MUC_HO_SO}
                </td>
                <td className={cn(TD, !n.taiKhoan && 'text-[var(--ink-3)]')}>
                  {n.taiKhoan ? (
                    <span className="num">
                      {n.taiKhoan.email}
                      {!n.taiKhoan.mo && (
                        <span className="text-k-label text-[var(--stop)]"> · khoá</span>
                      )}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td
              colSpan={9}
              className={cn(
                TD,
                'sticky bottom-0 bg-[var(--surface-raised)] whitespace-normal text-[var(--ink-2)]',
              )}
            >
              <b className="text-[var(--ink)]">{d.ds.length} người</b> · {coNgayVao} có
              ngày vào · {thieu} hồ sơ còn thiếu. &quot;Hồ sơ&quot; đếm {SO_MUC_HO_SO} mục
              theo sổ quản lý lao động (công việc, chấm công, cá nhân, định danh, liên
              hệ); chưa gồm hợp đồng.
            </td>
          </tr>
        </tfoot>
      </table>
      {d.ds.length === 0 && (
        <p className="text-k-sm px-[var(--gutter)] py-6 text-[var(--ink-2)]">
          Không có ai khớp bộ lọc — chọn chip &quot;Đang làm&quot;, bỏ lọc tổ hoặc xoá ô
          tìm.
        </p>
      )}
    </div>
  )
}
