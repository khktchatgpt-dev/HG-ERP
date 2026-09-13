import { NextResponse } from 'next/server'

/**
 * Trả một file .xlsx cho trình duyệt tải về. Dùng chung cho mọi route xuất
 * Excel — trước đây mỗi route tự dựng header, và cái bẫy tên file có dấu bị
 * chép đi chép lại.
 */
export function xlsxResponse(buf: Buffer, filename: string): NextResponse {
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // Hai lần khai tên: `filename` ascii cho trình duyệt cũ, `filename*` mới
      // giữ được dấu tiếng Việt — xem lib/storage cho cùng câu chuyện.
      'content-disposition': `attachment; filename="${filename.replace(/[^ -~]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'no-store',
    },
  })
}
