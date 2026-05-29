import { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import { History as HistoryIcon, ChevronDown, ChevronUp } from 'lucide-react';

const typeLabels = {
  consulta_cuit: 'Datos CUIT',
  constancia_inscripcion: 'Constancia',
  actividades: 'Actividades',
  domicilio_fiscal: 'Domicilio',
  impuestos: 'Impuestos',
  informe_completo: 'Informe Completo',
};

export default function History() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    reportsAPI.historial({ report_type: filterType || undefined })
      .then((res) => setReports(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterType]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, color: '#1a1a2e' }}>Historial de Consultas</h2>
          <p style={{ color: '#666', margin: '4px 0 0', fontSize: 14 }}>
            Todas las consultas realizadas
          </p>
        </div>
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setLoading(true); }}
          style={{
            padding: '10px 16px', borderRadius: 8, border: '2px solid #e0e0e0',
            fontSize: 14, outline: 'none', background: 'white',
          }}
        >
          <option value="">Todos los tipos</option>
          {Object.entries(typeLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p style={{ color: '#666' }}>Cargando historial...</p>
      ) : reports.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 12, padding: 40, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <HistoryIcon size={48} color="#ccc" />
          <p style={{ color: '#666', marginTop: 16 }}>No hay consultas en el historial.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {reports.map((r) => (
            <div
              key={r.id}
              style={{
                background: 'white', borderRadius: 12,
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                style={{
                  width: '100%', padding: '16px 20px', background: 'none', border: 'none',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <span style={{
                    background: '#e3f2fd', color: '#1565c0', padding: '4px 10px',
                    borderRadius: 6, fontSize: 12, fontWeight: 600,
                  }}>
                    {typeLabels[r.report_type] || r.report_type}
                  </span>
                  <span style={{ fontWeight: 600, color: '#1a1a2e' }}>{r.cuit}</span>
                  <span style={{ fontSize: 13, color: '#999' }}>
                    {new Date(r.created_at).toLocaleString('es-AR')}
                  </span>
                </div>
                {expandedId === r.id ? <ChevronUp size={20} color="#666" /> : <ChevronDown size={20} color="#666" />}
              </button>

              {expandedId === r.id && (
                <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f0f0f0' }}>
                  <pre style={{
                    background: '#f8f9fa', borderRadius: 8, padding: 16,
                    overflow: 'auto', fontSize: 13, lineHeight: 1.5,
                    maxHeight: 400, margin: '16px 0 0',
                  }}>
                    {JSON.stringify(r.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
