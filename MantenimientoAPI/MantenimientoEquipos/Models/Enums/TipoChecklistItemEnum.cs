namespace MantenimientoEquipos.Models.Enums;

/// <summary>
/// Tipos de elementos en un checklist dinámico
/// </summary>
public enum TipoChecklistItemEnum
{
    SiNo = 1,           // Respuesta Sí/No
    Texto = 2,          // Campo de texto libre
    Numerico = 3,       // Valor numérico
    Seleccion = 4,      // Selección de opciones predefinidas
    Foto = 5            // Requiere evidencia fotográfica
}
