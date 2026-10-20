'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Btn, DateInput, NoticeBar } from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { cn } from '@/lib/utils'
import { tenMay } from '@/lib/cham-cong/mot-nguoi'
import { kyCuaThang } from '@/lib/cham-cong/ky-gio-cong'
import type { MotNguoiCong } from '@/modules/dept/hr/cham-cong/gio-cong.service'
import { KhungTrang } from './khung-trang'
import { doiThang } from './ky-cong.shared'
import { CongTungNgay } from './cong-tung-ngay'

/** Kỳ đang xem — chỉ cần ngần này để đặt khoảng mặc định và nút nhanh. */
export type KyXem = { thang: string; tu: string; den: string; homNay: string }

/**
 * TRANG "CHẤM CÔNG MỘT NGƯỜI" (bản vẽ MotNguoi.dc.html, duyệt 16/10/2026; thành
 * trang riêng 17/10/2026 khi tách trang — link gửi được). Mọi ngày trong khoảng
 * Từ–Đến, kể cả ngày không quẹt; xuất Excel đúng khoảng đang xem. Mở từ tên ở trang
 * Lượt quẹt, Có mặt theo tổ và Hồ sơ nhân viên. 20/10/2026: thêm công từng ngày theo
 * tờ "Chi tiết" của phần mềm cũ (`cong-tung-ngay.tsx`) — giờ lấy từ Bảng công.
 */
export function MotNguoiScreen({ ky, ma }: { ky: KyXem; ma: string }) {
  const router = useRouter()
  return (
    <KhungTrang
      ten="Chấm công một người"
      actions={
        <Btn icon="quayLai" onClick={() => router.back()}>
          Quay lại
        </Btn>
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--surface-card)] px-[var(--gutter)] py-3">
        <NoiDung key={ma} ky={ky} ma={ma} />
      </div>
    </KhungTrang>
  )
}

const congNgay = (iso: string, n: number) => {
  const t = new Date(`${iso}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

function NoiDung({ ky: k, ma }: { ky: KyXem; ma: string }) {
  const homNay = k.homNay
  const denKy = homNay < k.den ? homNay : k.den
  const [tu, setTu] = useState(k.tu)
  const [den, setDen] = useState(denKy)
  const [kq, setKq] = useState<{ khoa: string; data?: MotNguoiCong; loi?: string } | null>(
    null,
  )
  // Tăng sau mỗi lần điều chỉnh để nạp lại (dữ liệu trang này tải ở client).
  const [lan, setLan] = useState(0)

  const sai =
    !tu || !den
      ? 'Chọn đủ từ ngày và đến ngày'
      : den < tu
        ? '"Đến ngày" phải sau hoặc bằng "Từ ngày"'
        : (Date.parse(den) - Date.parse(tu)) / 86400_000 >= 366
          ? 'Mỗi lần xem tối đa 1 năm'
          : null
  const khoa = `${ma}|${tu}|${den}|${lan}`
  const q = `ma=${encodeURIComponent(ma)}&tu=${tu}&den=${den}`

  useEffect(() => {
    if (sai) return
    let huy = false
    api<MotNguoiCong>(`/api/dept/hr/cham-cong/nguoi?${q}`)
      .then((data) => !huy && setKq({ khoa, data }))
      .catch((e) => !huy && setKq({ khoa, loi: apiErrorText(e) }))
    return () => {
      huy = true
    }
  }, [q, khoa, sai])

  // Kỳ công 26 → 25 (không phải tháng dương lịch) — cùng kỳ với Bảng công.
  const kyTruoc = kyCuaThang(doiThang(k.thang, -1))
  const nhanh: { ten: string; tu: string; den: string }[] = [
    { ten: 'Kỳ này', tu: k.tu, den: denKy },
    { ten: 'Kỳ trước', tu: kyTruoc.tu, den: kyTruoc.den },
    { ten: '7 ngày', tu: congNgay(homNay, -6), den: homNay },
    { ten: '30 ngày', tu: congNgay(homNay, -29), den: homNay },
  ]

  // Đang nạp lại sau điều chỉnh: giữ bảng cũ thay vì nháy "Đang tải…".
  const xong = kq?.khoa === khoa || kq?.khoa.startsWith(`${ma}|${tu}|${den}|`) ? kq : null
  const data = xong?.data

  return (
    <div className="grid gap-3">
      {data && (
        <div>
          <div className="text-k-lg font-semibold">{data.nguoi.ten}</div>
          <dl className="text-k-sm mt-1 grid grid-cols-[repeat(4,minmax(0,auto))] justify-start gap-x-6 gap-y-0.5">
            <div>
              <dt className="text-k-label text-[var(--ink-3)]">Mã chấm công</dt>
              <dd className="num text-[var(--ink)]" style={{ textAlign: 'left' }}>
                {data.nguoi.ma}
              </dd>
            </div>
            <div>
              <dt className="text-k-label text-[var(--ink-3)]">Bộ phận</dt>
              <dd className={cn(!data.nguoi.boPhan && 'text-[var(--warn)]')}>
                {data.nguoi.boPhan ?? 'chưa có'}
              </dd>
            </div>
            <div>
              <dt className="text-k-label text-[var(--ink-3)]">Ca thường làm</dt>
              <dd>{data.nguoi.ca || '—'}</dd>
            </div>
            <div>
              <dt className="text-k-label text-[var(--ink-3)]">Quẹt ở máy</dt>
              <dd>
                {data.nguoi.maMay.length
                  ? [
                      ...new Set(data.nguoi.maMay.map((x) => tenMay(x.split(' ')[0]))),
                    ].join(', ')
                  : 'chưa ghép máy'}
              </dd>
            </div>
          </dl>
        </div>
      )}
      {data?.nguoi.khongChamCong && (
        <NoticeBar tone="neutral" tag="Không chấm công">
          Người này không quẹt máy — không quẹt không có nghĩa là vắng.
        </NoticeBar>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <DateInput label="Từ ngày" value={tu} onChange={setTu} />
        <DateInput label="Đến ngày" value={den} onChange={setDen} />
        {nhanh.map((n) => {
          const on = n.tu === tu && n.den === den
          return (
            <button
              key={n.ten}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setTu(n.tu)
                setDen(n.den)
              }}
              className={cn(
                'text-k-sm h-7 border px-2.5',
                on
                  ? 'border-[var(--act)] bg-[var(--act-wash)] text-[var(--act-text)]'
                  : 'border-[var(--line)] bg-[var(--surface-card)] hover:bg-[var(--surface-hover)]',
              )}
            >
              {n.ten}
            </button>
          )
        })}
      </div>

      {sai ? (
        <NoticeBar tone="stop" tag="Khoảng ngày">
          {sai}
        </NoticeBar>
      ) : xong?.loi ? (
        <NoticeBar tone="stop" tag="Chưa tải được">
          {xong.loi}
        </NoticeBar>
      ) : !data ? (
        <p className="text-k-sm text-[var(--ink-2)]">Đang tải…</p>
      ) : (
        <CongTungNgay data={data} q={q} taiLai={() => setLan((x) => x + 1)} />
      )}
    </div>
  )
}
