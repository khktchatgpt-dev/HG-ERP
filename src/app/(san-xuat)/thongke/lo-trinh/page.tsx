import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import {
  componentsService,
  isUnshaped,
  needsRoute,
} from '@/modules/dept/production/components.service'
import { canEditComponents } from '@/modules/dept/production/perms'
import { DauTrang, Rong, SxKhung, ThanhTT } from '@/app/(workspace)/production/_erp/khung'

export const metadata = { title: 'Sản xuất · Lộ trình công đoạn' }
export const dynamic = 'force-dynamic'

/**
 * LỘ TRÌNH CÔNG ĐOẠN — cửa vào bước 2 của lệnh từ menu (04/11/2026). Khuôn C,
 * một câu hỏi của Kế hoạch: lệnh nào đang chạy còn CỤM CHƯA KHAI lộ trình (đang
 * chạy theo mặc định nhóm vật tư)? Bảng chi tiết là định mức của Kỹ thuật, tự
 * nạp lúc duyệt lệnh — ở đây chỉ bày để biết lệnh nào còn chờ Kỹ thuật. Bấm
 * một lần là vào thẳng tab Lộ trình của lệnh. Badge sidebar đếm bằng CHÍNH
 * `shapingOverview` + `needsRoute` của trang này.
 */
export default async function LoTrinhDanhSachPage() {
  const user = await authService.requirePageUser()
  const [rows, canEdit] = await Promise.all([
    componentsService.shapingOverview(),
    canEditComponents(user),
  ])
  const can = rows.filter(needsRoute)
  const choKT = rows.filter((r) => !needsRoute(r) && isUnshaped(r))
  const xong = rows.filter((r) => !needsRoute(r) && !isUnshaped(r))
  const chuaNap = choKT.filter((r) => r.lines_missing_bom === 0).length
  const dmy = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('vi-VN') : '—'

  return (
    <SxKhung bare label="Lộ trình công đoạn">
      <div className="sx-body">
        <DauTrang
          crumb="Sản xuất › 2 · Kế hoạch chuẩn bị"
          title="Lộ trình công đoạn"
          ctx={
            <>
              <b>{rows.length}</b> lệnh đang chạy · <b>{can.length}</b> còn cụm chưa khai
              · <b>{choKT.length - chuaNap}</b> chờ Kỹ thuật nạp định mức
              {chuaNap > 0 && (
                <>
                  {' '}
                  · <b>{chuaNap}</b> có định mức mà chưa nạp bảng
                </>
              )}{' '}
              · {canEdit ? 'bạn khai được' : 'bạn chỉ xem'}
            </>
          }
        />
        <div className="sx-note">
          <b>Việc của Kế hoạch ở bước 2:</b> mỗi cụm của mỗi SP trong lệnh đi qua công
          đoạn nào — đánh x rồi Lưu, hồ sơ SP tự nhận để lệnh sau có sẵn. Bảng chi tiết
          (cụm, chi tiết, số lượng) là định mức của Kỹ thuật, đã tự nạp lúc duyệt lệnh;
          lệnh nào trống là Kỹ thuật chưa nạp định mức cho SP đó.
        </div>
        {rows.length === 0 ? (
          <Rong
            tieuDe="Không có lệnh nào đang chạy"
            lyDo="Chỉ lệnh đã duyệt hoặc đang chạy mới cần khai lộ trình."
            tiep={
              <Link href="/thongke/lenh" className="sx-btn p">
                Xem Lệnh sản xuất
              </Link>
            }
          />
        ) : (
          <div className="sx-grid">
            <table className="sx-tb" style={{ minWidth: 860 }}>
              <colgroup>
                <col style={{ width: 150 }} />
                <col />
                <col style={{ width: 90 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 160 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 130 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Lệnh</th>
                  <th>Khách</th>
                  <th className="r">Hạn xuất</th>
                  <th className="r">Dòng SP</th>
                  <th>Lộ trình cụm</th>
                  <th>Bảng chi tiết (Kỹ thuật)</th>
                  <th>Tổ & hạn</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...can, ...choKT, ...xong].map((r) => {
                  const can1 = needsRoute(r)
                  const trong = isUnshaped(r)
                  return (
                    <tr key={r.lsx.id}>
                      <td>
                        <Link href={`/thongke/lsx/${r.lsx.id}`} className="lnk ma">
                          {r.lsx.code}
                        </Link>
                      </td>
                      <td title={r.lsx.customer_name}>{r.lsx.customer_name}</td>
                      <td className="r num">{dmy(r.lsx.ship_date)}</td>
                      <td className="r num">{r.line_count}</td>
                      <td>
                        {trong ? (
                          <span className="mut">—</span>
                        ) : r.cluster_count === 0 ? (
                          <span className="mut">BOM phẳng · cụm mặc nhiên</span>
                        ) : can1 ? (
                          <span className="pill w">
                            {r.cluster_unrouted}/{r.cluster_count} cụm chưa khai
                          </span>
                        ) : (
                          <span className="pill d">{r.cluster_count} cụm đã khai</span>
                        )}
                      </td>
                      <td>
                        {trong && r.lines_missing_bom > 0 ? (
                          <span className="pill w">
                            chờ Kỹ thuật ({r.lines_missing_bom} SP)
                          </span>
                        ) : trong ? (
                          <span
                            className="pill m"
                            title="SP đã có định mức — mở lệnh, bấm Nạp từ BOM kỹ thuật"
                          >
                            chưa nạp bảng
                          </span>
                        ) : r.lines_missing_bom > 0 ? (
                          <span>
                            {r.component_count} dòng ·{' '}
                            <span className="warn">
                              {r.lines_missing_bom} SP chờ Kỹ thuật
                            </span>
                          </span>
                        ) : (
                          <span className="mut">{r.component_count} dòng</span>
                        )}
                      </td>
                      <td>
                        <span className="mut">
                          {r.jobs_total > 0 ? `${r.jobs_total} việc` : 'chưa giao tổ'}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/thongke/lsx/${r.lsx.id}/dinh-hinh`}
                          className={can1 && canEdit ? 'sx-btn' : 'lnk'}
                        >
                          {trong
                            ? 'Xem'
                            : can1
                              ? canEdit
                                ? 'Khai lộ trình'
                                : 'Xem'
                              : 'Sửa'}
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>
                    {can.length} còn cụm chưa khai · {choKT.length - chuaNap} chờ Kỹ thuật · {chuaNap} chưa nạp bảng ·{' '}
                    {xong.length} xong
                  </td>
                  <td colSpan={4} className="mut" style={{ fontWeight: 400 }}>
                    Cụm chưa khai = chạy theo mặc định nhóm vật tư, vẫn ghi sổ được · xếp:
                    chưa khai → chờ Kỹ thuật → xong, trong mỗi nhóm theo ưu tiên và hạn
                    xuất
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <ThanhTT
          left="Chỉ lệnh đã duyệt / đang chạy"
          right="production_components.stages · bước 3 là Giao tổ & hạn ở Kế hoạch SX"
        />
      </div>
    </SxKhung>
  )
}
