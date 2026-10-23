'use client'

import { Btn, SearchInput, Tag } from '@/components/kit'
import { cn } from '@/lib/utils'
import { khongDau } from '@/lib/luong/ho-so-luong'
import type { BangLuongCtx } from './useBangLuong'
import { R, so, TD, TF, TH, tong, type PhieuDong } from './bang-luong.shared'

const COT: { ten: string; f: (p: PhieuDong) => number; tru?: boolean; dam?: boolean }[] =
  [
    { ten: 'Lương công', f: (p) => p.luongCong + p.nghiCoLuong },
    { ten: 'Tăng ca', f: (p) => p.tangCa },
    { ten: 'Phụ cấp', f: (p) => p.phuCap },
    { ten: 'Khoản +', f: (p) => p.khoanCong },
    { ten: 'BH (10,5 %)', f: (p) => p.bhNld, tru: true },
    { ten: 'Đoàn phí (0,5 %)', f: (p) => p.doanPhi, tru: true },
    // Q5: thuế tính được nhưng chưa trừ thì không nằm ở cột trừ — xem ngăn Bảo hiểm & thuế
    { ten: 'Thuế TNCN', f: (p) => (p.truThue ? p.thue : 0), tru: true },
    { ten: 'Tạm ứng / khoản −', f: (p) => p.khoanTru, tru: true },
    { ten: 'Thực lĩnh', f: (p) => p.thucLinh, dam: true },
  ]

export function NganBang({ d }: { d: BangLuongCtx }) {
  const q = khongDau(d.tim)
  const ds = d.b.phieu
    .filter((p) => !q || p.ma.toLowerCase().includes(q) || khongDau(p.ten).includes(q))
    .sort(
      (a, b) =>
        (a.to ?? '').localeCompare(b.to ?? '', 'vi') ||
        a.ma.localeCompare(b.ma, 'vi', { numeric: true }),
    )
  const nhom = new Map<string, PhieuDong[]>()
  for (const p of ds)
    nhom.set(p.to ?? '(chưa có tổ)', [...(nhom.get(p.to ?? '(chưa có tổ)') ?? []), p])
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1.5">
        <SearchInput
          value={d.tim}
          onChange={d.setTim}
          placeholder="Tìm mã, tên"
          width={200}
          label="Tìm người"
        />
        <span className="text-k-sm text-[var(--ink-3)]">
          bấm một dòng để xem phiếu lương và phép tính
        </span>
      </div>
      <div className="flex min-h-0">
        <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-[var(--surface-card)]">
          <table className="text-k-sm w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={TH}>Mã · Họ tên</th>
                <th className={TH} style={R}>
                  Công
                </th>
                {COT.map((c) => (
                  <th key={c.ten} className={TH} style={R}>
                    {c.ten}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...nhom].map(([to, ps]) => (
                <NhomTo key={to} d={d} to={to} ps={ps} />
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className={TF}>{ds.length} người</td>
                <td className={cn(TF, 'num')} style={R}>
                  {so(
                    tong(ds, (p) => p.cong),
                    2,
                  )}
                </td>
                {COT.map((c) => (
                  <td key={c.ten} className={cn(TF, 'num')} style={R}>
                    {so(tong(ds, c.f))}
                  </td>
                ))}
              </tr>
              <tr>
                <td
                  colSpan={COT.length + 2}
                  className={cn(TF, 'font-normal whitespace-normal text-[var(--ink-3)]')}
                >
                  Thực lĩnh = lương công (gồm nghỉ có lương) + tăng ca + phụ cấp + khoản
                  cộng − BH người lao động − thuế TNCN − tạm ứng và khoản trừ. Không gồm
                  BH phần doanh nghiệp và KPCĐ — xem mục Bảo hiểm & thuế.
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {d.phieuChon && <NganPhieu d={d} p={d.phieuChon} />}
      </div>
    </div>
  )
}

function NhomTo({ d, to, ps }: { d: BangLuongCtx; to: string; ps: PhieuDong[] }) {
  return (
    <>
      <tr>
        <td
          colSpan={COT.length + 2}
          className={cn(
            TD,
            'bg-[var(--surface-raised)] font-semibold text-[var(--ink-2)]',
          )}
        >
          {to} · {ps.length} người · thực lĩnh {so(tong(ps, (p) => p.thucLinh))}
        </td>
      </tr>
      {ps.map((p) => (
        <tr
          key={p.employeeId}
          onClick={() => d.setChon(p.employeeId)}
          className={cn(
            'cursor-pointer hover:bg-[var(--surface-hover)]',
            d.chon === p.employeeId && 'bg-[var(--act-wash)]',
          )}
        >
          <td className={TD}>
            <button
              type="button"
              className="text-left hover:underline"
              onClick={() => d.setChon(p.employeeId)}
            >
              <span className="num mr-1.5 text-[var(--ink-3)]">{p.ma}</span>
              {p.ten}
            </button>
            {p.van.length > 0 && (
              <span className="ml-1.5">
                <Tag tone="stop">{p.van.length} vướng</Tag>
              </span>
            )}
          </td>
          <td className={cn(TD, 'num')} style={R}>
            {so(p.cong, 2)}
          </td>
          {COT.map((c) => {
            const v = c.f(p)
            return (
              <td
                key={c.ten}
                className={cn(
                  TD,
                  'num',
                  c.tru && v && 'text-[var(--stop)]',
                  c.dam && 'font-bold',
                  c.dam && v < 0 && 'text-[var(--stop)]',
                )}
                style={R}
              >
                {v ? so(v) : ''}
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}

function NganPhieu({ d, p }: { d: BangLuongCtx; p: PhieuDong }) {
  return (
    <aside className="text-k-sm w-[400px] shrink-0 overflow-auto border-l border-[var(--line)] bg-[var(--surface-card)] px-4 py-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-k-label font-semibold tracking-wide text-[var(--ink-3)] uppercase">
            Phiếu lương · {p.ma}
          </div>
          <div className="text-k-body font-semibold">{p.ten}</div>
          <div className="text-[var(--ink-3)]">{p.to ?? '(chưa có tổ)'}</div>
        </div>
        <Btn icon="huy" aria-label="Đóng phiếu" onClick={() => d.setChon(null)}>
          {''}
        </Btn>
      </div>
      {p.van.length > 0 && (
        <ul className="m-0 mt-2 list-none space-y-0.5 p-0 text-[var(--stop)]">
          {p.van.map((v) => (
            <li key={v}>✗ {v}</li>
          ))}
        </ul>
      )}
      <div className="mt-2 rounded-[var(--radius)] border border-[var(--line-faint)] bg-[var(--surface)] px-2.5 py-2 font-[family-name:var(--font-mono)] text-[11.5px] leading-[1.7] text-[var(--ink)]">
        {p.why.map((l, i) => (
          <div
            key={i}
            className={cn(
              'whitespace-pre-wrap',
              /^(Tổng thu nhập|Thực lĩnh)/.test(l) && 'font-bold text-[var(--act)]',
            )}
          >
            {l}
          </div>
        ))}
      </div>
      <div className="mt-2 text-[var(--ink-3)]">
        Nguồn: bản chốt kỳ công lần {d.b.bang?.lanChotCong ?? '—'} · hồ sơ lương hiệu lực
        kỳ này · hệ số của bản cách tính kỳ công đã dùng · khoản theo kỳ.
      </div>
      <h4 className="text-k-label mt-3 mb-1 font-semibold tracking-wide text-[var(--ink-3)] uppercase">
        Chuyển khoản
      </h4>
      <div className="num">
        {p.nganHang ?? '—'} {p.stk ? `••••${p.stk.slice(-4)}` : 'thiếu STK'} ·{' '}
        {so(p.thucLinh)} đ
      </div>
    </aside>
  )
}
