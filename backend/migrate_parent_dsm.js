const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.json');
const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));

// Normalize nhom → DSM key chuẩn
function nhomToDSM(nhom) {
  if (!nhom) return null;
  const n = nhom.replace(/\s+/g, '').toUpperCase();
  if (n === 'OTC1') return 'DSM 01';
  if (n === 'OTC2') return 'DSM 02';
  if (n === 'OTC3') return 'DSM 03';
  if (n === 'OTC4') return 'DSM 04';
  if (n === 'OTC5') return 'DSM 5';
  return null;
}

// Gán parent_dsm cho từng record chi_tieu
let currentDSM = null;

// Sort records theo id để đảm bảo đúng thứ tự xuất hiện trong file
const sorted = [...db.chi_tieu].sort((a, b) => a.id - b.id);

for (const r of sorted) {
  const nv = r.nhan_vien;
  const isDSM = nv && (nv.startsWith('DSM') || nv === 'CCO' || nv === 'TỔNG KÊNH');

  if (isDSM && nv !== 'TỔNG KÊNH') currentDSM = nv;

  r.parent_dsm = isDSM ? null : currentDSM;
}

// Ghi lại vào data.json
db.chi_tieu = sorted;
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
console.log('Migration done. Sample:');
sorted.slice(0, 20).forEach(r => {
  if (r.chi_so === 'Doanh số')
    console.log(`  parent_dsm=${r.parent_dsm || 'null'}\t| ${r.nhan_vien}`);
});
