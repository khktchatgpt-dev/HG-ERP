'use client'

import { useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Ico,
  Btn,
  Cell,
  Chip,
  Code,
  Empty,
  FilterBar,
  Pick,
  Row,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  StatusBar,
  TFoot,
  THead,
  Table,
} from '@/components/kit'
import { useBeRong } from '@/lib/use-be-rong'
import { RO_NHAN, RO_TON, type RoTon } from './ro-ton'
import { lenhGon, type CuaLenh } from './ton-lenh.shared'
import { XemSwitch } from './xem-switch'

export type TonRow = {
  material_id: string
  code: string
  name: string
  unit: string
  qty_ok: number
  qty_qc: number
  qty_blocked: number
  reserved: number
  available: number
  shelf_location: string | null
  is_low: boolean
  min_stock: number
}

const fmt = (n: number) => n.toLocaleString('vi-VN')
/** Số 0 KHÔNG tô đỏ — hết một mã không phải lúc nào cũng xấu; chỉ làm nhạt. */
const num = (n: number, tone?: 'warn' | 'stop' | 'ok') =>
  n === 0 ? (
    <span className="text-[var(--ink-empty)]">0</span>
  ) : (
    <span
      className={
        tone === 'warn'
          ? 'font-semibold text-[var(--warn)]'
          : tone === 'stop'
            ? 'font-semibold text-[var(--stop)]'
            : tone === 'ok'
              ? 'font-semibold'
              : undefined
      }
    >
      {fmt(n)}
    </span>
  )

/**
 * TỒN KHO — Khuôn C (Bước 3 Kho). Bản thiết kế: artboard 4 ở
 * https://claude.ai/artifact/G9Zso3vzCHUYpNGRp9o7Nf
 *
 * Câu màn trả lời: "mã nào cần tôi động vào?" — nên bảy RỔ là điều khiển
 * chính, không phải ô tìm. Sáu cột lượng tách bạch: số dùng để tính đủ–thiếu
 * luôn là DÙNG ĐƯỢC, không bao giờ là tổng tồn.
 *
 * Mọi bộ lọc sống trên URL, server lọc và cắt trang — màn này là màn hay mở
 * nhất của Kho, kéo 13.229 dòng xuống trình duyệt là lỗi của bản cũ.
 */
export function TonKhoScreen({
  rows,
  cuaLenh,
  counts,
  total,
  trang,
  soTrang,
  ro,
  q: qUrl,
  nhom,
  nhomOptions,
}: {
  rows: TonRow[]
  /** Lệnh được chia tồn của từng mã trên trang (Kho đợt 2 · B5, cột "Của lệnh"). */
  cuaLenh: Record<string, CuaLenh>
  counts: Record<RoTon, number>
  total: number
  trang: number
  soTrang: number
  ro: RoTon
  q: string
  nhom: string
  nhomOptions: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [q, setQ] = useState(qUrl)
  /*
    Cột "Của lệnh" (B5 Q4) chỉ khi khung đủ rộng; hẹp hơn thì nằm ở ô gợi ý của
    mã. Đo khung, không đo cửa sổ (luật màn hẹp Kho đợt 2).
  */
  const khung = useRef<HTMLDivElement>(null)
  const coCotLenh = useBeRong(khung) >= 1000
  const ghiLenh = (id: string) =>
    (cuaLenh[id] ?? []).map((c) => `${lenhGon(c.code)} ${fmt(c.qty)}`).join(' · ')

  /** Đổi một tham số → về trang 1 (giữ trang cũ là lọc xong rơi vào trang trống). */
  const dat = (p: Record<string, string | null>) => {
    const s = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(p)) {
      if (v) s.set(k, v)
      else s.delete(k)
    }
    if (!('trang' in p)) s.delete('trang')
    const qs = s.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const dangLoc = ro !== 'has' || qUrl.trim() !== '' || nhom !== ''
  const cong = rows.reduce(
    (a, r) => ({
      ok: a.ok + r.qty_ok,
      qc: a.qc + r.qty_qc,
      blocked: a.blocked + r.qty_blocked,
      res: a.res + r.reserved,
      avail: a.avail + r.available,
    }),
    { ok: 0, qc: 0, blocked: 0, res: 0, avail: 0 },
  )

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <ScreenFrame>
        <ScreenHeader
          compact
          eyebrow="Kho"
          title="Tồn kho"
          facts={[
            { label: 'Đang có tồn', value: fmt(counts.has) },
            {
              label: 'Dưới mức',
              value: fmt(counts.low),
              tone: counts.low > 0 ? 'warn' : 'neutral',
            },
            {
              label: 'Thiếu cho lệnh',
              value: fmt(counts.short),
              tone: counts.short > 0 ? 'stop' : 'neutral',
            },
          ]}
          actions={
            <Btn icon="so" href="/warehouse/phieu">
              Xem sổ phiếu
            </Btn>
          }
        />

        <FilterBar>
          <XemSwitch xem="ma" />
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Tìm mã hoặc tên vật tư…"
            width={280}
          />
          <Btn icon="tim" onClick={() => dat({ q: q.trim() || null })}>
            Tìm
          </Btn>
          <Pick
            value={nhom}
            onChange={(v) => dat({ nhom: v || null })}
            options={[
              { value: '', label: 'Mọi nhóm vật tư' },
              ...nhomOptions.map((g) => ({ value: g, label: g })),
            ]}
            label="Nhóm vật tư"
            width={190}
          />
          {RO_TON.map((id) => (
            <Chip
              key={id}
              on={ro === id}
              count={counts[id]}
              onClick={() => dat({ ro: id === 'has' ? null : id })}
            >
              {RO_NHAN[id]}
            </Chip>
          ))}
        </FilterBar>

        <div ref={khung} className="h-0 w-full" aria-hidden />
        {rows.length === 0 ? (
          <Empty
            headline={
              dangLoc ? 'Không có mã nào trong rổ này' : 'Kho chưa có mã nào còn tồn'
            }
            reason={
              dangLoc
                ? `Rổ "${RO_NHAN[ro]}" đang trống với bộ lọc hiện tại. Bỏ lọc để xem lại, hoặc chuyển sang rổ "Cả danh mục" (${fmt(counts.all)} mã).`
                : 'Tồn chỉ tăng khi ghi phiếu nhập. Hàng nhà cung cấp đã giao mà chưa ghi sổ thì chưa tính là tồn.'
            }
            next={
              dangLoc ? (
                <Btn
                  icon="boLoc"
                  primary
                  onClick={() => dat({ ro: null, q: null, nhom: null })}
                >
                  Bỏ lọc
                </Btn>
              ) : (
                <Btn icon="nhanHang" primary href="/warehouse/nhap">
                  Sang Hàng về để nhận hàng
                </Btn>
              )
            }
          />
        ) : (
          <Table>
            <THead pinFirst>
              <th>Mã</th>
              <th>Tên vật tư</th>
              <th>ĐVT</th>
              <th style={{ textAlign: 'right', whiteSpace: 'normal' }}>Dùng được</th>
              <th style={{ textAlign: 'right', whiteSpace: 'normal' }}>Chờ kiểm</th>
              <th style={{ textAlign: 'right', whiteSpace: 'normal' }}>Khoá</th>
              <th style={{ textAlign: 'right', whiteSpace: 'normal' }}>Giữ cho lệnh</th>
              <th style={{ textAlign: 'right', whiteSpace: 'normal' }}>Còn dùng</th>
              {coCotLenh && <th style={{ width: 190 }}>Của lệnh</th>}
              <th>Kệ</th>
              <th />
            </THead>
            <tbody>
              {rows.map((r) => (
                <Row key={r.material_id}>
                  <Cell
                    pin
                    title={!coCotLenh && cuaLenh[r.material_id] ? `Của lệnh: ${ghiLenh(r.material_id)}` : undefined} // prettier-ignore
                  >
                    <Code>{r.code}</Code>
                  </Cell>
                  <Cell grow>
                    <span className="truncate" title={r.name}>
                      {r.name}
                    </span>
                  </Cell>
                  <Cell muted>{r.unit}</Cell>
                  <Cell num>{num(r.qty_ok, r.is_low ? 'warn' : 'ok')}</Cell>
                  <Cell num>{num(r.qty_qc, 'warn')}</Cell>
                  <Cell num>{num(r.qty_blocked, 'stop')}</Cell>
                  <Cell num muted>
                    {num(r.reserved)}
                  </Cell>
                  {/* Còn dùng ÂM = đã hứa nhiều hơn số có — chỗ duy nhất đáng đỏ. */}
                  <Cell num>
                    {r.available < 0 ? num(r.available, 'stop') : num(r.available)}
                  </Cell>
                  {coCotLenh && (
                    <Cell title={ghiLenh(r.material_id) || undefined}>
                      {cuaLenh[r.material_id] ? (
                        <span className="text-k-sm block truncate">
                          {cuaLenh[r.material_id].map((c, i) => (
                            <span key={c.lsx_id}>
                              {i > 0 && ' · '}
                              {lenhGon(c.code)}{' '}
                              <b className="num font-semibold">{fmt(c.qty)}</b>
                            </span>
                          ))}
                        </span>
                      ) : r.qty_ok > 0 ? (
                        <i className="text-k-sm text-[var(--ink-3)]">tồn chung</i>
                      ) : (
                        <span className="text-[var(--ink-empty)]">—</span>
                      )}
                    </Cell>
                  )}
                  <Cell muted>
                    {r.shelf_location ?? (
                      <span className="text-[var(--ink-empty)]">—</span>
                    )}
                  </Cell>
                  <Cell>
                    <span className="flex justify-end">
                      <Btn
                        icon="xuatKho"
                        href={`/warehouse/xuat?ma=${encodeURIComponent(r.code)}`}
                        className="text-k-sm h-6 px-2"
                      >
                        Xuất
                      </Btn>
                    </span>
                  </Cell>
                </Row>
              ))}
            </tbody>
            <TFoot
              label={<td colSpan={3}>Cộng {rows.length} mã trên trang này</td>}
              cells={
                <>
                  <td className="num">{fmt(cong.ok)}</td>
                  <td className="num">{fmt(cong.qc)}</td>
                  <td className="num">{fmt(cong.blocked)}</td>
                  <td className="num">{fmt(cong.res)}</td>
                  <td className="num">{fmt(cong.avail)}</td>
                </>
              }
              caveat={`Cộng theo TRANG và cộng chéo nhiều đơn vị — chỉ để đối chiếu. Rổ này có ${fmt(total)} mã.`}
              caveatSpan={coCotLenh ? 3 : 2}
            />
          </Table>
        )}

        {soTrang > 1 && (
          <div className="text-k-sm flex items-center gap-2 border-t border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1.5">
            <span className="text-[var(--ink-3)]">Trang</span>
            <Btn
              icon="truoc"
              disabled={trang <= 1}
              onClick={() => dat({ trang: String(trang - 1) })}
              className="text-k-sm h-6 px-2"
            >
              Trước
            </Btn>
            <span className="num">
              {trang} / {soTrang}
            </span>
            <Btn
              disabled={trang >= soTrang}
              onClick={() => dat({ trang: String(trang + 1) })}
              className="text-k-sm h-6 px-2"
            >
              Sau
              <Ico name="sau" />
            </Btn>
            <span className="ml-auto text-[var(--ink-3)]">50 dòng mỗi trang</span>
          </div>
        )}

        <StatusBar
          left={[
            'Số dùng để tính đủ–thiếu luôn là DÙNG ĐƯỢC, không phải tổng tồn',
            'Tồn chỉ đổi qua phiếu — không ô nào gõ được số tồn',
          ]}
          right={`${rows.length} / ${fmt(total)} mã`}
        />
      </ScreenFrame>
    </div>
  )
}
