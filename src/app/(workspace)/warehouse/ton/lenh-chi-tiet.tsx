'use client'

import { useState, type CSSProperties } from 'react'
import { Btn, Cell, Code, Row, Sheet, Table, Tag, TFoot, THead } from '@/components/kit'
import { isoToVn } from '@/lib/date-vn'
import { lenhGon, type LenhDong, type MaChiTiet } from './ton-lenh.shared'

const so = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
/** Tiêu đề số xuống dòng — nowrap của kit ép bảng tràn ngăn 737px (1024 + sidebar). */
const R = { textAlign: 'right', whiteSpace: 'normal' } as const
const EPS = 1e-6

type Ngan = 'con' | 'het' | 'du'

/**
 * NGĂN CHI TIẾT MỘT LỆNH — Tồn kho theo lệnh (Kho đợt 2 · B5-2/B5-3). Chỉ để
 * xem; nút duy nhất là "Xuất cho lệnh này" (mở phiếu xuất, B4).
 *
 * Ba ngăn: Còn trong kho · Kho hết · Đã xuất đủ. Mã chung với lệnh khác thì nói
 * rõ lệnh kia; ở ngăn Kho hết mỗi dòng nói VÌ SAO (tồn 0, hay tồn đang chia cho
 * lệnh hạn xuất sớm hơn — NK-0044 của 06-MX đang chia cho YOTRIO).
 */
export function LenhChiTiet({
  lenh,
  rows,
  onClose,
}: {
  lenh: LenhDong
  rows: MaChiTiet[]
  onClose: () => void
}) {
  const con = rows.filter((r) => r.con > EPS && r.chia > EPS)
  const het = rows.filter((r) => r.con > EPS && r.chia <= EPS)
  const du = rows.filter((r) => r.con <= EPS)
  const [ngan, setNgan] = useState<Ngan>(con.length > 0 ? 'con' : het.length > 0 ? 'het' : 'du') // prettier-ignore
  const theoMa = (a: MaChiTiet, b: MaChiTiet) => a.code.localeCompare(b.code, 'vi')
  const ds = (ngan === 'con' ? con : ngan === 'het' ? het : du).slice().sort(theoMa)

  const phu = [
    lenh.khach,
    lenh.ship_date ? `hạn xuất hàng ${isoToVn(lenh.ship_date)}` : null,
    lenh.xuat_cuoi ? `xuất gần nhất ${isoToVn(lenh.xuat_cuoi)}` : 'chưa ghi xuất lần nào',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Lệnh ${lenh.code}`}
      subtitle={phu}
      stakes="nhe"
      width={860}
      footer={
        <span className="flex w-full items-center gap-3">
          <span className="text-k-sm text-[var(--ink-3)]">
            {lenh.xong
              ? 'Lệnh đã xong: kho không còn hàng của lệnh, không ghi xuất bù (sẽ làm âm tồn).'
              : 'Chỉ xem. Ghi xuất ở phiếu xuất — số điền sẵn đúng cột "Kho chia".'}
          </span>
          <span className="ml-auto flex gap-2">
            <Btn onClick={onClose}>Đóng</Btn>
            {!lenh.xong && con.length > 0 && (
              <Btn icon="xuatKho" primary href={`/warehouse/xuat?lsx=${lenh.id}`}>
                Xuất cho lệnh này
              </Btn>
            )}
          </span>
        </span>
      }
    >
      <div
        className="flex flex-col gap-2"
        style={{ '--col-grow': '150px' } as CSSProperties}
      >
        <div
          role="tablist"
          aria-label="Hàng của lệnh"
          className="flex border-b border-[var(--line)]"
        >
          {(
            [
              ['con', 'Còn trong kho', con.length],
              ['het', 'Kho hết', het.length],
              ['du', 'Đã xuất đủ', du.length],
            ] as const
          ).map(([id, ten, n]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={ngan === id}
              onClick={() => setNgan(id)}
              className={
                ngan === id
                  ? 'text-k-body -mb-px border-b-2 border-[var(--act)] px-3 py-1.5 font-semibold text-[var(--act-text)]'
                  : 'text-k-body -mb-px border-b-2 border-transparent px-3 py-1.5 text-[var(--ink-2)] hover:text-[var(--act-text)]'
              }
            >
              {ten} <span className="num">{n}</span>
            </button>
          ))}
        </div>

        {ds.length === 0 ? (
          <p className="text-k-body m-0 py-6 text-center text-[var(--ink-3)]">
            {ngan === 'con'
              ? 'Kho không còn hàng nào của lệnh này để xuất.'
              : ngan === 'het'
                ? 'Mọi mã còn phần của lệnh đều còn hàng trong kho.'
                : 'Chưa mã nào đã xuất đủ phần đã về.'}
          </p>
        ) : ngan === 'du' ? (
          <Table minWidth={560} label="Mã đã xuất đủ">
            <THead>
              <th style={{ width: 92 }}>Mã</th>
              <th>Tên vật tư</th>
              <th style={{ width: 54 }}>ĐVT</th>
              <th style={{ ...R, width: 96 }}>Đã về</th>
              <th style={{ ...R, width: 96 }}>Đã xuất</th>
            </THead>
            <tbody>
              {ds.map((r) => (
                <Row key={r.material_id}>
                  <Cell>
                    <Code>{r.code}</Code>
                  </Cell>
                  <Cell grow title={r.name}>
                    {r.name}
                  </Cell>
                  <Cell muted>{r.unit}</Cell>
                  <Cell num>{so(r.ve)}</Cell>
                  <Cell num>{so(r.xuat)}</Cell>
                </Row>
              ))}
            </tbody>
          </Table>
        ) : (
          <Table
            minWidth={620}
            label={ngan === 'con' ? 'Mã còn trong kho' : 'Mã kho hết'}
          >
            <THead>
              <th style={{ width: 92 }}>Mã</th>
              <th>Tên vật tư</th>
              <th style={{ width: 54 }}>ĐVT</th>
              <th style={{ ...R, width: 84 }}>Đã về</th>
              <th style={{ ...R, width: 84 }}>Đã xuất</th>
              <th style={{ ...R, width: 92 }}>Còn của lệnh</th>
              {ngan === 'con' && <th style={{ ...R, width: 88 }}>Kho chia</th>}
              <th style={{ width: ngan === 'con' ? 150 : 220 }}>
                {ngan === 'con' ? 'Ghi chú' : 'Vì sao kho hết'}
              </th>
            </THead>
            <tbody>
              {ds.map((r) => {
                const thieu = r.chia < r.con - EPS
                return (
                  <Row key={r.material_id}>
                    <Cell>
                      <Code>{r.code}</Code>
                    </Cell>
                    <Cell grow title={r.name} muted={ngan === 'het'}>
                      {r.name}
                    </Cell>
                    <Cell muted>{r.unit}</Cell>
                    <Cell num>{so(r.ve)}</Cell>
                    <Cell num muted>
                      {r.xuat > EPS ? so(r.xuat) : '·'}
                    </Cell>
                    <Cell num>
                      <b>{so(r.con)}</b>
                    </Cell>
                    {ngan === 'con' && (
                      <Cell num>
                        <span
                          className={
                            thieu ? 'font-semibold text-[var(--warn)]' : undefined
                          }
                        >
                          {so(r.chia)}
                        </span>
                      </Cell>
                    )}
                    <Cell
                      title={
                        r.chung.length > 0 ? `Chung với ${r.chung.join(', ')}` : undefined
                      }
                    >
                      {ngan === 'con' ? (
                        <span className="flex gap-1 overflow-hidden">
                          {thieu && <Tag tone="warn">thiếu {so(r.con - r.chia)}</Tag>}
                          {r.chung.length > 0 && (
                            <Tag>chung {r.chung.map(lenhGon).join(', ')}</Tag>
                          )}
                        </span>
                      ) : (
                        <span className="text-k-sm block truncate text-[var(--ink-2)]">
                          {r.ton > EPS && r.chung.length > 0
                            ? `Kho còn ${so(r.ton)}, đang chia cho ${r.chung.map(lenhGon).join(', ')}`
                            : 'Tồn dùng được bằng 0'}
                        </span>
                      )}
                    </Cell>
                  </Row>
                )
              })}
            </tbody>
            <TFoot
              label={
                <td colSpan={5}>
                  {ds.length} mã
                  {ngan === 'con' &&
                    ds.some((r) => r.chia < r.con - EPS) &&
                    ` · ${ds.filter((r) => r.chia < r.con - EPS).length} mã kho chia thiếu`}
                </td>
              }
              cells={null}
              caveat="Số theo ĐVT từng mã, không cộng dồn."
              caveatSpan={ngan === 'con' ? 3 : 2}
            />
          </Table>
        )}
      </div>
    </Sheet>
  )
}
