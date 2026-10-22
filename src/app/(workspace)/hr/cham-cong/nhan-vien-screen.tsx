'use client'

import { useState } from 'react'
import { Btn, Empty, Pick, SearchInput } from '@/components/kit'
import { cn } from '@/lib/utils'
import type {
  NhanVienData,
  NvDong,
  NvMa,
} from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { KhungTrang } from './khung-trang'
import { LOC, TRONG, useNhanVien, type NhanVienCtx } from './useNhanVien'
import { HoSoNv } from './ho-so-nv'
import { dm } from './ky-cong.shared'
import { so } from './cham-cong.shared'

/**
 * CHẤM CÔNG › MÃ TRÊN MÁY & CA (dời từ Hồ sơ nhân viên 19/10/2026, bản vẽ lượt 2 Q5):
 * dọn dữ liệu máy — tên lấy từ máy, ca mặc định, mã chưa ghép. Hồ sơ người ở /hr/nhan-vien.
 * Gốc: BƯỚC ② NHÂN VIÊN & CA — "ai là ai, làm ca nào?" (bản vẽ Nv.dc.html, duyệt 15/10/2026).
 * Ô đếm = bộ lọc; lưới nhân viên chọn nhiều để đổi ca / bộ phận một lần; bấm một
 * dòng mở hồ sơ bên phải. Ô "Mã có quẹt, chưa ghép người" đổi lưới sang danh sách
 * mã trên máy để gán tay. Ca ở đây chỉ là CA THƯỜNG LÀM (một ngày làm nhiều đoạn
 * thì từng đoạn tự nhận ca — làm ở phần tính công, sau).
 */
export function NhanVienScreen({ nv }: { nv: NhanVienData }) {
  const v = useNhanVien(nv)
  return (
    <KhungTrang
      nhom="Chấm công"
      ten="Mã trên máy & ca"
      facts={[{ label: 'Đang làm', value: so(v.dem('dang-lam')) }]}
      actions={
        <Btn primary icon="them" onClick={() => v.setHoSo({ moi: true })}>
          Tuyển vào
        </Btn>
      }
    >
      <div
        className="flex border-b border-[var(--line)] bg-[var(--surface-card)]"
        role="group"
        aria-label="Lọc theo tình trạng"
      >
        {LOC.map((o) => {
          const on = v.loc === o.id
          const n = v.dem(o.id)
          const tone =
            n === 0 || o.id === 'dang-lam' || o.id === 'nghi' || o.id === 'khong-cham'
              ? ''
              : o.id === 'chua-ghep'
                ? 'text-[var(--stop)]'
                : 'text-[var(--warn)]'
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => v.doiLoc(o.id)}
              className={cn(
                'min-w-0 flex-1 border-t-2 border-r border-r-[var(--line)] px-3 py-1.5 text-left last:border-r-0 hover:bg-[var(--surface-hover)]',
                on
                  ? 'border-t-[var(--act)] bg-[var(--act-wash)]'
                  : 'border-t-transparent',
              )}
            >
              <span className="text-k-label block text-[var(--ink-2)]">{o.ten}</span>
              <span className={cn('num block text-[20px] leading-7 font-semibold', tone)}>
                {so(n)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1.5">
        <SearchInput
          value={v.tim}
          onChange={v.setTim}
          placeholder="Tìm mã, tên, tên trên máy"
          width={230}
          label="Tìm mã, tên, tên trên máy"
        />
        {v.loc !== 'chua-ghep' && (
          <>
            <Pick
              label="Bộ phận"
              value={v.boPhan}
              onChange={v.setBoPhan}
              options={[
                { value: '', label: 'Mọi bộ phận' },
                ...v.boPhanTrongO.map(([b, n]) =>
                  b
                    ? { value: b, label: `${b} (${n})` }
                    : { value: TRONG, label: `(chưa có bộ phận) (${n})` },
                ),
              ]}
            />
            <Pick
              label="Ca thường làm"
              value={v.ca}
              onChange={v.setCa}
              options={[
                { value: '', label: 'Mọi ca' },
                ...nv.cas.map((c) => ({ value: c.id, label: `${c.ten} ${c.gio}` })),
              ]}
            />
            {v.chon.size > 0 && <HangLoat v={v} />}
          </>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {v.loc === 'chua-ghep' ? <LuoiMaChuaGhep v={v} /> : <LuoiNhanVien v={v} />}
        <HoSoNv v={v} />
      </div>
    </KhungTrang>
  )
}

/** Đổi ca / bộ phận cho các dòng đang chọn. */
function HangLoat({ v }: { v: NhanVienCtx }) {
  const [ca, setCa] = useState('')
  const [bp, setBp] = useState('')
  return (
    <div className="text-k-sm ml-auto flex flex-wrap items-center gap-2 text-[var(--ink-2)]">
      Đã chọn <b className="num text-[var(--ink)]">{v.chon.size}</b>
      <Pick
        label="Đổi ca thành"
        value={ca}
        onChange={setCa}
        options={[
          { value: '', label: 'Đổi ca thành…' },
          ...v.nv.cas.map((c) => ({ value: c.id, label: c.ten })),
        ]}
      />
      <Btn disabled={!ca} busy={v.busy} onClick={() => v.hangLoat({ shift_id: ca })}>
        Đổi ca
      </Btn>
      <input
        aria-label="Đổi bộ phận thành"
        list="hr-bo-phan"
        value={bp}
        onChange={(e) => setBp(e.target.value)}
        placeholder="Đổi bộ phận thành…"
        className="text-k-sm h-7 w-44 border border-[var(--line)] bg-[var(--surface-card)] px-2"
      />
      <Btn disabled={!bp.trim()} busy={v.busy} onClick={() => v.hangLoat({ team: bp })}>
        Đổi bộ phận
      </Btn>
    </div>
  )
}

const c = 'border-b border-[var(--line-faint)]/40 px-2.5 py-1 whitespace-nowrap'
const h = cn(
  c,
  'sticky top-0 z-[1] border-[var(--line)] bg-[var(--surface-raised)] text-left font-semibold text-[var(--ink-2)]',
)

function ChipMa({ m }: { m: NvMa }) {
  return (
    <span
      title={`Máy ${m.may} · mã ${m.ma}${m.lanCuoi ? ` · quẹt cuối ${dm(m.lanCuoi)}` : ''}`}
      className={cn(
        'num mr-1 mb-0.5 inline-block border px-1 text-[11px] leading-[17px] whitespace-nowrap',
        m.canXem
          ? 'border-[var(--warn-line)] bg-[var(--warn-wash)] text-[var(--warn)]'
          : 'border-[var(--line)] bg-[var(--surface-card)] text-[var(--ink)]',
      )}
    >
      {m.may} {m.ma} {m.ten}
    </span>
  )
}

function CanXem({ n }: { n: NvDong }) {
  const tags: string[] = []
  if (n.tenTuMay) tags.push('Tên từ máy')
  if (!n.boPhan) tags.push('Chưa bộ phận')
  if (n.caMacDinh) tags.push('Ca mặc định')
  if (n.ma.some((m) => m.canXem)) tags.push('Mã trùng số máy kia')
  if (n.ma.length === 0 && !n.khongChamCong) tags.push('Chưa ghép mã máy')
  return (
    <>
      {tags.map((t) => (
        <span
          key={t}
          className="mr-1 mb-0.5 inline-block border border-[var(--warn-line)] bg-[var(--warn-wash)] px-1.5 text-[11px] whitespace-nowrap text-[var(--warn)]"
        >
          {t}
        </span>
      ))}
    </>
  )
}

function LuoiNhanVien({ v }: { v: NhanVienCtx }) {
  const tatCa = v.ds.length > 0 && v.ds.every((n) => v.chon.has(n.id))
  const dangMo = v.hoSo && 'id' in v.hoSo ? v.hoSo.id : null
  if (v.ds.length === 0)
    return (
      <div className="min-w-0 flex-1 bg-[var(--surface-card)]">
        <Empty
          headline="Không có ai khớp bộ lọc"
          reason={`Ô "${LOC.find((o) => o.id === v.loc)!.ten}" có ${so(v.dem(v.loc))} người, nhưng không ai khớp ô tìm / bộ phận / ca.`}
          next={
            <Btn
              onClick={() => {
                v.setTim('')
                v.setBoPhan('')
                v.setCa('')
              }}
            >
              Bỏ lọc
            </Btn>
          }
        />
      </div>
    )
  return (
    <div
      className="min-w-0 flex-1 overflow-auto bg-[var(--surface-card)]"
      role="region"
      aria-label="Danh sách nhân viên chấm công"
      tabIndex={0}
    >
      <table className="text-k-sm w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={cn(h, 'w-8')}>
              <input
                type="checkbox"
                aria-label="Chọn tất cả dòng đang hiện"
                checked={tatCa}
                onChange={(e) => v.chonHet(e.target.checked)}
                className="accent-[var(--act)]"
              />
            </th>
            <th className={h}>Mã NV</th>
            <th className={h}>Họ tên</th>
            <th className={h}>Bộ phận / Tổ</th>
            <th
              className={h}
              title="Admin cấp ở Admin › Nhân viên & tài khoản — ở đây chỉ để xem"
            >
              Tài khoản ERP
            </th>
            <th
              className={h}
              title="Chỉ là gợi ý — ngày làm nhiều đoạn thì từng đoạn tự nhận ca"
            >
              Ca thường làm
            </th>
            <th className={h}>Mã trên máy</th>
            <th
              className={h}
              title="Ngày quẹt gần nhất trong 45 ngày — để thấy ai đã nghỉ mà chưa đánh dấu"
            >
              Quẹt gần nhất
            </th>
            <th className={h}>Cần xem lại</th>
          </tr>
        </thead>
        <tbody>
          {v.ds.map((n) => (
            <tr
              key={n.id}
              onClick={() => v.setHoSo({ id: n.id })}
              className={cn(
                'cursor-pointer hover:bg-[var(--surface-hover)]',
                dangMo === n.id && 'bg-[var(--act-wash)]',
              )}
            >
              <td className={c} onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  aria-label={`Chọn ${n.hoTen}`}
                  checked={v.chon.has(n.id)}
                  onChange={() => v.batChon(n.id)}
                  className="accent-[var(--act)]"
                />
              </td>
              <td className={cn(c, 'num text-[var(--act-text)]')}>{n.code}</td>
              <td className={cn(c, dangMo === n.id && 'font-semibold')}>{n.hoTen}</td>
              <td className={cn(c, !n.boPhan && 'text-[var(--ink-3)]')}>
                {n.boPhan ?? '—'}
              </td>
              <td className={cn(c, !n.taiKhoan && 'text-[var(--ink-3)]')}>
                {n.taiKhoan ? (
                  <>
                    <span className="num">{n.taiKhoan.email}</span>
                    {!n.taiKhoan.mo && (
                      <span className="ml-1.5 text-[11px] text-[var(--stop)]">
                        đã khoá
                      </span>
                    )}
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td className={c} onClick={(e) => e.stopPropagation()}>
                <select
                  aria-label={`Ca thường làm của ${n.hoTen}`}
                  value={n.shiftId}
                  disabled={v.busy}
                  onChange={(e) => v.doiCa(n, e.target.value)}
                  // Inline: CSS .kit cho select nằm ngoài @layer nên thắng lớp h-6 — hàng từng cao ~40px.
                  style={{ height: 22, minHeight: 0, paddingBlock: 0 }}
                  className="text-k-sm border border-[var(--line)] bg-[var(--surface-card)] px-1"
                >
                  {v.nv.cas.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.ten}
                    </option>
                  ))}
                </select>
              </td>
              <td className={cn(c, 'whitespace-normal')}>
                {n.khongChamCong && (
                  <span className="mr-1 border border-[var(--line)] bg-[var(--surface-raised)] px-1.5 text-[11px] text-[var(--ink-2)]">
                    Không chấm công
                  </span>
                )}
                {n.ma.length ? (
                  n.ma.map((m) => <ChipMa key={m.id} m={m} />)
                ) : n.khongChamCong ? null : (
                  <span className="text-[var(--ink-3)]">—</span>
                )}
              </td>
              <td
                className={cn(c, 'num', !n.lanCuoi && 'text-[var(--ink-3)]')}
                style={{ textAlign: 'left' }}
              >
                {n.lanCuoi ? dm(n.lanCuoi) : n.khongChamCong ? '—' : 'chưa quẹt'}
              </td>
              <td className={cn(c, 'whitespace-normal')}>
                <CanXem n={n} />
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
              Cộng {so(v.ds.length)} người
              <span className="font-normal text-[var(--ink-2)]">
                {' '}
                — đang lọc “{LOC.find((o) => o.id === v.loc)!.ten}” · trên tổng{' '}
                {so(v.nv.ds.length)} ({so(v.dem('dang-lam'))} đang làm,{' '}
                {so(v.dem('nghi'))} không còn làm) · bấm một dòng để sửa hồ sơ, tích nhiều
                dòng để đổi ca / bộ phận một lần
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/** Mã trên máy có quẹt gần đây mà chưa ghép ai — gán vào người có sẵn hoặc tạo người mới. */
function LuoiMaChuaGhep({ v }: { v: NhanVienCtx }) {
  const [gan, setGan] = useState<Record<string, string>>({})
  if (v.maChuaGhep.length === 0)
    return (
      <div className="min-w-0 flex-1 bg-[var(--surface-card)]">
        <Empty
          headline="Không còn mã nào chưa ghép"
          reason={`Mọi mã có quẹt từ ${dm(v.nv.nhinLaiTu)} đều đã ghép nhân viên.`}
          next={<Btn onClick={() => v.doiLoc('dang-lam')}>Xem người đang làm</Btn>}
        />
      </div>
    )
  const nguoi = v.nv.ds.filter((n) => n.active)
  return (
    <div
      className="min-w-0 flex-1 overflow-auto bg-[var(--surface-card)]"
      role="region"
      aria-label="Mã trên máy có quẹt chưa ghép người"
      tabIndex={0}
    >
      <table className="text-k-sm w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={h}>Máy</th>
            <th className={h}>Mã trên máy</th>
            <th className={h}>Tên trên máy</th>
            <th className={h} style={{ textAlign: 'right' }}>
              Lượt từ {dm(v.nv.nhinLaiTu)}
            </th>
            <th className={h}>Quẹt cuối</th>
            <th className={h}>Gán cho</th>
          </tr>
        </thead>
        <tbody>
          {v.maChuaGhep.map((m) => (
            <tr key={m.id} className="hover:bg-[var(--surface-hover)]">
              <td className={cn(c, 'num')}>{m.may}</td>
              <td className={cn(c, 'num')}>{m.ma}</td>
              <td className={cn(c, 'whitespace-normal')}>
                {m.ten || <span className="text-[var(--ink-3)]">(trống)</span>}
                {m.canXem && (
                  <span className="ml-1 border border-[var(--warn-line)] bg-[var(--warn-wash)] px-1.5 text-[11px] text-[var(--warn)]">
                    cùng số máy kia là người khác
                  </span>
                )}
              </td>
              <td className={cn(c, 'num')} style={{ textAlign: 'right' }}>
                {so(m.luotGanDay)}
              </td>
              <td className={cn(c, 'num')}>{m.lanCuoi ? dm(m.lanCuoi) : '—'}</td>
              <td className={c}>
                <span className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label={`Gán mã ${m.ma} máy ${m.may} cho nhân viên`}
                    value={gan[m.id] ?? ''}
                    onChange={(e) => setGan({ ...gan, [m.id]: e.target.value })}
                    className="text-k-sm h-6 max-w-56 border border-[var(--line)] bg-[var(--surface-card)] px-1"
                  >
                    <option value="">Chọn nhân viên…</option>
                    {nguoi.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.code} · {n.hoTen}
                      </option>
                    ))}
                  </select>
                  <Btn
                    disabled={!gan[m.id]}
                    busy={v.busy}
                    onClick={() =>
                      v.ghep(
                        m.id,
                        gan[m.id],
                        nguoi.find((n) => n.id === gan[m.id])!.hoTen,
                      )
                    }
                  >
                    Ghép
                  </Btn>
                  <Btn
                    icon="them"
                    onClick={() =>
                      v.setHoSo({ moi: true, code: m.ma, duId: m.id, tenMay: m.ten })
                    }
                  >
                    Người mới
                  </Btn>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td
              colSpan={6}
              className={cn(
                c,
                'sticky bottom-0 border-t border-[var(--line)] bg-[var(--surface-raised)] font-semibold',
              )}
            >
              Cộng {so(v.maChuaGhep.length)} mã
              <span className="font-normal text-[var(--ink-2)]">
                {' '}
                — chỉ mã có quẹt từ {dm(v.nv.nhinLaiTu)}; lượt của các mã này CHƯA thuộc
                về ai nên chưa vào bảng công
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
