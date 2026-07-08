const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TABLES = ['chi_tieu', 'doanh_so', 'uploads', 'users', 'tien_ve'];
const PAGE_SIZE = 1000;

// PostgREST giới hạn 1000 dòng/lần select -> phải phân trang lấy hết
async function selectAll(table) {
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    all = all.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

function nextIdFrom(rows) {
  return rows.reduce((max, r) => Math.max(max, r.id || 0), 0) + 1;
}

function getDefaultUsers() {
  return [
    { id: 1, username: 'admin', password: 'admin123', role: 'admin', dsm: null, full_name: 'Administrator' },
    { id: 2, username: 'dsm01', password: 'dsm01', role: 'dsm', dsm: 'DSM1', full_name: 'DSM 01' }
  ];
}

async function loadDB() {
  const [chiTieu, doanhSo, uploads, users, tienVe] = await Promise.all(TABLES.map(selectAll));

  return {
    chi_tieu: chiTieu,
    doanh_so: doanhSo,
    uploads: uploads,
    users: users.length ? users : getDefaultUsers(),
    tien_ve: tienVe,
    nextId: {
      chi_tieu: nextIdFrom(chiTieu),
      doanh_so: nextIdFrom(doanhSo),
      uploads: nextIdFrom(uploads),
      users: nextIdFrom(users),
      tien_ve: nextIdFrom(tienVe)
    }
  };
}

// Ghi đè toàn bộ 1 bảng: xóa hết rồi insert lại theo dữ liệu trong bộ nhớ.
// Chấp nhận được vì quy mô dữ liệu nhỏ (vài nghìn dòng) và các endpoint
// upload đã tự lọc/gộp mảng trong bộ nhớ trước khi gọi saveDB.
async function replaceTable(table, rows) {
  const { error: delErr } = await supabase.from(table).delete().gt('id', 0);
  if (delErr) throw delErr;
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += PAGE_SIZE) {
    const chunk = rows.slice(i, i + PAGE_SIZE);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw error;
  }
}

async function saveDB(data) {
  await Promise.all([
    replaceTable('chi_tieu', data.chi_tieu || []),
    replaceTable('doanh_so', data.doanh_so || []),
    replaceTable('uploads', data.uploads || []),
    replaceTable('users', data.users || getDefaultUsers()),
    replaceTable('tien_ve', data.tien_ve || [])
  ]);
}

module.exports = { loadDB, saveDB };
