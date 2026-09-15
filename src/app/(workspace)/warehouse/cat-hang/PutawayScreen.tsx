'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Code,
  Crumb,
  Empty,
  NoticeBar,
  Pick,
  StatusBar,
  Tag,
} from '@/components/kit'
import { TopProgressBar } from '@/components/erp/Spinner'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'

type StockStatus = 'ok' | 'qc' | 'blocked'

type Row = {
  material_id: string
  code: string
  name: string
  unit: string
  qty: number
  stock_status: StockStatus
  /** Kệ gợi ý theo danh mục — điền sẵn, sửa được. */
  suggest_bin_code: string | null
}

type Bin = {
  id: string
  code: string
  name: string | null
  kind: 'store' | 'receiving' | 'blocked' | 'scrap'
  is_active: boolean
}

const STATUS_LABEL: Record<StockStatus, string> = {
  ok: 'Dùng được',
  qc: 'Chờ kiểm',
  blocked: 'Khoá',
}

const STATUS_TONE: Record<StockStatus, 'done' | 'warn' | 'stop'> = {
  ok: 'done',
  qc: 'warn',
  blocked: 'stop',
}

const n = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

export function PutawayScreen({
  rows,
  bins,
  fromBinId,
  canEdit,
}: {
  rows: Row[]
  bins: Bin[]
  /** Khu tiếp nhận. Null = kho chưa khai khu ảo nào. */
  fromBinId: string | null
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  /** Kệ thật — chỉ kệ thật mới là đích cất được. */
  const storeBins = useMemo(() => bins.filter((b) => b.kind === 'store'), [bins])

  /**
   * Kệ đã chọn cho từng dòng, khoá theo (mã × trạng thái).
   *
   * Điền sẵn theo `shelf_location` của danh mục nếu mã đó khớp một kệ đang có —
   * việc thường ngày khi đó chỉ còn là xác nhận, không phải chọn lại từ đầu.
   */
  const [pick, setPick] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const r of rows) {
      const hit = storeBins.find(
        (b) => b.code.toUpperCase() === (r.suggest_bin_code ?? '').toUpperCase(),
      )
      if (hit) init[`${r.material_id}|${r.stock_status}`] = hit.id
    }
    return init
  })

  const keyOf = (r: Row) => `${r.material_id}|${r.stock_status}`
  const missing = rows.filter((r) => !pick[keyOf(r)])

  async function submit() {
    if (!fromBinId) return
    setBusy(true)
    try {
      await api('/api/dept/warehouse/docs/transfer', {
        method: 'POST',
        body: {
          reason: 'Cất hàng khỏi khu tiếp nhận',
          lines: rows
            .filter((r) => pick[keyOf(r)])
            .map((r) => ({
              material_id: r.material_id,
              qty: r.qty,
              from_bin_id: fromBinId,
              to_bin_id: pick[keyOf(r)],
              stock_status: r.stock_status,
            })),
        },
      })
      router.refresh()
      toast.success('Đã cất hàng')
    } catch (e) {
      toast.error('Không cất được', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  const binOptions = [
    { value: '', label: '— chọn kệ —' },
    ...storeBins.map((b) => ({
      value: b.id,
      label: b.name ? `${b.code} · ${b.name}` : b.code,
    })),
  ]

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex flex-col">
      <TopProgressBar active={busy} />

      <Crumb
        path={['Kho', 'Chờ cất']}
        view={rows.length > 0 ? `${rows.length} dòng` : 'Không còn gì'}
      />

      <div className="flex flex-col gap-[13px] px-[var(--gutter)] py-[13px]">
        {!fromBinId && (
          <NoticeBar
            tone="stop"
            tag="Thiếu khu"
            action={{ label: 'Mở Sơ đồ kệ', onClick: () => router.push('/warehouse/ke') }}
          >
            <b>Kho chưa có khu tiếp nhận.</b> Hàng nhận về không có chỗ đứng tạm nào, nên
            màn này không nói được gì. Migration nạp sẵn khu này — không thấy nghĩa là nó
            đã bị ngừng dùng hoặc đổi loại.
          </NoticeBar>
        )}

        {fromBinId && storeBins.length === 0 && (
          /*
            Chặn ĐÚNG CHỖ: vấn đề không phải người dùng làm sai, mà là danh mục
            kệ còn trống. Nói thẳng và dẫn thẳng tới nơi sửa, thay vì bày một ô
            chọn rỗng rồi để họ đoán.
          */
          <NoticeBar
            tone="warn"
            tag="Chưa có kệ"
            action={{ label: 'Khai kệ ở Sơ đồ kệ', onClick: () => router.push('/warehouse/ke') }} // prettier-ignore
          >
            <b>Chưa khai kệ thật nào nên chưa cất đi đâu được.</b> Khai 8–12 khu thô theo
            đúng biển hiệu ngoài xưởng là đủ để bắt đầu — không cần đánh tới từng ô.
          </NoticeBar>
        )}

        {rows.length === 0 ? (
          <Empty
            headline="Không còn gì ở khu tiếp nhận"
            reason="Mọi dòng vừa nhận đã được cất vào kệ thật. Việc cất xuất hiện ở đây ngay sau khi ghi sổ một phiếu nhập."
            next={<Btn href="/warehouse/nhap">Xem hàng đang chờ nhận</Btn>}
          />
        ) : (
          <>
            <div className="divide-y divide-[var(--line)] overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-card)]">
              {rows.map((r) => {
                const k = keyOf(r)
                return (
                  <div
                    key={k}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 px-[12px] py-[9px]"
                  >
                    <div className="min-w-[220px] flex-1">
                      <div className="flex items-baseline gap-2">
                        <Code>{r.code}</Code>
                        {r.stock_status !== 'ok' && (
                          <Tag tone={STATUS_TONE[r.stock_status]}>
                            {STATUS_LABEL[r.stock_status]}
                          </Tag>
                        )}
                      </div>
                      <div className="text-[var(--fs-sm)] text-[var(--ink-3)]">
                        {r.name}
                      </div>
                    </div>

                    <div className="num min-w-[96px] text-right text-[15px] font-bold">
                      {n(r.qty)}{' '}
                      <span className="font-normal text-[var(--fs-sm)] text-[var(--ink-3)]">
                        {r.unit}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="num text-[var(--fs-sm)] text-[var(--ink-3)]">
                        TIEP-NHAN →
                      </span>
                      <Pick
                        label="Kệ đến"
                        value={pick[k] ?? ''}
                        options={binOptions}
                        onChange={(v) => setPick((s) => ({ ...s, [k]: v }))}
                        disabled={!canEdit || storeBins.length === 0}
                        width={220}
                      />
                      {pick[k] && (
                        <span
                          className="text-[15px] text-[var(--done)]"
                          aria-label="đã chọn kệ"
                        >
                          ✓
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {canEdit && (
              <div className="flex flex-wrap items-center gap-2">
                {/*
                  CẤT ĐƯỢC PHẦN NÀO CẤT PHẦN ẤY. Bắt chọn đủ mọi dòng mới cho
                  bấm là ép thủ kho đứng chờ một mã chưa biết để đâu, trong khi
                  chín mã kia đã có chỗ. Nút nói rõ nó sẽ cất bao nhiêu dòng.
                */}
                <Btn
                  primary
                  disabled={busy || rows.length === missing.length}
                  title={
                    rows.length === missing.length ? 'Chưa dòng nào có kệ đến' : undefined
                  }
                  onClick={() => void submit()}
                >
                  Xác nhận đã cất {rows.length - missing.length}/{rows.length} dòng
                </Btn>
                {storeBins.length > 0 && (
                  <Btn
                    onClick={() =>
                      setPick((s) => {
                        const next = { ...s }
                        for (const r of rows) next[keyOf(r)] = storeBins[0].id
                        return next
                      })
                    }
                  >
                    Cất hết vào {storeBins[0].code}
                  </Btn>
                )}
                {missing.length > 0 && (
                  <span className="text-[var(--fs-sm)] text-[var(--warn)]">
                    {missing.length} dòng chưa có kệ đến:{' '}
                    {missing.map((r) => r.code).join(', ')} — sẽ để lại ở khu tiếp nhận.
                  </span>
                )}
              </div>
            )}
          </>
        )}

        <p className="max-w-[76ch] leading-relaxed text-[var(--fs-sm)] text-[var(--ink-3)]">
          Cất hàng là <b>một lần chuyển kệ</b>, ghi thành hai dòng sổ (ra khỏi khu tiếp
          nhận, vào kệ thật) nối bằng một mã nhóm. Không cột nào bị sửa tại chỗ — sổ chỉ
          cộng thêm, nên tổng sổ luôn cộng lại đúng bằng những gì đã xảy ra. Dòng tự rời
          màn này khi đã cất; không có cờ trạng thái nào phải nhớ bật tắt.
        </p>
      </div>

      <StatusBar
        left={[
          <>
            <b>Chờ cất</b> · {rows.length} dòng
          </>,
          'Kho vật tư chính · khu tiếp nhận',
        ]}
        right={`${rows.length - missing.length}/${rows.length} dòng đã có kệ đến`}
      />
    </div>
  )
}
