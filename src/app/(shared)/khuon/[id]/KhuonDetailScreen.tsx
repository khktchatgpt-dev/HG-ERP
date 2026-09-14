'use client'

import {
  Code,
  Crumb,
  DocBody,
  DocHead,
  DocScreen,
  FactBox,
  FactKv,
  FactSection,
  FastTab,
  Field,
  FieldGrid,
  Grid,
  GridBody,
  GridHead,
  GridRow,
  MasterWarn,
  Metric,
  MetricStrip,
  StatusBar,
  Tag,
  Td,
  Th,
} from '@/components/kit'
import type {
  DieEvent,
  DieRow,
  DieSpec,
  DieUsage,
} from '@/modules/dept/technical/dies.repo'
import { DIE_EVENT_LABEL, DIE_STATUS_LABEL, kgPerM, money, viDate } from '../_lib/labels'
import { KhuonActions } from './KhuonActions'
import { KhuonImageActions } from './KhuonImageActions'

/**
 * KHUÔN E — HỒ SƠ DANH MỤC cho một cái khuôn.
 *
 * Trả lời: "cái khuôn này là gì, đang ở đâu, ai giữ, dùng cho SP nào?".
 * Thiết kế: docs/quan-ly-khuon-ke-hoach.md §5.2.
 *
 * KHÔNG có ba trục trạng thái của khuôn chứng từ, và không có nút "gửi duyệt":
 * không ai duyệt một cái khuôn. Chỗ đó là DẢI HIỆU SUẤT — mỗi ô kèm mẫu số.
 *
 * Ô nào chưa đo được thì để `value={null}` (kit hiện "chưa đo được") chứ KHÔNG
 * thay bằng 0: "chưa ai ghi lần sửa nào" và "khuôn chưa từng phải sửa" là hai
 * chuyện khác hẳn, và 39% danh mục đang ở tình trạng thứ nhất.
 */

/**
 * Bảng màu RIÊNG cho màn này vì nó còn dựng bằng bộ kit, còn thư viện đã chuyển
 * sang theme v3 — hai hệ có hai tập tên tone (kit: neutral/warn/done/stop; v3:
 * gray/amber/green/red). Khi hồ sơ khuôn cũng chuyển sang v3 thì xoá khối này và
 * dùng chung `DIE_STATUS_TONE` ở `_lib/labels`.
 */
const KIT_TONE: Record<DieRow['status'], 'neutral' | 'warn' | 'done' | 'stop'> = {
  pending: 'warn',
  active: 'done',
  rarely_used: 'neutral',
  broken: 'stop',
  replaced: 'neutral',
  retired: 'neutral',
  unknown: 'warn',
}

type Props = {
  die: DieRow & DieSpec
  events: DieEvent[]
  usage: DieUsage[]
  imageUrl: string | null
  /** Tổng số hồ sơ SP — mẫu số của ô "đang dùng ở", không hiện số trần trụi. */
  productTotal: number
  /** Cờ SỬA từ service — UI không tự tính lại luật quyền. */
  canEdit: boolean
  holderOptions: string[]
  groupOptions: string[]
}

export function KhuonDetailScreen({
  die,
  events,
  usage,
  imageUrl,
  productTotal,
  canEdit,
  holderOptions,
  groupOptions,
}: Props) {
  const products = new Set(usage.map((u) => u.product_id))
  const viaLegacy = usage.filter((u) => u.via === 'legacy').length
  const lastEvent = events[0] ?? null
  const lastFix = events.find(
    (e) => e.event_type === 'modified' && e.weight_after != null,
  )

  return (
    <DocScreen>
      <Crumb path={['Dùng chung', { label: 'Khuôn nhôm', href: '/khuon' }, die.code]} />

      <DocHead
        compact
        kind="Khuôn nhôm"
        code={die.code}
        sub={
          <>
            {die.name ?? 'Chưa ghi tên chi tiết'}
            {' · '}
            <Tag tone={KIT_TONE[die.status]}>{DIE_STATUS_LABEL[die.status]}</Tag>
            {die.holder_name ? ` · đang ở ${die.holder_name}` : ''}
          </>
        }
      />

      <MetricStrip>
        <Metric
          label="Đang dùng ở"
          value={products.size === 0 ? '0 SP' : `${products.size} SP`}
          basis={`khớp mã khuôn trên ${productTotal} hồ sơ · ${usage.length} dòng định mức`}
          tone={products.size > 0 ? 'done' : undefined}
        />
        <Metric
          label="kg/m hiện hành"
          value={die.weight_per_m == null ? null : kgPerM(die.weight_per_m)}
          basis={
            lastFix
              ? `đã sửa ${viDate(lastFix.event_date) || 'không rõ ngày'} · trước đó ${lastFix.weight_before == null ? '—' : kgPerM(lastFix.weight_before)}`
              : 'số cân của nhà cung cấp, chưa qua lần sửa nào được ghi'
          }
        />
        <Metric
          label="Tiền mở khuôn"
          value={die.die_price == null ? null : `${money(die.die_price)} ₫`}
          basis={
            die.die_price == null
              ? 'bốn file cũ không ghi giá mã này'
              : 'theo file hợp nhất của Kỹ thuật'
          }
        />
        <Metric
          label="Lần động gần nhất"
          value={
            lastEvent
              ? `${viDate(lastEvent.event_date) || 'không rõ ngày'} · ${DIE_EVENT_LABEL[lastEvent.event_type]}`
              : null
          }
          basis={`nhật ký có ${events.length} dòng`}
        />
      </MetricStrip>

      {canEdit && (
        <div className="flex justify-end px-[var(--gutter)] pt-2">
          <KhuonActions
            die={die}
            holderOptions={holderOptions}
            groupOptions={groupOptions}
          />
        </div>
      )}

      <MasterWarn
        used={
          products.size > 0 ? (
            <>
              <b>{products.size} hồ sơ sản phẩm</b> đang trỏ vào mã khuôn này
            </>
          ) : (
            <>Chưa hồ sơ sản phẩm nào trỏ vào mã khuôn này</>
          )
        }
      />

      <DocBody
        aside={
          <FactBox>
            <FactSection title="Nhận dạng">
              <FactKv
                rows={[
                  ['Nhóm chi tiết', die.part_group ?? '—'],
                  ['Dạng profile', die.profile_shape ?? '—'],
                  ['Hợp kim', die.alloy ?? '—'],
                  ['ĐVT', die.unit ?? '—'],
                ]}
              />
            </FactSection>
            <FactSection title="Nơi giữ khuôn">
              <FactKv
                rows={[
                  ['Hiện ở', die.holder_name ?? '—'],
                  ['Ghi trên file gốc', die.supplier_name ?? '—'],
                ]}
              />
            </FactSection>
            <FactSection title="Độ tin cậy số liệu">
              <FactKv
                rows={[
                  [
                    'Trạng thái',
                    die.data_confidence === 'needs_review' ? (
                      <span key="a" className="k-t-warn">
                        Cần rà lại
                      </span>
                    ) : (
                      <span key="a" className="k-t-done">
                        Đã chốt
                      </span>
                    ),
                  ],
                  ['Vì sao', die.review_note ?? '—'],
                  ['Cụm nghi trùng', die.duplicate_group ?? 'không'],
                ]}
              />
            </FactSection>
            {die.legacy_codes.length > 0 && (
              <FactSection title="Cách viết cũ của mã">
                <div className="num">{die.legacy_codes.join(' · ')}</div>
              </FactSection>
            )}
          </FactBox>
        }
      >
        <FastTab
          title="Mặt cắt khuôn"
          defaultOpen
          summary={[['Ảnh', imageUrl ? 'có' : 'chưa có']]}
        >
          <div className="flex flex-col gap-3">
            {imageUrl ? (
              <>
                {/*
                  Ảnh KHÔNG qua `next/image`: phần lớn ảnh trong kho là bản xử lý
                  ×3 (quanh 450px) do `khuon-images-enhance.mjs` sinh ra, cho
                  trình tối ưu phóng/nén lại là làm mờ đúng thứ vừa làm rõ.
                */}
                {/* eslint-disable-next-line @next/next/no-img-element -- giữ khổ gốc, xem chú thích trên */}
                <img
                  src={imageUrl}
                  alt={`Mặt cắt khuôn ${die.code}`}
                  className="max-h-[260px] max-w-full object-contain"
                />
                <div className="text-[var(--fs-sm)] text-[var(--ink-3)]">
                  Ảnh bóc từ file Excel của Kỹ thuật (gốc quanh 150×100 px), đã kéo giãn
                  mức xám cho nét thành đen liền. Cần kích thước chính xác thì tra bản vẽ
                  gốc.
                </div>
              </>
            ) : (
              <div className="text-[var(--ink-2)]">
                Chưa có ảnh mặt cắt. Tổ định hình nhận dạng cây nhôm bằng hình tiết diện —
                thiếu ảnh thì phải đo lại bằng thước.
              </div>
            )}

            {canEdit && (
              <KhuonImageActions
                dieId={die.id}
                dieCode={die.code}
                hasImage={!!imageUrl}
              />
            )}
          </div>
        </FastTab>

        <FastTab
          title="Dùng ở sản phẩm nào"
          flush
          defaultOpen
          summary={[
            ['Sản phẩm', <span key="a" className="num">{products.size}</span>], // prettier-ignore
            ['Dòng định mức', <span key="b" className="num">{usage.length}</span>], // prettier-ignore
            ...(viaLegacy > 0
              ? ([['Khớp qua mã cũ', <span key="c" className="num k-t-warn">{viaLegacy}</span>]] as [string, React.ReactNode][]) // prettier-ignore
              : []),
          ]}
        >
          {usage.length === 0 ? (
            <div className="px-[var(--gutter)] py-4 text-[var(--ink-2)]">
              Chưa dòng định mức nào ghi mã khuôn này. Không có nghĩa là khuôn không được
              dùng — chỉ 11% dòng định mức có ghi mã khuôn, phần còn lại ghi quy cách bằng
              tay.
            </div>
          ) : (
            <Grid minWidth={640}>
              <GridHead>
                <Th width={120}>Mã SP</Th>
                <Th>Tên sản phẩm</Th>
                <Th>Chi tiết</Th>
                <Th num width={70}>
                  SL
                </Th>
                <Th num width={90}>
                  Dài cắt (mm)
                </Th>
                <Th width={110}>Khớp bằng</Th>
              </GridHead>
              <GridBody>
                {usage.map((u, i) => (
                  <GridRow key={`${u.product_id}-${i}`}>
                    <Td>
                      <Code as="a" href={`/products/${u.product_id}`}>
                        {u.product_code ?? '—'}
                      </Code>
                    </Td>
                    <Td>{u.product_name ?? '—'}</Td>
                    <Td>{u.part_name}</Td>
                    <Td num>{u.qty ?? ''}</Td>
                    <Td num>{u.cut_length_mm ?? ''}</Td>
                    <Td tone={u.via === 'legacy' ? 'warn' : undefined}>
                      {u.via === 'code' ? 'mã chuẩn' : `mã cũ “${u.profile_code}”`}
                    </Td>
                  </GridRow>
                ))}
              </GridBody>
            </Grid>
          )}
        </FastTab>

        <FastTab
          title="Nhật ký đời khuôn"
          flush
          summary={[['Số dòng', <span key="a" className="num">{events.length}</span>]]} // prettier-ignore
        >
          {events.length === 0 ? (
            <div className="px-[var(--gutter)] py-4 text-[var(--ink-2)]">
              Chưa có sự kiện nào. Nhật ký mới chỉ nạp được 43 dòng sửa khuôn có sẵn trong
              file của Kỹ thuật; mọi lần mở / chuyển / báo hư trước đây đều nằm trong ô
              ghi chú nên không tách ra được.
            </div>
          ) : (
            <Grid minWidth={680}>
              <GridHead>
                <Th width={92}>Ngày</Th>
                <Th width={130}>Việc</Th>
                <Th num width={80}>
                  kg/m trước
                </Th>
                <Th num width={80}>
                  kg/m sau
                </Th>
                <Th num width={110}>
                  Chi phí
                </Th>
                <Th>Nội dung</Th>
              </GridHead>
              <GridBody>
                {events.map((e) => (
                  <GridRow key={e.id}>
                    <Td>{viDate(e.event_date) || '—'}</Td>
                    <Td>{DIE_EVENT_LABEL[e.event_type]}</Td>
                    <Td num>{e.weight_before == null ? '' : kgPerM(e.weight_before)}</Td>
                    <Td num>{e.weight_after == null ? '' : kgPerM(e.weight_after)}</Td>
                    <Td num>{e.cost == null ? '' : money(e.cost)}</Td>
                    <Td>
                      {e.content ?? ''}
                      {e.source ? ` · nguồn: ${e.source}` : ''}
                    </Td>
                  </GridRow>
                ))}
              </GridBody>
            </Grid>
          )}
        </FastTab>

        <FastTab
          title="Thông số cho sản xuất"
          summary={[
            [
              'Đã khai',
              <span key="a" className="num">
                {
                  [
                    die.section_a_mm,
                    die.wall_thickness_mm,
                    die.bar_length_m,
                    die.pcs_per_bundle,
                    die.rib_count,
                  ].filter((v) => v != null).length
                }
                /5
              </span>,
            ],
          ]}
        >
          <FieldGrid note="Ba số kg/m · chiều dài cây · tiết diện là thứ xưởng cần để đổi “dài cắt” ra “mấy cây nhôm”. Hôm nay 0/994 chi tiết sản xuất trả lời được câu đó — xem §4 của docs/quan-ly-khuon-ke-hoach.md. Ô trống ở đây là việc phải khai, không phải lỗi hiển thị.">
            <Field label="Tiết diện A × B (mm)">
              {die.section_a_mm == null && die.section_b_mm == null
                ? '—'
                : `${die.section_a_mm ?? '?'} × ${die.section_b_mm ?? '?'}`}
            </Field>
            <Field label="Độ dày thành (mm)">{die.wall_thickness_mm ?? '—'}</Field>
            <Field label="Đường kính ngoài (mm)">{die.outer_diameter_mm ?? '—'}</Field>
            <Field label="Số gân">{die.rib_count ?? '—'}</Field>
            <Field label="Chiều dài cây (m)">{die.bar_length_m ?? '—'}</Field>
            <Field label="Số cây / bó">{die.pcs_per_bundle ?? '—'}</Field>
            <Field label="Dung sai trọng lượng (%)">
              {die.weight_tolerance_pct ?? '—'}
            </Field>
            <Field label="Mạch cưa (mm)">{die.saw_kerf_mm ?? '—'}</Field>
            <Field label="Đầu chừa mỗi cây (mm)">{die.end_trim_mm ?? '—'}</Field>
            <Field label="Bề mặt">{die.surface_finish ?? '—'}</Field>
            <Field label="Dấu in trên cây">{die.marking ?? '—'}</Field>
          </FieldGrid>
        </FastTab>

        {(die.note || die.source_note) && (
          <FastTab title="Ghi chú &amp; nguồn dữ liệu">
            <FieldGrid>
              <Field label="Ghi chú tổng hợp">{die.note ?? '—'}</Field>
              <Field label="Nguồn dữ liệu">{die.source_note ?? '—'}</Field>
            </FieldGrid>
          </FastTab>
        )}
      </DocBody>

      <StatusBar
        left={['Danh mục do phòng Kỹ thuật giữ', 'Đợt này chỉ xem']}
        right={die.code}
      />
    </DocScreen>
  )
}
