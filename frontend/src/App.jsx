import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import MucTieu from './pages/MucTieu';
import KpiThucDat from './pages/KpiThucDat';
import Logo from './components/Logo';

const NAV = [
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'kpi-thuc-dat', label: '📈 KPI Thực Đạt' },
  { id: 'muc-tieu', label: '🎯 Mục Tiêu KPI' },
  { id: 'upload', label: '📂 Dữ liệu' },
];

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f2f6fb', fontFamily: 'Inter, Segoe UI, Arial, sans-serif' }}>
      <div className={`app-sidebar${collapsed ? ' is-collapsed' : ''}`} style={{ width: 220, background: '#01377d', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <button className="sidebar-toggle" onClick={() => setCollapsed(c => !c)}>{collapsed ? '>' : '<'}</button>
        <div className="sidebar-brand" style={{ padding: '24px 16px 18px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="app-logo-box" style={{ width: 252, padding: 12, borderRadius: 8, background: '#fff' }}>
            <Logo width={184} />
          </div>
          <div className="sidebar-subtitle" style={{ fontSize: 11, color: 'rgba(255,255,255,0.68)', marginTop: 10, fontWeight: 600 }}>KPI OTC Dashboard 2026</div>
        </div>
        <nav className="sidebar-nav" style={{ padding: '16px 10px', flex: 1 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', marginBottom: 4, background: page === n.id ? 'rgba(255,255,255,0.15)' : 'transparent', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: page === n.id ? 600 : 400, color: page === n.id ? '#fff' : 'rgba(255,255,255,0.65)', cursor: 'pointer' }}>
              {n.label}
            </button>
          ))}
        </nav>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {page === 'dashboard' && <Dashboard />}
        {page === 'kpi-thuc-dat' && <KpiThucDat />}
        {page === 'muc-tieu' && <MucTieu />}
        {page === 'upload' && <Upload />}
      </div>
    </div>
  );
}
