export interface User {
  id: number;
  nombreCompleto: string;
  username: string;
  email?: string;
  numeroEmpleado?: string;
  telefono?: string;
  rolId: number;
  rolNombre?: string;
  roles?: string[];
  areaId?: number;
  areaNombre?: string;
  tipoTecnico?: string;
  empresaExterna?: string;
  tarifaHora?: number;
  especialidades?: string;
  activo: boolean;
  ultimoInicioSesion?: string;
  fechaCreacion: string;
}

export interface UserList {
  id: number;
  nombreCompleto: string;
  username: string;
  numeroEmpleado?: string;
  rolNombre?: string;
  areaNombre?: string;
  activo: boolean;
  ultimoInicioSesion?: string;
}

export interface UserCreateRequest {
  nombreCompleto: string;
  username: string;
  password: string;
  email?: string;
  numeroEmpleado?: string;
  telefono?: string;
  rolId: number;
  areaId?: number;
  tipoTecnico?: string;
  empresaExterna?: string;
  tarifaHora?: number;
  especialidades?: string;
}

export interface UserUpdateRequest {
  nombreCompleto?: string;
  email?: string;
  telefono?: string;
  rolId?: number;
  areaId?: number;
  password?: string;
  tipoTecnico?: string;
  empresaExterna?: string;
  tarifaHora?: number;
  especialidades?: string;
  activo?: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiration: string;
  usuario: User;
}

export interface RegisterRequest {
  nombreCompleto: string;
  username: string;
  password: string;
  email?: string;
  numeroEmpleado?: string;
  telefono?: string;
  areaId?: number;
  rolId: number;
}

export interface ChangePasswordRequest {
  passwordActual: string;
  nuevaPassword: string;
  confirmarPassword: string;
}

export interface Rol {
  id: number;
  nombre: string;
  descripcion?: string;
  activo: boolean;
}

export interface Tecnico {
  id: number;
  nombreCompleto: string;
  numeroEmpleado?: string;
  telefono?: string;
  tipoTecnico?: string;
  empresaExterna?: string;
  tarifaHora?: number;
  especialidades?: string;
  ordenesActivas: number;
  ordenesCompletadas: number;
}
