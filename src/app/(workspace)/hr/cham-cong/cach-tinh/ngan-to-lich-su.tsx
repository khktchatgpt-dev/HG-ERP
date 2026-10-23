'use client'

import { Btn, NoticeBar, Pick, Tag } from '@/components/kit'
import { cn } from '@/lib/utils'
import { kyVn, lucVn } from './cach-tinh.shared'
import { SEC, TD, TH } from './ngan-he-so'
import type { CachTinhCtx } from './useCachTinh'
import {
  CACH_TINH,
  khongTheoKhung,
  TEN_CACH_TINH,
  type CachTinh,
} from '@/lib/cham-cong/ky-gio-cong'

/**
 * Cách tính theo tổ KHÔNG có phiên bản: đổi là áp ngay cho kỳ đang mở (kỳ đã chốt sẽ có
 * kết quả lưu riêng ở B3). Cột Tổ sản xuất là cầu nối cho lương sản phẩm về sau.
 */
export function NganTheoTo({ d }: { d: CachTinhCtx }) {
  const { c } = d
  const tong = c.to.reduce((s, t) => s + t.soNguoi, 0)
  const noi = c.to.filter((t) => t.toSx).length
  return (
    <div className="flex min-h-0 flex-col">
      {c.chuaCoTo > 0 && (
        <NoticeBar tone="neutral" tag="Chưa có tổ">
          {c.chuaCoTo} người đang làm chưa có tổ — họ được tính theo khung giờ. Gán tổ ở
          Bảng công → Nhân viên &amp; ca.
        </NoticeBar>
      )}
      <div className="min-h-0 overflow-auto">
        <table className="text-k-sm w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className={TH}>Tổ / bộ phận</th>
              <th className={TH} style={{ textAlign: 'right', width: 110 }}>
                Đang làm
              </th>
              <th className={TH} style={{ width: 240 }}>
                Cách tính
              </th>
              <th className={TH}>Tổ sản xuất (sổ sản lượng)</th>
            </tr>
          </thead>
          <tbody>
            {[...c.to]
              .sort((a, b) => b.soNguoi - a.soNguoi || a.ten.localeCompare(b.ten, 'vi'))
              .map((t) => (
                <tr key={t.ten}>
                  <td className={TD}>{t.ten}</td>
                  <td className={cn(TD, 'num')} style={{ textAlign: 'right' }}>
                    {t.soNguoi}
                  </td>
                  <td className={TD}>
                    {c.quyen.to ? (
                      <Pick
                        label={`Cách tính ${t.ten}`}
                        width={220}
                        value={t.cachTinh}
                        disabled={d.busy === 'to:' + t.ten}
                        onChange={(v) => d.doiCachTinhTo(t.ten, v as CachTinh)}
                        options={CACH_TINH.map((c) => ({
                          value: c,
                          label: TEN_CACH_TINH[c],
                        }))}
                      />
                    ) : (
                      TEN_CACH_TINH[t.cachTinh]
                    )}
                  </td>
                  <td className={cn(TD, !t.toSx && 'text-[var(--ink-3)]')}>
                    {t.toSx ??
                      (khongTheoKhung(t.cachTinh) ? 'không áp dụng' : '— chưa nối')}
                  </td>
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr>
              <td
                className={cn(
                  TD,
                  'sticky bottom-0 bg-[var(--surface-raised)] font-semibold',
                )}
              >
                {c.to.length} tổ · {noi} đã nối tổ sản xuất
              </td>
              <td
                className={cn(
                  TD,
                  'num sticky bottom-0 bg-[var(--surface-raised)] font-semibold',
                )}
                style={{ textAlign: 'right' }}
              >
                {tong}
              </td>
              <td
                colSpan={2}
                className={cn(
                  TD,
                  'sticky bottom-0 bg-[var(--surface-raised)] text-[var(--ink-2)]',
                )}
              >
                Không gồm {c.chuaCoTo} người chưa có tổ.
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export function NganLichSu({ d }: { d: CachTinhCtx }) {
  const { c } = d
  return (
    <div className="min-h-0 overflow-auto">
      <div className={SEC}>
        <h3 className="text-k-body font-semibold">Các bản cách tính</h3>
        <span className="text-k-sm text-[var(--ink-3)]">
          kỳ X dùng bản có &quot;từ kỳ&quot; lớn nhất không vượt X
        </span>
      </div>
      <table className="text-k-sm w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={cn(TH, 'w-20')}>Bản</th>
            <th className={TH}>Tình trạng</th>
            <th className={TH}>Từ kỳ</th>
            <th className={TH}>Tạo</th>
            <th className={TH}>Sửa lần cuối</th>
            <th className={TH}>Áp dụng</th>
            <th className={TH}>Ghi chú</th>
            <th className={TH} />
          </tr>
        </thead>
        <tbody>
          {[...c.ban].reverse().map((b) => (
            <tr key={b.id} className={cn(b.id === c.xem.id && 'bg-[var(--act-wash)]')}>
              <td className={cn(TD, 'font-semibold')}>Bản {b.so}</td>
              <td className={TD}>
                {b.tinhTrang === 'nhap' ? (
                  <Tag tone="warn">nháp</Tag>
                ) : b.tinhTrang === 'ap_dung' ? (
                  <Tag tone="done">đang áp dụng</Tag>
                ) : (
                  <Tag>đã dùng</Tag>
                )}
              </td>
              <td className={cn(TD, 'num')}>{b.tuKy ? kyVn(b.tuKy) : '—'}</td>
              <td className={TD}>
                {b.nguoiTao ?? 'hệ thống'}
                <span className="num block text-[var(--ink-3)]">{lucVn(b.taoLuc)}</span>
              </td>
              <td className={TD}>
                {b.nguoiSua ?? '—'}
                <span className="num block text-[var(--ink-3)]">{lucVn(b.suaLuc)}</span>
              </td>
              <td className={TD}>
                {b.apDungLuc ? (
                  <>
                    {b.nguoiApDung ?? 'hệ thống'}
                    <span className="num block text-[var(--ink-3)]">
                      {lucVn(b.apDungLuc)}
                    </span>
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td className={cn(TD, 'text-[var(--ink-2)]')}>{b.ghiChu}</td>
              <td className={TD}>
                {b.id !== c.xem.id && (
                  <Btn icon="mo" onClick={() => d.xemBan(b.id)}>
                    Xem
                  </Btn>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
