import { useEffect, useState } from 'react';
import { getKpiThucDat, exportKpiThucDat } from '../api';
import useLatestPeriod from '../useLatestPeriod';

const MONTHS = ['','Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

function fmtDS(v) {
  if (!v && v !== 0) return '—';
  if (v >= 1e9) return (v/1e9).toFixed(2)+' tỷ';
  if (v >= 1e6) return (v/1e6).toFixed(1)+' tr';
  if (v >= 1e3) return (v/1e3).toFixed(0)+' k';
  return v.toLocaleString('vi-VN');
}
function fmtN(v) {
  if (v === null || v === undefined || v === 0) return '—';
  return typeof v === 'number' && v % 1 !== 0 ? v.toFixed(1) : v.toLocaleString('vi-VN');
}
function fmtPct(v) {
  if (v === null || v === undefined) return <span style={{color:'#ccc'}}>—</span>;
  const color = v >= 100 ? '#2e7d32' : v >= 80 ? '#f57c00' : '#c62828';
  return <span style={{color, fontWeight:700}}>{v}%</span>;
}
function fmtGTTB(v) {
  if (!v) return '—';
  if (v >= 1e6) return (v/1e6).toFixed(2)+' tr';
  return v.toLocaleString('vi-VN');
}

const COLS = [
  { key:'ds',    label:'Doanh số',        fmt: fmtDS,   mt:'mt_ds',   pct:'pct_ds' },
  { key:'dh',    label:'Đơn hàng',         fmt: fmtN,    mt:'mt_dh',   pct:'pct_dh' },
  { key:'kh',    label:'Độ phủ (KH)',      fmt: fmtN,    mt:'mt_kh',   pct:'pct_kh' },
  { key:'gttb',  label:'GT TB Đơn',        fmt: fmtGTTB, mt:'mt_gttb', pct:'pct_gttb' },
  { key:'sptt',  label:'SPTT (hộp)',       fmt: fmtN,    mt:'mt_sptt', pct:'pct_sptt' },
];

const DSM_COLORS = {
  DSM1: '#1565c0', DSM2: '#6a1b9a', DSM3: '#2e7d32',
  OTC4: '#e65100', DSM5: '#00838f', CCO: '#37474f'
};

export default function KpiThucDat() {
  const latestPeriod = useLatestPeriod();
  const [nam, setNam] = useState(null);
  const [thang, setThang] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const [showExport, setShowExport] = useState(false);
  const [exportLoai, setExportLoai] = useState('dsm');
  const [exportPhamVi, setExportPhamVi] = useState('all');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (latestPeriod && !nam) {
      setNam(latestPeriod.nam);
      setThang(latestPeriod.thang);
    }
  }, [latestPeriod]);

  useEffect(() => {
    if (!nam || !thang) return;
    setLoading(true);
    getKpiThucDat({ nam, thang })
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [nam, thang]);

  const toggleDSM = (dsm) => setCollapsed(c => ({ ...c, [dsm]: !c[dsm] }));

  const filtered = !search ? data : data.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) || r.level !== 'tdv'
  );

  const dsmOptions = data.filter(r => r.level === 'dsm');
  const tdvOptions = data.filter(r => r.level === 'tdv').sort((a, b) => a.name.localeCompare(b.name));

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await exportKpiThucDat({ nam, thang, loai: exportLoai, pham_vi: exportPhamVi });
      const disposition = res.headers['content-disposition'] || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const fileName = match ? match[1] : `KPI_ThucDat_${exportLoai}_T${thang}-${nam}.xlsx`;
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Lỗi xuất file: ' + (err.response?.data?.error || err.message));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <h2 style={{ margin:0, fontSize:20, fontWeight:700, color:'#1e3a5f' }}>
          KPI Thực Đạt
          {thang > 0 && <span style={{ fontSize:13, fontWeight:400, color:'#888', marginLeft:10 }}>— {MONTHS[thang]} {nam}</span>}
        </h2>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <select value={nam} onChange={e=>setNam(parseInt(e.target.value))}
            style={{ padding:'7px 12px', border:'1.5px solid #e0e0e0', borderRadius:8, fontSize:13 }}>
            {[2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <select value={thang} onChange={e=>setThang(parseInt(e.target.value))}
            style={{ padding:'7px 12px', border:'1.5px solid #e0e0e0', borderRadius:8, fontSize:13 }}>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m=><option key={m} value={m}>{MONTHS[m]}</option>)}
          </select>
          <input placeholder="🔍 Tìm TDV/DSM..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{ padding:'7px 14px', border:'1.5px solid #e0e0e0', borderRadius:8, fontSize:13, width:180 }} />
          <button onClick={() => setShowExport(s => !s)}
            style={{ padding:'7px 14px', background: showExport ? '#1e3a5f' : '#fff', color: showExport ? '#fff' : '#1e3a5f', border:'1.5px solid #1e3a5f', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
            ⬇ Xuất Excel
          </button>
        </div>
      </div>

      {showExport && (
        <div style={{ background:'#fff', borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.08)', padding:18, marginBottom:20, display:'flex', gap:14, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'#666', display:'block', marginBottom:4 }}>Loại xuất</label>
            <select value={exportLoai} onChange={e => { setExportLoai(e.target.value); setExportPhamVi('all'); }}
              style={{ padding:'7px 12px', border:'1.5px solid #e0e0e0', borderRadius:8, fontSize:13 }}>
              <option value="dsm">Theo vùng DSM quản lý</option>
              <option value="tdv">Theo TDV (đối chiếu dữ liệu)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'#666', display:'block', marginBottom:4 }}>Phạm vi</label>
            <select value={exportPhamVi} onChange={e => setExportPhamVi(e.target.value)}
              style={{ padding:'7px 12px', border:'1.5px solid #e0e0e0', borderRadius:8, fontSize:13, minWidth:200 }}>
              <option value="all">{exportLoai === 'dsm' ? 'Tất cả DSM (mỗi DSM 1 sheet)' : 'Tất cả TDV'}</option>
              {exportLoai === 'dsm'
                ? dsmOptions.map(d => <option key={d.dsm} value={d.dsm}>{d.dsm_label}</option>)
                : tdvOptions.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          <button onClick={handleExport} disabled={exporting || data.length === 0}
            style={{ padding:'8px 20px', background: exporting ? '#ccc' : '#2e7d32', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor: exporting ? 'not-allowed' : 'pointer' }}>
            {exporting ? 'Đang xuất...' : '📥 Tải file .xlsx'}
          </button>
        </div>
      )}

      {(loading || !nam) && <div style={{ textAlign:'center', padding:60, color:'#888' }}>Đang tải...</div>}

      {!loading && nam && data.length === 0 && (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'#999' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>📊</div>
          <div>Chưa có dữ liệu thực hiện. Vui lòng upload file Sổ Chi Tiết Bán Hàng.</div>
        </div>
      )}

      {!loading && data.length > 0 && (
        <div style={{ background:'#fff', borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.08)', overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'#1e3a5f' }}>
                  <th style={{ padding:'10px 16px', textAlign:'left', color:'#fff', fontWeight:700, whiteSpace:'nowrap', minWidth:200, position:'sticky', left:0, background:'#1e3a5f', zIndex:2 }}>
                    Tên / Địa bàn
                  </th>
                  {COLS.map(c => (
                    <th key={c.key} colSpan={3} style={{ padding:'10px 8px', textAlign:'center', color:'#fff', fontWeight:700, borderLeft:'1px solid rgba(255,255,255,0.2)', whiteSpace:'nowrap' }}>
                      {c.label}
                    </th>
                  ))}
                </tr>
                <tr style={{ background:'#2d6a9f' }}>
                  <th style={{ padding:'6px 16px', color:'rgba(255,255,255,0.7)', fontSize:11, position:'sticky', left:0, background:'#2d6a9f', zIndex:2 }}></th>
                  {COLS.map(c => (
                    <>
                      <th key={c.key+'_th'} style={{ padding:'6px 8px', textAlign:'right', color:'rgba(255,255,255,0.9)', fontSize:11, fontWeight:600, borderLeft:'1px solid rgba(255,255,255,0.2)', minWidth:80 }}>Thực hiện</th>
                      <th key={c.key+'_mt'} style={{ padding:'6px 8px', textAlign:'right', color:'rgba(255,255,255,0.7)', fontSize:11, minWidth:80 }}>Mục tiêu</th>
                      <th key={c.key+'_pct'} style={{ padding:'6px 8px', textAlign:'center', color:'rgba(255,255,255,0.9)', fontSize:11, minWidth:60 }}>% HT</th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => {
                  const isTotal = row.level === 'total';
                  const isDSM   = row.level === 'dsm';
                  const isTDV   = row.level === 'tdv';
                  const dsmColor = DSM_COLORS[row.dsm] || '#555';
                  if (isTDV && collapsed[row.dsm]) return null;

                  const bg = isTotal ? '#1e3a5f' : isDSM ? '#f0f5ff' : i%2===0?'#fff':'#fafafa';
                  const clr = isTotal ? '#fff' : '#333';
                  const fw = isTotal||isDSM ? 700 : 400;

                  return (
                    <tr key={i} style={{ borderBottom: isDSM?'2px solid #c5d8f0':'1px solid #f0f0f0' }}>
                      {/* Tên */}
                      <td style={{ padding: isTDV?'7px 16px 7px 32px':'9px 16px', fontWeight:fw, background:bg, color:clr, whiteSpace:'nowrap', position:'sticky', left:0, zIndex:1,
                        borderLeft: isDSM?`4px solid ${dsmColor}`: isTotal?'4px solid #fff':'4px solid transparent' }}>
                        {isDSM && (
                          <span onClick={() => toggleDSM(row.dsm)} style={{ cursor:'pointer', marginRight:6, fontSize:10, color:dsmColor }}>
                            {collapsed[row.dsm] ? '▶' : '▼'}
                          </span>
                        )}
                        {isTDV && <span style={{ color:'#b0c4de', marginRight:6 }}>└</span>}
                        {row.name}
                      </td>
                      {/* 5 KPI cols × 3 sub-cols */}
                      {COLS.map(c => (
                        <>
                          <td key={c.key+'_th'} style={{ padding:'7px 8px', textAlign:'right', background:bg, color:clr, fontWeight:isTDV?400:600, borderLeft:'1px solid #f0f0f0' }}>
                            {c.fmt(row[c.key])}
                            {c.key === 'ds' && row.doanh_so_tien_ve != null && (
                              <div style={{ fontSize:9, fontWeight:400, color: isTotal?'rgba(255,255,255,0.7)':'#888' }}>💵 tiền về</div>
                            )}
                          </td>
                          <td key={c.key+'_mt'} style={{ padding:'7px 8px', textAlign:'right', background:bg, color:isTotal?'rgba(255,255,255,0.6)':'#999', fontSize:11 }}>
                            {c.fmt(row[c.mt])}
                          </td>
                          <td key={c.key+'_pct'} style={{ padding:'7px 8px', textAlign:'center', background:bg }}>
                            {fmtPct(row[c.pct])}
                          </td>
                        </>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Legend */}
          <div style={{ padding:'10px 16px', borderTop:'1px solid #f0f0f0', display:'flex', gap:20, fontSize:11, color:'#888', flexWrap:'wrap' }}>
            <span>🟢 ≥ 100%</span><span>🟡 80-99%</span><span>🔴 &lt; 80%</span>
            {data.some(r => r.level !== 'total' && r.doanh_so_tien_ve != null) ? (
              <span>💵 Doanh số tính theo tiền về thực thu trong tháng (kể cả công nợ tháng trước, thu tiền tháng này vẫn tính cho đúng TDV)</span>
            ) : data[0]?.doanh_so_tien_ve != null ? (
              <span>💵 Doanh số Tổng Kênh tính theo tiền về, DSM/TDV vẫn theo doanh số bán hàng</span>
            ) : null}
            <span style={{ marginLeft:'auto' }}>Click vào DSM để thu gọn/mở rộng</span>
          </div>
        </div>
      )}
    </div>
  );
}
