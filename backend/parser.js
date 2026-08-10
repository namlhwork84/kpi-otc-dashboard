const XLSX = require('xlsx');

// Chuẩn hóa tên cột chi_so
function normChiSo(s) {
  if (!s) return s;
  return s.trim()
    .replace('Gía trị', 'Giá trị')
    .replace('Số lượng khách hàng mua TB/THÁNG', 'Số lượng độ phủ TB/THÁNG');
}

// Parse bất kỳ file chỉ tiêu nào — trả về tất cả 12 tháng
function parseChiTieuFile(buffer, nam, thang, nguon) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  const sheetName =
    wb.SheetNames.find(s => s.includes('Chỉ tiêu SPTT')) ||
    wb.SheetNames.find(s => s.includes('CHỈ TIÊU NĂM')) ||
    wb.SheetNames.find(s => s.includes('Chỉ tiêu')) ||
    wb.SheetNames[0];

  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Tìm dòng header chứa "Tháng 1"
  let headerRow = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    if (rows[i] && rows[i].some(c => c && String(c).includes('Tháng 1'))) {
      headerRow = i; break;
    }
  }

  // Tìm cột "Tháng 1"
  let thang1Col = 5;
  if (headerRow >= 0) {
    const hRow = rows[headerRow];
    for (let c = 0; c < hRow.length; c++) {
      if (hRow[c] && String(hRow[c]).trim() === 'Tháng 1') { thang1Col = c; break; }
    }
  }

  const results = [];
  let currentNhom = null;
  let currentDSM = null;
  const startRow = headerRow >= 0 ? headerRow + 1 : 3;

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[2] || !row[3]) continue;

    const nhanVien = String(row[2]).trim();
    const chiSo = normChiSo(String(row[3]));
    const chiTieuNam = parseFloat(row[4]) || 0;

    if (!nhanVien || nhanVien === 'NHÂN VIÊN' || nhanVien === '\xa0' || nhanVien === ' ') continue;
    if (!chiSo || chiSo === 'CHỈ SỐ') continue;
    if (nhanVien.startsWith('Nơi nhận') || nhanVien.startsWith('Ban Giám')) continue;

    if (row[1] && String(row[1]).trim() && !String(row[1]).trim().startsWith('-') &&
        String(row[1]).trim() !== 'Nơi nhận:' && String(row[1]).trim() !== '\xa0') {
      currentNhom = String(row[1]).trim();
    }

    const isDSM = nhanVien.startsWith('DSM') || nhanVien === 'CCO' || nhanVien === 'TỔNG KÊNH';
    if (isDSM && nhanVien !== 'TỔNG KÊNH') currentDSM = nhanVien;

    // Tạo 1 record cho mỗi tháng có dữ liệu (tháng 1-12)
    for (let t = 1; t <= 12; t++) {
      const colIdx = thang1Col + t - 1;
      const giaTriThang = parseFloat(row[colIdx]) || 0;
      // Bỏ qua tháng không có dữ liệu (0 và không phải TỔNG KÊNH/DSM)
      if (giaTriThang === 0 && !isDSM && nhanVien !== 'TỔNG KÊNH') continue;

      results.push({
        nam,
        thang: t,
        nhom: currentNhom,
        parent_dsm: isDSM ? null : currentDSM,
        nhan_vien: nhanVien,
        chi_so: chiSo,
        chi_tieu_nam: chiTieuNam,
        gia_tri: giaTriThang,
        nguon: nguon || 'sptt'
      });
    }
  }

  return results;
}

// Alias cũ
const parseChiTieuSPTT = (buf, nam, thang) => parseChiTieuFile(buf, nam, thang, 'sptt');
const parseChiTieuKeHoach = (buf, nam, thang) => parseChiTieuFile(buf, nam, thang, 'ke_hoach');

// Parse cột "Tình trạng thu tiền" (VD: "Đã thu tiền T7", "Chưa thu tiền") thành trạng thái + kỳ thực thu.
// saleNam/saleThang là kỳ phát sinh bán hàng của chính dòng đó — dùng để suy ra năm thực thu khi
// file không ghi năm (VD: bán tháng 12/2026, "Đã thu tiền T1" → thực thu là T1/2027).
function parseTinhTrangThuTien(raw, saleNam, saleThang) {
  if (raw === undefined || raw === null) return { tinh_trang_thu_tien: null, da_thu_tien: null, nam_thu_tien: null, thang_thu_tien: null };
  const s = String(raw).trim();
  if (!s) return { tinh_trang_thu_tien: null, da_thu_tien: null, nam_thu_tien: null, thang_thu_tien: null };

  const m = s.match(/^Đã thu tiền\s*T\s*(\d{1,2})(?:[.\/](\d{2,4}))?/i);
  if (m) {
    const thangThu = parseInt(m[1]);
    let namThu;
    if (m[2]) {
      namThu = m[2].length === 2 ? 2000 + parseInt(m[2]) : parseInt(m[2]);
    } else {
      namThu = thangThu < saleThang ? saleNam + 1 : saleNam;
    }
    return { tinh_trang_thu_tien: s, da_thu_tien: true, nam_thu_tien: namThu, thang_thu_tien: thangThu };
  }

  if (/^Chưa thu tiền/i.test(s)) {
    return { tinh_trang_thu_tien: s, da_thu_tien: false, nam_thu_tien: null, thang_thu_tien: null };
  }

  // Giá trị lạ (không đúng 2 mẫu trên) — giữ lại text gốc nhưng không suy luận được trạng thái
  return { tinh_trang_thu_tien: s, da_thu_tien: null, nam_thu_tien: null, thang_thu_tien: null };
}

// Parse file doanh số thực hiện (Sổ chi tiết bán hàng hoặc sheet Dữ liệu)
function parseDuLieu(buffer, nam, thang) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  // Ưu tiên các sheet có dữ liệu giao dịch
  const sheetName =
    wb.SheetNames.find(s => s.includes('SỔ CHI TIẾT') || s.includes('SO CHI TIET')) ||
    wb.SheetNames.find(s => s.includes('Dữ liệu') || s.includes('Du lieu')) ||
    wb.SheetNames.find(s => s.includes('DS thu tiền')) ||
    wb.SheetNames[0];

  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Tìm dòng header
  let headerRow = -1;
  for (let i = 0; i < Math.min(8, rows.length); i++) {
    if (rows[i] && rows[i].some(c => c && String(c).includes('Ngày hạch toán'))) {
      headerRow = i; break;
    }
  }
  if (headerRow === -1) return [];

  const headers = rows[headerRow].map(h => h ? String(h).trim() : '');
  const col = {};
  headers.forEach((h, i) => { col[h] = i; });

  // Ưu tiên cột doanh số: Doanh số thực đạt → Tổng thanh toán → Doanh số bán
  const dsCol = col['Doanh số thực đạt'] !== undefined ? 'Doanh số thực đạt'
    : col['Tổng thanh toán'] !== undefined ? 'Tổng thanh toán'
    : 'Doanh số bán';

  // Cột "Tình trạng thu tiền" đôi khi nằm ở dòng header phụ ngay dưới header chính (header 2 tầng)
  let ttColIdx = col['Tình trạng thu tiền'];
  if (ttColIdx === undefined && rows[headerRow + 1]) {
    const idx2 = rows[headerRow + 1].findIndex(h => h && String(h).trim() === 'Tình trạng thu tiền');
    if (idx2 !== -1) ttColIdx = idx2;
  }

  const results = [];
  let namVal = nam, thangVal = thang;

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const ngay = row[col['Ngày hạch toán']];
    const tenNV = row[col['Tên nhân viên bán hàng']];
    if (!ngay || !tenNV) continue;

    // Loại trừ "Kênh Ủy Thác" khỏi dữ liệu KPI
    if (String(tenNV).toLowerCase().includes('ủy thác') || String(tenNV).toLowerCase().includes('uy thac')) continue;

    // Loại trừ giao dịch nội bộ (nhóm "BOD") — không phải doanh số bán hàng thực tế cho khách hàng
    const nhomKHRaw = String(row[col['Tên nhóm khách hàng']] || row[col['Nhóm quản lý vùng']] || '').trim();
    if (nhomKHRaw.toUpperCase() === 'BOD') continue;

    let ngayStr = '';
    if (ngay instanceof Date) ngayStr = ngay.toISOString().split('T')[0];
    else ngayStr = String(ngay).substring(0, 10);

    // Tính năm/tháng từ ngày
    const d = new Date(ngayStr);
    if (!isNaN(d)) { namVal = d.getFullYear(); thangVal = d.getMonth() + 1; }

    const ttInfo = parseTinhTrangThuTien(ttColIdx !== undefined ? row[ttColIdx] : null, namVal, thangVal);

    results.push({
      nam: namVal,
      thang: thangVal,
      ngay_hach_toan: ngayStr,
      so_chung_tu: String(row[col['Số chứng từ']] || ''),
      ma_khach_hang: String(row[col['Mã khách hàng']] || ''),
      ten_khach_hang: String(row[col['Tên khách hàng']] || ''),
      ten_hang: String(row[col['Tên hàng']] || ''),
      so_luong_ban: parseFloat(row[col['Số lượng bán']]) || 0,
      sl_khuyen_mai: parseFloat(row[col['SL bán khuyến mại']]) || 0,
      don_gia: parseFloat(row[col['Đơn giá']]) || 0,
      doanh_so_ban: parseFloat(row[col['Doanh số bán']]) || 0,
      doanh_so_thuc_dat: parseFloat(row[col[dsCol]]) || 0,
      ten_nhan_vien: String(tenNV).trim(),
      ten_don_vi: String(row[col['Tên đơn vị kinh doanh']] || ''),
      tinh_thanh_pho: String(row[col['Tỉnh/Thành phố']] || ''),
      ten_nhom_kh: String(row[col['Tên nhóm khách hàng']] || row[col['Nhóm quản lý vùng']] || ''),
      tinh_trang_thu_tien: ttInfo.tinh_trang_thu_tien,
      da_thu_tien: ttInfo.da_thu_tien,
      nam_thu_tien: ttInfo.nam_thu_tien,
      thang_thu_tien: ttInfo.thang_thu_tien
    });
  }

  return results;
}

// Parse file Nhật ký chung để lấy "Doanh số tiền về" (tiền thực thu trong tháng)
// Bút toán thu tiền khách hàng: Nợ TK 111/112 - Có TK 131
function parseTienVe(buffer, nam, thang) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  const sheetName =
    wb.SheetNames.find(s => s.includes('SỔ NHẬT KÝ CHUNG') || s.includes('NHAT KY CHUNG')) ||
    wb.SheetNames[0];

  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  let headerRow = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    if (rows[i] && rows[i].some(c => c && String(c).includes('Ngày hạch toán'))) {
      headerRow = i; break;
    }
  }
  if (headerRow === -1) return [];

  const headers = rows[headerRow].map(h => h ? String(h).trim() : '');
  const col = {};
  headers.forEach((h, i) => { col[h] = i; });

  const results = [];

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const ngay = row[col['Ngày hạch toán']];
    const tk = String(row[col['Tài khoản']] || '');
    const tkDoiUng = String(row[col['TK đối ứng']] || '');
    if (!ngay) continue;

    // Chỉ lấy bút toán thu tiền: Nợ 111/112, đối ứng 131
    const isThuTien = (tk.startsWith('111') || tk.startsWith('112')) && tkDoiUng.startsWith('131');
    if (!isThuTien) continue;

    let ngayStr = '';
    if (ngay instanceof Date) ngayStr = ngay.toISOString().split('T')[0];
    else ngayStr = String(ngay).substring(0, 10);

    const d = new Date(ngayStr);
    if (isNaN(d)) continue;
    const namVal = d.getFullYear(), thangVal = d.getMonth() + 1;
    if (namVal !== nam || thangVal !== thang) continue;

    results.push({
      nam: namVal,
      thang: thangVal,
      ngay_hach_toan: ngayStr,
      so_chung_tu: String(row[col['Số chứng từ']] || ''),
      ten_khach_hang: String(row[col['Tên đối tượng']] || ''),
      so_tien: parseFloat(row[col['Phát sinh Nợ']]) || 0
    });
  }

  return results;
}

module.exports = { parseChiTieuSPTT, parseChiTieuKeHoach, parseDuLieu, parseTienVe };
