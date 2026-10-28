using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace RetroBatManager
{
    public static class ScannerEngine
    {
        public static List<Juego> EscanearSistema(string carpetaSistema, string nombreSistema)
        {
            var lista = new List<Juego>();
            string archivoXml = Path.Combine(carpetaSistema, "gamelist.xml");

            string sysLower = nombreSistema.ToLowerInvariant();
            bool esWindows = sysLower == "windows" || sysLower == "pc";
            bool esXbox360 = sysLower == "xbox360" || sysLower == "xbox" || sysLower == "x360";
            bool esPs3Ps4 = sysLower == "ps3" || sysLower == "ps4" || sysLower == "ps3_iso";
            bool esSwitch = sysLower == "switch";

            var todosLosArchivos = Directory.Exists(carpetaSistema) ? Directory.GetFiles(carpetaSistema) : Array.Empty<string>();
            var todasLasCarpetas = Directory.Exists(carpetaSistema) ? Directory.GetDirectories(carpetaSistema) : Array.Empty<string>();

            var archivosReales = todosLosArchivos.ToDictionary(f => Path.GetFileName(f).ToLowerInvariant(), f => f);
            var carpetasReales = todasLasCarpetas.ToDictionary(d => Path.GetFileName(d).ToLowerInvariant(), d => d);

            var procesadosFisicos = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var archivosOmitirPorDependencia = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            // PASO 1: Analizar .m3u para asociar discos
            var diccM3uDeps = new Dictionary<string, List<DependenciaItem>>(StringComparer.OrdinalIgnoreCase);
            foreach (var m3u in todosLosArchivos.Where(f => Path.GetExtension(f).Equals(".m3u", StringComparison.OrdinalIgnoreCase)))
            {
                var deps = new List<DependenciaItem>();
                try
                {
                    foreach (var linea in File.ReadAllLines(m3u))
                    {
                        var lin = linea.Trim();
                        if (string.IsNullOrWhiteSpace(lin) || lin.StartsWith("#")) continue;

                        string rel = lin.Replace("/", "\\").TrimStart('\\');
                        string completa = Path.Combine(carpetaSistema, rel);

                        if (!File.Exists(completa))
                        {
                            string dirRel = Path.GetDirectoryName(completa) ?? carpetaSistema;
                            string nameRel = Path.GetFileName(completa);
                            if (Directory.Exists(dirRel))
                            {
                                var match = Directory.GetFiles(dirRel).FirstOrDefault(f => Path.GetFileName(f).Equals(nameRel, StringComparison.OrdinalIgnoreCase));
                                if (match != null) completa = match;
                            }
                        }

                        if (File.Exists(completa))
                        {
                            var fi = new FileInfo(completa);
                            deps.Add(new DependenciaItem
                            {
                                Tipo = "M3U_FILE",
                                NombreArchivo = Path.GetFileName(completa),
                                RutaCompleta = completa,
                                TamanoBytes = fi.Length
                            });
                            archivosOmitirPorDependencia.Add(completa);
                            archivosOmitirPorDependencia.Add(Path.GetFileName(completa).ToLowerInvariant());
                        }
                    }
                }
                catch { }
                diccM3uDeps[m3u] = deps;
            }

            // PASO 2: Procesar gamelist.xml
            if (File.Exists(archivoXml))
            {
                try
                {
                    var doc = XDocument.Load(archivoXml);
                    foreach (var g in doc.Descendants("game"))
                    {
                        if (g.Element("hidden")?.Value == "true") continue;

                        string? rutaRelativa = g.Element("path")?.Value;
                        if (string.IsNullOrEmpty(rutaRelativa)) continue;

                        string nombreArchivo = rutaRelativa.Replace("./", "").Replace("/", "\\").Trim();
                        string extPath = Path.GetExtension(nombreArchivo).ToLowerInvariant();

                        if (esXbox360 && extPath == ".xex") continue;
                        if (esWindows && extPath != ".game" && extPath != ".m3u") continue;
                        if (esPs3Ps4 && (extPath == ".bin" || extPath == ".sfo" || extPath == ".edat")) continue;

                        string nombreLower = Path.GetFileName(nombreArchivo).ToLowerInvariant();
                        string rutaFisicaFinal = string.Empty;
                        long tamano = 0;
                        bool esCarpeta = false;
                        string? carpetaEnlazada = null;
                        var dependencias = new List<DependenciaItem>();

                        if (archivosReales.TryGetValue(nombreLower, out var archExacto))
                        {
                            rutaFisicaFinal = archExacto;
                            tamano = new FileInfo(archExacto).Length;
                        }
                        else if (carpetasReales.TryGetValue(nombreLower, out var dirExacto))
                        {
                            rutaFisicaFinal = dirExacto;
                            esCarpeta = true;
                            tamano = CalcularTamanoCarpeta(dirExacto);
                        }
                        else
                        {
                            string baseLower = Path.GetFileNameWithoutExtension(nombreArchivo).ToLowerInvariant();
                            var match = archivosReales.Values.FirstOrDefault(f => Path.GetFileNameWithoutExtension(f).ToLowerInvariant() == baseLower);
                            if (match != null)
                            {
                                rutaFisicaFinal = match;
                                nombreArchivo = Path.GetFileName(match);
                                tamano = new FileInfo(match).Length;
                            }
                            else
                            {
                                string rutaDirecta = Path.Combine(carpetaSistema, nombreArchivo);
                                if (File.Exists(rutaDirecta))
                                {
                                    rutaFisicaFinal = rutaDirecta;
                                    tamano = new FileInfo(rutaDirecta).Length;
                                }
                                else continue;
                            }
                        }

                        if (archivosOmitirPorDependencia.Contains(rutaFisicaFinal) || archivosOmitirPorDependencia.Contains(Path.GetFileName(rutaFisicaFinal).ToLowerInvariant()))
                        {
                            procesadosFisicos.Add(rutaFisicaFinal);
                            continue;
                        }

                        if (Path.GetExtension(rutaFisicaFinal).Equals(".m3u", StringComparison.OrdinalIgnoreCase) &&
                            diccM3uDeps.TryGetValue(rutaFisicaFinal, out var m3uItems))
                        {
                            dependencias.AddRange(m3uItems);
                            tamano += m3uItems.Sum(d => d.TamanoBytes);
                        }

                        // EXTRAER MULTIMEDIA (Imágenes, Videos, Manuales)
                        ExtraerMultimediaDelXml(g, carpetaSistema, dependencias);

                        // CASO WINDOWS: .game
                        if (esWindows)
                        {
                            string ext = Path.GetExtension(rutaFisicaFinal).ToLowerInvariant();
                            if (ext == ".game" && File.Exists(rutaFisicaFinal))
                            {
                                try
                                {
                                    string contenido = File.ReadAllText(rutaFisicaFinal).Trim();
                                    string[] partes = contenido.Split(new[] { '\\', '/' }, StringSplitOptions.RemoveEmptyEntries);
                                    if (partes.Length > 0)
                                    {
                                        string carpetaNombre = partes[0].ToLowerInvariant();
                                        if (carpetasReales.TryGetValue(carpetaNombre, out var carpFisica))
                                        {
                                            esCarpeta = true;
                                            carpetaEnlazada = carpFisica;
                                            long carpBytes = CalcularTamanoCarpeta(carpFisica);
                                            dependencias.Add(new DependenciaItem
                                            {
                                                Tipo = "WIN_FOLDER",
                                                NombreArchivo = Path.GetFileName(carpFisica),
                                                RutaCompleta = carpFisica,
                                                TamanoBytes = carpBytes
                                            });
                                            procesadosFisicos.Add(carpFisica);
                                        }
                                    }
                                }
                                catch { }
                            }
                        }

                        // CASO SWITCH: DLCs y Updates
                        if (esSwitch)
                        {
                            string nombreBaseSwitch = Path.GetFileNameWithoutExtension(rutaFisicaFinal).ToLowerInvariant();
                            var matchId = Regex.Match(nombreBaseSwitch, @"\[([0-9a-fA-F]{16})\]");
                            string titleId = matchId.Success ? matchId.Groups[1].Value.ToLowerInvariant() : "";

                            var todosArchivosSwitch = Directory.GetFiles(carpetaSistema, "*", SearchOption.AllDirectories);
                            foreach (var extraFile in todosArchivosSwitch)
                            {
                                if (extraFile.Equals(rutaFisicaFinal, StringComparison.OrdinalIgnoreCase)) continue;
                                string extraLower = Path.GetFileName(extraFile).ToLowerInvariant();

                                bool esDlc = extraLower.Contains("[dlc]") || extraLower.Contains("[v");
                                bool coincideId = !string.IsNullOrEmpty(titleId) && extraLower.Contains(titleId.Substring(0, 13));

                                if (coincideId || (extraLower.StartsWith(nombreBaseSwitch) && esDlc))
                                {
                                    long extraBytes = new FileInfo(extraFile).Length;
                                    dependencias.Add(new DependenciaItem
                                    {
                                        Tipo = extraLower.Contains("[dlc]") ? "SWITCH_DLC" : "SWITCH_UPDATE",
                                        NombreArchivo = Path.GetFileName(extraFile),
                                        RutaCompleta = extraFile,
                                        TamanoBytes = extraBytes
                                    });
                                    procesadosFisicos.Add(extraFile);
                                }
                            }
                        }

                        // SUMAR EL PESO DE TODAS LAS DEPENDENCIAS (Multimedia, Videos, DLCs, Manuales)
                        tamano += dependencias.Sum(d => d.TamanoBytes);
                        procesadosFisicos.Add(rutaFisicaFinal);

                        string rawRegion = g.Element("region")?.Value ?? ExtraerRegionDeNombre(nombreArchivo);
                        string nombreJuego = g.Element("name")?.Value ?? Path.GetFileNameWithoutExtension(nombreArchivo);

                        lista.Add(new Juego
                        {
                            Nombre = nombreJuego,
                            CleanTitle = LimpiarTitulo(nombreJuego),
                            Ruta = "./" + Path.GetFileName(rutaFisicaFinal),
                            RutaCompleta = rutaFisicaFinal,
                            Sistema = nombreSistema,
                            Extension = Path.GetExtension(rutaFisicaFinal).ToLowerInvariant(),
                            TamanoBytes = tamano,
                            Region = NormalizarRegion(rawRegion),
                            Genero = g.Element("genre")?.Value ?? "Varios",
                            Desarrollador = g.Element("developer")?.Value ?? "Desconocido",
                            Anio = ExtraerAnio(g.Element("releasedate")?.Value),
                            Descripcion = g.Element("desc")?.Value ?? "Sin descripción registrada.",
                            Imagen = g.Element("image")?.Value ?? "",
                            Video = g.Element("video")?.Value ?? "",
                            Jugadores = g.Element("players")?.Value != null ? $"{g.Element("players")?.Value} Jugador(es)" : "1 Jugador",
                            EsCarpetaOEnlazado = esCarpeta,
                            CarpetaEnlazadaRuta = carpetaEnlazada,
                            Dependencias = new ObservableCollection<DependenciaItem>(dependencias)
                        });
                    }
                }
                catch { }
            }

            // PASO 3: Archivos físicos restantes
            foreach (var archivo in archivosReales.Values)
            {
                if (procesadosFisicos.Contains(archivo) || archivosOmitirPorDependencia.Contains(archivo)) continue;

                string ext = Path.GetExtension(archivo).ToLowerInvariant();
                if (ext == ".xml" || ext == ".txt" || ext == ".db" || ext == ".log") continue;

                if (esXbox360 && ext == ".xex") continue;
                if (esWindows && ext != ".game" && ext != ".m3u") continue;
                if (esPs3Ps4 && (ext == ".bin" || ext == ".sfo" || ext == ".edat")) continue;

                string nombreArchivo = Path.GetFileName(archivo);
                string nombreBase = Path.GetFileNameWithoutExtension(archivo);
                long tamano = new FileInfo(archivo).Length;
                var dependencias = new List<DependenciaItem>();

                if (ext == ".m3u" && diccM3uDeps.TryGetValue(archivo, out var m3uItems))
                {
                    dependencias.AddRange(m3uItems);
                }

                BuscarMultimediaAutomatica(carpetaSistema, nombreBase, dependencias);
                tamano += dependencias.Sum(d => d.TamanoBytes);

                lista.Add(new Juego
                {
                    Nombre = nombreBase,
                    CleanTitle = LimpiarTitulo(nombreBase),
                    Ruta = "./" + nombreArchivo,
                    RutaCompleta = archivo,
                    Sistema = nombreSistema,
                    Extension = ext,
                    TamanoBytes = tamano,
                    Region = NormalizarRegion(ExtraerRegionDeNombre(nombreArchivo)),
                    Genero = "Varios",
                    Desarrollador = "Desconocido",
                    Anio = "",
                    Descripcion = "Juego detectado directamente desde el almacenamiento físico.",
                    Dependencias = new ObservableCollection<DependenciaItem>(dependencias)
                });
            }

            return lista;
        }

        private static void ExtraerMultimediaDelXml(XElement g, string carpetaSistema, List<DependenciaItem> deps)
        {
            var tags = new (string Tag, string Tipo)[]
            {
                ("image", "IMAGE"),
                ("thumbnail", "THUMB"),
                ("video", "VIDEO"),
                ("manual", "MANUAL"),
                ("marquee", "MARQUEE"),
                ("fanart", "FANART"),
                ("bezel", "BEZEL"),
                ("boxback", "BOXBACK"),
                ("titleshot", "TITLESHOT"),
                ("cartridge", "CARTRIDGE")
            };

            foreach (var (tag, tipo) in tags)
            {
                string? rel = g.Element(tag)?.Value;
                if (!string.IsNullOrEmpty(rel))
                {
                    string rutaLimpia = rel.Replace("./", "").Replace("/", "\\").TrimStart('\\');
                    string rutaCompleta = Path.Combine(carpetaSistema, rutaLimpia);

                    if (!File.Exists(rutaCompleta))
                    {
                        string dir = Path.GetDirectoryName(rutaCompleta) ?? carpetaSistema;
                        string fileName = Path.GetFileName(rutaCompleta);
                        if (Directory.Exists(dir))
                        {
                            var match = Directory.GetFiles(dir).FirstOrDefault(f => Path.GetFileName(f).Equals(fileName, StringComparison.OrdinalIgnoreCase));
                            if (match != null) rutaCompleta = match;
                        }
                    }

                    if (File.Exists(rutaCompleta))
                    {
                        if (!deps.Any(d => d.RutaCompleta.Equals(rutaCompleta, StringComparison.OrdinalIgnoreCase)))
                        {
                            deps.Add(new DependenciaItem
                            {
                                Tipo = tipo,
                                NombreArchivo = Path.GetFileName(rutaCompleta),
                                RutaCompleta = rutaCompleta,
                                TamanoBytes = new FileInfo(rutaCompleta).Length
                            });
                        }
                    }
                }
            }
        }

        private static void BuscarMultimediaAutomatica(string carpetaSistema, string baseName, List<DependenciaItem> deps)
        {
            var carpetasMedia = new (string Carpeta, string Tipo)[]
            {
                ("images", "IMAGE"),
                ("videos", "VIDEO"),
                ("manuals", "MANUAL"),
                ("marquees", "MARQUEE"),
                ("fanart", "FANART")
            };

            foreach (var (subDir, tipo) in carpetasMedia)
            {
                string pathSubDir = Path.Combine(carpetaSistema, subDir);
                if (Directory.Exists(pathSubDir))
                {
                    var matches = Directory.GetFiles(pathSubDir)
                        .Where(f => Path.GetFileNameWithoutExtension(f).StartsWith(baseName, StringComparison.OrdinalIgnoreCase));

                    foreach (var m in matches)
                    {
                        if (!deps.Any(d => d.RutaCompleta.Equals(m, StringComparison.OrdinalIgnoreCase)))
                        {
                            deps.Add(new DependenciaItem
                            {
                                Tipo = tipo,
                                NombreArchivo = Path.GetFileName(m),
                                RutaCompleta = m,
                                TamanoBytes = new FileInfo(m).Length
                            });
                        }
                    }
                }
            }
        }

        public static List<Juego> ProcesarDuplicados1G1R(List<Juego> juegos, string regionPreferida = "ES")
        {
            var grupos = juegos.GroupBy(j => $"{j.Sistema}:::{j.CleanTitle.ToLowerInvariant()}");
            foreach (var grp in grupos)
            {
                if (grp.Count() > 1)
                {
                    var mejor = grp.OrderByDescending(j => (j.Extension == ".m3u" ? 2000 : 0) + EvaluarPuntaje1G1R(j, regionPreferida)).First();
                    foreach (var j in grp)
                    {
                        j.EsDuplicado = true;
                        j.GrupoDuplicadoId = grp.Key;
                        j.RolDuplicado = (j == mejor) ? "original" : "descarte";
                    }
                }
                else
                {
                    var unico = grp.First();
                    unico.EsDuplicado = false;
                    unico.RolDuplicado = "original";
                }
            }
            return juegos;
        }

        private static int EvaluarPuntaje1G1R(Juego j, string regPref)
        {
            int score = 0;
            string reg = j.Region.ToUpperInvariant();
            if (reg.Contains("ESPAÑA") || reg.Contains("ES")) score += (regPref == "ES" ? 1000 : 500);
            if (reg.Contains("EUROPA") || reg.Contains("EU")) score += 400;
            if (reg.Contains("USA") || reg.Contains("US")) score += 300;
            if (reg.Contains("MUNDIAL") || reg.Contains("WORLD")) score += 200;

            if (j.Extension == ".chd" || j.Extension == ".zcci" || j.Extension == ".cxi" || j.Extension == ".rvz") score += 80;
            if (j.Extension == ".m3u") score += 120;
            if (j.Extension == ".iso") score += 40;
            return score;
        }

        public static string LimpiarTitulo(string titulo)
        {
            if (string.IsNullOrWhiteSpace(titulo)) return "";
            string limpio = Regex.Replace(titulo, @"\s*\([^)]*\)", "");
            limpio = Regex.Replace(limpio, @"\s*\[[^\]]*\]", "");
            return limpio.Trim();
        }

        public static string ExtraerRegionDeNombre(string archivo)
        {
            if (archivo.Contains("(Europe)") || archivo.Contains("(Spain)") || archivo.Contains("(ES)")) return "Spain";
            if (archivo.Contains("(USA)") || archivo.Contains("(US)")) return "USA";
            if (archivo.Contains("(Japan)") || archivo.Contains("(JA)")) return "Japan";
            if (archivo.Contains("(World)")) return "World";
            return "Global";
        }

        public static string NormalizarRegion(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return "Global";
            switch (raw.ToLowerInvariant().Trim())
            {
                case "es": case "spain": return "Spain";
                case "eu": case "europe": return "Europe";
                case "us": case "usa": return "USA";
                case "jp": case "japan": return "Japan";
                case "world": case "wr": return "World";
                default: return raw;
            }
        }

        private static string ExtraerAnio(string? releaseDate)
        {
            if (!string.IsNullOrEmpty(releaseDate) && releaseDate.Length >= 4) return releaseDate.Substring(0, 4);
            return "";
        }

        public static long CalcularTamanoCarpeta(string carpeta)
        {
            try
            {
                var dir = new DirectoryInfo(carpeta);
                return dir.EnumerateFiles("*", SearchOption.AllDirectories).Sum(f => f.Length);
            }
            catch { return 0; }
        }
        // Búsqueda de imágenes y videos ÚNICAMENTE por nombre exacto de ROM
        public static void VincularMultimediaEstricta(Juego juego, string carpetaSistema, ref long pesoAcumulado)
        {
            if (string.IsNullOrEmpty(juego.RutaCompleta)) return;

            string romNameSinExt = Path.GetFileNameWithoutExtension(juego.RutaCompleta);
            string dirImages = Path.Combine(carpetaSistema, "images");
            string dirVideos = Path.Combine(carpetaSistema, "videos");
            string dirManuals = Path.Combine(carpetaSistema, "manuals");

            string[] extImgs = { ".png", ".jpg", ".jpeg", ".webp" };
            string[] extVids = { ".mp4", ".mkv", ".avi" };
            string[] extMans = { ".pdf", ".txt", ".cbz" };

            // 1. Carátula (-image o nombre exacto)
            foreach (var ext in extImgs)
            {
                string p1 = Path.Combine(dirImages, $"{romNameSinExt}-image{ext}");
                string p2 = Path.Combine(dirImages, $"{romNameSinExt}{ext}");
                string rutaEncontrada = File.Exists(p1) ? p1 : (File.Exists(p2) ? p2 : "");

                if (!string.IsNullOrEmpty(rutaEncontrada))
                {
                    juego.RutaImage = rutaEncontrada;
                    long bytes = new FileInfo(rutaEncontrada).Length;
                    pesoAcumulado += bytes;

                    juego.Dependencias.Add(new DependenciaItem
                    {
                        NombreArchivo = Path.GetFileName(rutaEncontrada),
                        RutaCompleta = rutaEncontrada,
                        TamanoBytes = bytes,
                        Tipo = "IMAGE"
                    });
                    break;
                }
            }

            // 2. Thumbnail (-thumb)
            foreach (var ext in extImgs)
            {
                string p = Path.Combine(dirImages, $"{romNameSinExt}-thumb{ext}");
                if (File.Exists(p))
                {
                    juego.RutaThumb = p;
                    long bytes = new FileInfo(p).Length;
                    pesoAcumulado += bytes;

                    juego.Dependencias.Add(new DependenciaItem
                    {
                        NombreArchivo = Path.GetFileName(p),
                        RutaCompleta = p,
                        TamanoBytes = bytes,
                        Tipo = "THUMB"
                    });
                    break;
                }
            }

            // 3. Marquee / Wheel (-marquee)
            foreach (var ext in extImgs)
            {
                string p = Path.Combine(dirImages, $"{romNameSinExt}-marquee{ext}");
                if (File.Exists(p))
                {
                    juego.RutaMarquee = p;
                    long bytes = new FileInfo(p).Length;
                    pesoAcumulado += bytes;

                    juego.Dependencias.Add(new DependenciaItem
                    {
                        NombreArchivo = Path.GetFileName(p),
                        RutaCompleta = p,
                        TamanoBytes = bytes,
                        Tipo = "MARQUEE"
                    });
                    break;
                }
            }

            // 4. Fanart / Fondo (-fanart)
            foreach (var ext in extImgs)
            {
                string p = Path.Combine(dirImages, $"{romNameSinExt}-fanart{ext}");
                if (File.Exists(p))
                {
                    juego.RutaFanart = p;
                    long bytes = new FileInfo(p).Length;
                    pesoAcumulado += bytes;

                    juego.Dependencias.Add(new DependenciaItem
                    {
                        NombreArchivo = Path.GetFileName(p),
                        RutaCompleta = p,
                        TamanoBytes = bytes,
                        Tipo = "FANART"
                    });
                    break;
                }
            }

            // 5. Video (-video o nombre exacto)
            foreach (var ext in extVids)
            {
                string p1 = Path.Combine(dirVideos, $"{romNameSinExt}-video{ext}");
                string p2 = Path.Combine(dirVideos, $"{romNameSinExt}{ext}");
                string rutaEncontrada = File.Exists(p1) ? p1 : (File.Exists(p2) ? p2 : "");

                if (!string.IsNullOrEmpty(rutaEncontrada))
                {
                    juego.Video = rutaEncontrada;
                    long bytes = new FileInfo(rutaEncontrada).Length;
                    pesoAcumulado += bytes;

                    juego.Dependencias.Add(new DependenciaItem
                    {
                        NombreArchivo = Path.GetFileName(rutaEncontrada),
                        RutaCompleta = rutaEncontrada,
                        TamanoBytes = bytes,
                        Tipo = "VIDEO"
                    });
                    break;
                }
            }

            // 6. Manuales (-manual o nombre exacto)
            if (Directory.Exists(dirManuals))
            {
                foreach (var ext in extMans)
                {
                    string p1 = Path.Combine(dirManuals, $"{romNameSinExt}-manual{ext}");
                    string p2 = Path.Combine(dirManuals, $"{romNameSinExt}{ext}");
                    string rutaEncontrada = File.Exists(p1) ? p1 : (File.Exists(p2) ? p2 : "");

                    if (!string.IsNullOrEmpty(rutaEncontrada))
                    {
                        long bytes = new FileInfo(rutaEncontrada).Length;
                        pesoAcumulado += bytes;

                        juego.Dependencias.Add(new DependenciaItem
                        {
                            NombreArchivo = Path.GetFileName(rutaEncontrada),
                            RutaCompleta = rutaEncontrada,
                            TamanoBytes = bytes,
                            Tipo = "MANUAL"
                        });
                        break;
                    }
                }
            }
        }
        public static void ResolverDependenciasJuego(Juego juego, string carpetaSistema)
        {
            if (juego.Dependencias == null)
                juego.Dependencias = new System.Collections.ObjectModel.ObservableCollection<DependenciaItem>();

            juego.Dependencias.Clear();

            long pesoAcumulado = 0;

            // 1. Archivo físico principal (.m3u, .chd, .iso, .cue, etc.)
            if (!string.IsNullOrEmpty(juego.RutaCompleta) && File.Exists(juego.RutaCompleta))
            {
                var fiPrincipal = new FileInfo(juego.RutaCompleta);
                pesoAcumulado += fiPrincipal.Length;

                // Si es .m3u: SOLO leer las líneas del archivo .m3u
                if (fiPrincipal.Extension.Equals(".m3u", StringComparison.OrdinalIgnoreCase))
                {
                    try
                    {
                        var lineas = File.ReadAllLines(juego.RutaCompleta);
                        foreach (var lin in lineas)
                        {
                            string l = lin.Trim();
                            if (string.IsNullOrEmpty(l) || l.StartsWith("#")) continue;

                            l = l.TrimStart('.', '/', '\\');
                            string rutaDisco = Path.Combine(carpetaSistema, l);

                            if (File.Exists(rutaDisco))
                            {
                                var fiDisco = new FileInfo(rutaDisco);
                                pesoAcumulado += fiDisco.Length;

                                juego.Dependencias.Add(new DependenciaItem
                                {
                                    NombreArchivo = fiDisco.Name,
                                    RutaCompleta = fiDisco.FullName,
                                    TamanoBytes = fiDisco.Length,
                                    Tipo = "DISC"
                                });
                            }
                        }
                    }
                    catch { }
                }
                // Si es .cue: SOLO leer los archivos .bin que declara el .cue
                else if (fiPrincipal.Extension.Equals(".cue", StringComparison.OrdinalIgnoreCase))
                {
                    try
                    {
                        var lineas = File.ReadAllLines(juego.RutaCompleta);
                        foreach (var lin in lineas)
                        {
                            if (lin.TrimStart().StartsWith("FILE", StringComparison.OrdinalIgnoreCase))
                            {
                                int p1 = lin.IndexOf('"');
                                int p2 = lin.LastIndexOf('"');
                                if (p1 != -1 && p2 > p1)
                                {
                                    string binName = lin.Substring(p1 + 1, p2 - p1 - 1);
                                    string rutaBin = Path.Combine(Path.GetDirectoryName(juego.RutaCompleta)!, binName);
                                    if (File.Exists(rutaBin))
                                    {
                                        var fiBin = new FileInfo(rutaBin);
                                        pesoAcumulado += fiBin.Length;

                                        juego.Dependencias.Add(new DependenciaItem
                                        {
                                            NombreArchivo = fiBin.Name,
                                            RutaCompleta = fiBin.FullName,
                                            TamanoBytes = fiBin.Length,
                                            Tipo = "TRACK"
                                        });
                                    }
                                }
                            }
                        }
                    }
                    catch { }
                }
            }
            // 2. Si el juego es una carpeta (ej: PS3, Windows, Wii U)
            else if (!string.IsNullOrEmpty(juego.RutaCompleta) && Directory.Exists(juego.RutaCompleta))
            {
                var di = new DirectoryInfo(juego.RutaCompleta);
                foreach (var f in di.GetFiles("*", SearchOption.AllDirectories))
                {
                    pesoAcumulado += f.Length;
                }
            }

            // 3. Vincular Multimedia EXACTA por nombre de ROM (y añadir a la lista de dependencias)
            VincularMultimediaEstricta(juego, carpetaSistema, ref pesoAcumulado);

            juego.TamanoBytes = pesoAcumulado;
        }

    }
}