'use client'

import Link from 'next/link'
import { useRouterBao } from '@/lib/tai-trang'
import { useTransition } from 'react'
import { ApNhom, ApNut, DauTrang, SxKhung } from '@/app/(workspace)/production/_erp/khung'
import type { LenhOption, LenhTinhTrang } from '@/lib/ma-chua-ghi'
import { fmt } from './ghi.shared'
import {
  BangMaChuaGhi,
  ChonLenh,
  khaiHref,
  napHref,
  nhacKyThuatHref,
} from './ma-chua-ghi'

/**
 * Ghi sản lượng — LỆNH CHƯA GHI ĐƯỢC (bản vẽ 15/11/2026 MRFoxWgh…, Q2 + Q4).
 * Lệnh đang chạy nhưng chưa có bảng chi tiết nào: thay lưới bằng câu lý do + bảng
 * mã hàng + lối gỡ, nút Ghi sổ khoá kèm vì sao. Ô chọn lệnh vẫn đổi được lệnh.
 */
export function ChuaGhiScreen({
  lenh,
  options,
  canKhai = false,
}: {
  lenh: LenhTinhTrang
  options: LenhOption[]
  /** Người xem sửa được bảng chi tiết (7 tài khoản thống kê có) → lối "Tự khai" (Q1). */
  canKhai?: boolean
}) {
  const router = useRouterBao()
  const [dangTai, startTai] = useTransition()
  const chuaDm = lenh.n_chua_dm
  const chuaNap = lenh.n_chua_nap
  // Nút chính = lối gỡ được NHIỀU mã nhất (02 ROSCO: 5 chỉ cần nạp, 1 chờ định mức →
  // Nạp); mã chưa có định mức thì người sửa được bảng TỰ KHAI, người khác nhắc Kỹ thuật.
  const chinh: 'nap' | 'khai' | 'nhac' =
    chuaNap > 0 && chuaNap >= chuaDm ? 'nap' : canKhai ? 'khai' : 'nhac'
  const tieuDe =
    lenh.ma.length === 0
      ? `Lệnh ${lenh.lsx_code} chưa có dòng sản phẩm nào`
      : chuaDm === 0
        ? `Lệnh ${lenh.lsx_code} chưa ghi được: ${fmt(chuaNap)}/${fmt(lenh.ma.length)} mã hàng có định mức nhưng chưa nạp vào lệnh`
        : `Lệnh ${lenh.lsx_code} chưa ghi được: ${fmt(chuaDm)}/${fmt(lenh.ma.length)} mã hàng chưa có định mức${chuaNap ? `, ${fmt(chuaNap)} mã có định mức nhưng chưa nạp vào lệnh` : ''}`

  return (
    <SxKhung bare label="Ghi sản lượng">
      <div className="sx-body">
        <DauTrang
          crumb="Ghi sổ"
          title="Ghi sản lượng"
          ctx={
            <>
              <b className="ma">{lenh.lsx_code}</b> · chưa có bảng chi tiết
              {dangTai && <span className="mut"> · đang mở lệnh…</span>}
            </>
          }
          actions={
            <ApNhom>
              <ApNut href="/thongke/da-ghi">Sổ theo ngày</ApNut>
              <ApNut href={`/thongke/lsx/${lenh.lsx_id}`}>Hồ sơ lệnh</ApNut>
            </ApNhom>
          }
        />
        <div className="sx-hc">
          <label className="c">
            Lệnh
            <ChonLenh
              options={options}
              value={lenh.lsx_id}
              onChange={(id) => startTai(() => router.push(`/thongke/ghi?lsx=${id}`))}
            />
          </label>
        </div>

        <div className="sx-cgd">
          <h2>{tieuDe}</h2>
          <p>
            {canKhai && chuaDm > 0
              ? 'Khai phần khung ở Bảng chi tiết là ghi sổ được ngay — định mức đầy đủ vẫn là việc của Kỹ thuật.'
              : 'Ghi sản lượng dựng dòng ghi từ bảng chi tiết của lệnh — lệnh này chưa có dòng nào.'}{' '}
            {fmt(lenh.sl_chua)} cái đang chờ.
          </p>
          <span className="tiep">
            {chinh === 'nap' && (
              <Link href={napHref(lenh.lsx_id)} className="sx-btn p">
                Nạp ở Bảng chi tiết
              </Link>
            )}
            {chuaDm > 0 && canKhai && (
              <Link
                href={khaiHref(lenh.lsx_id)}
                className={chinh === 'khai' ? 'sx-btn p' : 'sx-btn'}
              >
                Tự khai bảng chi tiết
              </Link>
            )}
            {chuaDm > 0 && (
              <Link
                href={nhacKyThuatHref}
                className={chinh === 'nhac' ? 'sx-btn p' : 'sx-btn'}
              >
                Nhắc Kỹ thuật
              </Link>
            )}
            {chuaNap > 0 && chinh !== 'nap' && (
              <Link href={napHref(lenh.lsx_id)} className="sx-btn">
                Nạp ở Bảng chi tiết
              </Link>
            )}
            <Link href={`/thongke/lsx/${lenh.lsx_id}`} className="sx-btn">
              Hồ sơ lệnh
            </Link>
          </span>
        </div>
        {lenh.chua.length > 0 && (
          <BangMaChuaGhi lsxId={lenh.lsx_id} ma={lenh.chua} full canKhai={canKhai} />
        )}

        <div className="sx-cb" role="region" aria-label="Ghi sổ">
          <span className="sum">Chưa có dòng nào để ghi</span>
          <span className="sp">
            <span
              className="sx-btn p"
              aria-disabled="true"
              title="Lệnh chưa có bảng chi tiết — xem bảng mã hàng phía trên"
            >
              Ghi sổ chính thức
            </span>
          </span>
        </div>
      </div>
    </SxKhung>
  )
}
