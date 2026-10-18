'use client'

/**
 * BẢNG CÔNG — màn A của bản vẽ "chấm công theo khung giờ" (duyệt 5 câu 17/10/2026).
 * Câu hỏi của màn: "kỳ này mỗi người làm bao nhiêu giờ, ngày nào cần bổ sung?".
 *
 * Đúng quy trình Nhân sự kể: lấy công từ máy → xem công từng người (bấm tên) → tổng hợp
 * theo tổ / văn phòng (chọn nhóm) → kiểm, bổ sung (bấm ô: bổ sung giờ, tick làm trưa,
 * nghỉ có lý do). Tổng hợp & chốt kỳ cho Kế toán là màn B (bước sau).
 *
 * Luật tính: `lib/cham-cong/gio-khung.ts` — khớp 241/241 ngày file "Thống kê giờ theo
 * khung T9 – Tổ sơn sắt" của Nhân sự.
 */

import {
  Btn,
  NoticeBar,
  Pick,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  Tag,
} from '@/components/kit'
import { cn } from '@/lib/utils'
import { DieuChinhSheet } from '../dieu-chinh-sheet'
import { LuoiGio } from './luoi-gio'
import { NganNguoi, NganTrua } from './ngan-gio'
import { OGio } from './o-gio'
import { useGioCong, type GioCongCtx } from './useGioCong'
import { dm, so, type GioCong } from './gio-cong.shared'

const doiThang = (t: string, b: number) => {
  const [y, m] = t.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + b, 1)).toISOString().slice(0, 7)
}

export function GioCongScreen({ b, bpDau }: { b: GioCong; bpDau?: string }) {
  const d = useGioCong(b, bpDau)
  const thieu = b.nguoi.reduce((s, n) => s + n.tong.thieu, 0)
  const truaCho = d.dong.reduce((s, n) => s + n.tong.truaCho, 0)
  const ngayCo = new Set(
    b.nguoi.flatMap((n) => n.ngay.filter((x) => x.luot.length).map((x) => x.ngay)),
  )
  const cuoiCo = [...ngayCo].sort().at(-1)

  return (
    <ScreenFrame tableMin={0}>
      <ScreenHeader
        compact
        eyebrow="Chấm công"
        title={
          <span className="flex items-center gap-1.5">
            Bảng công
            <Btn
              icon="truoc"
              aria-label="Kỳ trước"
              onClick={() => d.xemThang(doiThang(b.thang, -1))}
            >
              {''}
            </Btn>
            <span className="num text-k-body font-semibold">
              Kỳ {dm(b.tu)} → {dm(b.den)}/{b.den.slice(0, 4)}
            </span>
            <Btn
              icon="sau"
              aria-label="Kỳ sau"
              onClick={() => d.xemThang(doiThang(b.thang, 1))}
            >
              {''}
            </Btn>
          </span>
        }
        status={
          ngayCo.size ? <Tag tone="warn">Đang thống kê</Tag> : <Tag>Chưa có dữ liệu</Tag>
        }
        facts={[
          { label: 'Dữ liệu tới', value: cuoiCo ? dm(cuoiCo) : '—' },
          { label: 'Người', value: so(b.nguoi.length) },
          {
            label: 'Ngày thiếu lượt',
            value: so(thieu),
            tone: thieu ? 'stop' : undefined,
          },
        ]}
        actions={
          <Btn
            icon="lamMoi"
            href={`/hr/cham-cong/lay-du-lieu?thang=${b.den.slice(0, 7)}`}
          >
            Lấy dữ liệu từ máy
          </Btn>
        }
      />
      <ThanhNhom d={d} />
      {b.ky && b.ky.trangThai !== 'open' && (
        <NoticeBar
          tone="neutral"
          tag={b.ky.trangThai === 'closed' ? 'Đã chốt' : 'Chờ mở lại'}
          action={{
            label: 'Mở Kỳ công',
            onClick: () => (window.location.href = `/hr/cham-cong/ky?thang=${b.thang}`),
          }}
        >
          Giờ kỳ này lấy từ bản chốt lần {b.ky.lanChot}; bổ sung giờ, tick làm trưa cho
          ngày trong kỳ đều bị khoá.
        </NoticeBar>
      )}
      {truaCho > 0 && d.b.quyen.trua && (
        <NoticeBar
          tone="neutral"
          tag="Làm trưa"
          action={{ label: 'Tick theo ngày…', onClick: () => d.setMoTrua(true) }}
        >
          {so(truaCho)} ngày có mặt xuyên trưa (đã trừ 1 giờ nghỉ trưa) chưa tick làm trưa
          — ô có chữ “t”.
        </NoticeBar>
      )}
      {!ngayCo.size && (
        <NoticeBar
          tone="warn"
          tag="Chưa có dữ liệu"
          action={{
            label: 'Lấy dữ liệu từ máy',
            onClick: () => (window.location.href = `/hr/cham-cong/lay-du-lieu`),
          }}
        >
          Kỳ {dm(b.tu)} → {dm(b.den)} chưa có lượt quẹt nào trong ERP.
        </NoticeBar>
      )}
      <LuoiGio d={d} />
      <OGio d={d} />
      <NganNguoi d={d} />
      <NganTrua key={String(d.moTrua)} d={d} />
      <DieuChinhSheet
        mo={d.moDc}
        dcs={b.dieuChinh}
        quyen={b.quyen}
        onClose={() => d.setMoDc(null)}
        onDoi={d.lamMoi}
      />
    </ScreenFrame>
  )
}

function ThanhNhom({ d }: { d: GioCongCtx }) {
  const { b, nhom } = d
  const sx = b.boPhan.filter((x) => x.cachTinh === 'khung')
  const thieuCua = (ten: string) =>
    b.nguoi.filter((n) => n.boPhan === ten).reduce((s, n) => s + n.tong.thieu, 0)
  const dang = nhom.kieu === 'bp' ? b.boPhan.find((x) => x.ten === nhom.ten) : undefined
  const chip = (on: boolean) =>
    cn(
      'text-k-sm border px-2 py-0.5 whitespace-nowrap',
      on
        ? 'border-[var(--act-line)] bg-[var(--act-wash)] font-semibold text-[var(--act-text)]'
        : 'border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--surface-hover)]',
    )
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1.5">
      <Pick
        label="Bộ phận"
        width={300}
        value={nhom.kieu === 'bp' ? nhom.ten : ''}
        onChange={(v) => v && d.chonNhom({ kieu: 'bp', ten: v })}
        options={[
          ...(nhom.kieu !== 'bp' ? [{ value: '', label: 'Chọn tổ / bộ phận…' }] : []),
          ...sx.map((x) => {
            const t = thieuCua(x.ten)
            return {
              value: x.ten,
              label: `${x.ten} · ${x.so} người${t ? ` · ${t} thiếu lượt` : ''}`,
            }
          }),
        ]}
      />
      <button
        type="button"
        className={chip(nhom.kieu === 'vp')}
        onClick={() => d.chonNhom({ kieu: 'vp' })}
      >
        Khối văn phòng{' '}
        <span className="num text-[var(--ink-3)]">
          {b.nguoi.filter((n) => d.vp.has(n.boPhan ?? '')).length}
        </span>
      </button>
      <button
        type="button"
        className={chip(nhom.kieu === 'all')}
        onClick={() => d.chonNhom({ kieu: 'all' })}
      >
        Cả công ty <span className="num text-[var(--ink-3)]">{b.nguoi.length}</span>
      </button>
      {dang && b.quyen.cachTinh && dang.ten !== '(chưa có bộ phận)' && (
        <Pick
          label="Cách tính của bộ phận"
          width={190}
          value={dang.cachTinh}
          disabled={d.dangGhi}
          onChange={(v) => d.doiCachTinh(dang.ten, v as 'khung' | 'ngay')}
          options={[
            { value: 'khung', label: 'Công = giờ có mặt ÷ 8' },
            { value: 'ngay', label: 'Có quẹt = 1 công' },
          ]}
        />
      )}
      <SearchInput
        value={d.tim}
        onChange={d.setTim}
        placeholder="Tìm mã, tên"
        width={170}
        label="Tìm mã hoặc tên"
      />
      <span className="text-k-label ml-auto flex flex-wrap items-center gap-2.5 text-[var(--ink-3)]">
        <span>
          <i className="mr-1 inline-block w-5 bg-[color-mix(in_srgb,var(--done)_8%,white)] text-center font-mono not-italic">
            1
          </i>
          công (8 giờ)
        </span>
        <span>
          <i className="mr-1 inline-block bg-[color-mix(in_srgb,var(--done)_26%,white)] px-0.5 text-center font-mono not-italic">
            1,63
          </i>
          làm 13 giờ
        </span>
        <span>
          <i className="mr-1 inline-block w-5 bg-[var(--stop-wash)] text-center font-mono text-[var(--stop)] not-italic">
            ?
          </i>
          1 lượt
        </span>
        <span>
          <i className="mr-1 inline-block w-5 bg-[var(--warn-wash)] text-center font-mono text-[var(--warn)] not-italic">
            P
          </i>
          nghỉ
        </span>
        <span>
          <b className="text-[var(--warn)]">t</b> trưa chưa tick ·{' '}
          <b className="text-[var(--act-text)]">đ</b> qua đêm ·{' '}
          <b className="text-[var(--act-text)]">s</b> đã điều chỉnh
        </span>
      </span>
    </div>
  )
}
