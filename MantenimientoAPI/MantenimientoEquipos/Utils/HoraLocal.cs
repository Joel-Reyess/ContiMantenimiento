using System.Text.Json;
using System.Text.Json.Serialization;

namespace MantenimientoEquipos.Utils;

/// <summary>
/// Zona horaria de la operación (GEN-07, Reporte 7). La base guarda las fechas en UTC (DateTime.UtcNow) y SQL Server
/// las devuelve sin zona; antes la API las mandaba sin "Z" y el navegador las tomaba como hora local: se veían
/// 6 horas adelantadas. Ahora la API las manda en UTC con "Z" (el navegador las muestra en la hora de quien consulta)
/// y lo que arma el servidor (Excel/CSV) se pasa a la hora de la operación: appsettings "ZonaHoraria"
/// (por defecto America/Mexico_City, UTC−6 sin horario de verano).
/// </summary>
public static class HoraLocal
{
    private static TimeZoneInfo _zona = Buscar(null);

    public static void Configurar(string? id) => _zona = Buscar(id);

    public static TimeZoneInfo Zona => _zona;

    private static TimeZoneInfo Buscar(string? id)
    {
        foreach (var candidato in new[] { id, "America/Mexico_City", "Central Standard Time (Mexico)" })
        {
            if (string.IsNullOrWhiteSpace(candidato)) continue;
            try { return TimeZoneInfo.FindSystemTimeZoneById(candidato); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        return TimeZoneInfo.CreateCustomTimeZone("UTC-6", TimeSpan.FromHours(-6), "UTC-6", "UTC-6");
    }

    /// <summary>
    /// Fecha que es solo día (medianoche sin zona: fecha de adquisición, próximo mantenimiento…): no se mueve.
    /// Las marcas de tiempo se guardan con DateTime.UtcNow y nunca caen exactamente en medianoche.
    /// </summary>
    public static bool EsSoloFecha(DateTime d) => d.Kind == DateTimeKind.Unspecified && d.TimeOfDay == TimeSpan.Zero;

    /// <summary>Hora de la operación para una fecha guardada en UTC</summary>
    public static DateTime DeUtc(DateTime d)
    {
        if (EsSoloFecha(d)) return d;
        if (d.Kind == DateTimeKind.Local) d = d.ToUniversalTime();
        return TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(d, DateTimeKind.Utc), _zona);
    }

    /// <summary>Ahora, en la hora de la operación</summary>
    public static DateTime Ahora => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, _zona);
}

/// <summary>Escribe las fechas en UTC con "Z" y lee las que traen zona convirtiéndolas a UTC (ver <see cref="HoraLocal"/>)</summary>
public class FechaUtcJsonConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var d = reader.GetDateTime();
        return d.Kind == DateTimeKind.Local ? d.ToUniversalTime() : d;
    }

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
    {
        if (HoraLocal.EsSoloFecha(value))
        {
            writer.WriteStringValue(value.ToString("yyyy-MM-dd'T'HH:mm:ss"));
            return;
        }
        var utc = value.Kind switch
        {
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
        writer.WriteStringValue(utc.ToString("yyyy-MM-dd'T'HH:mm:ss.fffffff'Z'"));
    }
}
