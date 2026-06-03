import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:3001/api' });

export const login = (username, password) => api.post('/login', { username, password });
export const getUsers = () => api.get('/users');
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const deleteUser = (id) => api.delete(`/users/${id}`);

export const uploadChiTieu = (file, nam, thang, nguon = 'sptt') => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('nam', nam);
  fd.append('thang', thang);
  fd.append('nguon', nguon);
  return api.post('/upload/chi-tieu', fd);
};

export const getMucTieu = (params) => api.get('/muc-tieu', { params });

export const uploadDoanhSo = (file, nam, thang) => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('nam', nam);
  fd.append('thang', thang);
  return api.post('/upload/doanh-so', fd);
};

export const getUploads = () => api.get('/uploads');
export const getSummary = (params) => api.get('/dashboard/summary', { params });
export const getTheoDSM = (params) => api.get('/dashboard/theo-dsm', { params });
export const getTheoTDV = (params) => api.get('/dashboard/theo-tdv', { params });
export const getTrendTuan = (params) => api.get('/dashboard/trend-tuan', { params });
export const getMetaDSM = (params) => api.get('/metadata/dsm', { params });
export const getMetaTDV = (params) => api.get('/metadata/tdv', { params });
export const getMetaNamThang = () => api.get('/metadata/nam-thang');
export const getGiaoDich = (params) => api.get('/giao-dich', { params });
