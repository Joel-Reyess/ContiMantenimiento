import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('es-MX').format(num);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export const getFullImageUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  
  // Intentamos obtener la base URL del backend desde el entorno.
  let apiUrl = import.meta.env.VITE_API_URL;
  
  if (!apiUrl) {
    const origin = window.location.origin;
    if (origin.includes(':5173')) {
      // Por defecto el backend corre en el puerto 5110 (anteriormente 5000)
      apiUrl = origin.replace(':5173', ':5110');
    } else {
      apiUrl = origin;
    }
  }

  // Obtenemos la base (quitando /api o /api/)
  const baseUrl = apiUrl.replace(/\/api\/?$/, '');
  
  // Aseguramos que la URL del archivo comience con /
  const normalizedPath = url.startsWith('/') ? url : `/${url}`;
  
  return `${baseUrl}${normalizedPath}`;
};
