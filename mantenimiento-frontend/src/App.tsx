import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout';
import { Login, ProtectedRoute } from '@/components/auth';
import { Dashboard } from '@/pages/Dashboard';
import { ReportesPage } from '@/pages/Reportes';
import { OrdenesPage } from '@/pages/Ordenes';
import { VehiculosPage } from '@/pages/Vehiculos';
import { VehiculoDetallePage } from '@/pages/VehiculoDetalle';
import { RefaccionesPage } from '@/pages/Refacciones';
import { InventarioPage } from '@/pages/Inventario';
import { MaterialesUnificadoPage } from '@/pages/MaterialesUnificado';
import { RecepcionPage } from '@/pages/Recepcion';
import { ArchivoPage } from '@/pages/Archivo';
import { AprobacionesPage } from '@/pages/Aprobaciones';
import { EntregasPage } from '@/pages/Entregas';
import { PagosPage } from '@/pages/Pagos';
import { OrdenesCompraPage } from '@/pages/OrdenesCompra';
import { UsuariosPage } from '@/pages/Usuarios';
import { ConfiguracionPage } from '@/pages/Configuracion';
import { NotificacionesPage } from '@/pages/Notificaciones';
import { PerfilPage } from '@/pages/Perfil';
import { AccessDenied } from '@/pages/AccessDenied';
import { NotFound } from '@/pages/NotFound';
import { GestionVehiculosPrefijosPage } from '@/pages/GestionVehiculosPrefijos';
import { GestionAsignacionLideresPage } from '@/pages/GestionAsignacionLideres';
import { FallasImagenPage } from '@/pages/FallasImagen';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rutas publicas */}
          <Route path="/login" element={<Login />} />

          {/* Rutas protegidas */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />

            {/* Vehiculos */}
            <Route
              path="vehiculos"
              element={
                <ProtectedRoute allowedRoles={['SuperUsuario', 'Administrador', 'Supervisor']}>
                  <VehiculosPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="vehiculos/:id"
              element={
                <ProtectedRoute allowedRoles={['SuperUsuario', 'Administrador', 'Supervisor']}>
                  <VehiculoDetallePage />
                </ProtectedRoute>
              }
            />

            {/* Reportes de Falla */}
            <Route
              path="reportes"
              element={
                <ProtectedRoute allowedRoles={['SuperUsuario', 'Administrador', 'Supervisor', 'Tecnico', 'Lider']}>
                  <ReportesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="reportes/:id"
              element={
                <ProtectedRoute allowedRoles={['SuperUsuario', 'Administrador', 'Supervisor', 'Tecnico', 'Lider']}>
                  <ReportesPage />
                </ProtectedRoute>
              }
            />

            {/* Ordenes de Trabajo */}
            <Route
              path="ordenes"
              element={
                <ProtectedRoute allowedRoles={['SuperUsuario', 'Administrador', 'Supervisor', 'Tecnico']}>
                  <OrdenesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="ordenes/:id"
              element={
                <ProtectedRoute allowedRoles={['SuperUsuario', 'Administrador', 'Supervisor', 'Tecnico']}>
                  <OrdenesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="mis-ordenes"
              element={
                <ProtectedRoute allowedRoles={['Tecnico']}>
                  <OrdenesPage />
                </ProtectedRoute>
              }
            />

            {/* Refacciones */}
            <Route
              path="refacciones"
              element={
                <ProtectedRoute allowedRoles={['SuperUsuario', 'Administrador', 'Supervisor']}>
                  <RefaccionesPage />
                </ProtectedRoute>
              }
            />

            {/* Recepcion (solo admin/supervisor) */}
            <Route
              path="recepcion"
              element={
                <ProtectedRoute allowedRoles={['SuperUsuario', 'Administrador', 'Supervisor']}>
                  <RecepcionPage />
                </ProtectedRoute>
              }
            />

            {/* Aprobaciones */}
            <Route
              path="aprobaciones"
              element={
                <ProtectedRoute allowedRoles={['SuperUsuario', 'Administrador', 'Supervisor']}>
                  <AprobacionesPage />
                </ProtectedRoute>
              }
            />

            {/* Entregas / firma (admin/supervisor/lider) */}
            <Route
              path="entregas"
              element={
                <ProtectedRoute allowedRoles={['SuperUsuario', 'Administrador', 'Supervisor', 'Lider']}>
                  <EntregasPage />
                </ProtectedRoute>
              }
            />

            {/* Inventario de consumibles */}
            <Route
              path="inventario"
              element={
                <ProtectedRoute allowedRoles={['SuperUsuario', 'Administrador', 'Supervisor']}>
                  <InventarioPage soloConsumibles />
                </ProtectedRoute>
              }
            />
            <Route
              path="refacciones-stock"
              element={
                <ProtectedRoute allowedRoles={['SuperUsuario', 'Administrador', 'Supervisor']}>
                  <InventarioPage modoRefacciones />
                </ProtectedRoute>
              }
            />

            {/* Materiales Unificado (refacciones + consumibles) */}
            <Route
              path="materiales"
              element={
                <ProtectedRoute allowedRoles={['SuperUsuario', 'Administrador', 'Supervisor', 'Tecnico']}>
                  <MaterialesUnificadoPage />
                </ProtectedRoute>
              }
            />

            {/* Archivo de planos/documentos */}
            <Route
              path="archivo"
              element={
                <ProtectedRoute allowedRoles={['SuperUsuario', 'Administrador', 'Supervisor']}>
                  <ArchivoPage />
                </ProtectedRoute>
              }
            />

            {/* Pagos */}
            <Route
              path="pagos"
              element={
                <ProtectedRoute allowedRoles={['SuperUsuario', 'Administrador']}>
                  <PagosPage />
                </ProtectedRoute>
              }
            />

            {/* Ordenes de Compra */}
            <Route
              path="ordenes-compra"
              element={
                <ProtectedRoute allowedRoles={['SuperUsuario', 'Administrador', 'Supervisor']}>
                  <OrdenesCompraPage />
                </ProtectedRoute>
              }
            />

            {/* Usuarios */}
            <Route
              path="usuarios"
              element={
                <ProtectedRoute allowedRoles={['SuperUsuario', 'Administrador']}>
                  <UsuariosPage />
                </ProtectedRoute>
              }
            />

            {/* Configuracion */}
            <Route
              path="configuracion"
              element={
                <ProtectedRoute allowedRoles={['SuperUsuario', 'Administrador']}>
                  <ConfiguracionPage />
                </ProtectedRoute>
              }
            />

            {/* Gestion de Prefijos */}
            <Route
              path="gestion-prefijos"
              element={
                <ProtectedRoute allowedRoles={['SuperUsuario', 'Administrador']}>
                  <GestionVehiculosPrefijosPage />
                </ProtectedRoute>
              }
            />

            {/* Configuración de Fallas por Imagen */}
            <Route
              path="fallas-imagen"
              element={
                <ProtectedRoute allowedRoles={['SuperUsuario', 'Administrador']}>
                  <FallasImagenPage />
                </ProtectedRoute>
              }
            />

            {/* Gestion de Asignacion de Lideres */}
            <Route
              path="asignacion-lideres"
              element={
                <ProtectedRoute allowedRoles={['SuperUsuario', 'Administrador']}>
                  <GestionAsignacionLideresPage />
                </ProtectedRoute>
              }
            />

            {/* Notificaciones */}
            <Route path="notificaciones" element={<NotificacionesPage />} />

            {/* Perfil */}
            <Route path="perfil" element={<PerfilPage />} />
          </Route>

          {/* Paginas de error */}
          <Route path="/acceso-denegado" element={<AccessDenied />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
