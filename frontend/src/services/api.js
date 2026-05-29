import axios from 'axios';

// En produccion, lee de window.__ENV__ (inyectado por nginx) o de VITE_API_URL (build time)
const apiUrl = window.__ENV__?.VITE_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: apiUrl,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (username, password) => {
    const form = new URLSearchParams();
    form.append('username', username);
    form.append('password', password);
    return api.post('/auth/login', form);
  },
  register: (username, password) =>
    api.post('/auth/register', { username, password }),
};

export const credentialsAPI = {
  list: () => api.get('/credentials/'),
  create: (data) => api.post('/credentials/', data),
  update: (id, data) => api.put(`/credentials/${id}`, data),
  delete: (id) => api.delete(`/credentials/${id}`),
};

export const reportsAPI = {
  consultaCuit: (cuit) => api.get(`/reports/consulta-cuit/${cuit}`),
  informeCompleto: (cuit, cuitRepr) =>
    api.get(`/reports/informe-completo/${cuit}`, { params: cuitRepr ? { cuit_representada: cuitRepr } : {} }),
  persona: (cuit, cuitRepr) =>
    api.get(`/reports/persona/${cuit}`, { params: cuitRepr ? { cuit_representada: cuitRepr } : {} }),
  estadoServicio: () => api.get('/reports/estado-servicio'),
  historial: (params) => api.get('/reports/historial', { params }),
};

export const certificatesAPI = {
  generateCSR: (cuit) => api.post(`/certificates/generate-csr/${cuit}`),
  downloadCSR: async (cuit) => {
    const res = await api.get(`/certificates/download-csr/${cuit}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cuit}.csr`;
    a.click();
    URL.revokeObjectURL(url);
  },
  uploadCert: (cuit, file) => {
    const form = new FormData();
    form.append('cert_file', file);
    return api.post(`/certificates/upload-cert/${cuit}`, form);
  },
  status: (cuit) => api.get(`/certificates/status/${cuit}`),
};

export const facturasAPI = {
  ultimoMes: (cuit, params) => api.get(`/facturas/ultimo-mes/${cuit}`, { params }),
  porFecha: (cuit, params) => api.get(`/facturas/por-fecha/${cuit}`, { params }),
  comprobante: (cuit, params) => api.get(`/facturas/comprobante/${cuit}`, { params }),
  puntosVenta: (cuit) => api.get(`/facturas/puntos-venta/${cuit}`),
  tiposComprobante: (cuit) => api.get(`/facturas/tipos-comprobante/${cuit}`),
  estadoWsfe: () => api.get('/facturas/estado-wsfe'),
};

export const consultasAPI = {
  constatarComprobante: (params) => api.get('/consultas/constatar-comprobante', { params }),
  estadoWscdc: () => api.get('/consultas/estado-wscdc'),
  cotizacion: (monedaId, cuit) => api.get(`/consultas/cotizacion/${monedaId}`, { params: { cuit } }),
  monedas: (cuit) => api.get('/consultas/monedas', { params: { cuit } }),
  paises: (cuit) => api.get('/consultas/paises', { params: { cuit } }),
  cuitsPaises: (cuit) => api.get('/consultas/cuits-paises', { params: { cuit } }),
  incoterms: (cuit) => api.get('/consultas/incoterms', { params: { cuit } }),
  tiposComprobante: (cuit) => api.get('/consultas/tipos-comprobante', { params: { cuit } }),
  puntosVenta: (cuit) => api.get('/consultas/puntos-venta', { params: { cuit } }),
  estadoServicios: () => api.get('/consultas/estado-servicios'),
};

export default api;
