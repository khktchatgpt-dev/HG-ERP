'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PhieuTruoc, ThongTinDong, TonChu } from './thong-tin-dong'
import type { DeNghiChiTiet } from '@/modules/dept/warehouse/de-nghi.service'
import { api, apiErrorText } from '@/lib/api'
import { isoToVn, todayVn } from '@/lib/date-vn'
import { DE_NGHI_NHAN, DE_NGHI_TONE, gio } from '@/lib/de-nghi'
import {
  Btn,
  Code,
  NoticeBar,
  NumInput,
  Sheet,
  SheetActions,
  Tag,
  TextArea,
  useToast,
} from '@/components/kit'

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
const docSo = (v: string): number | null => {
  const t = v.trim()
  if (!t) return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * DUYỆT ĐỀ NGHỊ MUA VẬT TƯ — bản vẽ DN-2 (0236 · Đ2, duyệt 13/10/2026).
 *
 * Câu màn trả lời cho lãnh đạo: Kho xin mua gì, bao nhiêu, kho còn bao nhiêu,
 * để làm gì, tốn chừng nào — duyệt hay trả lại. Hôm nay lãnh đạo duyệt bằng chữ
 * "Ok" trên Zalo ĐIỆN THOẠI, nên màn dựng cho 390px trước: mỗi dòng một khối chữ
 * (tên · số · tồn · mục đích · tiền), không bảng nhiều cột phải cuộn ngang.
 *
 * Sửa số trước khi duyệt: chạm ô số lượng (0 = không mua dòng đó). Từ chối bắt
 * lý do — Kho sửa theo lý do rồi gửi lại. Điện thoại: hai nút lớn ở đáy (ngón
 * cái); máy tính (≥ 768px): nút ở góc trên phải như mọi màn.
 */
export function DuyetDeNghiScreen({
  phieu: p,
  canApprove,
  laNguoiDeNghi = false,
}: {
  phieu: DeNghiChiTiet
  canApprove: boolean
  /** Người xem chính là người đề nghị — nói đúng vì sao không có nút duyệt. */
  laNguoiDeNghi?: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const cho = p.status === 'pending'
  const duyetDuoc = cho && canApprove
  const [so, setSo] = useState<Record<string, number>>(() =>
    Object.fromEntries(p.lines.map((l) => [l.id, l.approved_qty ?? l.qty])),
  )
  const [busy, setBusy] = useState(false)
  const [moTuChoi, setMoTuChoi] = useState(false)
  const [ly, setLy] = useState('')

  const tong = useMemo(
    () =>
      p.lines.reduce(
        (a, l) => {
          const q = so[l.id] ?? l.qty
          if (l.unit_price == null) return { ...a, thieu: a.thieu + (q > 0 ? 1 : 0) }
          return { ...a, tien: a.tien + q * l.unit_price }
        },
        { tien: 0, thieu: 0 },
      ),
    [p.lines, so],
  )
  const daSua = p.lines.filter((l) => Math.abs((so[l.id] ?? l.qty) - l.qty) > 1e-9)
  const conMua = p.lines.filter((l) => (so[l.id] ?? l.qty) > 0).length

  async function quyet(decision: 'approve' | 'reject') {
    setBusy(true)
    try {
      await api(`/api/dept/warehouse/de-nghi/${p.id}/duyet`, {
        method: 'POST',
        body:
          decision === 'reject'
            ? { decision, reason: ly.trim() }
            : {
                decision,
                lines: daSua.map((l) => ({ id: l.id, approved_qty: so[l.id] })),
              },
      })
      toast.success(
        decision === 'approve' ? `Đã duyệt ${p.code}` : `Đã trả lại ${p.code}`,
        decision === 'approve'
          ? 'Kho đã nhận thông báo và đi mua theo số duyệt.'
          : 'Phiếu về nháp; Kho nhận lý do để sửa.',
      )
      setMoTuChoi(false)
      router.refresh()
    } catch (e) {
      toast.error('Không ghi được quyết định', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const nut = (lon: boolean) => (
    <>
      <Btn
        onClick={() => setMoTuChoi(true)}
        disabled={busy}
        className={lon ? 'h-11 flex-1 justify-center text-[15px]' : undefined}
      >
        Từ chối
      </Btn>
      <Btn
        icon="duyet"
        primary
        onClick={() => void quyet('approve')}
        disabled={busy || conMua === 0}
        title={
          conMua === 0 ? 'Mọi dòng đang là 0 — bấm Từ chối nếu không mua gì' : undefined
        }
        className={lon ? 'h-11 flex-1 justify-center text-[15px]' : undefined}
      >
        {busy
          ? 'Đang ghi…'
          : daSua.length > 0
            ? `Duyệt (sửa ${daSua.length} dòng)`
            : 'Duyệt'}
      </Btn>
    </>
  )

  return (
    <div className="theme-v3 kit text-foreground -m-4 flex min-h-full flex-col bg-[var(--surface)] sm:-m-6">
      {/* Máy tính: khung đọc 900px — dòng trải cả 1.068px thì tên và số cách nhau quá xa. */}
      <div className="mx-auto flex w-full max-w-[900px] flex-1 flex-col md:border-x md:border-[var(--line)]">
        {/* Đầu phiếu */}
        <header className="flex flex-wrap items-start gap-x-4 gap-y-1 border-b border-[var(--line)] bg-[var(--surface-card)] px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-k-label font-semibold tracking-[.08em] text-[var(--ink-3)] uppercase">
              {canApprove && (
                <Link
                  href="/duyet/de-nghi"
                  className="text-[var(--act-text)] hover:underline"
                >
                  ‹ Danh sách ·{' '}
                </Link>
              )}
              Đề nghị mua vật tư{cho && canApprove ? ' · chờ anh duyệt' : ''}
            </span>
            <h1 className="text-k-title m-0 flex flex-wrap items-center gap-2 font-semibold">
              <span className="num">{p.code}</span>
              <Tag tone={DE_NGHI_TONE[p.status]}>{DE_NGHI_NHAN[p.status]}</Tag>
            </h1>
            <span className="text-k-body">
              {p.requested_by_name ?? '—'} · {p.department}
              {p.submitted_at && (
                <span className="text-[var(--ink-3)]"> · gửi {gio(p.submitted_at)}</span>
              )}
            </span>
            <span className="text-k-sm text-[var(--ink-3)]">
              {[
                p.need_by ? `Cần trước ${isoToVn(p.need_by)}` : null,
                p.lsx_code ? `Lệnh ${p.lsx_code}` : null,
                p.note,
              ]
                .filter(Boolean)
                .join(' · ') || 'Không ghi chú'}
            </span>
          </div>
          {duyetDuoc && (
            <div className="hidden items-center gap-2 md:flex">{nut(false)}</div>
          )}
        </header>

        {cho && !canApprove && (
          <NoticeBar tone="warn" tag="Chờ duyệt">
            Phiếu đang chờ lãnh đạo duyệt. Tài khoản này không duyệt được
            {laNguoiDeNghi
              ? ' — người đề nghị không tự duyệt phiếu của mình'
              : ' — cần quyền duyệt đơn mua (ban giám đốc)'}
            .
          </NoticeBar>
        )}
        {p.status === 'approved' && (
          <NoticeBar tone="neutral" tag="Đã duyệt">
            {p.approved_by_name ?? 'Lãnh đạo'} duyệt lúc {gio(p.approved_at)} — Kho đi mua
            theo số duyệt rồi nhập kho theo phiếu.
          </NoticeBar>
        )}
        {p.status === 'draft' && p.rejected_at && (
          <NoticeBar tone="stop" tag="Đã trả lại">
            {p.rejected_by_name ?? 'Lãnh đạo'} trả lại lúc {gio(p.rejected_at)}: “
            {p.rejected_reason}”. Kho đang sửa.
          </NoticeBar>
        )}
        {p.status === 'cancelled' && (
          <NoticeBar tone="neutral" tag="Đã huỷ">
            Kho đã huỷ phiếu: {p.cancel_reason}
          </NoticeBar>
        )}

        {p.phieu_truoc && <PhieuTruoc t={p.phieu_truoc} />}

        {/* Dòng hàng: mỗi dòng một khối chữ — đọc được ở 390px, không cuộn ngang. */}
        <ul className="m-0 flex list-none flex-col p-0" aria-label="Vật tư đề nghị mua">
          {p.lines.map((l) => {
            const q = so[l.id] ?? l.qty
            const sua = Math.abs(q - l.qty) > 1e-9
            return (
              <li
                key={l.id}
                className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 border-b border-[var(--hair)] bg-[var(--surface-card)] px-4 py-2.5"
              >
                <span className="text-k-body min-w-0 font-semibold">{l.name}</span>
                <span className="flex items-center justify-end gap-1.5">
                  {duyetDuoc ? (
                    <NumInput
                      value={String(q)}
                      onCommit={(v) => {
                        const n = docSo(v)
                        if (n != null) setSo((s) => ({ ...s, [l.id]: n }))
                      }}
                      aria-label={`Số duyệt ${l.code ?? l.name}`}
                      style={{ width: 84 }}
                    />
                  ) : (
                    <b className="num">{fmt(l.approved_qty ?? l.qty)}</b>
                  )}
                  <span className="text-k-sm text-[var(--ink-3)]">{l.unit}</span>
                </span>
                <span className="text-k-sm min-w-0 text-[var(--ink-3)]">
                  {l.code ? <Code>{l.code}</Code> : <Tag tone="warn">chưa có mã</Tag>}
                  <TonChu l={l} />
                  {l.purpose && <span> · {l.purpose}</span>}
                </span>
                <span className="text-k-sm text-right text-[var(--ink-2)]">
                  {sua || l.approved_qty != null ? (
                    <span className="text-[var(--warn)]">đề nghị {fmt(l.qty)} · </span>
                  ) : null}
                  {l.unit_price == null ? (
                    <span className="text-[var(--ink-empty)]">chưa có giá</span>
                  ) : (
                    <span className="num">{fmt(Math.round(q * l.unit_price))} đ</span>
                  )}
                </span>
                <ThongTinDong l={l} />
              </li>
            )
          })}
        </ul>

        <div className="text-k-sm flex flex-wrap items-baseline justify-between gap-2 bg-[var(--surface-card)] px-4 py-2.5">
          <span className="text-[var(--ink-2)]">
            {p.lines.length} dòng{tong.thieu > 0 && ` · ${tong.thieu} dòng chưa có giá`} ·
            chưa VAT, chưa vận chuyển
          </span>
          <span>
            Dự kiến <b className="num text-k-lg">{fmt(Math.round(tong.tien))} đ</b>
          </span>
        </div>

        {/* Điện thoại: hai nút lớn dính đáy (bản vẽ DN-2). Máy tính đã có ở đầu phiếu. */}
        {duyetDuoc && (
          <div className="sticky bottom-0 mt-auto flex flex-col gap-1 border-t border-[var(--line)] bg-[var(--surface-card)] px-4 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom,0px))] md:hidden">
            <div className="flex gap-2">{nut(true)}</div>
            <span className="text-k-label text-center text-[var(--ink-3)]">
              Chạm số lượng để sửa trước khi duyệt · 0 = không mua dòng đó
            </span>
          </div>
        )}
      </div>

      {moTuChoi && (
        <Sheet
          open
          onClose={() => setMoTuChoi(false)}
          title={`Từ chối ${p.code}`}
          subtitle="Phiếu về nháp. Kho nhận thông báo kèm lý do, sửa rồi gửi lại."
          stakes="nang"
          width={480}
          footer={
            <SheetActions
              onCancel={() => setMoTuChoi(false)}
              onConfirm={() => void quyet('reject')}
              confirmLabel="Gửi từ chối"
              cancelLabel="Quay lại"
              stakes="nang"
              busy={busy}
              disabled={ly.trim().length < 3}
            />
          }
        >
          <label className="text-k-body flex flex-col gap-1">
            <span className="font-semibold">
              Lý do (bắt buộc, gửi cho {p.requested_by_name ?? 'Kho'})
            </span>
            <TextArea
              value={ly}
              onChange={setLy}
              rows={4}
              placeholder="VD: găng tay tháng trước mới mua 200 đôi — kiểm lại tồn rồi gửi lại"
              aria-label="Lý do từ chối"
            />
          </label>
        </Sheet>
      )}
      <span className="sr-only">Ngày xem {isoToVn(todayVn())}</span>
    </div>
  )
}
