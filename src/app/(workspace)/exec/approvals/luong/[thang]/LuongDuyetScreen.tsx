'use client'

/**
 * DUYỆT BẢNG LƯƠNG — màn của sếp (bản vẽ duyệt 21/10/2026, https://claude.ai/artifact/8BH9Nam6…,
 * Q1–Q5 theo đề xuất). Khuôn D (chứng từ) rút gọn: vòng đời + người giữ + bảng tổng + điều kiện.
 * Câu hỏi của màn: "kỳ này trả bao nhiêu, ở đâu tăng bất thường, đã kiểm đủ chưa — duyệt hay
 * trả lại?". Chỉ TỔNG theo khối → tổ (Q9 của 20/10: sếp không thấy lương từng người).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Consequence,
  Empty,
  HolderBar,
  NoticeBar,
  ScreenFrame,
  ScreenHeader,
  StatusTrack,
  Tag,
  TextArea,
  Timeline,
  useToast,
  type Mark,
} from '@/components/kit'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { DongTong } from '@/lib/luong/tong-duyet'
import type { DuyetLuongTrang } from '@/modules/dept/hr/luong/duyet-luong.service'

const so = (n: number) => Math.round(n).toLocaleString('vi-VN')
const kyVn = (t: string) => `${t.slice(5, 7)}/${t.slice(0, 4)}`
const ngay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const luc = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'
const TH =
  'sticky top-0 z-[1] border-b border-[var(--line)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-left font-semibold text-[var(--ink-2)] whitespace-nowrap'
const TD = 'border-b border-[var(--line-faint)] px-2.5 py-1.5 whitespace-nowrap'
const TF =
  'sticky bottom-0 bg-[var(--surface-raised)] border-t border-[var(--line)] px-2.5 py-1.5 whitespace-nowrap font-semibold'
const R = { textAlign: 'right' as const }

const TEN_TT = {
  draft: 'Nháp',
  submitted: 'Chờ duyệt',
  approved: 'Đã duyệt',
  paid: 'Đã chi',
} as const

const VIEC: Record<string, { ten: string; tone: Mark['tone'] }> = {
  calculate: { ten: 'Tính bảng lương', tone: 'act' },
  submit: { ten: 'Gửi sếp duyệt', tone: 'warn' },
  withdraw: { ten: 'Rút về nháp', tone: 'act' },
  approve: { ten: 'Sếp duyệt', tone: 'done' },
  return: { ten: 'Sếp trả lại', tone: 'stop' },
  reopen: { ten: 'Mở lại bảng đã duyệt', tone: 'warn' },
  paid: { ten: 'Đã chi', tone: 'done' },
}

export function LuongDuyetScreen({ t }: { t: DuyetLuongTrang }) {
  const router = useRouter()
  const toast = useToast()
  const [traLai, setTraLai] = useState(false)
  const [lyDo, setLyDo] = useState('')
  const [busy, setBusy] = useState<'duyet' | 'tra' | null>(null)
  const b = t.bang
  const tt = b?.trangThai ?? null

  async function quyet(dongY: boolean) {
    if (!dongY && !lyDo.trim()) return
    setBusy(dongY ? 'duyet' : 'tra')
    try {
      await api(`/api/dept/hr/luong/bang/${t.thang}`, {
        method: 'POST',
        body: { viec: 'quyet', dongY, lyDo: dongY ? undefined : lyDo.trim() },
      })
      toast.success(
        dongY
          ? `Đã duyệt bảng lương ${kyVn(t.thang)} — đã báo người gửi`
          : `Đã trả lại bảng lương ${kyVn(t.thang)} — đã báo người gửi`,
      )
      setTraLai(false)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Không thực hiện được — thử lại')
    } finally {
      setBusy(null)
    }
  }

  return (
    <ScreenFrame tableMin={0}>
      <ScreenHeader
        compact
        eyebrow="Lương · Duyệt bảng lương"
        title={`Bảng lương kỳ ${kyVn(t.thang)}`}
        status={tt ? <Tag tone={tt === 'submitted' ? 'warn' : 'done'}>{TEN_TT[tt]}</Tag> : <Tag>Chưa có</Tag>} // prettier-ignore
        facts={[
          ...(t.ky ? [{ label: '', value: `${ngay(t.ky.tu)} → ${ngay(t.ky.den)}` }] : []),
          ...(b?.guiLuc
            ? [{ label: 'Gửi', value: `${b.guiBoi ?? '—'} · ${luc(b.guiLuc)}` }]
            : []),
          ...(b?.lanTinh ? [{ label: 'Tính lần', value: String(b.lanTinh) }] : []),
        ]}
        actions={
          t.quyen.duyet && (
            <>
              <Btn icon="traLai" onClick={() => setTraLai(true)}>
                Trả lại…
              </Btn>
              <Btn
                primary
                icon="duyet"
                busy={busy === 'duyet'}
                onClick={() => quyet(true)}
              >
                Duyệt bảng lương
              </Btn>
            </>
          )
        }
      />
      {b && (
        <div className="flex flex-wrap items-center gap-x-6 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1">
          <StatusTrack
            label="Vòng đời bảng lương"
            steps={['Nháp', 'Chờ sếp duyệt', 'Đã duyệt', 'Đã chi']}
            at={tt === 'paid' ? 3 : tt === 'approved' ? 2 : tt === 'submitted' ? 1 : 0}
            tone={tt === 'paid' ? 'done' : tt === 'submitted' ? 'wait' : 'run'}
          />
          {tt === 'submitted' ? (
            <HolderBar inline who="Ban Giám Đốc" what="duyệt hoặc trả lại" age={luc(b.guiLuc)} /> // prettier-ignore
          ) : tt === 'approved' ? (
            <HolderBar inline who="Tài Chính Kế Toán" what="chuyển khoản rồi ghi đã chi" age={luc(b.duyetLuc)} /> // prettier-ignore
          ) : tt === 'draft' ? (
            <HolderBar
              inline
              who="Tài Chính Kế Toán"
              what="kiểm tra, sửa rồi gửi duyệt"
            />
          ) : null}
        </div>
      )}
      {!t.quyen.duyet && t.quyen.lyDo && b && (
        <NoticeBar tone="neutral" tag="Không cần duyệt lúc này">
          {t.quyen.lyDo}
        </NoticeBar>
      )}
      {traLai && (
        <div className="grid gap-2 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-2.5">
          <label className="text-k-sm font-semibold" htmlFor="duyet-luong-ly-do">
            Lý do trả lại (người gửi thấy ở đầu màn Bảng lương)
          </label>
          <TextArea
            id="duyet-luong-ly-do"
            aria-label="Lý do trả lại"
            value={lyDo}
            onChange={setLyDo}
            rows={2}
          />
          <Consequence>
            Bảng về Nháp kèm lý do; người gửi được báo, sửa ở nguồn, Tính lại rồi gửi lại.
          </Consequence>
          <div className="flex gap-2">
            <Btn onClick={() => setTraLai(false)}>Huỷ</Btn>
            <Btn
              primary
              busy={busy === 'tra'}
              aria-disabled={!lyDo.trim()}
              onClick={() => quyet(false)}
            >
              Trả lại cho người gửi
            </Btn>
            {!lyDo.trim() && (
              <span className="text-k-sm self-center text-[var(--warn)]">
                Ghi lý do trước khi trả lại.
              </span>
            )}
          </div>
        </div>
      )}
      {!b || !t.so.nguoi ? (
        <Empty
          headline={`Chưa có bảng lương kỳ ${kyVn(t.thang)} để duyệt`}
          reason={
            b
              ? 'Bảng chưa tính phiếu nào — Kỳ công chưa chốt hoặc chưa ai có hồ sơ lương.'
              : 'Kỳ công chưa chốt hoặc người quản lý lương chưa lập bảng.'
          }
          next="Có bảng gửi lên, chuông sẽ báo và bảng hiện ở Chờ tôi phê duyệt."
        />
      ) : (
        <>
          <ODem t={t} />
          {t.ghiChuGui && (
            <NoticeBar tone="neutral" tag={`${b.guiBoi ?? 'Người gửi'} ghi`}>
              {t.ghiChuGui}
            </NoticeBar>
          )}
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px] max-[900px]:grid-cols-1">
            <BangTong t={t} />
            <BenPhai t={t} />
          </div>
        </>
      )}
    </ScreenFrame>
  )
}

/** Bốn ô đếm — số trên đầu = đúng tổng của bảng bên dưới (dòng Cộng). */
function ODem({ t }: { t: DuyetLuongTrang }) {
  const s = t.so
  const o = [
    { ten: 'Số người', so: so(s.nguoi), phu: s.truocNguoi != null ? `kỳ trước ${so(s.truocNguoi)}` : 'kỳ trước: chưa có trong ERP' }, // prettier-ignore
    { ten: 'Tổng thu nhập', so: so(s.tong), phu: 'trước BH, đoàn phí, khoản trừ' },
    { ten: 'Thực lĩnh (chuyển khoản)', so: so(s.thucLinh), phu: s.truocThucLinh != null ? `kỳ trước ${so(s.truocThucLinh)}` : 'kỳ trước: chưa có trong ERP' }, // prettier-ignore
    { ten: 'BH người lao động', so: so(s.bhNld), phu: `${s.coBh} người đóng BH` },
  ]
  return (
    <div className="grid grid-cols-4 border-b border-[var(--line)] bg-[var(--surface-card)] max-[700px]:grid-cols-2">
      {o.map((x) => (
        <div
          key={x.ten}
          className="border-r border-[var(--line-faint)] px-[var(--gutter)] py-1.5 last:border-r-0"
        >
          <span className="text-k-sm text-[var(--ink-2)]">{x.ten}</span>
          <b className="text-k-lg num block font-semibold">{x.so}</b>
          <span className="text-k-label text-[var(--ink-3)]">{x.phu}</span>
        </div>
      ))}
    </div>
  )
}

function Chenh({ d }: { d: DongTong }) {
  if (d.chenh == null) return <span className="text-[var(--ink-3)]">—</span>
  const pt = (d.chenh * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })
  return (
    <span className={cn(d.canhBao && 'font-semibold text-[var(--warn)]')}>
      {d.chenh > 0 ? '+' : ''}
      {pt} %
    </span>
  )
}

function Dong({ d, khoi }: { d: DongTong; khoi?: boolean }) {
  return (
    <tr className={cn(khoi && 'bg-[var(--surface-raised)] font-semibold')}>
      <td className={cn(TD, !khoi && 'pl-6')}>{d.ten}</td>
      <td className={cn(TD, 'num')} style={R}>
        {d.nguoi}
      </td>
      <td className={cn(TD, 'num')} style={R}>
        {so(d.tong)}
      </td>
      <td className={cn(TD, 'num')} style={R}>
        {so(d.tru)}
      </td>
      <td className={cn(TD, 'num')} style={R}>
        {so(d.thucLinh)}
      </td>
      <td className={cn(TD, 'num')} style={R}>
        <Chenh d={d} />
      </td>
    </tr>
  )
}

function BangTong({ t }: { t: DuyetLuongTrang }) {
  const c = t.cong
  return (
    <div className="min-h-0 overflow-auto bg-[var(--surface-card)]">
      <table className="text-k-sm w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={TH}>Bộ phận</th>
            <th className={TH} style={R}>
              Người
            </th>
            <th className={TH} style={R}>
              Tổng thu nhập
            </th>
            <th className={TH} style={R}>
              Trừ (BH, đoàn phí, ứng)
            </th>
            <th className={TH} style={R}>
              Thực lĩnh
            </th>
            <th className={TH} style={R}>
              So kỳ trước
            </th>
          </tr>
        </thead>
        <tbody>
          {t.khoi.map((k) => [
            <Dong key={k.khoi} d={k} khoi />,
            ...k.to.map((to) => <Dong key={`${k.khoi}|${to.ten}`} d={to} />),
          ])}
        </tbody>
        <tfoot>
          <tr>
            <td className={TF}>
              Cộng {t.khoi.reduce((s, k) => s + k.to.length, 0)} bộ phận · không gồm thuế
              TNCN (tính, chưa trừ)
            </td>
            <td className={cn(TF, 'num')} style={R}>
              {c.nguoi}
            </td>
            <td className={cn(TF, 'num')} style={R}>
              {so(c.tong)}
            </td>
            <td className={cn(TF, 'num')} style={R}>
              {so(c.tru)}
            </td>
            <td className={cn(TF, 'num')} style={R}>
              {so(c.thucLinh)}
            </td>
            <td className={cn(TF, 'num')} style={R}>
              <Chenh d={c} />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function BenPhai({ t }: { t: DuyetLuongTrang }) {
  const marks: Mark[] = [...t.suKien].reverse().map((e, i) => {
    const v = VIEC[e.viec] ?? { ten: e.viec, tone: 'act' as const }
    return {
      key: `${i}-${e.luc}`,
      at: e.luc,
      label: v.ten,
      actor: e.boi,
      detail: e.ghiChu,
      tone: v.tone,
    }
  })
  return (
    <aside className="text-k-sm grid content-start gap-4 border-l border-[var(--line)] bg-[var(--surface-card)] px-3.5 py-3 max-[900px]:border-t max-[900px]:border-l-0">
      <section>
        <h2 className="text-k-label m-0 mb-1.5 font-semibold tracking-wide text-[var(--ink-3)] uppercase">
          Đã kiểm trước khi gửi
        </h2>
        <ul className="m-0 grid list-none gap-1 p-0">
          {t.dieuKien.map((x) => (
            <li key={x.ma} className="grid grid-cols-[16px_1fr] gap-1.5">
              <span
                className={cn(
                  'font-bold',
                  x.ok ? 'text-[var(--done)]' : 'text-[var(--stop)]',
                )}
                aria-hidden
              >
                {x.ok ? '✓' : '✕'}
              </span>
              <span>
                {x.ten}: <span className="num">{x.chiTiet}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-k-label m-0 mb-1.5 font-semibold tracking-wide text-[var(--ink-3)] uppercase">
          Dòng thời gian
        </h2>
        {marks.length ? (
          <Timeline marks={marks} />
        ) : (
          <p className="m-0 text-[var(--ink-3)]">Chưa có việc gì.</p>
        )}
      </section>
      <p className="m-0 text-[var(--ink-3)]">
        Sếp không thấy lương từng người. Muốn hỏi kỹ thì trả lại kèm câu hỏi.
      </p>
    </aside>
  )
}
