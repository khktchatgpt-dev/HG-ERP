'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Btn, Pick, SearchInput, Sheet } from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { codeFromScan } from '@/lib/may-moc'
import { Blocked, FormRow } from './shared'

export type LookupAsset = {
  code: string
  name: string
  kind: 'machine' | 'tool'
  model: string | null
  serial: string | null
  status: string
  hours_per_day: number
  dept_name: string | null
}

/** Danh sách gọn máy còn trên sổ (`GET /api/may-moc/assets`) — ô tìm máy + quét tem. */
export const loadLookup = () =>
  api<{ assets: LookupAsset[]; my_dept: string | null }>('/api/may-moc/assets')

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> }
type DetectorCtor = new (o: { formats: string[] }) => Detector

/**
 * QUÉT TEM QR — bản thật của "Quét tem QR" trong demo MOCA (bản demo chỉ mô
 * phỏng camera). Ba đường, như demo:
 *  1. Camera: `BarcodeDetector` của trình duyệt (Chrome / Edge trên Android,
 *     máy tính có camera). Trình duyệt không có thì nói thẳng và chỉ hai đường kia.
 *  2. Chọn tổ đang đứng → bấm đúng máy trong danh sách.
 *  3. Gõ mã in trên tem.
 * `intent="hours"` (nút "Cập nhật giờ chạy"): chỉ liệt kê máy có đồng hồ giờ và mở
 * hồ sơ kèm sẵn hộp nhập giờ (`?gio=1`).
 */
export function ScanSheet({
  intent,
  onClose,
}: {
  intent?: 'hours'
  onClose: () => void
}) {
  const router = useRouter()
  const [list, setList] = useState<LookupAsset[] | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [dept, setDept] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [cam, setCam] = useState<'off' | 'on' | 'starting'>('off')
  const [camErr, setCamErr] = useState<string | null>(null)
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    let live = true
    loadLookup().then(
      (r) => {
        if (!live) return
        setList(r.assets)
        // Như demo: mở sẵn tổ đang đứng — lấy tổ của người đăng nhập nếu tổ đó có máy.
        if (
          r.my_dept &&
          r.assets.some(
            (a) =>
              a.dept_name === r.my_dept &&
              (intent !== 'hours' || (a.kind === 'machine' && a.hours_per_day > 0)),
          )
        )
          setDept(r.my_dept)
      },
      (e) => live && setLoadErr(apiErrorText(e)),
    )
    return () => {
      live = false
    }
  }, [intent])

  const stopCam = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
  }
  // Tắt camera khi đóng hộp — để đèn camera sáng mãi là lỗi người dùng thấy ngay.
  useEffect(() => stopCam, [])

  const pool = (list ?? []).filter(
    (a) => intent !== 'hours' || (a.kind === 'machine' && a.hours_per_day > 0),
  )
  const depts = [...new Set(pool.map((a) => a.dept_name ?? '(chưa gán tổ)'))].sort(
    (a, b) => a.localeCompare(b, 'vi'),
  )
  const here = dept ? pool.filter((a) => (a.dept_name ?? '(chưa gán tổ)') === dept) : []

  function open(raw: string) {
    const c = codeFromScan(raw)
    if (!c) return setErr('gõ mã in trên tem, VD: TS-HAN-001.')
    const a = (list ?? []).find((x) => x.code.toUpperCase() === c)
    if (!a) return setErr(`không có máy mã ${c} trên sổ — kiểm lại mã trên tem.`)
    if (intent === 'hours' && !a.hours_per_day)
      return setErr(
        `${a.code} không có đồng hồ giờ chạy — lịch của máy này tính theo ngày.`,
      )
    stopCam()
    onClose()
    router.push(
      `/may-moc/may/${encodeURIComponent(a.code)}${intent === 'hours' ? '?gio=1' : ''}`,
    )
  }

  async function startCam() {
    const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
      setCamErr(
        'Trình duyệt này chưa đọc được QR bằng camera. Dùng camera điện thoại quét tem (mở thẳng hồ sơ máy), hoặc chọn tổ / gõ mã bên dưới.',
      )
      return
    }
    setCamErr(null)
    setCam('starting')
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      stream.current = s
      const v = video.current
      if (!v) return stopCam()
      v.srcObject = s
      await v.play()
      setCam('on')
      const det = new Ctor({ formats: ['qr_code'] })
      const tick = async () => {
        if (!stream.current) return
        try {
          const found = await det.detect(v)
          if (found[0]?.rawValue) {
            open(found[0].rawValue)
            return
          }
        } catch {
          // Khung hình chưa sẵn — thử lại ở nhịp sau.
        }
        timer.current = window.setTimeout(() => void tick(), 250)
      }
      void tick()
    } catch (e) {
      stopCam()
      setCam('off')
      setCamErr(
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Trình duyệt không cho dùng camera. Cho phép camera ở thanh địa chỉ rồi bấm lại, hoặc chọn tổ / gõ mã bên dưới.'
          : 'Không mở được camera trên máy này. Chọn tổ / gõ mã bên dưới.',
      )
    }
  }

  return (
    <Sheet
      open
      onClose={() => {
        stopCam()
        onClose()
      }}
      width={620}
      title={intent === 'hours' ? 'Quét máy để cập nhật giờ chạy' : 'Quét tem QR'}
      subtitle="Hướng camera vào tem dán trên máy — hoặc chọn máy theo tổ, hoặc gõ mã in trên tem."
    >
      <div className="grid gap-3">
        <div className="grid gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-raised)] p-2">
          <video
            ref={video}
            muted
            playsInline
            aria-label="Hình từ camera"
            className={
              cam === 'off'
                ? 'hidden'
                : 'aspect-video w-full rounded-[var(--radius)] bg-black object-cover'
            }
          />
          {cam !== 'on' ? (
            <Btn
              primary
              icon="quetQr"
              busy={cam === 'starting'}
              onClick={() => void startCam()}
            >
              Bật camera để quét
            </Btn>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-k-sm text-[var(--ink-2)]">
                Đang tìm tem trong khung hình…
              </span>
              <Btn
                onClick={() => {
                  stopCam()
                  setCam('off')
                }}
              >
                Tắt camera
              </Btn>
            </div>
          )}
          {camErr && <p className="text-k-sm text-[var(--warn)]">{camErr}</p>}
        </div>

        {loadErr ? (
          <Blocked lead="Chưa mở được:">không tải được danh sách máy: {loadErr}</Blocked>
        ) : (
          <>
            <FormRow label="Đang đứng ở">
              <Pick
                label="Tổ đang đứng"
                value={dept}
                onChange={setDept}
                options={[
                  { value: '', label: list ? '— Chọn tổ —' : 'Đang tải…' },
                  ...depts.map((d) => ({ value: d, label: d })),
                ]}
              />
            </FormRow>
            {dept && (
              <div className="grid max-h-[260px] grid-cols-2 gap-1.5 overflow-auto">
                {here.length === 0 && (
                  <p className="text-k-sm col-span-2 text-[var(--ink-3)]">
                    Không có máy phù hợp ở tổ này.
                  </p>
                )}
                {here.map((a) => (
                  <button
                    key={a.code}
                    type="button"
                    onClick={() => open(a.code)}
                    className="text-k-sm grid min-w-0 gap-0.5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-card)] px-2 py-1.5 text-left hover:border-[var(--act)] hover:bg-[var(--act-wash)]"
                  >
                    <b className="font-mono">{a.code}</b>
                    <span className="truncate text-[var(--ink-2)]">{a.name}</span>
                  </button>
                ))}
              </div>
            )}
            <form
              className="grid gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                open(code)
              }}
            >
              <span className="text-k-sm font-semibold text-[var(--ink-label)]">
                Hoặc gõ mã in trên tem
              </span>
              <div className="flex items-center gap-2">
                <SearchInput
                  value={code}
                  onChange={(v) => {
                    setCode(v)
                    setErr(null)
                  }}
                  placeholder="VD: TS-HAN-001"
                  label="Mã in trên tem"
                  width={240}
                />
                <Btn primary type="submit" disabled={!list}>
                  Mở
                </Btn>
              </div>
            </form>
            {err && <Blocked lead="Chưa mở được:">{err}</Blocked>}
          </>
        )}
      </div>
    </Sheet>
  )
}
