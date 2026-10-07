import ExcelJS from 'exceljs'
import type { CustomerActivity, CustomerWithOwner } from './sales.repo'

/**
 * Xuất SỔ KHÁCH HÀNG ra .xlsx (07/10/2026) — đúng bộ lọc đang xem, một dòng một
 * khách, đủ liên hệ + điều khoản mặc định + người phụ trách + số báo giá/đơn.
 * Logic thuần: nhận mảng, trả buffer; route lo quyền và tên file.
 */
export async function buildCustomersExcel(
  rows: CustomerWithOwner[],
  activity: Record<string, CustomerActivity>,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'HG Manager'
  const ws = wb.addWorksheet('Khách hàng', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = [
    { header: 'STT', key: 'stt', width: 5 },
    { header: 'Mã KH', key: 'code', width: 12 },
    { header: 'Tên khách hàng', key: 'name', width: 32 },
    { header: 'Quốc gia', key: 'country', width: 14 },
    { header: 'Người liên hệ', key: 'contact', width: 22 },
    { header: 'Chức danh', key: 'title', width: 16 },
    { header: 'Email', key: 'email', width: 26 },
    { header: 'Điện thoại', key: 'phone', width: 16 },
    { header: 'Địa chỉ', key: 'address', width: 40 },
    { header: 'MST', key: 'tax', width: 14 },
    { header: 'Tiền tệ', key: 'cur', width: 8 },
    { header: 'Incoterm', key: 'term', width: 16 },
    { header: 'Thanh toán', key: 'pay', width: 30 },
    { header: 'Cảng đích', key: 'pod', width: 18 },
    { header: 'Phụ trách', key: 'owner', width: 24 },
    { header: 'Báo giá', key: 'quotes', width: 9 },
    { header: 'Đơn', key: 'orders', width: 8 },
    { header: 'Đơn đang mở', key: 'open', width: 12 },
    { header: 'Trạng thái', key: 'status', width: 16 },
    { header: 'Ghi chú', key: 'notes', width: 40 },
  ]
  ws.getRow(1).font = { bold: true }
  rows.forEach((c, i) => {
    const a = activity[c.id] ?? { quotes: 0, orders: 0, openOrders: 0 }
    ws.addRow({
      stt: i + 1,
      code: c.code ?? '',
      name: c.name,
      country: c.country ?? '',
      contact: c.contact_person ?? '',
      title: c.representative_title ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      address: c.address ?? '',
      tax: c.tax_code ?? '',
      cur: c.default_currency ?? '',
      term: c.default_price_term ?? '',
      pay: c.default_payment_terms ?? '',
      pod: c.port_of_discharge ?? '',
      owner: c.owner_name ?? '',
      quotes: a.quotes,
      orders: a.orders,
      open: a.openOrders,
      status: c.is_active ? 'Đang giao dịch' : 'Ngừng giao dịch',
      notes: c.notes ?? '',
    })
  })
  const out = await wb.xlsx.writeBuffer()
  return Buffer.from(out as ArrayBuffer)
}
