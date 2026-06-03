import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import MucTieu from './pages/MucTieu';

const NAV = [
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'muc-tieu', label: '🎯 Mục Tiêu KPI' },
  { id: 'upload', label: '📂 Dữ liệu' },
];

export default function App() {
  const [page, setPage] = useState('dashboard');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f3f8', fontFamily: 'Inter, Segoe UI, Arial, sans-serif' }}>
      <div style={{ width: 220, background: '#1e3a5f', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>KPI OTC</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Dashboard 2026</div>
        </div>
        <nav style={{ padding: '16px 12px', flex: 1 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', marginBottom: 4, background: page === n.id ? 'rgba(255,255,255,0.15)' : 'transparent', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: page === n.id ? 600 : 400, color: page === n.id ? '#fff' : 'rgba(255,255,255,0.65)', cursor: 'pointer' }}>
              {n.label}
            </button>
          ))}
        </nav>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {page === 'dashboard' && <Dashboard />}
        {page === 'muc-tieu' && <MucTieu />}
        {page === 'upload' && <Upload />}
      </div>
    </div>
  );
}
