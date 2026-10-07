'use client'

import Link from 'next/link'
import { Btn } from '@/components/kit'
import type { LibraryFacts } from './nhap-excel.shared'
import { API } from './nhap-excel.shared'
import type { NhapExcelCtx } from './useNhapExcel'

/**
 * Màn lúc CHƯA chọn file (bản vẽ, trạng thái 1 — Q4): ô kéo-thả + hai cách bắt
 * đầu bên trái, luật đọc file + số đếm thư viện ở cột dữ kiện bên phải.
 */

const RULES: [string, string][] = [
  ['Ô trống', 'Giữ nguyên dữ liệu đang có'],
  ['Gõ "-"', 'Xoá trắng ô đó'],
  ['Mã trống', 'SP mới — mã tự cấp lúc ghi theo Loại + Vật liệu khung'],
  ['Ô Ảnh', 'Ảnh dán mới thành ảnh đại diện; ảnh nhỏ đã xuất ra thì bỏ qua'],
  ['Đóng gói', 'SP có mặt ở sheet thì thay trọn bộ phương án; vắng mặt thì giữ'],
  ['Có lỗi', 'Một dòng lỗi là chặn cả file — không ghi dở dang'],
]

export function ManTrong({ d, facts }: { d: NhapExcelCtx; facts: LibraryFacts }) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-5 px-6 py-5">
        <div
          {...d.drop}
          className="flex items-center gap-5 px-6 py-8"
          style={{
            border: `1.5px dashed ${d.dragging ? 'var(--act)' : 'var(--act-line)'}`,
            background: d.dragging ? 'var(--act-wash)' : 'var(--surface-hover)',
          }}
        >
          <div
            aria-hidden
            className="relative h-16 w-14 shrink-0 border-[1.5px] border-[var(--act-line)] bg-[var(--surface-card)]"
          >
            <span className="text-k-label absolute inset-x-0 bottom-2 text-center font-[family-name:var(--font-mono)] font-semibold text-[var(--done)]">
              XLSX
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-k-lg m-0 font-semibold">
              {d.busy ? 'Đang đọc file…' : 'Kéo file .xlsx vào đây'}
            </p>
            <p className="m-0 text-[var(--ink-2)]">
              hoặc bấm <b>Chọn file…</b> ở góc trên. Chưa ghi gì cho tới khi anh/chị soi
              xong và bấm Ghi.
            </p>
            <p className="text-k-sm m-0 text-[var(--ink-3)]">
              Đọc sheet <b>Sản phẩm</b> và <b>Đóng gói</b>. File .xls cũ: mở bằng Excel,
              lưu lại thành .xlsx.
            </p>
          </div>
          <div className="ml-auto shrink-0">
            <Btn icon="excel" onClick={d.pick} busy={d.busy}>
              Chọn file…
            </Btn>
          </div>
        </div>

        <div className="grid grid-cols-2 border-t border-[var(--line)]">
          <div className="flex flex-col gap-1.5 py-3 pr-4">
            <h2 className="text-k-body m-0 font-semibold">Sửa SP đang có</h2>
            <ol className="m-0 flex flex-col gap-0.5 pl-5 text-[var(--ink-2)]">
              <li>
                Ở{' '}
                <Link href="/products" className="font-medium text-[var(--act-text)]">
                  Thư viện sản phẩm
                </Link>
                , lọc theo khách / loại.
              </li>
              <li>
                Bấm <b>Excel → Xuất SP đang xem</b> (kèm ảnh nhỏ).
              </li>
              <li>Sửa trên máy, dán ảnh mới vào ô Ảnh, rồi chọn file ở đây.</li>
            </ol>
          </div>
          <div className="flex flex-col gap-1.5 border-l border-[var(--hair)] py-3 pl-4">
            <h2 className="text-k-body m-0 font-semibold">Thêm SP mới</h2>
            <ol className="m-0 flex flex-col gap-0.5 pl-5 text-[var(--ink-2)]">
              <li>
                <a href={API} className="font-medium text-[var(--act-text)]">
                  Tải file mẫu trống
                </a>
                , hoặc thêm dòng cuối file đã xuất.
              </li>
              <li>Để trống ô Mã: hệ thống tự cấp theo Loại + Vật liệu khung.</li>
              <li>
                Đóng gói nhiều kiện: ghi SP trước, tải file có mã, điền sheet Đóng gói.
              </li>
            </ol>
          </div>
        </div>
      </div>

      <aside
        aria-label="Luật đọc file"
        className="flex flex-col gap-4 border-l border-[var(--line)] bg-[var(--surface-raised)] px-4 py-4"
      >
        <section>
          <h2 className="text-k-label m-0 mb-1.5 tracking-wider text-[var(--ink-3)] uppercase">
            Luật đọc file
          </h2>
          <dl className="m-0">
            {RULES.map(([k, v]) => (
              <div
                key={k}
                className="text-k-sm grid grid-cols-[84px_1fr] gap-2.5 border-t border-[var(--hair)] py-1.5"
              >
                <dt className="text-[var(--ink-3)]">{k}</dt>
                <dd className="m-0">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h2 className="text-k-label m-0 mb-1.5 tracking-wider text-[var(--ink-3)] uppercase">
            Thư viện hiện có
          </h2>
          {(
            [
              ['Sản phẩm', facts.products],
              ['Chưa có ảnh', facts.noImage],
              ['Có đóng gói nhiều kiện', facts.withPacking],
            ] as const
          ).map(([k, v]) => (
            <div
              key={k}
              className="text-k-sm flex justify-between border-t border-[var(--hair)] py-1"
            >
              <span>{k}</span>
              <span className="font-[family-name:var(--font-mono)] tabular-nums">
                {v.toLocaleString('vi-VN')}
              </span>
            </div>
          ))}
        </section>
      </aside>
    </div>
  )
}
