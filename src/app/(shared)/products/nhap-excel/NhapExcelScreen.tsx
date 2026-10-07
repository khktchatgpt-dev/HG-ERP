'use client'

import { useRef } from 'react'
import {
  Btn,
  Chip,
  CommitBar,
  Empty,
  FilterBar,
  NoticeBar,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
} from '@/components/kit'
import { BangDongGoi } from './bang-dong-goi'
import { BangSanPham } from './bang-san-pham'
import { DaGhi } from './da-ghi'
import { ManTrong } from './man-trong'
import { API, StepStrip, type LibraryFacts, type SheetTab } from './nhap-excel.shared'
import { useNhapExcel, type NhapExcelCtx } from './useNhapExcel'

/**
 * THÊM + CẬP NHẬT SẢN PHẨM BẰNG EXCEL — làm lại giao diện theo bản vẽ
 * 3ZsNUVkcMyCKRzsJa1zPSe (user duyệt 08/10/2026 theo đề xuất Q1–Q4, sau lời chê
 * "UI/UX rất xấu").
 *
 * Khuôn F (bảng nhập) làm điểm xuất phát: lưới là nhân vật chính, thanh chốt đáy
 * nói vì sao chưa ghi được bằng một câu bấm được. Khác khuôn F: lưới CHỈ ĐỌC —
 * sửa ở file Excel người dùng giữ; sửa tại chỗ ở đây thì file bên họ lệch với thứ
 * đã ghi. Chép của SAP "Import products" / Odoo import: soi trước, ghi sau, lỗi
 * một dòng chặn cả file.
 *
 * Chia file theo khuôn "Cấu trúc code React": hook `useNhapExcel` giữ state,
 * mỗi khối một file (`man-trong`, `bang-san-pham`, `bang-dong-goi`, `da-ghi`).
 */

function SheetTabs({ d }: { d: NhapExcelCtx }) {
  const p = d.preview!
  const tabs: { key: SheetTab; label: string; count: string; err: number }[] = [
    {
      key: 'products',
      label: 'Sản phẩm',
      count: `${p.counts.total}`,
      err: p.counts.error,
    },
    {
      key: 'packing',
      label: 'Đóng gói',
      count: `${p.packing.counts.replace} SP đổi`,
      err: p.packing.counts.error,
    },
  ]
  return (
    <div
      role="tablist"
      aria-label="Sheet trong file"
      className="flex gap-0.5 border-b border-[var(--line)] px-3.5"
    >
      {tabs.map((t) => {
        const on = d.sheet === t.key
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => d.setSheet(t.key)}
            className="flex items-center gap-1.5 px-3.5 pt-2 pb-[7px] font-medium focus-visible:outline-2 focus-visible:outline-[var(--act)]"
            style={{
              color: on ? 'var(--act-text)' : 'var(--ink-2)',
              borderBottom: `2px solid ${on ? 'var(--act)' : 'transparent'}`,
            }}
          >
            {t.label}
            <span className="text-k-label rounded-[3px] border border-[var(--hair)] bg-[var(--surface-raised)] px-1.5 font-[family-name:var(--font-mono)] text-[var(--ink-2)]">
              {t.count}
            </span>
            {t.err > 0 && (
              <span className="text-k-label rounded-[3px] border border-[var(--stop-line)] bg-[var(--stop-wash)] px-1.5 font-[family-name:var(--font-mono)] text-[var(--stop)]">
                {t.err} lỗi
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function ProductChips({ d }: { d: NhapExcelCtx }) {
  const chips = [
    ['write', 'Sẽ ghi'],
    ['create', 'Thêm mới'],
    ['update', 'Cập nhật'],
    ['error', 'Lỗi'],
    ['warn', 'Cảnh báo'],
    ['same', 'Không đổi'],
  ] as const
  return (
    <FilterBar label="Lọc dòng theo việc">
      {chips.map(([f, label]) => (
        <Chip
          key={f}
          on={d.filter === f}
          count={d.count(f)}
          onClick={() => d.setFilter(f)}
        >
          {label}
        </Chip>
      ))}
      <span aria-hidden className="mx-1 h-[18px] w-px bg-[var(--line)]" />
      <Chip
        on={d.filter === 'all'}
        count={d.rows.length}
        onClick={() => d.setFilter('all')}
      >
        Tất cả
      </Chip>
      <span className="ml-auto flex items-center gap-3">
        {d.preview!.blank > 0 && (
          <span className="text-k-sm text-[var(--ink-3)]">
            bỏ qua {d.preview!.blank} dòng trống
          </span>
        )}
        <SearchInput
          value={d.q}
          onChange={d.setQ}
          placeholder="Tìm mã, tên SP…"
          label="Tìm dòng trong file"
          width={220}
        />
      </span>
    </FilterBar>
  )
}

function PackChips({ d }: { d: NhapExcelCtx }) {
  const c = d.preview!.packing.counts
  const chips = [
    ['replace', 'Thay đóng gói', c.replace],
    ['same', 'Không đổi', c.same],
    ['error', 'Lỗi', c.error],
  ] as const
  return (
    <FilterBar label="Lọc SP ở sheet Đóng gói">
      {chips.map(([f, label, n]) => (
        <Chip
          key={f}
          on={d.packFilter === f}
          count={n}
          onClick={() => d.setPackFilter(f)}
        >
          {label}
        </Chip>
      ))}
      <span className="text-k-sm ml-auto text-[var(--ink-3)]">
        SP có mặt ở sheet thì thay TRỌN BỘ phương án; SP vắng mặt giữ nguyên.
      </span>
    </FilterBar>
  )
}

/** Dải lỗi đầu bảng — mỗi lỗi một dòng, bấm nhảy tới đúng chỗ. */
function ErrorNotice({ d }: { d: NhapExcelCtx }) {
  const prodErr = d.rows.filter((r) => r.action === 'error')
  const packErr = d.packErrors
  const n = prodErr.length + packErr.length
  if (!n) return null
  const lines = [
    ...prodErr.slice(0, 3).map((r) => ({
      key: `p${r.row}`,
      text: `Dòng ${r.row} · ${r.errors.map((e) => e.msg).join(' · ')}`,
      go: () => {
        d.setSheet('products')
        d.setFilter('error')
      },
    })),
    ...packErr.slice(0, 3).map((i) => ({
      key: `k${i.code}${i.rows[0]}`,
      text: `Đóng gói · dòng ${i.rows.join(', ')} · ${i.errors.map((e) => e.msg).join(' · ')}`,
      go: () => {
        d.setSheet('packing')
        d.setPackFilter('error')
      },
    })),
  ]
  return (
    <div
      className="flex gap-2.5 border-b border-[var(--line)] bg-[var(--stop-wash)] px-3.5 py-2"
      role="alert"
    >
      <span className="text-k-label shrink-0 pt-px font-semibold tracking-wide text-[var(--stop)] uppercase">
        {n} chỗ lỗi
      </span>
      <ul className="text-k-sm m-0 flex list-none flex-col gap-0.5 p-0">
        {lines.map((l) => (
          <li key={l.key}>
            {l.text}{' '}
            <button
              type="button"
              onClick={l.go}
              className="font-semibold whitespace-nowrap text-[var(--act-text)]"
            >
              → xem
            </button>
          </li>
        ))}
        {n > lines.length && (
          <li className="text-[var(--ink-3)]">… và {n - lines.length} chỗ nữa</li>
        )}
      </ul>
    </div>
  )
}

export function NhapExcelScreen({ facts }: { facts: LibraryFacts }) {
  const input = useRef<HTMLInputElement>(null)
  const top = useRef<HTMLDivElement>(null)
  const d = useNhapExcel(input, top)
  const p = d.preview
  const step = !p ? 0 : d.written ? 2 : 1
  const fileFacts = d.file && p && (
    <>
      <span>
        File{' '}
        <b className="font-[family-name:var(--font-mono)] font-medium text-[var(--ink)]">
          {d.file.name}
        </b>
      </span>
      <span>
        {
          p.columns.filter((k) => k !== 'code' && k !== 'version' && k !== 'image_ref')
            .length
        }{' '}
        cột đọc được
      </span>
    </>
  )

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <input
        ref={input}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={d.onPick}
        aria-label="Chọn file Excel"
      />
      <ScreenFrame tableMin={1080}>
        <ScreenHeader
          compact
          eyebrow="Thư viện sản phẩm"
          title="Nhập / cập nhật sản phẩm từ Excel"
          actions={
            <>
              {step !== 2 && (
                <Btn icon="excel" href={API}>
                  Tải file mẫu trống
                </Btn>
              )}
              <Btn
                primary={!p}
                icon="them"
                onClick={d.pick}
                busy={d.busy && !p}
                disabled={!!d.progress}
              >
                {!p ? 'Chọn file…' : step === 2 ? 'Nhập file khác…' : 'Chọn file khác…'}
              </Btn>
              <Btn icon="quayLai" href="/products">
                Về thư viện
              </Btn>
            </>
          }
        />
        <StepStrip at={step} right={fileFacts} />
        <div ref={top} />

        {!p ? (
          <ManTrong d={d} facts={facts} />
        ) : d.rows.length === 0 && p.packing.items.length === 0 ? (
          <Empty
            headline="File không có dòng nào"
            reason={`Sheet "${p.sheet}" từ hàng 4 trở xuống đang trống, sheet Đóng gói cũng trống.`}
            next="Điền từ hàng 4 (hàng 1–3 là nhóm, tiêu đề, ghi chú) rồi chọn lại file."
          />
        ) : d.written ? (
          <DaGhi d={d} />
        ) : (
          <>
            {d.progress && (
              <NoticeBar tone="neutral" tag="Đang ghi">
                Lô {d.progress.lot}/{d.progress.lots} ·{' '}
                {d.progress.lot > d.progress.lots - d.packLotCount
                  ? 'đóng gói '
                  : `${d.progress.done}/${d.progress.total} dòng `}
                — đừng đóng trang.
              </NoticeBar>
            )}
            <ErrorNotice d={d} />
            <SheetTabs d={d} />
            {d.sheet === 'products' ? (
              <>
                <ProductChips d={d} />
                <BangSanPham d={d} />
              </>
            ) : (
              <>
                <PackChips d={d} />
                <BangDongGoi
                  items={d.packShown}
                  counts={p.packing.counts}
                  empty={
                    d.packItems.length
                      ? {
                          headline: 'Không có SP nào ở mục này',
                          reason: 'Mục đang chọn ở sheet Đóng gói không khớp SP nào.',
                          next: 'Chọn mục khác ở hàng lọc phía trên.',
                        }
                      : undefined
                  }
                />
              </>
            )}

            <CommitBar
              totals={[
                { label: 'Thêm mới', value: p.counts.create },
                { label: 'Cập nhật', value: `${p.counts.update} (${p.changedCells} ô)` },
                { label: 'Ảnh mới', value: d.newImages },
                { label: 'Đóng gói', value: `${d.toPack.length} SP` },
                { label: 'Còn thiếu cho LSX', value: `${d.lacking} SP` },
              ]}
              grand={{ label: 'Sẽ ghi', value: `${d.productsToWrite} SP` }}
              blocked={d.blocked}
              onGoBlocked={
                d.errorRows.length > 0 || d.packErrors.length > 0
                  ? d.goBlocked
                  : undefined
              }
              actions={
                <Btn
                  primary
                  icon="ghiSo"
                  onClick={d.commit}
                  busy={d.busy && !!d.progress}
                  disabled={
                    d.errorRows.length > 0 ||
                    d.packErrors.length > 0 ||
                    d.nothing ||
                    d.busy
                  }
                >
                  {d.toPack.length === 0
                    ? `Ghi ${d.toWrite.length} sản phẩm`
                    : d.toWrite.length === 0
                      ? `Ghi đóng gói ${d.toPack.length} SP`
                      : `Ghi ${d.toWrite.length} SP + đóng gói ${d.toPack.length} SP`}
                </Btn>
              }
            />
          </>
        )}
      </ScreenFrame>
    </div>
  )
}
