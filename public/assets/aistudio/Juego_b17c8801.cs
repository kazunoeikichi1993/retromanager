using System;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;

namespace RetroBatManager
{
    public class DependenciaItem
    {
        public string Tipo { get; set; } = "DISC";
        public string NombreArchivo { get; set; } = string.Empty;
        public string RutaCompleta { get; set; } = string.Empty;
        public long TamanoBytes { get; set; } = 0;
        public string TamanoFormateado => Juego.FormatearBytes(TamanoBytes);

        // Color del badge según el tipo
        public string TipoColor => Tipo switch
        {
            "DISC" => "#A855F7",    // Púrpura para discos
            "TRACK" => "#8B5CF6",   // Violeta para pistas
            "IMAGE" => "#38BDF8",   // Celeste para carátula
            "THUMB" => "#0284C7",   // Azul para miniatura
            "MARQUEE" => "#F59E0B", // Ámbar para marquee/wheel
            "FANART" => "#EC4899",  // Rosa para fondo
            "VIDEO" => "#10B981",   // Verde para video preview
            "MANUAL" => "#E11D48",  // Rojo para manuales PDF
            _ => "#64748B"
        };
    }

    public class Juego
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string CleanTitle { get; set; } = string.Empty;
        public string Ruta { get; set; } = string.Empty;
        public string RutaCompleta { get; set; } = string.Empty;
        public string Sistema { get; set; } = string.Empty;
        public string Extension { get; set; } = string.Empty;
        public long TamanoBytes { get; set; } = 0;
        public string Region { get; set; } = "Global";
        public string Genero { get; set; } = "Varios";
        public string Desarrollador { get; set; } = "Desconocido";
        public string Anio { get; set; } = "";
        public string Descripcion { get; set; } = "";
        public string Imagen { get; set; } = "";
        public string Video { get; set; } = "";
        public string Jugadores { get; set; } = "1 Jugador";
        public bool EsVerificado { get; set; } = true;

        public string RutaImage { get; set; } = "";
        public string RutaThumb { get; set; } = "";
        public string RutaMarquee { get; set; } = "";
        public string RutaFanart { get; set; } = "";

        public bool EsCarpetaOEnlazado { get; set; } = false;
        public string? CarpetaEnlazadaRuta { get; set; }

        public ObservableCollection<DependenciaItem> Dependencias { get; set; } = new ObservableCollection<DependenciaItem>();

        public bool EsDuplicado { get; set; } = false;
        public string RolDuplicado { get; set; } = "original";
        public string GrupoDuplicadoId { get; set; } = string.Empty;

        public bool EsRecomendado => RolDuplicado == "original";
        public bool EsM3uReal => Extension.Equals(".m3u", StringComparison.OrdinalIgnoreCase);

        public string BadgeMultidisco
        {
            get
            {
                if (EsM3uReal) return "M3U MULTIDISCO";
                if (Extension.Equals(".game", StringComparison.OrdinalIgnoreCase)) return ".GAME (CARPETA)";
                if (Sistema.Equals("switch", StringComparison.OrdinalIgnoreCase) && Dependencias.Count > 0) return $"{Extension.ToUpperInvariant()} + DLC/UPD";
                if (EsCarpetaOEnlazado) return "CARPETA VINCULADA";
                return Extension.ToUpperInvariant();
            }
        }

        public string BadgeColor
        {
            get
            {
                if (EsM3uReal) return "#A855F7";
                if (Extension.Equals(".game", StringComparison.OrdinalIgnoreCase)) return "#0284C7";
                if (Sistema.Equals("switch", StringComparison.OrdinalIgnoreCase) && Dependencias.Count > 0) return "#E11D48";
                if (EsCarpetaOEnlazado) return "#0D9488";
                return "#38BDF8";
            }
        }

        public int TotalDependencias => Dependencias.Count;
        public bool EsSeleccionado { get; set; } = false;
        public string TamanoFormateado => FormatearBytes(TamanoBytes);

        public string TamanoTextoEditable
        {
            get => TamanoFormateado;
            set => TamanoBytes = ParsearTamano(value);
        }

        // Predeterminado: THUMB (Carátula Principal)
        public static string TipoArteGlobal = "THUMB";
        public static double TamanoVisualPx = 80;

        public double TamanoVisualActual => TamanoVisualPx;

        public string RutaArteActivo
        {
            get
            {
                string rutaOriginal = "";
                if (TipoArteGlobal == "THUMB") rutaOriginal = ObtenerRutaThumb();
                else if (TipoArteGlobal == "MARQUEE") rutaOriginal = ObtenerRutaMarquee();
                else rutaOriginal = ObtenerRutaCaratula();

                return ObtenerOCrearCacheLocal(rutaOriginal);
            }
        }

        // MOTOR DE CACHÉ LOCAL EN DISCO PARA REDES COMPARTIDAS
        private string ObtenerOCrearCacheLocal(string rutaOrigen)
        {
            if (string.IsNullOrEmpty(rutaOrigen) || !File.Exists(rutaOrigen)) return "";
            try
            {
                string dirCache = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Cache", "Thumbs", Sistema);
                if (!Directory.Exists(dirCache)) Directory.CreateDirectory(dirCache);

                string safeName = Math.Abs(rutaOrigen.GetHashCode()).ToString("X") + "_" + Path.GetFileName(rutaOrigen);
                // Sanitizar caracteres inválidos para el sistema de archivos
                foreach (char c in Path.GetInvalidFileNameChars()) safeName = safeName.Replace(c, '_');

                string rutaCache = Path.Combine(dirCache, safeName);
                if (!File.Exists(rutaCache))
                {
                    File.Copy(rutaOrigen, rutaCache, true);
                }
                return rutaCache;
            }
            catch
            {
                return rutaOrigen; // Si falla la copia, usar la ruta directa
            }
        }

        public string ObtenerRutaThumb()
        {
            if (!string.IsNullOrEmpty(RutaThumb) && File.Exists(RutaThumb)) return RutaThumb;
            var dep = Dependencias.FirstOrDefault(d => d.Tipo == "THUMB");
            if (dep != null && File.Exists(dep.RutaCompleta)) return dep.RutaCompleta;
            return ObtenerRutaCaratula();
        }

        public string ObtenerRutaCaratula()
        {
            if (!string.IsNullOrEmpty(RutaImage) && File.Exists(RutaImage)) return RutaImage;
            var dep = Dependencias.FirstOrDefault(d => d.Tipo == "IMAGE");
            if (dep != null && File.Exists(dep.RutaCompleta)) return dep.RutaCompleta;
            return File.Exists(Imagen) ? Imagen : "";
        }

        public string ObtenerRutaMarquee()
        {
            if (!string.IsNullOrEmpty(RutaMarquee) && File.Exists(RutaMarquee)) return RutaMarquee;
            var dep = Dependencias.FirstOrDefault(d => d.Tipo == "MARQUEE");
            if (dep != null && File.Exists(dep.RutaCompleta)) return dep.RutaCompleta;
            return "";
        }

        public string ObtenerRutaFanart()
        {
            if (!string.IsNullOrEmpty(RutaFanart) && File.Exists(RutaFanart)) return RutaFanart;
            var dep = Dependencias.FirstOrDefault(d => d.Tipo == "FANART");
            if (dep != null && File.Exists(dep.RutaCompleta)) return dep.RutaCompleta;
            return "";
        }

        public static long ParsearTamano(string input)
        {
            if (string.IsNullOrWhiteSpace(input)) return 0;
            input = input.Trim().ToUpperInvariant();
            try
            {
                if (input.EndsWith("GB") || input.EndsWith("G"))
                {
                    string num = input.Replace("GB", "").Replace("G", "").Trim().Replace(",", ".");
                    return (long)(double.Parse(num, System.Globalization.CultureInfo.InvariantCulture) * 1024 * 1024 * 1024);
                }
                if (input.EndsWith("MB") || input.EndsWith("M"))
                {
                    string num = input.Replace("MB", "").Replace("M", "").Trim().Replace(",", ".");
                    return (long)(double.Parse(num, System.Globalization.CultureInfo.InvariantCulture) * 1024 * 1024);
                }
                if (input.EndsWith("KB") || input.EndsWith("K"))
                {
                    string num = input.Replace("KB", "").Replace("K", "").Trim().Replace(",", ".");
                    return (long)(double.Parse(num, System.Globalization.CultureInfo.InvariantCulture) * 1024);
                }
                if (long.TryParse(input.Replace("B", "").Trim(), out long bytes)) return bytes;
            }
            catch { }
            return 0;
        }

        public void RecalcularTamanoTotal()
        {
            long total = 0;
            if (File.Exists(RutaCompleta)) total += new FileInfo(RutaCompleta).Length;
            else if (Directory.Exists(RutaCompleta)) total += ScannerEngine.CalcularTamanoCarpeta(RutaCompleta);

            if (!string.IsNullOrEmpty(CarpetaEnlazadaRuta) && Directory.Exists(CarpetaEnlazadaRuta))
                total += ScannerEngine.CalcularTamanoCarpeta(CarpetaEnlazadaRuta);

            foreach (var dep in Dependencias)
            {
                if (File.Exists(dep.RutaCompleta))
                {
                    dep.TamanoBytes = new FileInfo(dep.RutaCompleta).Length;
                    total += dep.TamanoBytes;
                }
                else if (Directory.Exists(dep.RutaCompleta))
                {
                    dep.TamanoBytes = ScannerEngine.CalcularTamanoCarpeta(dep.RutaCompleta);
                    total += dep.TamanoBytes;
                }
                else total += dep.TamanoBytes;
            }
            TamanoBytes = total;
        }

        public static string FormatearBytes(long bytes)
        {
            if (bytes <= 0) return "0 B";
            string[] sufijos = { "B", "KB", "MB", "GB", "TB" };
            int i = 0;
            double dbl = bytes;
            while (dbl >= 1024 && i < sufijos.Length - 1)
            {
                dbl /= 1024;
                i++;
            }
            return $"{dbl:0.##} {sufijos[i]}";
        }
    }
}