import { useEffect, useState } from 'react';
import { getMetaDSM, getMetaTDV } from '../api';

const MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
const QUARTERS = ['Quý 1 (T1-T3)', 'Quý 2 (T4-T6)', 'Quý 3 (T7-T9)', 'Quý 4 (T10-T12)'];
const YEARS = [2025, 2026, 2027];

export default function FilterBar({ filters, onChange }) {
  const [dsmList, setDsmList] = useState([]);
  const [tdvList, setTdvList] = useState([]);

  useEffect(() => {
    getMetaDSM({ nam: filters.nam, thang: filters.thang }).then(r => setDsmList(r.data)).catch(() => {});
  }, [filters.nam, filters.thang]);

  useEffect(() => {
    getMetaTDV({ nam: filters.nam, thang: filters.thang, dsm: filters.dsm }).then(r => setTdvList(r.data)).catch(() => {});
  }, [filters.nam, filters.thang, filters.dsm]);

  const sel = (name, value, opts, label, disabled = false) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
      <select
        value={value || ''}
        onChange={e => onChange({ [name]: e.target.value || null })}
        disabled={disabled}
        style={{ padding: '8px 12px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 13, background: disabled ? '#f5f5f5' : '#fff', cursor: disabled ? 'default' : 'pointer', minWidth: 130 }}
      >
        {opts}
      </select>
    </div>
  );

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', marginBottom: 20 }}>
      {sel('nam', filters.nam, [<option key="" value="">Chọn năm</option>, ...YEARS.map(y => <option key={y} value={y}>{y}</option>)], 'Năm')}

      {sel('quy', filters.quy, [<option key="" value="">Tất cả quý</option>, ...QUARTERS.map((q, i) => <option key={i+1} value={i+1}>{q}</option>)], 'Quý')}

      {sel('thang', filters.thang, [<option key="" value="">Tất cả tháng</option>, ...MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)], 'Tháng')}

      {sel('tuan', filters.tuan, [<option key="" value="">Tất cả tuần</option>, ...[1,2,3,4,5].map(w => <option key={w} value={w}>Tuần {w}</option>)], 'Tuần')}

      {sel('dsm', filters.dsm,
        [<option key="" value="">Tất cả DSM</option>, ...dsmList.map(d => <option key={d} value={d}>{d}</option>)],
        'DSM'
      )}

      {sel('tdv', filters.tdv,
        [<option key="" value="">Tất cả TDV</option>, ...tdvList.map(t => <option key={t} value={t}>{t}</option>)],
        'TDV/CTV'
      )}

      {(filters.dsm || filters.tdv || filters.tuan || filters.quy) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'transparent' }}>x</label>
          <button
            onClick={() => onChange({ dsm: null, tdv: null, tuan: null, quy: null })}
            style={{ padding: '8px 14px', background: '#f5f5f5', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666' }}
          >
            Xóa bộ lọc
          </button>
        </div>
      )}
    </div>
  );
}
