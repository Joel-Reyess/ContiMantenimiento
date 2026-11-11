import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, Truck, AlertTriangle, Wrench, DollarSign, Settings, FileText, Package, ClipboardList, CheckSquare, Building2 } from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
  /** Roles que no lo ven en el menú porque lo abren desde Configuración del sistema */
  ocultarPara?: string[];
  /** Otras rutas en las que esta opción se marca como activa */
  incluye?: string[];
}

// Módulos que se abren desde Configuración del sistema (requerimiento de navegación)
const RUTAS_DE_CONFIGURACION = ['/usuarios', '/fallas-imagen', '/gestion-prefijos', '/archivo', '/asignacion-lideres', '/empresas-proveedoras'];

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-6 w-6" />, roles: ['SuperUsuario', 'Administrador', 'Supervisor', 'Lider', 'Operador'] },
  { label: 'Zona de Transición', href: '/recepcion', icon: <ClipboardList className="h-6 w-6" />, roles: ['SuperUsuario', 'Administrador', 'Supervisor', 'Tecnico', 'Lider', 'Operador'] },
  { label: 'Órdenes de Trabajo', href: '/ordenes', icon: <Wrench className="h-6 w-6" />, roles: ['SuperUsuario', 'Administrador', 'Supervisor', 'Tecnico', 'Lider', 'Operador'] },
  { label: 'Inventario y Materiales', href: '/materiales', icon: <Package className="h-6 w-6" />, roles: ['SuperUsuario', 'Administrador', 'Supervisor', 'Tecnico'] },
  { label: 'Archivo Técnico (Planos)', href: '/archivo', icon: <FileText className="h-6 w-6" />, roles: ['Supervisor', 'Tecnico'], ocultarPara: ['SuperUsuario', 'Administrador'] },
  { label: 'Control de Pagos', href: '/pagos', icon: <DollarSign className="h-6 w-6" />, roles: ['SuperUsuario', 'Administrador', 'Supervisor'] },
  { label: 'Empresas Proveedoras', href: '/empresas-proveedoras', icon: <Building2 className="h-6 w-6" />, roles: ['Supervisor'], ocultarPara: ['SuperUsuario', 'Administrador'] },
  { label: 'Flota de Contenedores', href: '/vehiculos', icon: <Truck className="h-6 w-6" />, roles: ['SuperUsuario', 'Administrador', 'Supervisor', 'Lider'] },
  { label: 'Reportes de Falla', href: '/reportes', icon: <AlertTriangle className="h-6 w-6" />, roles: ['SuperUsuario', 'Administrador', 'Supervisor', 'Tecnico', 'Operador', 'Lider'] },
  { label: 'Mis Órdenes', href: '/mis-ordenes', icon: <FileText className="h-6 w-6" />, roles: ['Tecnico'] },
  { label: 'Validación y Aprobaciones', href: '/aprobaciones', icon: <CheckSquare className="h-6 w-6" />, roles: ['SuperUsuario', 'Administrador', 'Supervisor', 'Lider'] },
  { label: 'Configuración del Sistema', href: '/configuracion', icon: <Settings className="h-6 w-6" />, roles: ['SuperUsuario', 'Administrador'], incluye: RUTAS_DE_CONFIGURACION }
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { hasRole } = useAuth();
  const { pathname } = useLocation();

  const filteredNavItems = navItems.filter((item) => {
    if (item.ocultarPara && hasRole(item.ocultarPara)) return false;
    if (!item.roles) return true;
    return hasRole(item.roles);
  });

  const enRuta = (rutas?: string[]) => !!rutas?.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  return (
    <aside
      aria-hidden={!isOpen}
      className={cn(
        'fixed left-0 top-[7rem] z-40 h-[calc(100vh-7rem)] w-72 bg-white/97 backdrop-blur-xl border-r border-continental-gray-3 shadow-[0_20px_45px_rgba(15,23,42,0.18)] transition-transform duration-300 ease-in-out',
        isOpen ? 'translate-x-0 lg:translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Sin botón de cerrar: el menú se cierra solo al elegir una sección o con el botón de menú del encabezado (GEN-06) */}
      <div className="px-6 pt-7 pb-5 border-b border-continental-gray-3 bg-white/95">
        <span className="text-base font-bold tracking-wide text-continental-black">Navegación</span>
      </div>
      <nav className="flex flex-col gap-2 px-4 pb-6 pt-4">
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-semibold transition-all duration-200 shadow-sm',
                isActive || enRuta(item.incluye)
                  ? 'bg-continental-yellow/90 text-continental-black shadow-lg shadow-continental-yellow/35'
                  : 'text-continental-gray-1 hover:bg-continental-gray-4/70 hover:text-continental-black'
              )
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
