'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { goiYMucDich } from '@/lib/po-muc-dich'
import { NGUONG_DU_TOAN } from '@/lib/hang-muc'
import { downloadCsv } from '@/lib/csv'
import type { ProjectRow } from '@/modules/dept/supply/projects.service'
import { khop } from '../_erp/chon-nhom'
import {
  ChipLoc,
  ChonLoc,
  DauTrang,
  HangLoc,
  INPUT,
  Nhan,
  NUM,
  Nut,
  TD,
  TF,
  TH,
  Thanh,
  ThanhDuoi,
  Trang,
} from '../_erp/ui'
import { HangMucSheet } from './hang-muc-sheet'
import { tien, tienTheoLoai } from './hang-muc.shared'

type Chip = 'mo' | 'chuY' | 'dong'
const CHIPS: { id: Chip; label: string; test: (r: ProjectRow) => boolean }[] = [
  { id: 'mo', label: 'Đang mở', test: (r) => r.status === 'open' },
  { id: 'chuY', label: 'Cần chú ý', test: (r) => r.chu_y.length > 0 },
  { id: 'dong', label: 'Đã đóng', test: (r) => r.status === 'closed' },
]
const TAT_CA = '*'

/**
 * DANH SÁCH HẠNG MỤC NGOÀI SẢN XUẤT — chép bản vẽ Đầu đơn mua (khối "Dễ quản lí"),
 * viết tay không qua kit. Mọi việc ngoài sản xuất trên một bảng: lọc Đang mở /
 * Cần chú ý / Đã đóng + Loại + Phụ trách, gom theo loại, thanh so dự toán, chân
 * tổng dính. Số đi qua lib/hang-muc như hồ sơ hạng mục.
 */
export function HangMucScreen({
  rows,
  canManage,
}: {
  rows: ProjectRow[]
  canManage: boolean
}) {
  const router = useRouter()
  const [chip, setChip] = useState<Chip>('mo')
  const [loai, setLoai] = useState(TAT_CA)
  const [phuTrach, setPhuTrach] = useState(TAT_CA)
  const [gom, setGom] = useState<'khong' | 'loai'>('khong')
  const [q, setQ] = useState('')
  const [tao, setTao] = useState(false)

  const kinds = [...new Set(rows.map((r) => r.kind))].sort((a, b) =>
    a.localeCompare(b, 'vi'),
  )
  const owners = [...new Set(rows.map((r) => r.owner_name ?? '—'))].sort((a, b) =>
    a.localeCompare(b, 'vi'),
  )
  const kept = rows.filter(
    (r) =>
      CHIPS.find((c) => c.id === chip)!.test(r) &&
      (loai === TAT_CA || r.kind === loai) &&
      (phuTrach === TAT_CA || (r.owner_name ?? '—') === phuTrach) &&
      (!q.trim() || khop(q, r.code, r.name, r.kind, r.owner_name)),
  )
  const nhom =
    gom === 'loai'
      ? kinds
          .filter((k) => kept.some((r) => r.kind === k))
          .map((k) => ({ k, rs: kept.filter((r) => r.kind === k) }))
      : [{ k: '', rs: kept }]
  const cong = (rs: ProjectRow[], key: 'ordered' | 'received_net' | 'owed') => {
    const m: Record<string, number> = {}
    for (const r of rs) m[r.currency] = (m[r.currency] ?? 0) + r.so[key]
    return tienTheoLoai(m) || '0'
  }
  const soDon = (rs: ProjectRow[]) => rs.reduce((t, r) => t + r.so.n, 0)

  const xuat = () =>
    downloadCsv('hang-muc.csv', kept, [
      { key: 'code', header: 'Mã' },
      { key: 'name', header: 'Hạng mục' },
      { key: 'kind', header: 'Loại' },
      { key: 'owner_name', header: 'Phụ trách' },
      {
        key: 'status',
        header: 'Trạng thái',
        get: (r) => (r.status === 'open' ? 'Đang mở' : 'Đã đóng'),
      },
      { key: 'so', header: 'Đơn', get: (r) => r.so.n },
      { key: 'so', header: 'Nháp', get: (r) => r.so.nhap },
      { key: 'so', header: 'Đã đặt (gồm VAT)', get: (r) => r.so.ordered },
      { key: 'budget', header: 'Dự toán' },
      { key: 'so', header: 'Đã về (chưa VAT)', get: (r) => r.so.received_net },
      { key: 'so', header: 'Còn nợ NCC', get: (r) => r.so.owed },
      { key: 'currency', header: 'Tiền tệ' },
      { key: 'chu_y', header: 'Cần chú ý', get: (r) => r.chu_y.join(' · ') },
    ])

  const loaiOpts = [
    { value: TAT_CA, label: 'tất cả' },
    ...kinds.map((k) => ({ value: k, label: k })),
  ]
  const ptOpts = [
    { value: TAT_CA, label: 'cả phòng' },
    ...owners.map((o) => ({ value: o, label: o })),
  ]
  const gomOpts = [
    { value: 'khong', label: 'Không gom' },
    { value: 'loai', label: 'Loại' },
  ]

  return (
    <Trang>
      <DauTrang
        eyebrow="Mua hàng"
        title="Hạng mục ngoài sản xuất"
        actions={
          <>
            <Nut onClick={xuat} title={`Xuất ${kept.length} hạng mục đang hiện`}>
              Xuất Excel
            </Nut>
            <Nut
              chinh
              khoa={canManage ? undefined : 'Chỉ phòng Cung ứng tạo được hạng mục'}
              onClick={() => setTao(true)}
            >
              + Hạng mục mới
            </Nut>
          </>
        }
      />
      <HangLoc>
        {CHIPS.map((c) => (
          <ChipLoc
            key={c.id}
            on={chip === c.id}
            count={rows.filter(c.test).length}
            onClick={() => setChip(c.id)}
          >
            {c.label}
          </ChipLoc>
        ))}
        <ChonLoc label="Loại" value={loai} onChange={setLoai} options={loaiOpts} />
        <ChonLoc
          label="Phụ trách"
          value={phuTrach}
          onChange={setPhuTrach}
          options={ptOpts}
        />
        <input
          aria-label="Tìm hạng mục"
          className={`${INPUT} w-[240px] py-[4px]`}
          value={q}
          placeholder="Tìm mã, tên, loại, người phụ trách…"
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="ml-auto flex items-center gap-1.5">
          <ChonLoc
            label="Gom theo"
            value={gom}
            onChange={(v) => setGom(v as 'khong' | 'loai')}
            options={gomOpts}
          />
        </span>
      </HangLoc>

      <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
        <table
          className="w-full border-separate border-spacing-0"
          aria-label="Danh sách hạng mục"
        >
          <thead>
            <tr>
              <th className={TH}>Mã</th>
              <th className={TH}>Hạng mục</th>
              <th className={TH}>Loại</th>
              <th className={TH}>Phụ trách</th>
              <th className={`${TH} text-right`}>Đơn</th>
              <th
                className={`${TH} text-right`}
                title="Tổng thanh toán (gồm VAT) các đơn đã rời nháp, trừ đơn huỷ"
              >
                Đã đặt
              </th>
              <th className={TH} style={{ width: 170 }}>
                So dự toán
              </th>
              <th
                className={`${TH} text-right`}
                title="Theo phiếu kho, chưa VAT — cùng số mục Tài chính của từng đơn"
              >
                Đã về
              </th>
              <th className={`${TH} text-right`} title="Hoá đơn gồm VAT − đã trả">
                Còn nợ NCC
              </th>
              <th className={TH}>Cần chú ý</th>
            </tr>
          </thead>
          <tbody>
            {kept.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-8 text-center text-[13px] text-[var(--ink-2)]"
                >
                  <b className="text-[var(--ink)]">
                    {rows.length === 0
                      ? 'Chưa có hạng mục nào'
                      : 'Không có hạng mục nào khớp bộ lọc'}
                  </b>
                  <div className="mt-1 text-[12px]">
                    {rows.length === 0
                      ? 'Hạng mục là việc ngoài sản xuất gom nhiều đơn mua — vd. Xây dựng văn phòng, Dự trữ kho.'
                      : 'Bỏ bớt bộ lọc ở hàng trên để thấy thêm.'}
                  </div>
                </td>
              </tr>
            )}
            {nhom.map((g) => (
              <Fragment key={g.k || '_'}>
                {g.k && (
                  <tr>
                    <td
                      colSpan={10}
                      className="border-b border-[var(--hair)] bg-[#fafbfc] px-2.5 py-1.5 text-[11px] font-bold tracking-[.05em] text-[var(--ink-3)] uppercase"
                    >
                      {g.k} · {g.rs.length} hạng mục · {soDon(g.rs)} đơn · đã đặt{' '}
                      {cong(g.rs, 'ordered')}
                    </td>
                  </tr>
                )}
                {g.rs.map((r) => (
                  <Dong key={r.id} r={r} />
                ))}
              </Fragment>
            ))}
          </tbody>
          {kept.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4} className={TF}>
                  Cộng {kept.length} hạng mục đang hiện
                  <span className="ml-1.5 font-normal text-[var(--ink-3)]">
                    — KHÔNG gồm đơn nháp, đơn huỷ, phí vận chuyển; cộng riêng từng loại
                    tiền
                  </span>
                </td>
                <td className={`${TF} ${NUM}`}>{soDon(kept)}</td>
                <td className={`${TF} ${NUM}`}>{cong(kept, 'ordered')}</td>
                <td className={TF} />
                <td className={`${TF} ${NUM}`}>{cong(kept, 'received_net')}</td>
                <td className={`${TF} ${NUM}`}>{cong(kept, 'owed')}</td>
                <td className={TF} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <ThanhDuoi
        left={
          <>
            <span>Bấm mã hoặc tên để mở hồ sơ hạng mục</span>
            <span>Tạo đơn cho hạng mục: ô “Cho việc” ở màn soạn đơn</span>
          </>
        }
        right={`${kept.length} / ${rows.length} hạng mục`}
      />
      {tao && (
        <HangMucSheet
          goiYLoai={goiYMucDich(rows.map((r) => r.kind))}
          onClose={() => setTao(false)}
          onSaved={(p) => router.push(`/mua-hang/hang-muc/${p.id}`)}
        />
      )}
    </Trang>
  )
}

/** Một dòng hạng mục. */
function Dong({ r }: { r: ProjectRow }) {
  const pct = r.so.pct ?? 0
  return (
    <tr className="hover:bg-[var(--surface-hover)]">
      <td className={TD}>
        <Link
          href={`/mua-hang/hang-muc/${r.id}`}
          className="font-mono font-semibold text-[var(--act)] hover:underline"
        >
          {r.code}
        </Link>
      </td>
      <td className={TD}>
        <Link
          href={`/mua-hang/hang-muc/${r.id}`}
          className="font-semibold hover:underline"
        >
          {r.name}
        </Link>
        {r.status === 'closed' && (
          <span className="ml-1.5">
            <Nhan>Đã đóng</Nhan>
          </span>
        )}
      </td>
      <td className={`${TD} text-[var(--ink-3)]`}>{r.kind}</td>
      <td className={TD}>{r.owner_name ?? '—'}</td>
      <td className={`${TD} ${NUM}`}>
        {r.so.n || ''}
        {r.so.nhap > 0 && <span className="text-[var(--ink-3)]"> +{r.so.nhap} nháp</span>}
      </td>
      <td className={`${TD} ${NUM}`}>
        {r.so.ordered ? tien(r.so.ordered, r.currency) : ''}
      </td>
      <td className={TD}>
        {r.budget == null ? (
          <span className="text-[var(--ink-3)]">không dự toán</span>
        ) : (
          <span className="flex flex-col gap-0.5">
            <Thanh pct={pct} canh={NGUONG_DU_TOAN} />
            <span
              className={`font-mono text-[11.5px] ${pct >= NGUONG_DU_TOAN ? 'text-[var(--warn)]' : 'text-[var(--ink-3)]'}`}
            >
              {pct}% của {tien(r.budget, r.currency)}
            </span>
          </span>
        )}
      </td>
      <td
        className={`${TD} ${NUM}`}
        title={
          r.so.thieu_gia
            ? `${r.so.thieu_gia} đơn có phiếu nhập KHÔNG GIÁ — tiền về của chúng đang tính 0`
            : undefined
        }
      >
        {r.so.received_net ? tien(r.so.received_net, r.currency) : ''}
        {r.so.thieu_gia > 0 && (
          <span className="ml-1.5">
            <Nhan tone="warn">thiếu giá</Nhan>
          </span>
        )}
        {r.so.loi_tai_chinh > 0 && (
          <span className="ml-1.5">
            <Nhan tone="stop">chưa đọc được</Nhan>
          </span>
        )}
      </td>
      <td className={`${TD} ${NUM}`}>{r.so.owed ? tien(r.so.owed, r.currency) : ''}</td>
      <td className={TD}>
        {r.chu_y.length > 0 && <Nhan tone="warn">{r.chu_y.join(' · ')}</Nhan>}
      </td>
    </tr>
  )
}
