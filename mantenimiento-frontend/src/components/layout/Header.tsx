import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui';
import { Bell, Menu, LogOut, User, ChevronDown } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import continentalLogo from '@/assets/continental_real.png';
import { notificacionesService } from '@/services/notificacionesService';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await notificacionesService.getResumen();
        if (response.data) {
          setUnreadCount(response.data.totalNoLeidas);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    fetchNotifications();
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-continental-gradient shadow-[0_20px_45px_rgba(0,0,0,0.25)]">
      <div className="mx-auto flex min-h-[6.5rem] max-w-[1920px] items-center justify-between px-5 py-4 md:px-10 text-white">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="!h-12 !w-12 rounded-full border border-white/30 bg-white/10 text-white hover:bg-white/20"
            aria-label="Abrir o cerrar menú"
          >
            <Menu className="h-6 w-6" />
          </Button>

          <Link to="/dashboard" className="flex items-center gap-3 text-white">
            <img
              src={continentalLogo}
              alt="Continental"
              className="h-10 w-auto brightness-0 invert drop-shadow"
            />
            <div className="hidden sm:block border-l border-white/40 pl-4 bg-white/10 rounded-lg px-4 py-3 drop-shadow">
              <p className="text-xs uppercase tracking-[0.3em] text-white/85 drop-shadow mb-1">
                Continental
              </p>
              <p className="text-lg font-semibold leading-tight drop-shadow mb-1">
                Sistema de Mantenimiento
              </p>
              <span className="text-sm text-white/85 drop-shadow">
                Portal Administrativo y Operativo
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/notificaciones">
            <Button
              variant="ghost"
              size="icon"
              className="relative !h-11 !w-11 rounded-full border border-continental-gray-3 bg-white text-continental-black shadow-md hover:bg-continental-gray-4"
            >
              <Bell className="h-6 w-6 text-continental-black" strokeWidth={2.6} color="black" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-continental-red text-xs font-semibold text-white">
                  {unreadCount}
                </span>
              )}
            </Button>
          </Link>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 rounded-full bg-white/15 px-3 py-2 text-left text-white backdrop-blur-md transition hover:bg-white/25"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/25 text-lg font-bold">
                {user ? getInitials(user.nombreCompleto) : 'U'}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-semibold">{user?.nombreCompleto}</p>
                <p className="text-xs text-white/70">{user?.rolNombre}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-white/70" />
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 z-50 mt-3 w-56 rounded-xl border border-white/40 bg-white/95 p-3 text-continental-black shadow-2xl backdrop-blur">
                  <Link
                    to="/perfil"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-continental-black hover:bg-continental-gray-4"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <User className="h-4 w-4" />
                    Mi Perfil
                  </Link>
                  <button
                    className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-continental-gray-4"
                    onClick={() => {
                      setShowUserMenu(false);
                      handleLogout();
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar Sesion
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Logout visible en mobile: solo icono */}
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="sm:hidden min-h-[3.25rem] min-w-[3.25rem] rounded-full border-2 border-white/80 bg-white/15 px-4 py-3 text-white transition hover:bg-white hover:text-continental-yellow inline-flex items-center justify-center shadow-md"
            aria-label="Cerrar sesion"
          >
            <LogOut className="h-6 w-6 text-white" strokeWidth={2.6} />
          </Button>

          <Button
            variant="ghost"
            onClick={handleLogout}
            className="hidden sm:inline-flex !h-11 items-center gap-2 rounded-full border-2 border-white/80 bg-transparent px-5 text-sm font-semibold text-white transition hover:bg-white hover:text-continental-yellow"
          >
            <LogOut className="h-4 w-4" />
            Cerrar Sesion
          </Button>
        </div>
      </div>
    </header>
  );
}
