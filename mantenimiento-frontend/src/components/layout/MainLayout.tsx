import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="min-h-screen bg-dashboard text-continental-black/90 print:bg-white">
      <div className="print:hidden">
        <Header onToggleSidebar={toggleSidebar} />
      </div>
      <div className="print:hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="bg-dashboard pt-[7rem] transition-all duration-300 min-h-[calc(100vh-7rem)] print:pt-0 print:min-h-0 print:bg-white">
        <div
          className={cn(
            'px-4 pb-12 pt-6 md:px-7 lg:px-10 transition-all duration-300 print:p-0 print:block',
            sidebarOpen ? 'lg:pl-72' : 'lg:pl-8'
          )}
        >
          <div className="dashboard-wrapper max-w-[1280px] print:max-w-none print:w-full">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
