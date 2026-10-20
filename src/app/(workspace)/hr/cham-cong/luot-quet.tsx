'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Btn, Empty, Menu, Pick, SearchInput, Tick } from '@/components/kit'
import { kyCuaThang } from '@/lib/cham-cong/ky-gio-cong'
import { cn } from '@/lib/utils'
import type { DongLuot } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { khongDau } from '@/lib/cham-cong/ghep-ten'
import { gioPhut, tachLuot } from '@/lib/cham-cong/mot-nguoi'
import { useKyCong } from './useKyCong'
import { KhungTrang } from './khung-trang'
import { THU, dm, thu, type KyCong } from './ky-cong.shared'
import { so } from './cham-cong.shared'

/** Giá trị lọc cho dòng chưa có bộ phận (Pick không nhận chuỗi rỗng làm lựa chọn riêng). */
const BO_PHAN_TRONG = '__trong__'

/** Nhóm số lượt sau gộp lặp: '1' · '2' · '3' (= 3 trở lên, ngày nhiều đoạn làm). */
const nhomLuot = (r: DongLuot) => (r.luot.length >= 3 ? '3' : String(r.luot.length))

/**
 * TRANG LƯỢT QUẸT — "máy đã ghi những lượt nào, của ai, ngày nào?". CHỈ bày đúng
 * những gì máy ghi, mỗi dòng một người một ngày — không tính công. `?ngay=` và
 * `?bo-phan=` đặt sẵn bộ lọc (mở từ trang Có mặt theo tổ).
 */
export function LuotQuetScreen({
  k,
  ngayDau = '',
  boPhanDau = '',
}: {
  k: KyCong
  ngayDau?: string
  boPhanDau?: string
}) {
  const d = useKyCong(k)
  const router = useRouter()
  const [tim, setTim] = useState('')
  const [ngay, setNgay] = useState(ngayDau)
  const [boPhan, setBoPhan] = useState(boPhanDau)
  const [soLuot, setSoLuot] = useState('')
  const [chuaGhep, setChuaGhep] = useState(false)

  const dsBoPhan = useMemo(
    () =>
      [...new Set(k.du.dong.map((r) => r.boPhan ?? ''))].sort((a, b) =>
        a.localeCompare(b, 'vi'),
      ),
    [k.du.dong],
  )

  const dong = useMemo(() => {
    const q = khongDau(tim)
    return k.du.dong.filter(
      (r) =>
        (!ngay || r.ngay === ngay) &&
        (!boPhan || (r.boPhan ?? '') === (boPhan === BO_PHAN_TRONG ? '' : boPhan)) &&
        (!soLuot || nhomLuot(r) === soLuot) &&
        (!chuaGhep || !r.daGhep) &&
        (!q || khongDau(`${r.ma} ${r.ten}`).includes(q)),
    )
  }, [k.du.dong, tim, ngay, boPhan, soLuot, chuaGhep])

  const soChuaGhep = k.du.dong.filter((r) => !r.daGhep).length
  // Trang này theo tháng dương lịch; file chi tiết theo KỲ công (26 → 25) như Bảng công.
  const kyXuat = kyCuaThang(k.thang)
  const demLuot = (n: string) => k.du.dong.filter((r) => nhomLuot(r) === n).length

  return (
    <KhungTrang
      ten="Lượt quẹt"
      thang={k.thang}
      onThang={d.xemThang}
      facts={[{ label: 'Dòng người-ngày', value: so(k.du.dong.length) }]}
      actions={
        <Menu
          label="Xuất Excel ▾"
          // Hai file như máy / phần mềm cũ xuất (user 20/10/2026, thay mục "lượt quẹt thô"):
          // "tổ X.xlsx" (chi tiết) và "tổng hợp tổ X.xlsx" — theo bộ phận đang lọc, KỲ công
          // 26 → 25; mọi bộ phận thì mỗi tổ một tờ.
          items={(['chi-tiet', 'tong-hop'] as const).map((loai) => ({
            label: `${loai === 'chi-tiet' ? 'Chi tiết chấm công' : 'Tổng hợp chấm công'} · ${
              boPhan === BO_PHAN_TRONG
                ? '(chưa có bộ phận)'
                : boPhan || 'mọi bộ phận, mỗi tổ một tờ'
            } · kỳ ${dm(kyXuat.tu)} → ${dm(kyXuat.den)}`,
            why: k.du.dong.length ? undefined : 'Tháng này chưa có lượt nào',
            onClick: () =>
              window.location.assign(
                `/api/dept/hr/cham-cong/bang-cong/excel?loai=${loai}&thang=${k.thang}&bp=${encodeURIComponent(
                  boPhan === BO_PHAN_TRONG ? '(chưa có bộ phận)' : boPhan || 'all',
                )}`,
              ),
          }))}
        />
      }
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1.5">
        <SearchInput
          value={tim}
          onChange={setTim}
          placeholder="Tìm mã hoặc tên"
          width={220}
          label="Tìm mã hoặc tên"
        />
        <Pick
          label="Ngày"
          value={ngay}
          onChange={setNgay}
          options={[
            { value: '', label: 'Cả kỳ' },
            ...k.du.theoNgay.map((n) => ({
              value: n.ngay,
              label: `${dm(n.ngay)} ${THU[thu(n.ngay)]}`,
            })),
          ]}
        />
        <Pick
          label="Bộ phận"
          value={boPhan}
          onChange={setBoPhan}
          options={[
            { value: '', label: 'Mọi bộ phận' },
            ...dsBoPhan.map((b) =>
              b
                ? { value: b, label: b }
                : { value: BO_PHAN_TRONG, label: '(chưa có bộ phận)' },
            ),
          ]}
        />
        <Pick
          label="Số lượt"
          value={soLuot}
          onChange={setSoLuot}
          options={[
            { value: '', label: 'Mọi số lượt' },
            { value: '1', label: `1 lượt (${so(demLuot('1'))})` },
            { value: '2', label: `2 lượt (${so(demLuot('2'))})` },
            { value: '3', label: `3 lượt trở lên (${so(demLuot('3'))})` },
          ]}
        />
        <label className="text-k-sm flex items-center gap-2 text-[var(--ink-2)]">
          <Tick
            label="Chỉ mã chưa ghép người"
            checked={chuaGhep}
            onChange={setChuaGhep}
          />
          Chỉ mã chưa ghép người ({so(soChuaGhep)})
        </label>
        <span className="text-k-sm ml-auto text-[var(--ink-3)]">
          Bước này chỉ bày đúng những gì máy ghi — chưa tính công
        </span>
      </div>

      {k.du.dong.length === 0 ? (
        <div className="flex-1 bg-[var(--surface-card)]">
          <Empty
            headline={`Kỳ ${dm(k.tu)} → ${dm(k.den)} chưa có lượt nào trong ERP`}
            reason="Dữ liệu chỉ vào ERP khi bấm lấy về — máy chấm công không tự gửi lên."
            next={
              <Btn
                onClick={() => router.push(`/hr/cham-cong/lay-du-lieu?thang=${k.thang}`)}
              >
                Sang Lấy dữ liệu
              </Btn>
            }
          />
        </div>
      ) : dong.length === 0 ? (
        <div className="flex-1 bg-[var(--surface-card)]">
          <Empty
            headline="Không có dòng nào khớp bộ lọc"
            reason={`Kỳ này có ${so(k.du.dong.length)} dòng, nhưng không dòng nào khớp ô tìm / ngày / bộ phận / số lượt.`}
            next={
              <Btn
                onClick={() => {
                  setTim('')
                  setNgay('')
                  setBoPhan('')
                  setSoLuot('')
                  setChuaGhep(false)
                }}
              >
                Bỏ lọc
              </Btn>
            }
          />
        </div>
      ) : (
        <BangLuot dong={dong} tong={k.du.dong.length} onMoNguoi={d.moNguoi} />
      )}
    </KhungTrang>
  )
}

function deY(r: DongLuot): { text: string; tone?: 'stop' | 'warn' }[] {
  const out: { text: string; tone?: 'stop' | 'warn' }[] = []
  if (r.luot.length >= 3) out.push({ text: 'nhiều đoạn' })
  if (r.soLuotTho > r.luot.length)
    out.push({ text: `bấm lặp ${r.soLuotTho - r.luot.length}` })
  if (new Set(r.luot.map((l) => l.may)).size > 1)
    out.push({ text: '2 máy', tone: 'warn' })
  if (!r.daGhep) out.push({ text: 'mã chưa ghép người', tone: 'warn' })
  return out
}

/**
 * Lưới lượt: KHÔNG cuộn ngang (chủ dự án 17/10/2026 "hạn chế scroll ngang"). Cột
 * cố định bề rộng (`table-fixed`), mã + họ tên chung một ô, bỏ cột Máy (máy đã ghi
 * cạnh từng lượt), "Các lượt" và "Để ý" được xuống dòng. Giờ bày HH:MM, giờ đủ giây
 * ở tooltip.
 */
function BangLuot({
  dong,
  tong,
  onMoNguoi,
}: {
  dong: DongLuot[]
  tong: number
  /** Mở ngăn "Chấm công một người" — chỉ cho mã đã ghép người. */
  onMoNguoi: (ma: string) => void
}) {
  const c = 'border-b border-[var(--line-faint)]/40 px-2 py-0.5 align-top'
  const h = cn(
    c,
    'sticky top-0 z-[1] border-[var(--line)] bg-[var(--surface-raised)] text-left font-semibold whitespace-nowrap text-[var(--ink-2)]',
  )
  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto bg-[var(--surface-card)]"
      role="region"
      aria-label="Lượt quẹt theo người và ngày"
      tabIndex={0}
    >
      <table className="text-k-sm w-full table-fixed border-separate border-spacing-0">
        <colgroup>
          <col style={{ width: 76 }} />
          <col style={{ width: '21%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: 62 }} />
          <col style={{ width: 62 }} />
          <col />
          <col style={{ width: 92 }} />
          <col style={{ width: 86 }} />
          <col style={{ width: '13%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className={h}>Ngày</th>
            <th className={h}>Mã · Họ tên</th>
            <th className={h}>Bộ phận</th>
            <th className={h} title="Lượt quẹt đầu tiên trong ngày">
              Giờ vào
            </th>
            <th className={h} title="Lượt quẹt cuối cùng trong ngày">
              Giờ ra
            </th>
            <th className={h} title="Các lượt giữa lượt đầu và lượt cuối">
              Lượt giữa
            </th>
            <th
              className={h}
              title="Từ giờ vào tới giờ ra, chưa trừ nghỉ trưa — chỉ để xem, chưa phải giờ công"
            >
              Tổng thời gian
            </th>
            <th className={h}>Máy</th>
            <th className={h}>Để ý</th>
          </tr>
        </thead>
        <tbody>
          {dong.map((x) => (
            <tr
              key={`${x.ngay}|${x.ma}|${x.daGhep}`}
              className="hover:bg-[var(--surface-hover)]"
            >
              <td
                className={cn(c, 'num whitespace-nowrap')}
                style={{ textAlign: 'left' }}
              >
                {dm(x.ngay)} {THU[thu(x.ngay)]}
              </td>
              <td className={cn(c, 'truncate')} title={`${x.ma} · ${x.ten}`}>
                <span className="num mr-1.5 text-[var(--ink-3)]">{x.ma}</span>
                {x.daGhep ? (
                  <button
                    type="button"
                    className="text-left text-[var(--act-text)] hover:underline"
                    onClick={() => onMoNguoi(x.ma)}
                  >
                    {x.ten}
                  </button>
                ) : (
                  x.ten
                )}
              </td>
              <td
                className={cn(c, 'truncate', !x.boPhan && 'text-[var(--ink-3)]')}
                title={x.boPhan ?? undefined}
              >
                {x.boPhan ?? '—'}
              </td>
              {(() => {
                const t = tachLuot(x.luot)
                const trai = { textAlign: 'left' as const }
                return (
                  <>
                    <td className={cn(c, 'num font-semibold')} style={trai}>
                      {t.vao ?? '—'}
                    </td>
                    <td className={cn(c, 'num font-semibold')} style={trai}>
                      {t.ra ?? (
                        <span className="font-normal text-[var(--warn)]">chưa có</span>
                      )}
                    </td>
                    <td className={cn(c, 'num text-[var(--ink-2)]')} style={trai}>
                      {t.giua.join(' · ')}
                    </td>
                    <td className={cn(c, 'num')} style={trai}>
                      {t.coMatPhut != null ? gioPhut(t.coMatPhut) : ''}
                    </td>
                    <td
                      className={cn(c, 'truncate text-[var(--ink-2)]')}
                      title={t.may.join(', ')}
                    >
                      {t.may.join(', ')}
                    </td>
                  </>
                )
              })()}
              <td className={c}>
                {deY(x).map((f) => (
                  <span
                    key={f.text}
                    className={cn(
                      'mr-1 mb-0.5 inline-block border px-1.5 text-[11px] whitespace-nowrap',
                      f.tone === 'stop'
                        ? 'border-[var(--stop-line)] bg-[var(--stop-wash)] text-[var(--stop)]'
                        : f.tone === 'warn'
                          ? 'border-[var(--warn-line)] bg-[var(--warn-wash)] text-[var(--warn)]'
                          : 'border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink-2)]',
                    )}
                  >
                    {f.text}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td
              colSpan={9}
              className={cn(
                c,
                'sticky bottom-0 border-t border-[var(--line)] bg-[var(--surface-raised)] font-semibold',
              )}
            >
              {so(dong.length)}
              {dong.length < tong ? ` / ${so(tong)}` : ''} dòng người-ngày · giờ vào =
              lượt đầu, giờ ra = lượt cuối, lượt bấm lặp trong 2 phút đã gộp · chỉ bày
              lượt, chưa tính công
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
