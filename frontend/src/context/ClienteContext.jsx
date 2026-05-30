import { createContext, useContext, useEffect, useState } from 'react';
import { clientesAPI } from '../services/api';

const ClienteContext = createContext(null);

/**
 * Maneja la lista de clientes del contador y cual esta seleccionado globalmente.
 * El cliente seleccionado define el CUIT sobre el que operan las demas secciones.
 */
export function ClienteProvider({ children }) {
  const [clientes, setClientes] = useState([]);
  const [selectedId, setSelectedId] = useState(() => {
    const saved = localStorage.getItem('clienteSeleccionado');
    return saved ? Number(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    try {
      const res = await clientesAPI.list();
      setClientes(res.data);
      return res.data;
    } catch {
      setClientes([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const selectCliente = (id) => {
    setSelectedId(id);
    if (id) localStorage.setItem('clienteSeleccionado', String(id));
    else localStorage.removeItem('clienteSeleccionado');
  };

  const selectedCliente = clientes.find((c) => c.id === selectedId) || null;

  return (
    <ClienteContext.Provider
      value={{ clientes, selectedCliente, selectedId, selectCliente, reload, loading }}
    >
      {children}
    </ClienteContext.Provider>
  );
}

export function useCliente() {
  const ctx = useContext(ClienteContext);
  if (!ctx) throw new Error('useCliente must be used within ClienteProvider');
  return ctx;
}
