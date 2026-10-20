'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Cell,
  Chip,
  Code,
  Crumb,
  Empty,
  FilterBar,
  Metric,
  MetricStrip,
  Num,
  Row,
  ScreenFrame,
  ScreenHeader,
  StatusBar,
  TFoot,
  THead,
  Table,
  Tag,
  showMoney,
  showNum,
  useToast,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { PO_STATUS_LABEL, type PoStatus } from '@/lib/po-status'
import {
  DA_GUI_NCC as DA_GUI,
  dvGia,
  nccRows,
  reNhatId,
  tomTat,
  type VtHoSo,
} from '@/lib/vat-tu-ho-so'

const ngay = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const tien = (v: number, cur: string) =>
  `${showMoney(v, { digits: cur === 'VND' ? 0 : 2 })} ${cur === 'VND' ? '₫' : cur}`

/**
 * HỒ SƠ VẬT TƯ — "mã này mua ở NCC nào, giá bao nhiêu, lần cuối khi nào?"
 * (06/10/2026, bản vẽ chủ dự án duyệt). Nguồn duy nhất là dòng đơn mua — xem
 * `lib/vat-tu-ho-so.ts`. Hai cách xem trong MỘT vùng cuộn: theo NCC (mặc định,
 * kèm NCC gợi ý cùng nhóm con) và theo lịch sử từng dòng đơn.
 */
export function HoSoVatTuScreen({ d, canEdit }: { d: VtHoSo; canEdit: boolean }) {
  const { vt, lines, goi_y } = d
  const [xem, setXem] = useState<'ncc' | 'lich-su'>('ncc')
  const [busy, setBusy] = useState<string | null>(null)
  const router = useRouter()
  const toast = useToast()

  const ncc = useMemo(
    () => nccRows(lines, vt.default_supplier),
    [lines, vt.default_supplier],
  )
  const reNhat = useMemo(() => reNhatId(ncc, vt.unit), [ncc, vt.unit])
  const { ganNhat, daDat, dangVe, nDon, donDangVe } = useMemo(
    () => tomTat(lines),
    [lines],
  )

  /**
   * ĐẶT LÀM NCC MẶC ĐỊNH — sửa ngay chỗ thấy mặc định trỏ sai (NH-0513 trỏ Tiến
   * Đạt mà người bán thật là Quang Minh / Đoàn Gia). Đi qua route sửa vật tư sẵn
   * có: `materialsService.update` kiểm quyền từng trường, có vết thay đổi.
   */
  async function datMacDinh(id: string, name: string) {
    setBusy(id)
    try {
      await api(`/api/dept/warehouse/materials/${vt.id}`, {
        method: 'PATCH',
        body: { default_supplier_id: id },
      })
      toast.success('Đã đặt NCC mặc định', `${vt.code} → ${name}`)
      router.refresh()
    } catch (e) {
      toast.error('Không đặt được', apiErrorText(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <ScreenFrame>
      <Crumb
        path={['Mua hàng', { label: 'Vật tư', href: '/mua-hang/vat-tu' }, vt.code]}
      />
      <ScreenHeader
        compact
        eyebrow={[vt.group_name ?? 'Chưa xếp nhóm', vt.sub_group]
          .filter(Boolean)
          .join(' · ')}
        title={
          <span className="flex items-center gap-2">
            {vt.name}
            <span className="num text-k-label text-[var(--ink-3)]">{vt.code}</span>
          </span>
        }
        status={vt.is_active ? undefined : <Tag tone="warn">Ngừng dùng</Tag>}
        facts={[
          { label: 'ĐVT', value: vt.unit },
          { label: 'Quy cách', value: vt.spec || '—' },
          {
            label: 'Tính giá theo',
            // Danh mục để trống mà đơn tính theo ĐV quy đổi (NH-0513: ₫/kg) thì
            // nói theo đơn — in "Cây" ở đây là cãi lại cả bảng giá bên dưới.
            value:
              vt.price_unit ??
              (ganNhat
                ? `${dvGia(ganNhat, vt.unit)} · theo đơn gần nhất`
                : `${vt.unit} (ĐVT)`),
          },
          { label: 'Kệ', value: vt.shelf || 'chưa khai' },
          {
            label: 'NCC mặc định',
            value: vt.default_supplier?.name ?? 'chưa đặt',
            tone: vt.default_supplier ? undefined : 'warn',
          },
        ]}
        actions={
          <>
            <Btn icon="tien" href={`/mua-hang/bang-gia?q=${encodeURIComponent(vt.code)}`}>
              So giá ở Bảng giá
            </Btn>
            {canEdit && (
              <Btn icon="sua" href={`/mua-hang/vat-tu?sua=${vt.id}`}>
                Sửa vật tư
              </Btn>
            )}
          </>
        }
      />

      {/* Mỗi ô một mẫu số — luật 6 của sổ: số không kiểm được thì không ai tin. */}
      <MetricStrip>
        <Metric
          label="NCC đã bán"
          value={String(ncc.filter((n) => n.last).length)}
          basis={
            lines.length === 0
              ? 'chưa lên đơn mua nào'
              : `từ ${lines.length} dòng · ${new Set(lines.map((l) => l.po_id)).size} đơn, không tính đơn huỷ`
          }
        />
        <Metric
          label="Giá gần nhất"
          value={
            ganNhat
              ? `${tien(ganNhat.unit_price!, ganNhat.currency)}/${dvGia(ganNhat, vt.unit)}`
              : null
          }
          basis={
            ganNhat
              ? `${ganNhat.supplier_name} · ${ganNhat.po_code} · ${ngay(ganNhat.at)}`
              : lines.length === 0
                ? 'chưa mua lần nào qua hệ thống'
                : 'chưa có đơn đã gửi NCC — giá đơn nháp chưa phải giá chốt'
          }
        />
        <Metric
          label="Đã đặt"
          value={`${showNum(daDat) || '0'} ${vt.unit}`}
          basis={nDon ? `${nDon} đơn đã gửi NCC` : 'chưa đặt lần nào'}
        />
        <Metric
          label="Đang về"
          value={`${showNum(dangVe) || '0'} ${vt.unit}`}
          basis={
            donDangVe ? `${donDangVe} đơn chưa về đủ` : 'không đơn nào đang chờ hàng'
          }
          // Không tô màu: hàng đang về là chuyện bình thường, không phải tin xấu.
        />
        <Metric
          label="Tồn kho"
          value={`${showNum(vt.on_hand) || '0'} ${vt.unit}`}
          basis={`kệ ${vt.shelf || '—'} · ngưỡng ${vt.min_stock ?? 0}`}
        />
      </MetricStrip>

      <FilterBar dense label="Xem theo">
        <Chip
          icon="ncc"
          on={xem === 'ncc'}
          count={ncc.length}
          onClick={() => setXem('ncc')}
        >
          Nhà cung cấp
        </Chip>
        <Chip
          icon="lichSu"
          on={xem === 'lich-su'}
          count={lines.length}
          onClick={() => setXem('lich-su')}
        >
          Lịch sử mua
        </Chip>
        <span className="text-k-label ml-auto text-[var(--ink-3)]">
          Nguồn: đơn mua trên hệ thống — không có bảng khai tay
        </span>
      </FilterBar>

      <div className="min-h-0 flex-1 overflow-auto">
        {xem === 'ncc' ? (
          <>
            {ncc.length === 0 ? (
              <Empty
                level={2}
                headline="Chưa mua mã này lần nào qua hệ thống"
                reason={
                  goi_y.length > 0
                    ? `Hệ thống chỉ biết NCC của một mã khi mã đó đã lên đơn mua. Bên dưới là ${goi_y.length} NCC từng bán mã CÙNG NHÓM "${vt.sub_group}" — gọi hỏi giá trước khi đặt.`
                    : `Hệ thống chỉ biết NCC qua đơn mua, mà nhóm "${vt.group_name}" chưa từng có mã nào lên đơn — chưa có gì để gợi ý.`
                }
                next={
                  <Btn icon="ncc" href="/mua-hang/ncc">
                    Tìm trong danh sách NCC
                  </Btn>
                }
              />
            ) : (
              <Table>
                <THead pinFirst>
                  <th>Nhà cung cấp</th>
                  <th style={{ textAlign: 'right' }}>Giá gần nhất</th>
                  <th>Mua lần cuối</th>
                  <th style={{ textAlign: 'right' }}>Số đơn</th>
                  <th style={{ textAlign: 'right' }}>Đã đặt</th>
                  <th style={{ textAlign: 'right' }}>Đang về</th>
                  <th />
                </THead>
                <tbody>
                  {ncc.map((n) => (
                    <Row key={n.id}>
                      <Cell pin grow>
                        <span className="flex items-center gap-2">
                          <a
                            href={`/mua-hang/ncc/${n.id}`}
                            className="truncate text-[var(--act)] hover:underline"
                          >
                            {n.name}
                          </a>
                          {vt.default_supplier?.id === n.id && (
                            <Tag tone="run">Mặc định</Tag>
                          )}
                          {reNhat === n.id && <Tag tone="done">Rẻ nhất</Tag>}
                        </span>
                      </Cell>
                      <Cell num>
                        {n.priceLine ? (
                          <span className="flex items-baseline justify-end gap-1">
                            <Num
                              value={showMoney(n.priceLine.unit_price!, { digits: n.priceLine.currency === 'VND' ? 0 : 2 })} // prettier-ignore
                              strong
                            />
                            <span className="text-k-label text-[var(--ink-3)]">
                              {n.priceLine.currency === 'VND'
                                ? '₫'
                                : n.priceLine.currency}
                              /{dvGia(n.priceLine, vt.unit)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[var(--ink-3)]">
                            {n.last ? 'chưa chốt giá' : 'chưa bán mã này qua hệ thống'}
                          </span>
                        )}
                      </Cell>
                      <Cell muted>
                        {n.last ? (
                          <>
                            <span className="num">{ngay(n.last.at)}</span>{' '}
                            <Code as="a" href={`/mua-hang/don/${n.last.po_id}`}>
                              {n.last.po_code}
                            </Code>
                          </>
                        ) : (
                          'chưa đơn nào'
                        )}
                      </Cell>
                      <Cell num>
                        <Num value={String(n.nDon)} />
                      </Cell>
                      <Cell num>
                        <Num value={showNum(n.qty)} />
                      </Cell>
                      <Cell num>
                        {/* Đã đặt mà không còn chờ = về đủ → ✓, không phải "chưa có số". */}
                        {n.open > 0 ? (
                          <Num value={showNum(n.open)} strong />
                        ) : (
                          <Num value="" zero={n.nDon > 0 ? 'done' : 'dash'} />
                        )}
                      </Cell>
                      <Cell>
                        <span className="flex justify-end gap-1.5">
                          {canEdit && n.last && vt.default_supplier?.id !== n.id && (
                            <Btn
                              icon="tick"
                              busy={busy === n.id}
                              onClick={() => datMacDinh(n.id, n.name)}
                            >
                              Đặt làm mặc định
                            </Btn>
                          )}
                          <Btn icon="them" href={`/mua-hang/don/moi?ncc=${n.id}`}>
                            Soạn đơn
                          </Btn>
                        </span>
                      </Cell>
                    </Row>
                  ))}
                </tbody>
                <TFoot
                  label={
                    <td colSpan={4}>
                      Cộng {ncc.filter((n) => n.last).length} NCC đã bán
                      <span className="text-k-sm ml-1.5 font-normal text-[var(--ink-3)]">
                        · giá và số lượng chỉ tính đơn ĐÃ GỬI NCC; đơn nháp / chờ duyệt
                        không tính, đơn huỷ bỏ hẳn
                      </span>
                    </td>
                  }
                  cells={
                    <>
                      <td className="num">{showNum(daDat)}</td>
                      <td className="num">{showNum(dangVe)}</td>
                      <td />
                    </>
                  }
                />
              </Table>
            )}

            {goi_y.length > 0 && (
              <>
                <div className="k-sec px-[var(--gutter)]">
                  NCC khác từng bán mã cùng nhóm “{vt.sub_group}”
                  <span className="text-k-sm ml-2 font-normal text-[var(--ink-3)]">
                    gợi ý — chưa bán {vt.code} cho mình, hỏi giá trước khi đặt
                  </span>
                </div>
                <Table>
                  <THead pinFirst>
                    <th>Nhà cung cấp</th>
                    <th style={{ textAlign: 'right' }}>Mã cùng nhóm đã bán</th>
                    <th>Ví dụ</th>
                    <th>Lần cuối</th>
                    <th />
                  </THead>
                  <tbody>
                    {goi_y.map((g) => (
                      <Row key={g.supplier_id}>
                        <Cell pin>
                          <a
                            href={`/mua-hang/ncc/${g.supplier_id}`}
                            className="text-[var(--act)] hover:underline"
                          >
                            {g.supplier_name}
                          </a>
                        </Cell>
                        <Cell num>
                          <Num value={String(g.n_codes)} />
                        </Cell>
                        <Cell grow>
                          <span className="flex min-w-0 gap-1.5 truncate">
                            {g.sample.map((s) => (
                              <span key={s.code} title={s.name}>
                                <Code>{s.code}</Code>
                              </span>
                            ))}
                          </span>
                        </Cell>
                        <Cell muted>
                          <span className="num">{ngay(g.last_at)}</span>
                        </Cell>
                        <Cell>
                          <Btn
                            icon="them"
                            href={`/mua-hang/don/moi?ncc=${g.supplier_id}`}
                          >
                            Soạn đơn
                          </Btn>
                        </Cell>
                      </Row>
                    ))}
                  </tbody>
                </Table>
              </>
            )}
          </>
        ) : lines.length === 0 ? (
          <Empty
            level={2}
            headline="Chưa có dòng đơn mua nào của mã này"
            reason="Lịch sử chỉ gồm đơn mua lập trên hệ thống (từ 08/2026). Mã mua trước đó hay mua ngoài sổ không có ở đây."
            next={
              <Btn icon="ncc" onClick={() => setXem('ncc')}>
                Xem NCC gợi ý
              </Btn>
            }
          />
        ) : (
          <Table>
            <THead pinFirst>
              <th>Đơn</th>
              <th>Ngày</th>
              <th>Trạng thái</th>
              <th>Nhà cung cấp</th>
              <th>Lệnh SX</th>
              <th style={{ textAlign: 'right' }}>SL ({vt.unit})</th>
              <th style={{ textAlign: 'right' }}>Quy đổi</th>
              <th style={{ textAlign: 'right' }}>Đơn giá</th>
              <th style={{ textAlign: 'right' }}>Còn chờ về</th>
              <th>Ghi chú dòng</th>
            </THead>
            <tbody>
              {lines.map((l) => (
                <Row key={l.line_id}>
                  <Cell pin>
                    <Code as="a" href={`/mua-hang/don/${l.po_id}`}>
                      {l.po_code}
                    </Code>
                  </Cell>
                  <Cell muted>
                    <span className="num">{ngay(l.at)}</span>
                  </Cell>
                  <Cell>
                    <Tag
                      tone={
                        l.status === 'received'
                          ? 'done'
                          : DA_GUI.has(l.status)
                            ? 'run'
                            : 'neutral'
                      }
                    >
                      {PO_STATUS_LABEL[l.status as PoStatus] ?? l.status}
                    </Tag>
                  </Cell>
                  <Cell>
                    <span
                      className="block max-w-[220px] truncate"
                      title={l.supplier_name}
                    >
                      {l.supplier_name}
                    </span>
                  </Cell>
                  <Cell muted>{l.lsx_code ?? 'Ngoài lệnh'}</Cell>
                  <Cell num>
                    <Num value={showNum(l.qty)} />
                  </Cell>
                  <Cell num muted>
                    {l.qty2 != null && l.unit2 ? `${showNum(l.qty2)} ${l.unit2}` : ''}
                  </Cell>
                  <Cell num>
                    {l.unit_price != null ? (
                      <span className="flex items-baseline justify-end gap-1">
                        <Num
                          value={showMoney(l.unit_price, {
                            digits: l.currency === 'VND' ? 0 : 2,
                          })}
                        />{' '}
                        {/* prettier-ignore */}
                        <span className="text-k-label text-[var(--ink-3)]">/{dvGia(l, vt.unit)}</span>
                      </span>
                    ) : (
                      ''
                    )}
                  </Cell>
                  <Cell num>
                    {l.qty_open > 0 ? (
                      <Num value={showNum(l.qty_open)} strong />
                    ) : (
                      // Đơn đã gửi mà hết chờ = về đủ (✓); đơn nháp chưa đi thì chưa có số.
                      <Num value="" zero={DA_GUI.has(l.status) ? 'done' : 'dash'} />
                    )}
                  </Cell>
                  <Cell grow muted>
                    <span className="block truncate" title={l.note ?? undefined}>
                      {l.note ?? ''}
                    </span>
                  </Cell>
                </Row>
              ))}
            </tbody>
            <TFoot
              label={
                <td colSpan={5}>
                  Cộng {lines.length} dòng
                  <span className="text-k-sm ml-1.5 font-normal text-[var(--ink-3)]">
                    · gồm cả đơn nháp / chờ duyệt; đơn huỷ không hiện
                  </span>
                </td>
              }
              cells={
                <>
                  <td className="num">{showNum(lines.reduce((s, l) => s + l.qty, 0))}</td>
                  <td />
                  <td />
                  <td className="num">{showNum(dangVe)}</td>
                  <td />
                </>
              }
            />
          </Table>
        )}
      </div>

      <StatusBar
        left={[`Vật tư ${vt.code}`, vt.unit]}
        right={
          ganNhat
            ? `gần nhất ${tien(ganNhat.unit_price!, ganNhat.currency)}/${dvGia(ganNhat, vt.unit)} · ${ncc.filter((n) => n.last).length} NCC đã bán`
            : `${goi_y.length} NCC gợi ý cùng nhóm`
        }
      />
    </ScreenFrame>
  )
}
