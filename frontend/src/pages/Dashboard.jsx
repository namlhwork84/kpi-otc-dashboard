import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { getSummary, getTheoDSM, getTheoTDV, getTrendTuan } from '../api';
import FilterBar from '../components/FilterBar';
import KPICard from '../components/KPICard';

function fmt(n) {
  if (!n) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' tỷ';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' tr';
  return n.toLocaleString('vi-VN');
}

const MONTH_NAMES = ['', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

function pctColor(p) {
  if (p >= 100) return '#2e7d32';
  if (p >= 80) return '#f57c00';
  return '#c62828';
}

export default function Dashboard() {
  const [filters, setFilters] = useState({ nam: 2026, thang: 4, quy: null, tuan: null, dsm: null, tdv: null });
  const [summary, setSummary] = useState(null);
  const [dsmData, setDsmData] = useState([]);
  const [tdvData, setTdvData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setTab] = useState('dsm');

  const mergeFilters = (patch) => setFilters(f => {
    const next = { ...f, ...patch };
    if (patch.quy) {
      next.thang = null;
    }
    if (patch.thang) {
      next.quy = null;
    }
    return next;
  });

  const apiParams = {
    nam: filters.nam,
    thang: filters.thang,
    dsm: filters.dsm,
    tdv: filters.tdv,
    tuan: filters.tuan
  };

  useEffect(() => {
    if (!filters.nam || !filters.thang) return;
    setLoading(true);
    Promise.all([
      getSummary(apiParams),
      getTheoDSM({ nam: filters.nam, thang: filters.thang }),
      getTheoTDV({ nam: filters.nam, thang: filters.thang, dsm: apiParams.dsm }),
      getTrendTuan(apiParams)
    ]).then(([s, d, t, tr]) => {
      setSummary(s.data);
      setDsmData(d.data);
      setTdvData(t.data);
      setTrendData(tr.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [JSON.stringify(filters)]);

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e3a5f' }}>
          Dashboard KPI Kênh OTC
          {filters.thang && <span style={{ fontSize: 14, fontWeight: 400, color: '#888', marginLeft: 10 }}>— Tháng {filters.thang}/{filters.nam}</span>}
        </h2>
      </div>

      <FilterBar filters={filters} onChange={mergeFilters} />

      {!summary && !loading && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
          <div style={{ fontSize: 16 }}>Chưa có dữ liệu. Vui lòng upload file Excel ở trang Quản lý dữ liệu.</div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>Đang tải...</div>
      )}

      {summary && !loading && (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            <KPICard title="Doanh số thực hiện" actual={summary.doanh_so_thuc_hien} target={summary.muc_tieu_ds} icon="💰" />
            <KPICard title="Số đơn hàng" actual={summary.so_don_hang} target={summary.muc_tieu_dh} icon="🧾" />
            <KPICard title="Độ phủ (KH)" actual={summary.so_khach_hang} target={summary.muc_tieu_do_phu} icon="🏪" />
            <KPICard title="SP Trọng tâm (MT)" actual={summary.sptt_muc_tieu} target={summary.sptt_muc_tieu} icon="⭐" />
          </div>

          {/* Trend theo tuần */}
          {trendData.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#333' }}>Doanh số theo tuần</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={v => v >= 1e9 ? (v/1e9).toFixed(1)+'tỷ' : v >= 1e6 ? (v/1e6).toFixed(0)+'tr' : v} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Bar dataKey="doanh_so" name="Doanh số" fill="#2d6a9f" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tab DSM / TDV */}
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
              {['dsm', 'tdv'].map(tab => (
                <button key={tab} onClick={() => setTab(tab)} style={{ padding: '14px 24px', border: 'none', background: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: activeTab === tab ? '#1e3a5f' : '#888', borderBottom: activeTab === tab ? '2px solid #2d6a9f' : '2px solid transparent' }}>
                  {tab === 'dsm' ? '📊 Theo DSM' : '👤 Theo TDV/CTV'}
                </button>
              ))}
            </div>

            {activeTab === 'dsm' && (
              <div style={{ padding: 20 }}>
                <div style={{ marginBottom: 20 }}>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={dsmData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="dsm" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={v => v >= 1e9 ? (v/1e9).toFixed(1)+'tỷ' : v >= 1e6 ? (v/1e6).toFixed(0)+'tr' : v} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => fmt(v)} />
                      <Legend />
                      <Bar dataKey="muc_tieu" name="Mục tiêu" fill="#e3f0fb" stroke="#2d6a9f" strokeWidth={1.5} radius={[4,4,0,0]} />
                      <Bar dataKey="thuc_hien" name="Thực hiện" radius={[4,4,0,0]}>
                        {dsmData.map((d, i) => <Cell key={i} fill={pctColor(d.pct_ht)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f5f7fa' }}>
                      {['DSM', 'Thực hiện', 'Mục tiêu', '% HT', 'Số đơn', 'Số KH'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#555', borderBottom: '2px solid #eee', ...(h === 'DSM' ? { textAlign: 'left' } : {}) }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dsmData.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e3a5f' }}>{row.dsm}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>{fmt(row.thuc_hien)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#888' }}>{fmt(row.muc_tieu)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: pctColor(row.pct_ht) }}>{row.pct_ht}%</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>{row.so_dh}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>{row.so_kh}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'tdv' && (
              <div style={{ padding: 20 }}>
                <div style={{ marginBottom: 20 }}>
                  <ResponsiveContainer width="100%" height={Math.max(260, tdvData.length * 36)}>
                    <BarChart data={tdvData.slice(0, 15)} layout="vertical" margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={v => v >= 1e9 ? (v/1e9).toFixed(1)+'tỷ' : v >= 1e6 ? (v/1e6).toFixed(0)+'tr' : v} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="tdv" width={130} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => fmt(v)} />
                      <Legend />
                      <Bar dataKey="muc_tieu" name="Mục tiêu" fill="#e3f0fb" stroke="#2d6a9f" strokeWidth={1.5} radius={[0,4,4,0]} />
                      <Bar dataKey="thuc_hien" name="Thực hiện" radius={[0,4,4,0]}>
                        {tdvData.slice(0, 15).map((d, i) => <Cell key={i} fill={pctColor(d.pct_ht)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f5f7fa' }}>
                        {['#', 'TDV/CTV', 'Thực hiện', 'Mục tiêu DS', '% HT DS', 'Đơn hàng', 'MT Đơn', 'Độ phủ', 'MT Phủ', 'MT SPTT'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#555', borderBottom: '2px solid #eee', whiteSpace: 'nowrap', ...(h === 'TDV/CTV' || h === '#' ? { textAlign: 'left' } : {}) }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tdvData.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ padding: '8px 12px', color: '#888', fontSize: 12 }}>{i + 1}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1e3a5f', whiteSpace: 'nowrap' }}>{row.tdv}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(row.thuc_hien)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#888' }}>{fmt(row.muc_tieu)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: pctColor(row.pct_ht) }}>{row.pct_ht}%</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>{row.so_dh}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#888' }}>{row.muc_tieu_dh || '-'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>{row.so_kh}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#888' }}>{row.muc_tieu_do_phu || '-'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#888' }}>{row.muc_tieu_sptt || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
