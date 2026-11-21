'use client'

import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { chiaTo, qrPath, type TheMoiTo, type TheTreo } from '@/lib/the-treo'

/**
 * THẺ TREO A5 dọc 148 × 210 mm — vẽ ĐÚNG bản vẽ duyệt 19/11/2026 (v2). Mọi kích
 * thước tính theo mm qua biến `--u` (px/mm trên màn, 1mm khi in), nên cùng một
 * thẻ dùng cho ngăn xem trước, tờ A4 2 thẻ (A5) và 4 thẻ (A6 = A5 × 0,707).
 */
export function TheTreoTag({
  t,
  origin,
  anh,
}: {
  t: TheTreo
  origin: string
  anh: boolean
}) {
  const qr = useMemo(() => qrPath(`${origin}/thu-vien/${t.id}`), [origin, t.id])
  const o = (v: number | undefined) => (
    <b className={v ? undefined : 'blank'}>{v ?? ''}</b>
  )
  return (
    <article className="tt" aria-label={`Thẻ ${t.code}`}>
      <div className="tt-band">
        <span className="tt-brand">HOÀNG GIA</span>
        <span className="tt-sr">SHOWROOM SAMPLE</span>
        {t.khu && <span className="tt-loc">ZONE {t.khu}</span>}
      </div>
      <div className="tt-in">
        <div>
          <div className="tt-lab">Item no.</div>
          <div className="tt-code">{t.code}</div>
        </div>
        <div className="tt-name">{t.name}</div>
        {t.en && <div className="tt-en">{t.en}</div>}
        {t.khach && <div className="tt-kh">{t.khach}</div>}
        {anh && (
          <div className="tt-img">
            {t.image_url && (
              <Image
                src={t.image_url}
                alt=""
                fill
                sizes="800px"
                loading="eager"
                style={{ objectFit: 'contain' }}
              />
            )}
          </div>
        )}
        <div className="tt-dim">
          <div className="tt-lab">Dimensions (mm)</div>
          <div className="tt-cells">
            <div>
              {o(t.dims?.l)}
              <span>Length</span>
            </div>
            <div>
              {o(t.dims?.w)}
              <span>Width</span>
            </div>
            <div>
              {o(t.dims?.h)}
              <span>Height</span>
            </div>
          </div>
          {t.inch && <div className="tt-inch">{t.inch}</div>}
        </div>
        {t.rows.length > 0 && (
          <table className="tt-spec">
            <tbody>
              {t.rows.map((r) => (
                <tr key={r.vi}>
                  <th scope="row">{r.en}</th>
                  <td>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {t.pack.length > 0 && (
          <table className="tt-spec tt-pack">
            <tbody>
              {t.pack.map((r) => (
                <tr key={r.vi}>
                  <th scope="row">{r.en}</th>
                  <td>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="tt-foot">
          <svg
            className="tt-qr"
            viewBox={`-2 -2 ${qr.size + 4} ${qr.size + 4}`}
            shapeRendering="crispEdges"
            role="img"
            aria-label={`QR mở hồ sơ ${t.code}`}
          >
            <path d={qr.d} fill="#000" />
          </svg>
          <div className="tt-qrt">
            Scan for product details
            <br />
            <span>Hoang Gia staff · login required</span>
            <b>{t.code}</b>
          </div>
          <div className="tt-origin">{t.origin}</div>
        </div>
      </div>
    </article>
  )
}

/** XEM BẢN IN trên màn — đúng các tờ A4 sẽ ra giấy (cùng `chiaTo`, cùng thẻ), thu nhỏ để xem. */
export function XemBanIn({
  tags,
  moiTo,
  origin,
  anh,
}: {
  tags: TheTreo[]
  moiTo: TheMoiTo
  origin: string
  anh: boolean
}) {
  const to = chiaTo(tags, moiTo)
  return (
    <div className="tt-xem">
      {to.map((x, i) => (
        <figure key={i} className="tt-xem-to">
          <section className={moiTo === 2 ? 'tt-sheet k2' : 'tt-sheet k4'}>
            {x.map((t) => (
              <TheTreoTag key={t.id} t={t} origin={origin} anh={anh} />
            ))}
          </section>
          <figcaption>
            Tờ {i + 1}/{to.length} · {x.map((t) => t.code).join(' · ')}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

/**
 * BẢN IN — chỉ dựng khi người dùng bấm "In". Đặt thẳng dưới `<body>` (portal) để
 * vỏ app (cao 100%, overflow ẩn) không cắt mất trang; trên màn nó nằm ngoài khung
 * nhìn, khi in mọi thứ khác ẩn đi. Chờ ảnh tải xong mới mở hộp in, đóng hộp in
 * thì báo `onXong` (không tự đánh dấu "đã treo" — Q6).
 */
export function BanIn({
  tags,
  moiTo,
  origin,
  anh,
  onXong,
}: {
  tags: TheTreo[]
  moiTo: TheMoiTo
  origin: string
  anh: boolean
  onXong: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const xong = useRef(onXong)
  useEffect(() => {
    xong.current = onXong
  }, [onXong])

  useEffect(() => {
    let huy = false
    let daBao = false
    const bao = () => {
      if (daBao) return
      daBao = true
      xong.current()
    }
    const imgs = [...(ref.current?.querySelectorAll('img') ?? [])]
    const cho = Promise.all(
      imgs.map((img) =>
        img.complete
          ? null
          : new Promise((res) => {
              img.addEventListener('load', res, { once: true })
              img.addEventListener('error', res, { once: true })
            }),
      ),
    )
    // Ảnh hỏng / mạng chậm không được treo cả lượt in: tối đa 20 giây.
    void Promise.race([cho, new Promise((r) => setTimeout(r, 20_000))]).then(() => {
      if (huy) return
      window.addEventListener('afterprint', bao, { once: true })
      window.print()
    })
    return () => {
      huy = true
      window.removeEventListener('afterprint', bao)
    }
  }, [])

  return createPortal(
    <div className="tt-print" ref={ref}>
      <style>{`@page { size: A4 ${moiTo === 2 ? 'landscape' : 'portrait'}; margin: 0; }`}</style>
      {chiaTo(tags, moiTo).map((to, i) => (
        <section key={i} className={moiTo === 2 ? 'tt-sheet k2' : 'tt-sheet k4'}>
          {to.map((t) => (
            <TheTreoTag key={t.id} t={t} origin={origin} anh={anh} />
          ))}
        </section>
      ))}
    </div>,
    document.body,
  )
}
