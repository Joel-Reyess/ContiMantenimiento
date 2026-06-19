import { useCallback, useEffect, useState } from 'react';
import { asignacionesService } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import { TipoVehiculoNombres } from '@/interfaces/Api.interface';

type AnyVehiculo = { tipo?: number | string; tipoVehiculo?: number | string; tipoId?: number | string };
type AnyTipoNombre = { vehiculoTipo?: string; tipoNombre?: string; tipo?: string | number };

const resolveTipoId = (vehiculo: AnyVehiculo) => {
  const raw = vehiculo.tipo ?? vehiculo.tipoVehiculo ?? vehiculo.tipoId;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
};

const normalize = (value?: string) =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const resolveTipoNombre = (item: AnyTipoNombre) => {
  if (item.vehiculoTipo) return String(item.vehiculoTipo);
  if (item.tipoNombre) return String(item.tipoNombre);
  if (typeof item.tipo === 'string') return item.tipo;
  return '';
};

export function useAllowedTipoVehiculo() {
  const { user, hasRole } = useAuth();
  const [allowedTipoIds, setAllowedTipoIds] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setAllowedTipoIds(null);
        return;
      }

      const scoped = hasRole(['Lider', 'Supervisor']) && !hasRole(['SuperUsuario', 'Administrador']);
      if (!scoped) {
        setAllowedTipoIds(null);
        return;
      }

      setLoading(true);
      try {
        const res = await asignacionesService.getByUsuario(user.id);
        if (res.success && res.data) {
          const ids = res.data.map((a) => Number(a.tipoVehiculo)).filter((id) => !Number.isNaN(id));
          setAllowedTipoIds(ids.length > 0 ? ids : null);
        } else {
          setAllowedTipoIds(null);
        }
      } catch {
        setAllowedTipoIds(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, hasRole]);

  const filterVehiculos = useCallback(
    <T extends AnyVehiculo>(items: T[]) => {
      if (!allowedTipoIds || allowedTipoIds.length === 0) return items;
      return items.filter((item) => {
        const tipoId = resolveTipoId(item);
        return tipoId !== null && allowedTipoIds.includes(tipoId);
      });
    },
    [allowedTipoIds]
  );

  const filterByTipoNombre = useCallback(
    <T extends AnyTipoNombre>(items: T[]) => {
      if (!allowedTipoIds || allowedTipoIds.length === 0) return items;
      const allowedNames = new Set(
        allowedTipoIds
          .map((id) => normalize(TipoVehiculoNombres[id] || String(id)))
          .filter((name) => name.length > 0)
      );
      return items.filter((item) => {
        const nombre = normalize(resolveTipoNombre(item));
        if (!nombre) return false;
        return allowedNames.has(nombre);
      });
    },
    [allowedTipoIds]
  );

  return { allowedTipoIds, filterVehiculos, filterByTipoNombre, loading };
}
