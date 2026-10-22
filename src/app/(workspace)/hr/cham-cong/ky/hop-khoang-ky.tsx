'use client'

/**
 * HỘP "ĐỔI KHOẢNG KỲ" — bản vẽ duyệt 21/10/2026 (artifact RUmsXSck…, Q1–Q5 theo đề xuất).
 * Nhân sự đặt từ–đến cho kỳ đang xem. Kiểm TẠI CHỖ bằng đúng `kiemKhoang` server dùng: chồng
 * ngày / ngoài 28–35 ngày / khác gợi ý mà thiếu lý do thì nút lưu khoá, mỗi vướng kèm cách
 * gỡ. Kỳ đã chốt: hộp chỉ nói vì sao khoá và đường mở lại.
 */

import { useState } from 'react'
import {
  Btn,
  Checks,
  Consequence,
  DateInput,
  Sheet,
  SheetActions,
  Tag,
  TextArea,
  type Check,
} from '@/components/kit'
import { doiThang, khoangKy, kiemKhoang, soNgay } from '@/lib/cham-cong/khoang-ky'
import type { KyCongCtx } from './useKyCong'

const kyVn = (t: string) => `${t.slice(5)}/${t.slice(0, 4)}`
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** Câu gỡ cho từng lỗi `kiemKhoang` (lỗi là câu nghiệp vụ; phần gỡ nói cách làm). */
function goCho(loi: string): string {
  if (loi.startsWith('Chồng'))
    return 'Chọn "Từ ngày" sau ngày cuối kỳ kia (hoặc "Đến ngày" trước ngày đầu kỳ sau), hay mở kỳ kia sửa lại'
  if (loi.startsWith('Kỳ ')) return 'Sửa lại ngày — một kỳ chỉ 28–35 ngày'
  return 'Sửa lại ngày'
}

export function HopKhoang({ d }: { d: KyCongCtx }) {
  const { k } = d
  const mo = d.sheet === 'khoang'
  const [tu, setTu] = useState(k.tu)
  const [den, setDen] = useState(k.den)
  const [lyDo, setLyDo] = useState('')
  const khoa = k.trangThai !== 'open'
  const kq = kiemKhoang(k.thang, tu, den, k.dsKy)
  const thieuLyDo = kq.khacGoiY && !lyDo.trim()
  const checks: Check[] = [
    ...kq.loi.map((l): Check => ({ level: 'stop', what: l, fix: goCho(l) })),
    ...(thieuLyDo && !kq.loi.length
      ? [
          {
            level: 'stop',
            what: `Khác gợi ý nối tiếp (${dm(kq.goiY.tu)} → ${dm(kq.goiY.den)}) mà chưa ghi lý do`,
            fix: 'Ghi lý do ở ô bên dưới (vd. "Theo sổ chấm công Nhân sự"), hoặc bấm Dùng gợi ý',
          } satisfies Check,
        ]
      : []),
    ...kq.canhBao.map((c): Check => ({
      level: 'warn',
      what: c,
      fix: 'Vẫn lưu được — lượt quẹt những ngày đó sẽ không vào công ai. Nối liền với kỳ bên cạnh nếu không cố ý',
    })),
  ]
  const doi = tu !== k.tu || den !== k.den
  const gan = [-1, 0, 1].map((n) => khoangKy(doiThang(k.thang, n), k.dsKy))
  const dong = () => {
    d.setSheet(null)
    setTu(k.tu)
    setDen(k.den)
    setLyDo('')
  }

  return (
    <Sheet
      open={mo}
      onClose={dong}
      title={`Khoảng kỳ ${kyVn(k.thang)}`}
      subtitle={`Hiện ${dm(k.tu)} → ${dm(k.den)}/${k.den.slice(0, 4)} · ${soNgay(k.tu, k.den)} ngày · ${
        k.khoangDaDat ? 'Nhân sự đã đặt' : 'gợi ý (chưa ai đặt)'
      }`}
      stakes="vua"
      footer={
        khoa ? (
          <SheetActions
            stakes="vua"
            onCancel={dong}
            onConfirm={dong}
            cancelLabel="Đóng"
            confirmLabel="Đã hiểu"
          />
        ) : (
          <SheetActions
            stakes="vua"
            onCancel={dong}
            onConfirm={async () => {
              if (await d.datKhoang(tu, den, lyDo)) setLyDo('')
            }}
            confirmLabel="Lưu khoảng kỳ"
            busy={d.busy === 'khoang'}
            disabled={!doi || checks.some((c) => c.level === 'stop')}
          />
        )
      }
    >
      <table className="text-k-sm w-full border-collapse">
        <caption className="text-k-label mb-1 text-left text-[var(--ink-3)]">
          Các kỳ gần đây — mỗi ngày chỉ thuộc một kỳ
        </caption>
        <thead>
          <tr className="text-k-label text-[var(--ink-2)]">
            <th className="border-b border-[var(--line)] py-1 text-left font-semibold">
              Kỳ
            </th>
            <th className="border-b border-[var(--line)] py-1 text-left font-semibold">
              Từ → đến
            </th>
            <th className="border-b border-[var(--line)] py-1 text-right font-semibold">
              Ngày
            </th>
            <th className="border-b border-[var(--line)] py-1 pl-3 text-left font-semibold">
              Khoảng
            </th>
          </tr>
        </thead>
        <tbody>
          {gan.map((g) => {
            const day = g.thang === k.thang
            return (
              <tr key={g.thang} className={day ? 'bg-[var(--act-wash)]' : undefined}>
                <td className="num border-b border-[var(--hair)] py-1">
                  {day ? <b>{kyVn(g.thang)}</b> : kyVn(g.thang)}
                </td>
                <td className="num border-b border-[var(--hair)] py-1">
                  {dm(g.tu)} → {dm(g.den)}
                </td>
                <td className="num border-b border-[var(--hair)] py-1 text-right">
                  {soNgay(g.tu, g.den)}
                </td>
                <td className="border-b border-[var(--hair)] py-1 pl-3">
                  {g.daDat ? <Tag tone="done">Đã đặt</Tag> : <Tag>Gợi ý</Tag>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {khoa ? (
        <Consequence>
          Kỳ {kyVn(k.thang)} đã chốt — khoảng kỳ khoá theo bản chốt. Muốn đổi: mở menu ⋯ →
          <b> Xin mở lại kỳ</b> (Kế toán trưởng duyệt), mở lại xong mới đổi được khoảng.
        </Consequence>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-k-sm grid gap-1">
              <span className="text-[var(--ink-2)]">Từ ngày</span>
              <DateInput label="Từ ngày" value={tu} onChange={setTu} />
            </label>
            <label className="text-k-sm grid gap-1">
              <span className="text-[var(--ink-2)]">Đến ngày</span>
              <DateInput label="Đến ngày" value={den} onChange={setDen} />
            </label>
          </div>
          <div className="text-k-sm flex flex-wrap items-center gap-2 text-[var(--ink-2)]">
            Gợi ý nối tiếp kỳ bên cạnh:
            <b className="num">
              {dm(kq.goiY.tu)} → {dm(kq.goiY.den)}
            </b>
            ({soNgay(kq.goiY.tu, kq.goiY.den)} ngày)
            {kq.khacGoiY && (
              <Btn
                onClick={() => {
                  setTu(kq.goiY.tu)
                  setDen(kq.goiY.den)
                }}
              >
                Dùng gợi ý
              </Btn>
            )}
          </div>
          <Checks title="Chưa lưu được" items={checks} />
          <label className="text-k-sm grid gap-1">
            <span className="text-[var(--ink-2)]">
              Lý do đổi{' '}
              <span className="text-[var(--ink-3)]">
                {kq.khacGoiY ? '(bắt buộc khi khác gợi ý)' : '(không bắt buộc)'}
              </span>
            </span>
            <TextArea value={lyDo} onChange={setLyDo} rows={2} maxLength={300} />
          </label>
          <Consequence>
            Lưu xong, Bảng công, phiếu điều chỉnh, ngày làm trưa và bảng lương kỳ{' '}
            {kyVn(k.thang)} đọc lại theo khoảng mới; kỳ bên cạnh chưa đặt thì gợi ý tự dời
            theo. Ghi vào Dòng thời gian của kỳ.
          </Consequence>
        </>
      )}
    </Sheet>
  )
}
