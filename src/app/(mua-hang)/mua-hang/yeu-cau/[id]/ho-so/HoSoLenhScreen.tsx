'use client'

import Image from 'next/image'
import type { LsxSupplyDetail } from '@/modules/dept/supply/lsx-supply.service'
import { coThongSo, gomThongSo } from '@/lib/lsx-spec-summary'
import {
  Btn,
  Cell,
  Code,
  Crumb,
  Empty,
  Num,
  Row,
  ScreenFrame,
  ScreenHeader,
  StatusBar,
  TFoot,
  THead,
  Table,
  Tag,
  showNum,
} from '@/components/kit'

const ngay = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

const conLai = (iso: string | null, today: string): number | null => {
  if (!iso) return null
  const t = (s: string) => Date.parse(s.slice(0, 10) + 'T00:00:00Z')
  return Math.round((t(iso) - t(today)) / 86_400_000)
}

/**
 * HỒ SƠ LỆNH CHO NGƯỜI MUA — "lệnh này làm cái gì, bằng vật liệu gì, hạn nào".
 *
 * Màn anh em với `/mua-hang/yeu-cau/[id]` (vật tư của lệnh): cùng một lệnh,
 * hai câu hỏi khác nhau, nên hai màn chứ không một màn nhồi đôi.
 *
 *   · màn kia — "còn thiếu gì, đã đặt đơn nào"  (trục: mua đủ chưa)
 *   · màn này — "làm cái gì, thông số ra sao"   (trục: nội dung lệnh)
 *
 * VÌ SAO DỰNG MỚI thay vì dẫn sang bản có sẵn: hồ sơ lệnh bản cũ
 * (`/planning/lsx/[id]/ho-so`) là màn DÙNG CHUNG cho Kế hoạch/Sản xuất/Giám
 * đốc — nó bày tiến độ công đoạn, jobs, số liệu xưởng. Người mua không cần
 * chỗ đó, mà lại THIẾU đúng thứ họ cần: thông số kỹ thuật để chép vào đơn
 * mua. Bản này lấy ba khối chủ dự án chốt 16/09/2026 — sản phẩm kèm ảnh, mốc
 * thời gian, thông số — và bỏ hẳn phần xưởng.
 *
 * KHÔNG SERVICE MỚI: cùng `buildLsxSupplyDetail` với màn vật tư, nên hai màn
 * không thể nói khác nhau về cùng một lệnh.
 */
export function HoSoLenhScreen({
  lsx,
  today,
  imageUrls,
}: {
  lsx: LsxSupplyDetail
  today: string
  imageUrls: Record<string, string>
}) {
  const nhom = gomThongSo(
    lsx.products.map((p) => ({ code: p.code, name: p.name, specs: p.specs })),
  )
  const tongSl = lsx.products.reduce((a, p) => a + p.qty, 0)
  const dvt = [...new Set(lsx.products.map((p) => p.unit).filter(Boolean))]
  const conMoc = conLai(lsx.materials_due_at, today)
  const conGiao = conLai(lsx.ship_date, today)

  return (
    <ScreenFrame>
      <Crumb
        path={[
          'Mua hàng',
          { label: 'Vật tư theo lệnh', href: '/mua-hang/yeu-cau' },
          { label: lsx.code, href: `/mua-hang/yeu-cau/${lsx.id}` },
          'Hồ sơ lệnh',
        ]}
      />
      <ScreenHeader
        compact
        eyebrow={lsx.customer_name}
        title={lsx.code}
        facts={[
          { label: 'Sản phẩm', value: String(lsx.products.length) },
          {
            label: 'Tổng SL',
            value: `${showNum(tongSl)}${dvt.length === 1 ? ' ' + dvt[0] : ''}`,
          },
          { label: 'Đơn khách', value: lsx.order_codes.join(', ') || 'không có' },
        ]}
        actions={
          <>
            <Btn href={`/mua-hang/yeu-cau/${lsx.id}`}>Vật tư của lệnh</Btn>
            <Btn href={`/api/dept/supply/lsx-report?lsx=${lsx.id}&loai=lsx`}>
              Báo cáo lệnh
            </Btn>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto">
        {/*
          MỐC THỜI GIAN — ba ngày người mua phải đối chiếu trước khi hứa với
          NCC, cộng container. Ngày nào chưa có thì NÓI RA là chưa có: mốc
          trống là lý do đo được khiến cảnh báo trễ bỏ qua cả lệnh.
        */}
        <Muc title="Mốc thời gian">
          <Table>
            <THead>
              <th>Mốc</th>
              <th>Ngày</th>
              <th>Còn lại</th>
              <th>Nghĩa với người mua</th>
            </THead>
            <tbody>
              <MocRow
                nhan="Mốc vật tư"
                iso={lsx.materials_due_at}
                con={conMoc}
                nghia="Hạn vật tư phải có mặt ở kho để xưởng vào việc"
              />
              <MocRow
                nhan="Ngày giao khách"
                iso={lsx.ship_date}
                con={conGiao}
                nghia="Ngày hàng phải rời kho — mọi đơn mua phải về trước mốc này"
              />
              <Row>
                <Cell>Vật tư đã nhận</Cell>
                <Cell>
                  {lsx.materials_received_at ? (
                    ngay(lsx.materials_received_at)
                  ) : (
                    <Tag tone="warn">chưa nhận</Tag>
                  )}
                </Cell>
                <Cell>—</Cell>
                <Cell muted>Mốc xưởng xác nhận đã nhận đủ vật tư của lệnh</Cell>
              </Row>
              <Row>
                <Cell>Container</Cell>
                <Cell>{lsx.container_summary || <Tag>chưa khai</Tag>}</Cell>
                <Cell>—</Cell>
                <Cell muted>Hàng đi cont nào — quyết định thứ tự hàng phải về</Cell>
              </Row>
            </tbody>
          </Table>
        </Muc>

        {/*
          SẢN PHẨM PHẢI LÀM. Ảnh đi qua đường dẫn cố định `/api/files/<id>/img`
          (xem page.tsx) chứ không phải URL ký đổi mỗi lượt render — URL ký là
          thứ đã đốt hạn mức tối ưu ảnh ở màn thư viện sản phẩm.
        */}
        <Muc title={`Sản phẩm phải làm (${lsx.products.length})`}>
          {lsx.products.length === 0 ? (
            <Empty
              headline="Lệnh chưa có dòng sản phẩm nào"
              reason="Dòng lệnh do Bán hàng soạn. Lệnh không có dòng thì không tính ra được cần mua gì — mọi con số vật tư của lệnh này bằng 0 vì lý do đó, không phải vì đã mua đủ."
              next={<Btn href={`/mua-hang/yeu-cau/${lsx.id}`}>Xem vật tư của lệnh</Btn>}
            />
          ) : (
            <Table>
              <THead>
                <th></th>
                <th>Mã SP</th>
                <th>Tên</th>
                <th>ĐVT</th>
                <th>Số lượng</th>
              </THead>
              <tbody>
                {lsx.products.map((p) => {
                  const src = p.image_file_id ? imageUrls[p.image_file_id] : null
                  return (
                    <Row key={p.code}>
                      <Cell>
                        {src ? (
                          <Image
                            src={src}
                            alt=""
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded-[3px] border border-[var(--line)] object-cover"
                          />
                        ) : (
                          /* Ô trống CHIẾM CHỖ và nói ra: ảnh thiếu là việc của
                             Kỹ thuật, giấu đi thì không ai biết mà bổ sung. */
                          <span className="flex h-10 w-10 items-center justify-center rounded-[3px] border border-dashed border-[var(--line)] text-[10px] text-[var(--ink-3)]">
                            chưa
                          </span>
                        )}
                      </Cell>
                      <Cell>
                        <Code>{p.code}</Code>
                      </Cell>
                      <Cell>{p.name}</Cell>
                      <Cell muted>{p.unit ?? '—'}</Cell>
                      <Cell num>
                        <Num value={showNum(p.qty)} />
                      </Cell>
                    </Row>
                  )
                })}
              </tbody>
              {/* `label` và `cells` của TFoot được đặt THẲNG vào <tr>, nên
                  cả hai phải là <td> — truyền chuỗi trần vào `label` là đẻ ra
                  text node trong <tr> và React đổ hydration ngay. */}
              <TFoot
                label={<td colSpan={2}>Cộng {lsx.products.length} mã</td>}
                cells={
                  <>
                    <td />
                    <td />
                    <td className="num text-right">
                      <Num value={showNum(tongSl)} strong />
                    </td>
                  </>
                }
              />
            </Table>
          )}
        </Muc>

        {/*
          THÔNG SỐ KỸ THUẬT — thứ người mua chép sang đơn khi đặt sơn, kính,
          vải. Gom bằng `lib/lsx-spec-summary`: cả lệnh giống nhau thì nói một
          câu, khác nhau thì bày đúng chỗ khác.
        */}
        <Muc title="Thông số kỹ thuật">
          {!coThongSo(nhom) ? (
            <Empty
              headline="Lệnh chưa khai thông số nào"
              reason="Sơn, gỗ, kính, nệm được Bán hàng khai trên dòng lệnh lúc soạn. Chưa có thì người mua không có gì để chép sang đơn — phải hỏi trước khi đặt, đừng đoán theo lệnh cũ."
              next={<Btn href={`/mua-hang/yeu-cau/${lsx.id}`}>Về vật tư của lệnh</Btn>}
            />
          ) : (
            <Table>
              <THead>
                <th>Hạng mục</th>
                <th>Thông số</th>
                <th>Ghi chú</th>
              </THead>
              <tbody>
                {nhom.map((g) => (
                  <Row key={g.key}>
                    <Cell>{g.label}</Cell>
                    {/* Ô này BẺ DÒNG: Cell mặc định nowrap (đúng cho ô số/mã), nhưng
                        danh sách 11 mã ở đây dài 300px và đẩy bảng cuộn ngang —
                        người mua phải kéo mới đọc hết thứ đáng đọc nhất màn. */}
                    <Cell className="whitespace-normal">
                      {g.chung ? (
                        <b>{g.chung}</b>
                      ) : g.theoGiaTri.length > 0 ? (
                        <span className="flex flex-col gap-[3px]">
                          {g.theoGiaTri.map((v) => (
                            <span key={v.value}>
                              <b>{v.value}</b>{' '}
                              <span className="text-[var(--ink-3)]">
                                — {v.codes.length} mã:{' '}
                              </span>
                              {v.codes.map((c) => (
                                <Code key={c}>{c}</Code>
                              ))}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <Tag tone="warn">chưa khai</Tag>
                      )}
                    </Cell>
                    <Cell muted>
                      {g.chung
                        ? 'cả lệnh dùng chung'
                        : g.thieu > 0
                          ? `${g.thieu}/${lsx.products.length} mã bỏ trống ô này`
                          : `${g.theoGiaTri.length} loại khác nhau`}
                    </Cell>
                  </Row>
                ))}
              </tbody>
            </Table>
          )}
        </Muc>
      </div>

      <StatusBar
        left={[`Lệnh ${lsx.code}`, lsx.customer_name]}
        right={`${lsx.products.length} mã · ${showNum(tongSl)} SP · ${lsx.pos.length} đơn mua`}
      />
    </ScreenFrame>
  )
}

/** Khối có tiêu đề — ngăn nhau bằng một vạch mảnh, không thẻ nổi (luật 4). */
function Muc({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-[var(--line)]">
      <h2 className="bg-[var(--surface-raised)] px-[var(--gutter)] py-[6px] font-semibold tracking-[.06em] text-[var(--fs-label)] text-[var(--ink-2)] uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

function MocRow({
  nhan,
  iso,
  con,
  nghia,
}: {
  nhan: string
  iso: string | null
  con: number | null
  nghia: string
}) {
  return (
    <Row>
      <Cell>{nhan}</Cell>
      <Cell>{iso ? ngay(iso) : <Tag tone="warn">chưa có</Tag>}</Cell>
      <Cell>
        {con == null ? (
          '—'
        ) : con < 0 ? (
          <Tag tone="stop">quá {Math.abs(con)} ngày</Tag>
        ) : (
          `còn ${con} ngày`
        )}
      </Cell>
      <Cell muted>{nghia}</Cell>
    </Row>
  )
}
