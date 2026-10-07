'use client'

import Link from 'next/link'
import { Combobox, Field, TextArea, Tick } from '@/components/kit'
import {
  ADJ_CAUSES,
  causeLabel,
  causeNeedsLsx,
  causeShowsLsx,
} from '@/lib/po-adjust-cause'
import { dmyAt } from './don-chung-tu.shared'
import type { DonCtx } from './useDonChungTu'

/** Lần đổi gần nhất của đơn khách thuộc lệnh — page nạp, hộp bày để đối chiếu. */
export type LsxLastChange = { order_code: string; at: string; note: string | null }

/**
 * KHỐI "NGUYÊN NHÂN" TRONG HỘP ÁP DỤNG ĐIỀU CHỈNH (0227, chốt 07/10/2026).
 *
 * Bản vẽ "Nguyên nhân điều chỉnh đơn mua", artboard 1 + 1b: chọn đúng một
 * nguyên nhân cố định; "Khách đổi đơn" bắt chỉ ra lệnh (gợi ý từ lệnh đơn đang
 * gắn, đơn gắn một lệnh thì chọn sẵn); ghi chú vẫn ≥ 5 ký tự. Câu chặn hiện
 * TẠI CHỖ dưới ô còn thiếu — nút Áp dụng khoá theo cùng hàm `causeBlock`.
 */
export function NguyenNhanField({ d }: { d: DonCtx }) {
  const { nn, adjLinkedLsx: linked, lsxOptions, lsxLastChange } = d
  const picked = nn.pickedLsx(linked)
  const block = nn.block(linked)
  const showLsx = causeShowsLsx(nn.cause)
  const toggle = (id: string, on: boolean) =>
    nn.setLsx(
      on ? [...picked.filter((x) => x !== id), id] : picked.filter((x) => x !== id),
    )
  // Lệnh chọn thêm ngoài danh sách gắn đơn (đơn chưa gắn lệnh, hoặc lệnh khác).
  const extra = picked.filter((id) => !linked.includes(id))
  const labelOf = (id: string) => lsxOptions.find((o) => o.value === id)

  return (
    <>
      <fieldset className="grid gap-1.5">
        <legend className="text-k-sm mb-1.5 font-semibold text-[var(--ink-label)]">
          Nguyên nhân <span className="text-[var(--stop)]">*</span>
        </legend>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-1.5">
          {ADJ_CAUSES.map((c) => {
            const on = nn.cause === c.key
            return (
              <label
                key={c.key}
                className={`flex cursor-pointer items-start gap-2 border px-2.5 py-1.5 ${on ? 'border-[var(--act)] bg-[var(--act-wash)]' : 'border-[var(--line)] hover:bg-[var(--surface-hover)]'}`}
              >
                <input
                  type="radio"
                  name="adj-cause"
                  className="mt-1 accent-[var(--act)]"
                  checked={on}
                  onChange={() => nn.setCause(c.key)}
                />
                <span>
                  {c.label}
                  <span className="text-k-sm block text-[var(--ink-3)]">{c.hint}</span>
                </span>
              </label>
            )
          })}
        </div>
        {block?.field === 'cause' && <Chan text={block.text} />}
      </fieldset>

      {showLsx && (
        <div className="grid gap-1.5">
          <div className="text-k-sm font-semibold text-[var(--ink-label)]">
            Theo thay đổi của đơn khách · lệnh{' '}
            {causeNeedsLsx(nn.cause) && <span className="text-[var(--stop)]">*</span>}
          </div>
          {linked.length > 0 && (
            <div className="border border-[var(--line)]">
              {linked.map((id) => {
                const o = labelOf(id)
                const ch = lsxLastChange[id]
                return (
                  <div
                    key={id}
                    className="flex items-start gap-2 border-b border-[var(--line-faint)] px-2.5 py-1.5 last:border-b-0"
                  >
                    <span className="mt-0.5">
                      <Tick
                        checked={picked.includes(id)}
                        onChange={(on) => toggle(id, on)}
                        label={`Chọn lệnh ${o?.label ?? id}`}
                      />
                    </span>
                    <span className="min-w-0">
                      <b className="num">{o?.label ?? '(lệnh đã đóng)'}</b>
                      {o?.hint ? ` · ${o.hint}` : ''}
                      {ch && (
                        <span className="text-k-sm block text-[var(--ink-3)]">
                          {ch.order_code} đổi gần nhất {dmyAt(ch.at)}
                          {ch.note ? `: "${ch.note}"` : ''}
                        </span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          {extra.map((id) => (
            <div key={id} className="flex items-center gap-2">
              <Tick
                checked
                onChange={() => toggle(id, false)}
                label={`Bỏ lệnh ${labelOf(id)?.label ?? id}`}
              />
              <b className="num">{labelOf(id)?.label ?? id}</b>
              {labelOf(id)?.hint ? ` · ${labelOf(id)?.hint}` : ''}
            </div>
          ))}
          <Combobox
            label="Thêm lệnh khác"
            value=""
            onChange={(v) => v && toggle(v, true)}
            emptyLabel={linked.length ? '+ lệnh khác…' : '— chọn lệnh —'}
            placeholder="Gõ số lệnh hoặc tên khách…"
            options={lsxOptions.filter((o) => !picked.includes(o.value))}
          />
          {linked.length === 0 && (
            <div className="text-k-sm text-[var(--ink-3)]">
              Đơn mua này chưa gắn lệnh. Tìm lệnh theo số, hoặc chọn nguyên nhân Khác nếu
              không thuộc đơn khách nào.
            </div>
          )}
          {block?.field === 'lsx' && <Chan text={block.text} />}
        </div>
      )}

      <Field label="Ghi chú">
        <TextArea
          aria-label="Ghi chú điều chỉnh"
          value={nn.note}
          onChange={nn.setNote}
          placeholder={
            nn.cause === 'khach_doi'
              ? 'VD: Khách chốt lại SL theo file 02/10, giảm 86 bộ sofa. Đã báo NCC qua Zalo'
              : 'VD: NCC báo tăng giá từ 25/09 (Zalo anh Nguyên)'
          }
        />
      </Field>
      {block?.field === 'note' && <Chan text={block.text} />}
    </>
  )
}

function Chan({ text }: { text: string }) {
  return <div className="k-t-warn text-k-sm">{text}</div>
}

/** Nhãn nguyên nhân + lệnh của một lần điều chỉnh — dùng ở bảng phát sinh và dòng thời gian. */
export function causeText(a: { cause?: string | null; lsx?: { code: string }[] }): string {
  const lsx = a.lsx ?? []
  return `${causeLabel(a.cause)}${lsx.length ? ` theo ${lsx.map((l) => l.code).join(', ')}` : ''}`
}

/** Màu chấm theo nguyên nhân — chỉ để nhận ra nhanh; chữ tự nói đủ ý. */
const CAUSE_DOT: Record<string, string> = {
  khach_doi: 'var(--act)',
  ncc_doi: 'var(--warn)',
  ky_thuat: 'var(--ink-2)',
  nhap_sai: 'var(--stop)',
  khac: 'var(--ink-3)',
}

/**
 * Ô NGUYÊN NHÂN của bảng phát sinh (artboard 2): nhãn có chấm + lệnh mà lần sửa
 * theo (bấm sang trang lệnh) + mã đơn khách của lệnh. Bản ghi cũ: "Chưa phân loại".
 */
export function NguyenNhanCell({
  a,
}: {
  a: { cause?: string | null; lsx?: { id: string; code: string; orders: string[] }[] }
}) {
  const dot = a.cause ? CAUSE_DOT[a.cause] : undefined
  return (
    <span className="grid gap-0.5">
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block size-2 rounded-full"
          style={dot ? { background: dot } : { border: '1px dashed var(--ink-3)' }}
        />
        {causeLabel(a.cause)}
      </span>
      {(a.lsx ?? []).map((l) => (
        <span key={l.id} className="text-k-sm text-[var(--ink-3)]">
          theo{' '}
          <Link href={`/mua-hang/yeu-cau/${l.id}`} className="num text-[var(--act-text)] underline">
            {l.code}
          </Link>
          {l.orders.length ? ` · ${l.orders.join(', ')}` : ''}
        </span>
      ))}
    </span>
  )
}
