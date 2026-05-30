import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  KeyRound,
  FileSearch,
  Receipt,
  History,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  FilePlus,
  ChevronDown,
  ChevronRight,
  FileText,
  DollarSign,
  Activity,
  Globe,
} from 'lucide-react';
import { useState } from 'react';

// Estructura de navegacion con grupos y submenus
const navStructure = [
  { type: 'item', path: '/', label: 'Dashboard', icon: LayoutDashboard },
  {
    type: 'group',
    label: 'Facturas',
    icon: Receipt,
    children: [
      { path: '/facturas', label: 'Ver Facturas', icon: FileText },
      { path: '/emitir', label: 'Emitir Factura', icon: FilePlus },
    ],
  },
  {
    type: 'group',
    label: 'Informes',
    icon: FileSearch,
    children: [
      { path: '/reports', label: 'Informe de Padron', icon: FileText },
      { path: '/consultas', label: 'Consultas y Validaciones', icon: ShieldCheck },
    ],
  },
  {
    type: 'group',
    label: 'Configuracion',
    icon: KeyRound,
    children: [
      { path: '/credentials', label: 'Credenciales', icon: KeyRound },
    ],
  },
  { type: 'item', path: '/history', label: 'Historial', icon: History },
];

// Mapeo de cada ruta al label de su grupo (para abrir el grupo activo por defecto)
const groupOfPath = {};
navStructure.forEach((entry) => {
  if (entry.type === 'group') {
    entry.children.forEach((c) => { groupOfPath[c.path] = entry.label; });
  }
});

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Grupos abiertos: por defecto el que contiene la ruta activa
  const [openGroups, setOpenGroups] = useState(() => {
    const active = groupOfPath[location.pathname];
    return active ? { [active]: true } : {};
  });

  const toggleGroup = (label) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const linkBaseStyle = (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '11px 16px',
    borderRadius: 8,
    color: 'white',
    textDecoration: 'none',
    marginBottom: 4,
    background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
    fontWeight: active ? 600 : 400,
    transition: 'background 0.2s',
    cursor: 'pointer',
    border: 'none',
    width: '100%',
    fontSize: 14,
    textAlign: 'left',
    boxSizing: 'border-box',
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f2f5' }}>
      <aside
        style={{
          width: 260,
          background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          height: '100vh',
          zIndex: 100,
        }}
        className="sidebar"
      >
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>
            ARCA Informes
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.6 }}>ex AFIP</p>
        </div>

        <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
          {navStructure.map((entry) => {
            // Item simple
            if (entry.type === 'item') {
              const Icon = entry.icon;
              const active = location.pathname === entry.path;
              return (
                <Link
                  key={entry.path}
                  to={entry.path}
                  onClick={() => setSidebarOpen(false)}
                  style={linkBaseStyle(active)}
                >
                  <Icon size={20} />
                  {entry.label}
                </Link>
              );
            }

            // Grupo con submenu
            const GroupIcon = entry.icon;
            const isOpen = !!openGroups[entry.label];
            const hasActiveChild = entry.children.some((c) => c.path === location.pathname);

            return (
              <div key={entry.label} style={{ marginBottom: 2 }}>
                <button
                  onClick={() => toggleGroup(entry.label)}
                  style={{
                    ...linkBaseStyle(hasActiveChild && !isOpen),
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <GroupIcon size={20} />
                    {entry.label}
                  </span>
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {isOpen && (
                  <div style={{ marginLeft: 12, marginTop: 2, marginBottom: 6 }}>
                    {entry.children.map((child) => {
                      const ChildIcon = child.icon;
                      const active = location.pathname === child.path;
                      return (
                        <Link
                          key={child.path}
                          to={child.path}
                          onClick={() => setSidebarOpen(false)}
                          style={{
                            ...linkBaseStyle(active),
                            padding: '9px 16px',
                            fontSize: 13,
                            opacity: active ? 1 : 0.85,
                          }}
                        >
                          <ChildIcon size={17} />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8, paddingLeft: 16 }}>
            {user?.username}
          </div>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              borderRadius: 8,
              background: 'rgba(255,70,70,0.15)',
              color: '#ff6b6b',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              fontSize: 14,
            }}
          >
            <LogOut size={20} />
            Cerrar sesion
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, marginLeft: 260, padding: 32 }}>
        <button
          className="menu-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            display: 'none',
            position: 'fixed',
            top: 16,
            left: 16,
            zIndex: 200,
            background: '#1a1a2e',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: 8,
            cursor: 'pointer',
          }}
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        {children}
      </main>
    </div>
  );
}
