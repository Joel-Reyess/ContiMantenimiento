import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, Truck, AlertTriangle, Wrench, Users, DollarSign, Settings, FileText, Package, X, ClipboardList, CheckSquare } from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-6 w-6" />, roles: ['SuperUsuario', 'Administrador', 'Supervisor', 'Lider'] },
  { label: 'Zona de Transición', href: '/recepcion', icon: <ClipboardList className="h-6 w-6" />, roles: ['SuperUsuario', 'Administrador', 'Supervisor'] },
  { label: 'Entrega y Conformidad', href: '/entregas', icon: <CheckSquare className="h-6 w-6" />, roles: ['SuperUsuario', 'Administrador', 'Supervisor', 'Lider'] },
  { label: 'Órdenes de Trabajo', href: '/ordenes', icon: <Wrench className="h-6 w-6" />, roles: ['SuperUsuario', 'Administrador', 'Supervisor', 'Tecnico'] },
  { label: 'Inventario y Materiales', href: '/materiales', icon: <Package className="h-6 w-6" />, roles: ['SuperUsuario', 'Administrador', 'Supervisor'] },
  { label: 'Archivo Técnico (Planos)', href: '/archivo', icon: <FileText className="h-6 w-6" />, roles: ['SuperUsuario', 'Administrador', 'Supervisor'] },
  { label: 'Control de Pagos', href: '/pagos', icon: <DollarSign className="h-6 w-6" />, roles: ['SuperUsuario', 'Administrador'] },
  { label: 'Flota de Contenedores', href: '/vehiculos', icon: <Truck className="h-6 w-6" />, roles: ['SuperUsuario', 'Administrador', 'Supervisor'] },
  { label: 'Reportes de Falla', href: '/reportes', icon: <AlertTriangle className="h-6 w-6" />, roles: ['SuperUsuario', 'Administrador', 'Supervisor', 'Tecnico', 'Operador', 'Lider'] },
  { label: 'Mis Órdenes', href: '/mis-ordenes', icon: <FileText className="h-6 w-6" />, roles: ['Tecnico'] },
  { label: 'Validación y Aprobaciones', href: '/aprobaciones', icon: <CheckSquare className="h-6 w-6" />, roles: ['SuperUsuario', 'Administrador', 'Supervisor'] },
  { label: 'Gestión de Usuarios', href: '/usuarios', icon: <Users className="h-6 w-6" />, roles: ['SuperUsuario', 'Administrador'] },
  { label: 'Configuración de Sistema', href: '/configuracion', icon: <Settings className="h-6 w-6" />, roles: ['SuperUsuario', 'Administrador'] },
  { label: 'Fallas Visuales', href: '/fallas-imagen', icon: <AlertTriangle className="h-6 w-6" />, roles: ['SuperUsuario', 'Administrador'] },
  { label: 'Configuración de Prefijos', href: '/gestion-prefijos', icon: <Settings className="h-6 w-6" />, roles: ['SuperUsuario', 'Administrador'] }
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { hasRole } = useAuth();

  const filteredNavItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return hasRole(item.roles);
  });

  return (
    <aside
      className={cn(
        'fixed left-0 top-[7rem] z-40 h-[calc(100vh-7rem)] w-72 bg-white/97 backdrop-blur-xl border-r border-continental-gray-3 shadow-[0_20px_45px_rgba(15,23,42,0.18)] transition-transform duration-300 ease-in-out',
        isOpen ? 'translate-x-0 lg:translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="flex items-center justify-between px-6 pt-7 pb-5 border-b border-continental-gray-3 bg-white/95">
        <span className="text-base font-bold tracking-wide text-continental-black">Navegación</span>
        <button
          onClick={onClose}
          className="inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-continental-black/20 bg-continental-black/5 text-continental-black shadow-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-continental-yellow/80 hover:bg-continental-yellow/90 hover:text-continental-black"
          aria-label="Cerrar menú"
        >
          <X className="h-7 w-7" strokeWidth={3} />
        </button>
      </div>
      <nav className="flex flex-col gap-2 px-4 pb-6 pt-4">
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-semibold transition-all duration-200 shadow-sm',
                isActive
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
