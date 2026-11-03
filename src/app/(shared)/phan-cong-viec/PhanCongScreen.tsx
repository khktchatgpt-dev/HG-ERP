'use client'

import './phan-cong.css'
import { useLayoutEffect, useRef, useState } from 'react'
import {
  GIVEN_FILTER_LABEL,
  MINE_FILTER_LABEL,
  type GivenFilter,
  type MineFilter,
} from '@/lib/task-flow'
import type {
  Assignee,
  GivenBoard,
  MineBoard,
} from '@/modules/workflow/tasks/tasks.service'
import { LuoiViec } from './luoi-viec'
import { NganChiTiet } from './ngan-chi-tiet'
import { PhieuGiao } from './phieu-giao'
import { usePhanCong, type PhanCongFocus } from './usePhanCong'

export type { PhanCongFocus }

/**
 * PHÂN CÔNG VIỆC — trang dùng chung, LỐI ERP KHÔNG KIT (docs/erp-khong-kit.md).
 * Bản vẽ 3 https://claude.ai/artifact/FQ2oJJGcWEMr8r798vrZz5 duyệt 03/11/2026 (Q1 nút
 * theo dòng chọn ở Action Pane · Q2 ngăn phải luôn mở · Q3 Bàn làm việc Cung ứng để
 * nguyên · Q4 không cột Phòng).
 *
 * Tầng: đầu trang + Action Pane · dòng báo · tab có số · thanh lọc · lưới | ngăn phải
 * · thanh trạng thái. Khung chốt chiều cao nên chỉ lưới và ngăn phải cuộn. State ở
 * `usePhanCong`; màn này chỉ ghép.
 */
export function PhanCongScreen({
  meId,
  meRole,
  restricted,
  today,
  board,
  mine,
  people,
  focus,
}: {
  meId: string
  /** Vai trò người xem — ngăn chi tiết cần để biết sếp đính tệp được. */
  meRole: string
  /** Người giao bị giới hạn phòng nhận (nhân viên Bán Hàng). */
  restricted: boolean
  today: string
  /** null = người xem không giao được việc. */
  board: GivenBoard | null
  mine: MineBoard
  people: Assignee[]
  /** Chuông mở trang thì có; null = mở thường. */
  focus: PhanCongFocus | null
}) {
  const d = usePhanCong({ board, mine, today, focus })
  const giao = d.tab === 'giao'

  return (
    <PcKhung>
      <div className="pc-ph">
        <h1>Phân công việc</h1>
        <div className="pc-ap" role="toolbar" aria-label="Thao tác">
          <div>
            <button
              type="button"
              className="b p"
              aria-disabled={!d.canGive}
              onClick={d.moGiao}
            >
              + Giao việc
            </button>
          </div>
          <div>
            {d.nut.map((n) => (
              <button
                key={n.a}
                type="button"
                className={n.chinh ? 'b p' : 'b'}
                aria-disabled={n.khoa || d.busy}
                onClick={() => d.bam(n.a, n.label)}
              >
                {n.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {d.bao && (
        <div className={d.bao.ok ? 'pc-why ok' : 'pc-why'} role="status">
          <span>{d.bao.text}</span>
          <button
            type="button"
            className="x"
            aria-label="Tắt thông báo"
            onClick={d.tatBao}
          >
            ✕
          </button>
        </div>
      )}

      <div className="pc-tabs" role="tablist" aria-label="Mục">
        <button
          type="button"
          role="tab"
          aria-selected={d.tab === 'cua-toi'}
          className="pc-tab"
          onClick={() => d.datMuc('cua-toi')}
        >
          Việc của tôi <span className="bd">{d.dem.mine.n}</span>
          {d.dem.mine.tre > 0 && <span className="note">{d.dem.mine.tre} trễ</span>}
        </button>
        {d.dem.giao && (
          <button
            type="button"
            role="tab"
            aria-selected={giao}
            className="pc-tab"
            onClick={() => d.datMuc('giao')}
          >
            Việc tôi giao <span className="bd">{d.dem.giao.n}</span>
            {d.dem.giao.cho > 0 && (
              <span className="note">{d.dem.giao.cho} chờ duyệt</span>
            )}
          </button>
        )}
      </div>

      <div className="pc-fb" role="search">
        <input
          type="search"
          className="in"
          aria-label="Tìm việc"
          placeholder="Tìm việc, người, mã CV…"
          value={d.q}
          onChange={(e) => d.setQ(e.target.value)}
        />
        <label className="sr-only" htmlFor="pc-loc">
          Tình trạng
        </label>
        {giao ? (
          <select
            id="pc-loc"
            className="in on"
            value={d.locGiao}
            onChange={(e) => d.setLocGiao(e.target.value as GivenFilter)}
          >
            {d.GIVEN_FILTERS.map((f) => (
              <option key={f} value={f}>
                Tình trạng: {GIVEN_FILTER_LABEL[f]} ({board?.summary[f] ?? 0})
              </option>
            ))}
          </select>
        ) : (
          <select
            id="pc-loc"
            className="in on"
            value={d.locMine}
            onChange={(e) => d.setLocMine(e.target.value as MineFilter)}
          >
            {d.MINE_FILTERS.map((f) => (
              <option key={f} value={f}>
                Tình trạng: {MINE_FILTER_LABEL[f]} ({mine.summary[f]})
              </option>
            ))}
          </select>
        )}
        {giao && d.phongs.length > 1 && (
          <select
            aria-label="Phòng người nhận"
            className={d.phong ? 'in on' : 'in'}
            value={d.phong}
            onChange={(e) => d.setPhong(e.target.value)}
          >
            <option value="">Phòng: Tất cả</option>
            {d.phongs.map((p) => (
              <option key={p} value={p}>
                Phòng: {p}
              </option>
            ))}
          </select>
        )}
        {(d.q || d.phong) && (
          <button
            type="button"
            className="lnk"
            onClick={() => {
              d.setQ('')
              d.setPhong('')
            }}
          >
            Bỏ lọc
          </button>
        )}
      </div>

      <div className="pc-body">
        <LuoiViec d={d} />
        {d.giaoMo ? (
          <PhieuGiao
            people={people}
            meId={meId}
            today={today}
            restricted={restricted}
            onClose={d.dongGiao}
            onDone={d.sauGiao}
            // Sửa: phiếu điền sẵn việc đang chọn; key theo việc để đổi dòng là phiếu mới.
            key={d.phieu === 'sua' ? `sua-${d.chon?.id}` : 'giao'}
            sua={d.phieu === 'sua' && d.chon && 'can_edit' in d.chon ? d.chon : null}
            onSaved={d.sauSua}
          />
        ) : (
          <NganChiTiet key={d.chon?.id ?? 'rong'} d={d} meId={meId} meRole={meRole} />
        )}
      </div>

      <div className="pc-sb">
        <span>
          <b>{d.rows.length}</b> dòng
        </span>
        {d.chon && !d.giaoMo && (
          <span>
            Đang chọn <b>{d.chon.task_code}</b>
          </span>
        )}
        {d.giaoMo && restricted && (
          <span className="r">Bán Hàng giao được cho Kỹ thuật và Cung ứng</span>
        )}
      </div>
    </PcKhung>
  )
}

/**
 * Gốc màn: huỷ đệm của `<main>` và CHỐT CHIỀU CAO = 100dvh − đỉnh màn, để chỉ lưới
 * và ngăn phải cuộn (cùng cách `KhoKhung` của khu Kho — chép, không import).
 */
function PcKhung({ children }: { children: React.ReactNode }) {
  const goc = useRef<HTMLDivElement>(null)
  const [cao, setCao] = useState('calc(100dvh - 60px)')
  useLayoutEffect(() => {
    const el = goc.current
    if (!el) return
    const doi = () =>
      setCao(`calc(100dvh - ${Math.round(el.getBoundingClientRect().top)}px)`)
    doi()
    window.addEventListener('resize', doi)
    return () => window.removeEventListener('resize', doi)
  }, [])
  return (
    <div ref={goc} className="pc -m-4 sm:-mx-6 sm:-my-6" style={{ height: cao }}>
      {children}
    </div>
  )
}
