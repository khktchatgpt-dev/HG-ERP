'use client'

import { useState } from 'react'
import { Btn, Empty, NumInput, Pick, TextArea, TextInput } from '@/components/kit'
import { cn } from '@/lib/utils'
import { docSo, khongDau } from '@/lib/luong/ho-so-luong'
import { KHOAN_CONG, TEN_KHOAN, type LoaiKhoan } from '@/lib/luong/tinh-luong'
import type { BangLuongCtx } from './useBangLuong'
import { R, so, TD, TF, TH } from './bang-luong.shared'

const LOAI = Object.keys(TEN_KHOAN) as LoaiKhoan[]

/** Khoản theo kỳ (Q5): thêm từng khoản, hoặc dán "mã NV ⇥ số tiền ⇥ ghi chú" cho một loại. */
export function NganKhoan({ d }: { d: BangLuongCtx }) {
  const { b } = d
  const [nv, setNv] = useState('')
  const [loai, setLoai] = useState<LoaiKhoan>('advance')
  const [tien, setTien] = useState('')
  const [ghiChu, setGhiChu] = useState('')
  const [dan, setDan] = useState('')
  const theoMa = new Map(b.nhanVien.map((n) => [n.ma.toLowerCase(), n]))
  const dongDan = dan
    .split(/\r?\n/)
    .map((l) => l.split('\t'))
    .filter((c) => c[0]?.trim())
    .map((c) => {
      const ma = c[0].trim().toLowerCase()
      const n =
        theoMa.get(ma) ?? b.nhanVien.find((x) => khongDau(x.ten) === khongDau(c[0]))
      return { n, tien: docSo(c[1]), ghiChu: c[2]?.trim() || null, goc: c[0].trim() }
    })
  const danDuoc = dongDan.filter((x) => x.n && x.tien && x.tien > 0)

  const sua = d.nhap
  return (
    <div className="min-h-0 overflow-auto bg-[var(--surface-card)]">
      {sua && (
        <div className="text-k-sm flex flex-wrap items-end gap-2 border-b border-[var(--line)] px-[var(--gutter)] py-2">
          <Pick
            label="Người"
            width={240}
            value={nv}
            onChange={setNv}
            options={[
              { value: '', label: 'Chọn người…' },
              ...b.nhanVien.map((n) => ({ value: n.id, label: `${n.ma} · ${n.ten}` })),
            ]}
          />
          <Pick
            label="Khoản"
            width={150}
            value={loai}
            onChange={(v) => setLoai(v as LoaiKhoan)}
            options={LOAI.map((l) => ({ value: l, label: TEN_KHOAN[l] }))}
          />
          <NumInput
            aria-label="Số tiền"
            value={tien}
            onCommit={setTien}
            className="w-32 border border-[var(--line)] px-1.5 py-0.5"
            placeholder="số tiền"
          />
          <span className="w-56">
            <TextInput
              label="Ghi chú"
              value={ghiChu}
              onCommit={setGhiChu}
              placeholder="ghi chú"
            />
          </span>
          <Btn
            icon="them"
            busy={d.busy === 'khoan'}
            onClick={async () => {
              const t = docSo(tien)
              if (!nv || !t || t <= 0) return
              if (
                await d.themKhoan([
                  {
                    employeeId: nv,
                    loai,
                    tien: Math.round(t),
                    ghiChu: ghiChu.trim() || null,
                  },
                ])
              ) {
                setTien('')
                setGhiChu('')
              }
            }}
          >
            Thêm khoản
          </Btn>
        </div>
      )}
      {b.khoan.length === 0 ? (
        <Empty
          headline="Kỳ này chưa có khoản nào"
          reason="Tạm ứng, thưởng, truy lĩnh, truy thu, khấu trừ khác của kỳ nhập ở đây; bảng lương cộng / trừ khi Tính lại."
          next={
            sua
              ? 'Thêm từng khoản ở hàng trên, hoặc dán từ Excel ở dưới.'
              : 'Bảng đã gửi duyệt — rút về nháp để thêm.'
          }
        />
      ) : (
        <table className="text-k-sm w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className={TH}>Người</th>
              <th className={TH}>Khoản</th>
              <th className={TH} style={R}>
                Số tiền
              </th>
              <th className={TH}>Ghi chú</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {b.khoan.map((k) => {
              const cong = KHOAN_CONG.includes(k.loai)
              return (
                <tr key={k.id}>
                  <td className={TD}>
                    <span className="num mr-1.5 text-[var(--ink-3)]">{k.ma}</span>
                    {k.ten}
                  </td>
                  <td className={TD}>{TEN_KHOAN[k.loai]}</td>
                  <td className={cn(TD, 'num', !cong && 'text-[var(--stop)]')} style={R}>
                    {cong ? '+' : '−'}
                    {so(k.tien)}
                  </td>
                  <td className={cn(TD, 'text-[var(--ink-3)]')}>{k.ghiChu}</td>
                  <td className={TD}>
                    {sua && (
                      <Btn
                        icon="xoa"
                        aria-label={`Xoá khoản ${k.ma}`}
                        busy={d.busy === 'xoa'}
                        onClick={() => d.xoaKhoan(k.id)}
                      >
                        {''}
                      </Btn>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className={TF} colSpan={2}>
                {b.khoan.length} khoản
              </td>
              <td className={cn(TF, 'num')} style={R}>
                +
                {so(
                  b.khoan
                    .filter((k) => KHOAN_CONG.includes(k.loai))
                    .reduce((s, k) => s + k.tien, 0),
                )}{' '}
                · −
                {so(
                  b.khoan
                    .filter((k) => !KHOAN_CONG.includes(k.loai))
                    .reduce((s, k) => s + k.tien, 0),
                )}
              </td>
              <td className={TF} colSpan={2} />
            </tr>
          </tfoot>
        </table>
      )}
      {sua && (
        <div className="text-k-sm border-t border-[var(--line)] px-[var(--gutter)] py-3">
          <label className="mb-1 block font-semibold" htmlFor="dan-khoan">
            Dán từ Excel — mỗi dòng: mã NV (hoặc họ tên) ⇥ số tiền ⇥ ghi chú, cùng loại “
            {TEN_KHOAN[loai]}”
          </label>
          <TextArea
            id="dan-khoan"
            aria-label="Dán khoản theo kỳ"
            value={dan}
            onChange={setDan}
            rows={4}
          />
          {dongDan.length > 0 && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[var(--ink-2)]">
                {danDuoc.length} / {dongDan.length} dòng nhận ra
                {dongDan.length > danDuoc.length &&
                  ` · không nhận: ${dongDan
                    .filter((x) => !x.n || !x.tien)
                    .slice(0, 3)
                    .map((x) => x.goc)
                    .join(', ')}`}
              </span>
              <Btn
                busy={d.busy === 'khoan'}
                aria-disabled={!danDuoc.length}
                onClick={async () => {
                  if (!danDuoc.length) return
                  const ok = await d.themKhoan(
                    danDuoc.map((x) => ({
                      employeeId: x.n!.id,
                      loai,
                      tien: Math.round(x.tien!),
                      ghiChu: x.ghiChu,
                    })),
                  )
                  if (ok) setDan('')
                }}
              >
                Thêm {danDuoc.length} khoản {TEN_KHOAN[loai].toLowerCase()}
              </Btn>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
