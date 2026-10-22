'use client'

/**
 * CÔNG CỘNG THÊM NGOÀI MÁY — khối B (bản vẽ duyệt 22/10/2026, PYQ1Dw2W…, Q3 + Q5 theo đề xuất).
 * Công Nhân sự cộng tay cho người CÓ chấm công: "Công ngoài giờ" của tổ Sơn (sổ TH cột 32,
 * Kế toán cộng vào công tăng ca → dòng riêng nhóm tăng ca trên phiếu lương), ngày làm Chủ nhật
 * không quẹt (công thường). Một người nhiều dòng được. Không bắt buộc, không chặn chốt.
 */

import { useState } from 'react'
import {
  Btn,
  Combobox,
  Consequence,
  NumInput,
  Pick,
  Sheet,
  SheetActions,
  Tag,
  TextArea,
  TextInput,
} from '@/components/kit'
import { cn } from '@/lib/utils'
import {
  docDan,
  docSo,
  kiemThem,
  LY_DO_THEM,
  soNgayKy,
  TEN_LY_DO_THEM,
  type LyDoThem,
} from '@/lib/cham-cong/cong-nhap-tay'
import type { KyCongCtx, KyCongTrang } from './useKyCong'
import { lucVn, so } from './ky.shared'
import { TD, TH } from './ngan-to'

type Dong = KyCongTrang['congThem'][number]
const R = { textAlign: 'right' as const }
const LY_DO_OPT = LY_DO_THEM.map((l) => ({ value: l, label: TEN_LY_DO_THEM[l] }))

export function KhoiCongThem({ d }: { d: KyCongCtx }) {
  const { k } = d
  const sua = d.mo && k.quyen.nhapTay
  const ngayKy = soNgayKy(k.tu, k.den)
  const [moi, setMoi] = useState<{ ma: string; lyDo: LyDoThem } | null>(null)
  const nguoiOpt = k.chonThem.map((n) => ({
    value: n.ma,
    label: `${n.ma} · ${n.ten}`,
    hint: n.to ?? undefined,
  }))
  const tong = (l?: LyDoThem) =>
    k.congThem.filter((x) => !l || x.lyDo === l).reduce((s, x) => s + x.cong, 0)

  return (
    <div className="flex flex-col border-t-2 border-[var(--line)]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-2">
        <div className="text-k-sm max-w-[80ch] text-[var(--ink-2)]">
          <b className="text-[var(--ink)]">B · Công cộng thêm ngoài máy.</b> Cho người có
          chấm công: “Công ngoài giờ” trả như tăng ca (số công × đơn giá ngày, dòng riêng
          trên phiếu lương); “Làm Chủ nhật”, “Khác” cộng vào số công thường. Không bắt
          buộc.
        </div>
        <span className="flex-1" />
        {sua && (
          <>
            <Btn icon="them" onClick={() => setMoi({ ma: '', lyDo: 'ngoai_gio' })}>
              Thêm dòng
            </Btn>
            <Btn icon="excel" onClick={() => d.setSheet('dan')}>
              Dán từ Excel
            </Btn>
          </>
        )}
      </div>
      <div className="overflow-auto">
        <table className="text-k-sm w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className={TH} style={{ minWidth: 240 }}>
                Người
              </th>
              <th className={TH}>Tổ</th>
              <th className={TH} style={{ width: 170 }}>
                Lý do
              </th>
              <th className={TH} style={{ ...R, width: 96 }}>
                Công
              </th>
              <th className={TH} style={{ minWidth: 180 }}>
                Ghi chú
              </th>
              <th className={TH}>Người sửa</th>
              <th className={TH} aria-label="Xoá" />
            </tr>
          </thead>
          <tbody>
            {k.congThem.map((x) => (
              <HangThem
                key={x.id}
                x={x}
                d={d}
                sua={sua}
                ngayKy={ngayKy}
                nguoiOpt={nguoiOpt}
              />
            ))}
            {moi && (
              <HangMoi
                d={d}
                moi={moi}
                setMoi={setMoi}
                ngayKy={ngayKy}
                nguoiOpt={nguoiOpt}
              />
            )}
            {!k.congThem.length && !moi && (
              <tr>
                <td className={cn(TD, 'text-[var(--ink-3)]')} colSpan={7}>
                  Kỳ này chưa có công cộng thêm.{' '}
                  {sua
                    ? 'Tổ Sơn có cột “Công ngoài giờ” trong sổ TH thì bấm Dán từ Excel, dán hai cột mã + công.'
                    : ''}
                </td>
              </tr>
            )}
          </tbody>
          {k.congThem.length > 0 && (
            <tfoot>
              <tr>
                <td
                  className={cn(TD, 'bg-[var(--surface-raised)] font-semibold')}
                  colSpan={3}
                >
                  {k.congThem.length} dòng ·{' '}
                  {LY_DO_THEM.filter((l) => tong(l) > 0)
                    .map((l) => `${TEN_LY_DO_THEM[l]} ${so(tong(l), 2)}`)
                    .join(' · ')}
                </td>
                <td
                  className={cn(TD, 'num bg-[var(--surface-raised)] font-semibold')}
                  style={R}
                >
                  {so(tong(), 2)}
                </td>
                <td
                  className={cn(TD, 'bg-[var(--surface-raised)] text-[var(--ink-3)]')}
                  colSpan={3}
                >
                  Công cộng thêm không gồm công từ máy và công khối A
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <HopDan d={d} ngayKy={ngayKy} />
    </div>
  )
}

function HangThem({
  x,
  d,
  sua,
  ngayKy,
  nguoiOpt,
}: {
  x: Dong
  d: KyCongCtx
  sua: boolean
  ngayKy: number
  nguoiOpt: { value: string; label: string; hint?: string }[]
}) {
  const [loi, setLoi] = useState<string | null>(null)
  const dang = d.busy === `them:${x.id}`
  async function ghi(p: {
    ma?: string
    lyDo?: LyDoThem
    cong?: number | null
    ghiChu?: string | null
  }) {
    const v = { ma: x.ma, lyDo: x.lyDo, cong: x.cong, ghiChu: x.ghiChu, ...p }
    const l = kiemThem(v.cong, ngayKy) ?? (v.ma ? null : 'Chọn người')
    if (l) return setLoi(l)
    setLoi(null)
    if (v.ma === x.ma && v.lyDo === x.lyDo && v.cong === x.cong && v.ghiChu === x.ghiChu)
      return
    await d.congThem({ viec: 'sua_cong', id: x.id, ...v }, `them:${x.id}`)
  }
  if (!sua)
    return (
      <tr>
        <td className={TD}>
          <span className="num text-[var(--ink-3)]">{x.ma}</span> {x.ten}
        </td>
        <td className={cn(TD, 'text-[var(--ink-2)]')}>{x.to ?? '—'}</td>
        <td className={TD}>{TEN_LY_DO_THEM[x.lyDo]}</td>
        <td className={cn(TD, 'num')} style={R}>
          {so(x.cong, 2)}
        </td>
        <td className={cn(TD, 'text-[var(--ink-2)]')}>{x.ghiChu ?? ''}</td>
        <td className={cn(TD, 'text-k-label text-[var(--ink-3)]')}>
          {x.nguoiSua ?? '—'} · {lucVn(x.lucSua)}
        </td>
        <td className={TD} />
      </tr>
    )
  return (
    <tr className={cn(loi && 'bg-[var(--stop-wash)]')}>
      <td className={cn(TD, 'py-0.5')}>
        <Combobox
          label={`Người của dòng ${x.ma}`}
          options={nguoiOpt}
          value={x.ma}
          disabled={dang}
          onChange={(v) => v && ghi({ ma: v })}
        />
      </td>
      <td className={cn(TD, 'text-[var(--ink-2)]')}>{x.to ?? '—'}</td>
      <td className={cn(TD, 'py-0.5')}>
        <Pick
          label={`Lý do của dòng ${x.ma}`}
          value={x.lyDo}
          disabled={dang}
          options={LY_DO_OPT}
          onChange={(v) => ghi({ lyDo: v as LyDoThem })}
        />
      </td>
      <td className={cn(TD, 'py-0.5')}>
        <NumInput
          aria-label={`Công cộng thêm của ${x.ten}`}
          value={so(x.cong, 2)}
          disabled={dang}
          onCommit={(s) => ghi({ cong: docSo(s) })}
          className={cn(loi && 'border-[var(--stop)]')}
        />
      </td>
      <td className={cn(TD, 'py-0.5')}>
        <TextInput
          label={`Ghi chú dòng ${x.ma}`}
          value={x.ghiChu ?? ''}
          disabled={dang}
          onCommit={(s) => ghi({ ghiChu: s.trim() || null })}
        />
        {loi && (
          <span className="text-k-sm block text-[var(--stop)]">{loi} — chưa lưu</span>
        )}
      </td>
      <td className={cn(TD, 'text-k-label text-[var(--ink-3)]')}>
        {x.nguoiSua ?? '—'} · {lucVn(x.lucSua)}
      </td>
      <td className={cn(TD, 'py-0.5')}>
        <Btn
          icon="xoa"
          aria-label={`Xoá dòng công cộng thêm của ${x.ten}`}
          busy={dang}
          onClick={() =>
            d.congThem(
              { viec: 'xoa_cong', id: x.id },
              `them:${x.id}`,
              `Đã xoá ${so(x.cong, 2)} công cộng thêm của ${x.ma}`,
            )
          }
        >
          {''}
        </Btn>
      </td>
    </tr>
  )
}

function HangMoi({
  d,
  moi,
  setMoi,
  ngayKy,
  nguoiOpt,
}: {
  d: KyCongCtx
  moi: { ma: string; lyDo: LyDoThem }
  setMoi: (v: { ma: string; lyDo: LyDoThem } | null) => void
  ngayKy: number
  nguoiOpt: { value: string; label: string; hint?: string }[]
}) {
  const [loi, setLoi] = useState<string | null>(null)
  const to = d.k.chonThem.find((n) => n.ma === moi.ma)?.to
  async function ghiCong(s: string) {
    const cong = docSo(s)
    const l = moi.ma ? kiemThem(cong, ngayKy) : 'Chọn người trước'
    if (l) return setLoi(l)
    setLoi(null)
    const ok = await d.congThem(
      { viec: 'them_cong', dong: [{ ma: moi.ma, cong, lyDo: moi.lyDo, ghiChu: null }] },
      'them:moi',
      `Đã cộng ${so(cong ?? 0, 2)} công cho ${moi.ma}`,
    )
    if (ok) setMoi(null)
  }
  return (
    <tr className="bg-[var(--act-wash)]">
      <td className={cn(TD, 'py-0.5')}>
        <Combobox
          label="Người của dòng mới"
          options={nguoiOpt}
          value={moi.ma}
          onChange={(v) => setMoi({ ...moi, ma: v })}
        />
      </td>
      <td className={cn(TD, 'text-[var(--ink-2)]')}>{to ?? '—'}</td>
      <td className={cn(TD, 'py-0.5')}>
        <Pick
          label="Lý do của dòng mới"
          value={moi.lyDo}
          options={LY_DO_OPT}
          onChange={(v) => setMoi({ ...moi, lyDo: v as LyDoThem })}
        />
      </td>
      <td className={cn(TD, 'py-0.5')}>
        <NumInput
          aria-label="Công của dòng mới"
          value=""
          placeholder="công"
          disabled={d.busy === 'them:moi'}
          onCommit={ghiCong}
          className={cn(loi && 'border-[var(--stop)]')}
        />
      </td>
      <td className={cn(TD, 'whitespace-normal')} colSpan={2}>
        {loi ? (
          <span className="text-k-sm text-[var(--stop)]">{loi}</span>
        ) : (
          <span className="text-k-sm text-[var(--ink-3)]">
            Chọn người, lý do, gõ số công rồi rời ô là lưu
          </span>
        )}
      </td>
      <td className={cn(TD, 'py-0.5')}>
        <Btn icon="huy" aria-label="Bỏ dòng mới" onClick={() => setMoi(null)}>
          {''}
        </Btn>
      </td>
    </tr>
  )
}

/** Dán hai cột mã + công từ sổ TH (cột "CÔNG NGOÀI GIỜ"). Mã lạ bày ra, không gửi. */
function HopDan({ d, ngayKy }: { d: KyCongCtx; ngayKy: number }) {
  const [text, setText] = useState('')
  const [lyDo, setLyDo] = useState<LyDoThem>('ngoai_gio')
  const mo = d.sheet === 'dan'
  const theoMa = new Map(d.k.chonThem.map((n) => [n.ma, n]))
  const { dong, hong } = docDan(text)
  const ok = dong.filter((x) => theoMa.has(x.ma) && !kiemThem(x.cong, ngayKy))
  const la = dong.filter((x) => !theoMa.has(x.ma))
  const sai = dong.filter((x) => theoMa.has(x.ma) && kiemThem(x.cong, ngayKy))
  const dong_ = () => {
    d.setSheet(null)
    setText('')
  }
  return (
    <Sheet
      open={mo}
      onClose={dong_}
      title="Dán công cộng thêm từ Excel"
      subtitle="Hai cột: mã nhân viên ⇥ số công (cột ghi chú thứ ba tuỳ ý). Dòng tiêu đề tự bỏ."
      stakes="vua"
      footer={
        <SheetActions
          stakes="vua"
          onCancel={dong_}
          onConfirm={async () => {
            const xong = await d.congThem(
              {
                viec: 'them_cong',
                dong: ok.map((x) => ({ ma: x.ma, cong: x.cong, lyDo, ghiChu: x.ghiChu })),
              },
              'dan',
              `Đã thêm ${ok.length} dòng ${TEN_LY_DO_THEM[lyDo].toLowerCase()}`,
            )
            if (xong) dong_()
          }}
          confirmLabel={`Thêm ${ok.length} dòng`}
          busy={d.busy === 'dan'}
          disabled={!ok.length}
        />
      }
    >
      <label className="text-k-sm grid gap-1">
        <span className="text-[var(--ink-2)]">Lý do cho mọi dòng dán</span>
        <Pick
          label="Lý do"
          value={lyDo}
          options={LY_DO_OPT}
          onChange={(v) => setLyDo(v as LyDoThem)}
        />
      </label>
      <label className="text-k-sm grid gap-1">
        <span className="text-[var(--ink-2)]">Dán ở đây (Ctrl+V từ Excel)</span>
        <TextArea aria-label="Dữ liệu dán" value={text} onChange={setText} rows={8} />
      </label>
      {(dong.length > 0 || hong.length > 0) && (
        <div className="text-k-sm grid gap-1">
          <span>
            <Tag tone="done">{ok.length} dòng thêm được</Tag> · tổng{' '}
            <b className="num">
              {so(
                ok.reduce((s, x) => s + x.cong, 0),
                2,
              )}
            </b>{' '}
            công
          </span>
          {la.length > 0 && (
            <span className="text-[var(--stop)]">
              {la.length} mã không có trong danh sách người chấm công kỳ này — bỏ qua:{' '}
              {la.map((x) => x.ma).join(', ')}. Thêm tay bằng nút Thêm dòng nếu đúng
              người.
            </span>
          )}
          {sai.length > 0 && (
            <span className="text-[var(--stop)]">
              {sai.length} dòng số công sai — bỏ qua:{' '}
              {sai.map((x) => `${x.ma} (${kiemThem(x.cong, ngayKy)})`).join('; ')}
            </span>
          )}
          {hong.length > 0 && (
            <span className="text-[var(--warn)]">
              {hong.length} dòng không đọc được: {hong.slice(0, 3).join('; ')}
            </span>
          )}
        </div>
      )}
      <Consequence>
        Mỗi dòng thành một dòng khối B, ghi vết ở Dòng thời gian. Dán hai lần là cộng hai
        lần — dán lại thì xoá dòng cũ trước.
      </Consequence>
    </Sheet>
  )
}
