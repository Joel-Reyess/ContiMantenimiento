import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { pathname } = useLocation();

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  // GEN-06: el menú se retrae al cambiar de sección (también si se navega desde otra parte, p. ej. Configuración)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setSidebarOpen(false);
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-dashboard text-continental-black/90 print:bg-white">
      <div className="print:hidden">
        <Header onToggleSidebar={toggleSidebar} />
      </div>
      <div className="print:hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* El menú flota sobre el contenido; un clic fuera lo cierra */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 top-[7rem] z-30 bg-black/50 lg:bg-black/20 print:hidden"
          onClick={() => setSidebarOpen(false)}
          data-testid="menu-fondo"
        />
      )}

      {/* Main Content */}
      <main className="bg-dashboard pt-[7rem] transition-all duration-300 min-h-[calc(100vh-7rem)] print:pt-0 print:min-h-0 print:bg-white">
        {/* El contenido siempre ocupa todo el ancho: el menú ya no lo empuja */}
        <div className="px-4 pb-12 pt-6 md:px-7 lg:px-10 lg:pl-8 transition-all duration-300 print:p-0 print:block">
          <div className="dashboard-wrapper max-w-[1280px] print:max-w-none print:w-full">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
