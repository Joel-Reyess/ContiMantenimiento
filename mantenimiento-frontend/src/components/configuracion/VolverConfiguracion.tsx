import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Regreso a la cuadrícula de Configuración del sistema, para los módulos que ahora se abren
 * desde ahí (Usuarios, Fallas visuales, Archivo técnico, Prefijos, Líderes). Solo lo ven quienes
 * pueden entrar a Configuración; un supervisor que abre Archivo técnico desde el menú no.
 */
export function VolverConfiguracion() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  if (!hasRole(['SuperUsuario', 'Administrador'])) return null;

  return (
    <div>
      {/* whitespace-normal: en celular el texto completo no cabe en un renglón y empujaba la página de lado */}
      <Button
        variant="ghost"
        onClick={() => navigate('/configuracion')}
        className="flex items-center gap-2 whitespace-normal text-left"
        style={{ maxWidth: '100%' }}
      >
        <ArrowLeft className="h-4 w-4 flex-shrink-0" />
        Volver a Configuración del sistema
      </Button>
    </div>
  );
}
