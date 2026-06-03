const XLSX = require('xlsx');

// Chuẩn hóa tên cột chi_so
function normChiSo(s) {
  if (!s) return s;
  return s.trim()
    .replace('Gía trị', 'Giá trị')
    .replace('Số lượng khách hàng mua TB/THÁNG', 'Số lượng độ phủ TB/THÁNG');
}

// Parse bất kỳ file chỉ tiêu nào có cấu trúc: cột 0=STT,1=NHÓM,2=NHÂN VIÊN,3=CHỈ SỐ,4=CHỈ TIÊU NĂM,5+=tháng
function parseChiTieuFile(buffer, nam, thang, nguon) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  // Tìm sheet phù hợp
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
      headerRow = i;
      break;
    }
  }
  // Col index cho tháng: header row có [null, null, null, null, null, "Tháng 1", "Tháng 2"...]
  // Tìm vị trí "Tháng 1" để tính offset
  let thang1Col = 5;
  if (headerRow >= 0) {
    const hRow = rows[headerRow];
    for (let c = 0; c < hRow.length; c++) {
      if (hRow[c] && String(hRow[c]).trim() === 'Tháng 1') { thang1Col = c; break; }
    }
  }
  const monthColIndex = thang1Col + thang - 1;

  const results = [];
  let currentNhom = null;
  const startRow = headerRow >= 0 ? headerRow + 1 : 3;

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[2] || !row[3]) continue;

    const nhanVien = String(row[2]).trim();
    const chiSo = normChiSo(String(row[3]));
    const chiTieuNam = parseFloat(row[4]) || 0;
    const giaTriThang = parseFloat(row[monthColIndex]) || 0;

    if (!nhanVien || nhanVien === 'NHÂN VIÊN' || nhanVien === '\xa0' || nhanVien === ' ') continue;
    if (!chiSo || chiSo === 'CHỈ SỐ') continue;
    if (nhanVien.startsWith('Nơi nhận') || nhanVien.startsWith('Ban Giám')) continue;

    if (row[1] && String(row[1]).trim() && !String(row[1]).trim().startsWith('-') && String(row[1]).trim() !== 'Nơi nhận:' && String(row[1]).trim() !== '\xa0') {
      currentNhom = String(row[1]).trim();
    }

    results.push({
      nam,
      thang,
      nhom: currentNhom,
      nhan_vien: nhanVien,
      chi_so: chiSo,
      chi_tieu_nam: chiTieuNam,
      gia_tri: giaTriThang,
      nguon: nguon || 'sptt'
    });
  }

  return results;
}

// Alias cũ
const parseChiTieuSPTT = (buf, nam, thang) => parseChiTieuFile(buf, nam, thang, 'sptt');
const parseChiTieuKeHoach = (buf, nam, thang) => parseChiTieuFile(buf, nam, thang, 'ke_hoach');

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

  const results = [];
  let namVal = nam, thangVal = thang;

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const ngay = row[col['Ngày hạch toán']];
    const tenNV = row[col['Tên nhân viên bán hàng']];
    if (!ngay || !tenNV) continue;

    let ngayStr = '';
    if (ngay instanceof Date) ngayStr = ngay.toISOString().split('T')[0];
    else ngayStr = String(ngay).substring(0, 10);

    // Tính năm/tháng từ ngày
    const d = new Date(ngayStr);
    if (!isNaN(d)) { namVal = d.getFullYear(); thangVal = d.getMonth() + 1; }

    results.push({
      nam: namVal,
      thang: thangVal,
      ngay_hach_toan: ngayStr,
      so_chung_tu: String(row[col['Số chứng từ']] || ''),
      ten_khach_hang: String(row[col['Tên khách hàng']] || ''),
      ten_hang: String(row[col['Tên hàng']] || ''),
      so_luong_ban: parseFloat(row[col['Số lượng bán']]) || 0,
      don_gia: parseFloat(row[col['Đơn giá']]) || 0,
      doanh_so_ban: parseFloat(row[col['Doanh số bán']]) || 0,
      doanh_so_thuc_dat: parseFloat(row[col[dsCol]]) || 0,
      ten_nhan_vien: String(tenNV).trim(),
      ten_don_vi: String(row[col['Tên đơn vị kinh doanh']] || ''),
      tinh_thanh_pho: String(row[col['Tỉnh/Thành phố']] || ''),
      ten_nhom_kh: String(row[col['Tên nhóm khách hàng']] || '')
    });
  }

  return results;
}

module.exports = { parseChiTieuSPTT, parseChiTieuKeHoach, parseDuLieu };
