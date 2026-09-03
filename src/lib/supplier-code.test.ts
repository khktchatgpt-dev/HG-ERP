import { describe, expect, it } from 'vitest'
import { nextSupplierCode, supplierCodeFrom } from './supplier-code'

describe('supplierCodeFrom — theo đúng nếp 37 mã người dùng đã tự đặt', () => {
  it('bỏ phần pháp lý / ngành nghề, lấy chữ đầu của tên riêng', () => {
    expect(supplierCodeFrom('CÔNG TY TNHH TM VÀ DỊCH VỤ ÂN HOÀN PHÁT')).toBe('AHP')
    expect(supplierCodeFrom('CÔNG TY TNHH SX TM TH AN THÀNH PHÁT')).toBe('ATP')
    expect(supplierCodeFrom('CÔNG TY TNHH XUẤT NHẬP KHẨU CÁT TƯỜNG')).toBe('CT')
    expect(supplierCodeFrom('Công ty TNHH thương mại sản xuất Hào Tư Hùng')).toBe('HTH')
    expect(supplierCodeFrom('Công ty Gia Anh')).toBe('GA')
  })

  it('một từ → ba chữ đầu', () => {
    expect(supplierCodeFrom('ALANMI')).toBe('ALA')
    expect(supplierCodeFrom('Mien Hua')).toBe('MH')
  })

  it('tên dài thì cắt còn 4 chữ, không đẻ mã lê thê', () => {
    expect(supplierCodeFrom('CÔNG TY TNHH ĐỨC TOÀN PHÚ TÀI')).toBe('DTPT')
    expect(supplierCodeFrom('Anh Bảo Cường Dũng Em Phát')).toBe('ABCD')
  })

  it('bỏ dấu và ký tự lạ; toàn từ pháp lý thì vẫn ra mã chứ không bỏ trống', () => {
    expect(supplierCodeFrom('Cơ khí & Xây dựng Đại Việt')).toBe('CKXD')
    // Tên chỉ có phần pháp lý là ca hỏng của dữ liệu, nhưng vẫn phải ra MỘT mã
    // nào đó — thà mã xấu còn hơn ô trống, vì trống là thứ đang phải đi sửa.
    expect(supplierCodeFrom('Công ty TNHH')).not.toBe('')
    expect(supplierCodeFrom('   ')).toBe('')
  })
})

describe('nextSupplierCode — không cấp trùng', () => {
  it('mã trống thì lấy bản gốc', () => {
    expect(nextSupplierCode('ALANMI', [])).toBe('ALA')
  })

  it('trùng thì nối số, so không phân biệt hoa thường', () => {
    expect(nextSupplierCode('ALANMI', ['ALA'])).toBe('ALA2')
    expect(nextSupplierCode('ALANMI', ['ala', 'ALA2'])).toBe('ALA3')
  })

  it('tên rỗng → không cấp mã (để trống còn hơn cấp mã vô nghĩa)', () => {
    expect(nextSupplierCode('', ['ALA'])).toBe('')
  })
})
