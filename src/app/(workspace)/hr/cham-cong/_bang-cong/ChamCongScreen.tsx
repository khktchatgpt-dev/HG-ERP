'use client'

/**
 * CHẤM CÔNG — bảng công tháng, lấy thẳng từ 2 máy ZKTeco.
 *
 * Khuôn C (danh sách) với lưới ngày kiểu bảng công Excel; bản vẽ được duyệt
 * 12/10/2026 (artifact "Bảng công tháng 9"). Câu hỏi của màn: "tháng này ai được
 * bao nhiêu công, ngày nào còn phải xử lý?".
 *
 * Dữ liệu CHỈ vào ERP khi Nhân sự bấm "Lấy về từ máy" với một khoảng ngày (chủ dự
 * án 12/10: không nạp sẵn cả lịch sử). Ngày chưa lấy về tô gạch trên lưới.
 */

import {
  Btn,
  Metric,
  MetricStrip,
  NoticeBar,
  Pick,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  Tag,
  Tick,
} from '@/components/kit'
import { cn } from '@/lib/utils'
import { BangPhu } from './bang-phu'
import { LuoiCong } from './luoi-cong'
import { SoiNgay } from './soi-ngay'
import { useChamCong, type ChamCongCtx, type Muc } from './useChamCong'
import { canXuLy, doiThang, luc, ngayCuoiThang, so, thangVn, type BangCong } from '../cham-cong.shared'

export function ChamCongScreen({ b }: { b: BangCong }) {
  const d = useChamCong(b)
  return (
    <ScreenFrame tableMin={1700}>
      <ScreenHeader
        compact
        eyebrow="Nhân sự"
        title="Bảng công"
        status={
          <span className="text-k-body flex items-center gap-1 font-normal">
            <Btn
              icon="truoc"
              aria-label="Tháng trước"
              onClick={() => d.xemThang(doiThang(b.thang, -1))}
            >
              {''}
            </Btn>
            <b className="num px-1">{thangVn(b.thang)}</b>
            <Btn
              icon="sau"
              aria-label="Tháng sau"
              onClick={() => d.xemThang(doiThang(b.thang, 1))}
            >
              {''}
            </Btn>
          </span>
        }
        actions={
          <Btn
            icon="lamMoi"
            href={`/hr/cham-cong/du-lieu?tu=${b.thang}-01&den=${ngayCuoiThang(b.thang)}`}
          >
            Lấy dữ liệu tháng này
          </Btn>
        }
      >
        <May d={d} />
        <Tabs d={d} />
      </ScreenHeader>

      {b.luotChuaGhep > 0 && (
        <NoticeBar tone="warn" tag="Chưa ghép người">
          {so(b.luotChuaGhep)} lượt trong tháng thuộc mã chưa ghép nhân viên nên không có
          trong bảng công.
        </NoticeBar>
      )}

      <MetricStrip>
        <Metric
          label="Công ngày thường"
          value={so(d.tong.cong, 1)}
          basis={`trên ${so(d.tong.ngayNguoi)} ngày-người có quẹt`}
        />
        <Metric
          label="Giờ tăng ca"
          value={so(d.tong.tangCa / 60, 1)}
          basis="ngày thường, đã làm tròn xuống"
        />
        <Metric
          label="Giờ chủ nhật"
          value={so(d.tong.chuNhat / 60, 1)}
          basis="trong ca + tăng ca, cột riêng"
        />
        <Metric
          label="Giờ ngày lễ"
          value={so(d.tong.le / 60, 1)}
          basis="trong ca + tăng ca, cột riêng"
        />
        <Metric
          label="Lượt đi trễ"
          value={so(d.tong.tre)}
          basis="quá ân hạn, chỉ đếm, không trừ công"
          tone={d.tong.tre ? 'warn' : undefined}
        />
        <Metric
          label="Ngày cần xử lý"
          value={so(d.tong.thieu + d.tong.ngoai)}
          basis={`${so(d.tong.thieu)} thiếu lượt · ${so(d.tong.ngoai)} ngoài ca`}
          tone={d.tong.thieu + d.tong.ngoai ? 'stop' : undefined}
        />
      </MetricStrip>

      {d.muc === 'bang' ? (
        <>
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1.5">
            <SearchInput
              value={d.tim}
              onChange={d.setTim}
              placeholder="Tìm mã hoặc tên"
              width={220}
              label="Tìm mã hoặc tên"
            />
            <Pick
              label="Ca"
              value={d.ca}
              onChange={d.setCa}
              options={[
                { value: '', label: 'Mọi ca' },
                ...b.cas.map((c) => ({
                  value: c.code,
                  label: `${c.name} (${c.soNguoi})`,
                })),
              ]}
            />
            <label className="text-k-sm flex items-center gap-2 text-[var(--ink-2)]">
              <Tick
                label="Chỉ người có ngày cần xử lý"
                checked={d.chiCanXuLy}
                onChange={d.setChiCanXuLy}
              />
              Chỉ người có ngày cần xử lý ({b.nguoi.filter((n) => canXuLy(n) > 0).length})
            </label>
            <ChuGiai />
          </div>
          <LuoiCong d={d} />
          {b.nguoi.length > 0 && <SoiNgay d={d} />}
        </>
      ) : (
        <BangPhu d={d} />
      )}
    </ScreenFrame>
  )
}

function May({ d }: { d: ChamCongCtx }) {
  return (
    <div className="text-k-sm flex flex-wrap items-center gap-x-5 gap-y-1 pb-1 text-[var(--ink-2)]">
      {d.b.may.map((m) => {
        const pct =
          m.luot != null && m.sucChua ? Math.round((m.luot / m.sucChua) * 100) : null
        return (
          <span key={m.ip} className="flex items-center gap-1.5">
            <b className="text-[var(--ink)]">{m.ten}</b>
            <span>lấy lúc {luc(m.keoLuc)}</span>
            {pct != null && (
              <span
                className={cn('num', pct >= 85 && 'font-semibold text-[var(--warn)]')}
              >
                · {so(m.luot!)} / {so(m.sucChua!)} lượt ({pct}%
                {pct >= 85 ? ', sắp đầy' : ''})
              </span>
            )}
            {m.loi && <Tag tone="stop">lần trước lỗi</Tag>}
          </span>
        )
      })}
      {d.b.ngayCoDuLieu.length > 0 && (
        <span>
          Tháng này đã lấy {d.b.ngayCoDuLieu.length}/{d.b.soNgay} ngày
        </span>
      )}
    </div>
  )
}

const MUC: {
  id: Muc
  label: string
  dem: (b: BangCong) => number | null
  tone?: 'stop'
}[] = [
  { id: 'bang', label: 'Bảng công', dem: (b) => b.nguoi.length },
  {
    id: 'thieu',
    label: 'Thiếu lượt',
    dem: (b) => b.nguoi.reduce((s, n) => s + n.tong.thieu, 0),
    tone: 'stop',
  },
  {
    id: 'ngoai',
    label: 'Ngoài ca',
    dem: (b) => b.nguoi.reduce((s, n) => s + n.tong.ngoai, 0),
  },
  { id: 'ma', label: 'Mã cần xem lại', dem: (b) => b.canXem.length },
  { id: 'ca', label: 'Ca & ngày lễ', dem: () => null },
]

function Tabs({ d }: { d: ChamCongCtx }) {
  return (
    <div
      role="tablist"
      aria-label="Nội dung chấm công"
      className="-mb-px flex gap-0.5 overflow-x-auto"
    >
      {MUC.map((m) => {
        const n = m.dem(d.b)
        const on = d.muc === m.id
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => d.setMuc(m.id)}
            className={cn(
              'text-k-body border-b-2 px-3 py-1.5 whitespace-nowrap',
              on
                ? 'border-[var(--act)] font-semibold text-[var(--act-text)]'
                : 'border-transparent text-[var(--ink-2)] hover:text-[var(--ink)]',
            )}
          >
            {m.label}
            {n != null && n > 0 && (
              <span
                className={cn(
                  'num text-k-label ml-1.5',
                  m.tone === 'stop' ? 'text-[var(--stop)]' : 'text-[var(--ink-3)]',
                )}
              >
                {so(n)}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function ChuGiai() {
  const o = 'num inline-block w-[22px] border border-[var(--line)] text-center'
  return (
    <span className="text-k-label ml-auto flex flex-wrap items-center gap-3 text-[var(--ink-3)]">
      <span>
        <i className={o}>8</i> giờ trong ca
      </span>
      <span>
        <i className={cn(o, 'text-[var(--act-text)]')}>+3</i> tăng ca
      </span>
      <span>
        <i className={cn(o, 'bg-[var(--stop-wash)] text-[var(--stop)]')}>?</i> thiếu lượt
      </span>
      <span>
        <i className={cn(o, 'bg-[var(--warn-wash)] text-[var(--warn)]')}>!</i> ngoài ca
      </span>
      <span>
        <i
          className={cn(
            o,
            'bg-[repeating-linear-gradient(135deg,var(--surface-raised)_0_4px,transparent_4px_8px)]',
          )}
        >
          &nbsp;
        </i>{' '}
        chưa lấy về
      </span>
      <span>◥ đi trễ</span>
    </span>
  )
}
