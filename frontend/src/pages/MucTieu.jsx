import { useEffect, useState } from 'react';
import { getMucTieu } from '../api';

const MONTHS = ['', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

function fmt(v, chiSo) {
  if (v === undefined || v === null || v === 0) return <span style={{ color: '#ccc' }}>—</span>;
  if (typeof v !== 'number') return v;
  if (chiSo?.includes('Doanh số')) {
    if (v >= 1e9) return (v / 1e9).toFixed(2) + ' tỷ';
    if (v >= 1e6) return (v / 1e6).toFixed(0) + ' tr';
  }
  if (chiSo?.includes('trung bình')) {
    if (v >= 1e6) return (v / 1e6).toFixed(2) + ' tr';
  }
  if (v % 1 !== 0) return v.toFixed(1);
  return v.toLocaleString('vi-VN');
}

const LEVEL_STYLE = {
  'TỔNG KÊNH': { background: '#1e3a5f', color: '#fff', fontWeight: 700, fontSize: 13 },
  DSM: { background: '#e8f0fb', color: '#1e3a5f', fontWeight: 700, fontSize: 13 },
  TDV: { background: '#fff', color: '#333', fontWeight: 400, fontSize: 12 },
};

function getLevel(nv) {
  if (nv === 'TỔNG KÊNH') return 'TỔNG KÊNH';
  if (nv.startsWith('DSM') || nv.startsWith('CCO') || nv.startsWith('FPT') || nv.startsWith('Pharmacity')) return 'DSM';
  return 'TDV';
}

const CHI_SO_LABEL = {
  'Doanh số': 'Doanh số',
  'Số lượng đơn hàng': 'Số đơn hàng',
  'Giá trị trung bình đơn hàng': 'GT TB đơn',
  'Số lượng độ phủ TB/THÁNG': 'Độ phủ',
  'Sản phẩm trọng tâm': 'SPTT',
};

export default function MucTieu() {
  const [nam, setNam] = useState(2026);
  const [thang, setThang] = useState(4);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [showNam, setShowNam] = useState(false); // toggle xem chỉ tiêu năm

  useEffect(() => {
    setLoading(true);
    getMucTieu({ nam, thang })
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [nam, thang]);

  const chiSoList = data?.chi_so_list || [];
  const rows = (data?.rows || []).filter(r =>
    !filter || r.nhan_vien.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e3a5f' }}>
          Bảng Mục Tiêu KPI
        </h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Filter năm/tháng */}
          <select value={nam} onChange={e => setNam(parseInt(e.target.value))}
            style={{ padding: '8px 12px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 13 }}>
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={thang} onChange={e => setThang(parseInt(e.target.value))}
            style={{ padding: '8px 12px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 13 }}>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{MONTHS[m]}</option>)}
          </select>
          {/* Tìm kiếm */}
          <input
            placeholder="🔍 Tìm tên TDV/DSM..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ padding: '8px 14px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 13, width: 200 }}
          />
          {/* Toggle xem chỉ tiêu năm */}
          <button
            onClick={() => setShowNam(!showNam)}
            style={{ padding: '8px 14px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 12, background: showNam ? '#1e3a5f' : '#fff', color: showNam ? '#fff' : '#555', cursor: 'pointer' }}
          >
            {showNam ? '✓ Chỉ tiêu năm' : 'Chỉ tiêu năm'}
          </button>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Đang tải...</div>}

      {!loading && rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <div>Chưa có dữ liệu mục tiêu. Vui lòng upload file CHỈ TIÊU ở trang <strong>Dữ liệu</strong>.</div>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          {/* Legend */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 20, fontSize: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, background: '#1e3a5f', borderRadius: 3, display: 'inline-block' }} /> Tổng kênh
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, background: '#e8f0fb', border: '1px solid #c5d8f0', borderRadius: 3, display: 'inline-block' }} /> DSM / CCO
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 3, display: 'inline-block' }} /> TDV / CTV
            </span>
            <span style={{ marginLeft: 'auto', color: '#888' }}>
              {rows.length} dòng | {MONTHS[thang]} {nam}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f5f7fa', position: 'sticky', top: 0 }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: '#444', borderBottom: '2px solid #e0e0e0', whiteSpace: 'nowrap', minWidth: 180 }}>
                    Tên / Cấp bậc
                  </th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#666', borderBottom: '2px solid #e0e0e0', whiteSpace: 'nowrap' }}>
                    Nhóm
                  </th>
                  {chiSoList.map(cs => (
                    <th key={cs} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#444', borderBottom: '2px solid #e0e0e0', whiteSpace: 'nowrap', minWidth: 110 }}>
                      <div style={{ fontSize: 11, color: '#1e3a5f', fontWeight: 700 }}>{CHI_SO_LABEL[cs] || cs}</div>
                      {showNam && <div style={{ fontSize: 10, color: '#aaa', fontWeight: 400 }}>Tháng / Năm</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const level = getLevel(row.nhan_vien);
                  const s = LEVEL_STYLE[level];
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '9px 16px', fontWeight: s.fontWeight, background: s.background, color: s.color, whiteSpace: 'nowrap' }}>
                        {level === 'TDV' && <span style={{ marginRight: 8, color: '#ccc' }}>└</span>}
                        {row.nhan_vien}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center', background: s.background, color: s.color === '#fff' ? 'rgba(255,255,255,0.7)' : '#888', fontSize: 11 }}>
                        {row.nhom || '—'}
                      </td>
                      {chiSoList.map(cs => {
                        const v = row[cs];
                        const vNam = row[cs + '_nam'];
                        return (
                          <td key={cs} style={{ padding: '9px 12px', textAlign: 'right', background: level === 'TỔNG KÊNH' ? '#1e3a5f' : level === 'DSM' ? '#f0f5ff' : '#fff', color: level === 'TỔNG KÊNH' ? '#fff' : '#333', fontWeight: level === 'TỔNG KÊNH' ? 600 : level === 'DSM' ? 600 : 400 }}>
                            <div>{fmt(v, cs)}</div>
                            {showNam && vNam && (
                              <div style={{ fontSize: 10, color: level === 'TỔNG KÊNH' ? 'rgba(255,255,255,0.6)' : '#aaa' }}>{fmt(vNam, cs)}</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
