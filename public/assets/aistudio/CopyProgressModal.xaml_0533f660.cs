using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;

namespace RetroBatManager
{
    public partial class CopyProgressModal : Window
    {
        private List<Juego> _juegosACopiar;
        private string _destinoRaiz;
        private CancellationTokenSource _cts;

        private int _totalCopiados = 0;
        private int _totalOmitidos = 0;
        private int _totalErrores = 0;

        private long _bytesTotalesEstimados = 0;
        private long _bytesTransferidosAcumulados = 0;
        private Stopwatch _cronometro = new Stopwatch();

        private DispatcherTimer _timerUI;
        private long _bytesUltimoSegundo = 0;

        public CopyProgressModal(List<Juego> juegos, string destinoRaiz)
        {
            InitializeComponent();
            _juegosACopiar = juegos ?? new List<Juego>();
            _destinoRaiz = destinoRaiz;
            _cts = new CancellationTokenSource();

            Loaded += CopyProgressModal_Loaded;
        }

        private async void CopyProgressModal_Loaded(object sender, RoutedEventArgs e)
        {
            _cronometro.Start();

            _timerUI = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(500) };
            _timerUI.Tick += ActualizarVelocidadYTiempo;
            _timerUI.Start();

            // Calcular peso total estimado
            _bytesTotalesEstimados = _juegosACopiar.Sum(j => j.TamanoBytes);

            txtJuegosConteo.Text = $"Juego 0 de {_juegosACopiar.Count}";
            txtDatosBytes.Text = $"0 B / {Juego.FormatearBytes(_bytesTotalesEstimados)}";

            await Task.Run(() => EjecutarSincronizacion(_cts.Token));

            _cronometro.Stop();
            _timerUI.Stop();

            btnCancelar.Content = "✔️ Cerrar Ventana";
            btnCancelar.Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(16, 185, 129));
            btnCancelar.Foreground = System.Windows.Media.Brushes.White;

            if (_cts.IsCancellationRequested)
            {
                txtEstadoFinal.Text = "Transferencia cancelada por el usuario.";
                txtSubtitulo.Text = "Proceso detenido.";
            }
            else
            {
                txtEstadoFinal.Text = $"Completado en {_cronometro.Elapsed:hh\\:mm\\:ss}. ¡Todos los archivos listos!";
                txtSubtitulo.Text = "Transferencia finalizada con éxito.";
                pbGlobal.Value = 100;
                txtPorcentajeGlobal.Text = "100%";
            }
        }

        private void ActualizarVelocidadYTiempo(object? sender, EventArgs e)
        {
            double segundos = _cronometro.Elapsed.TotalSeconds;
            if (segundos <= 0) return;

            long bytesActuales = Interlocked.Read(ref _bytesTransferidosAcumulados);
            long bytesEnIntervalo = bytesActuales - _bytesUltimoSegundo;
            _bytesUltimoSegundo = bytesActuales;

            // Velocidad por segundo (x2 porque intervalo es 500ms)
            double velocidadBytesSeg = bytesEnIntervalo * 2;
            txtVelocidad.Text = $"{Juego.FormatearBytes((long)velocidadBytesSeg)}/s";

            // Tiempo restante estimado
            long bytesRestantes = _bytesTotalesEstimados - bytesActuales;
            if (velocidadBytesSeg > 0 && bytesRestantes > 0)
            {
                double segRestantes = bytesRestantes / velocidadBytesSeg;
                txtTiempoRestante.Text = TimeSpan.FromSeconds(segRestantes).ToString(@"hh\:mm\:ss");
            }
            else if (bytesRestantes <= 0)
            {
                txtTiempoRestante.Text = "00:00:00";
            }

            // Barra Global y contadores
            if (_bytesTotalesEstimados > 0)
            {
                double pct = Math.Min(100.0, (bytesActuales / (double)_bytesTotalesEstimados) * 100.0);
                pbGlobal.Value = pct;
                txtPorcentajeGlobal.Text = $"{pct:F1}%";
            }

            txtDatosBytes.Text = $"{Juego.FormatearBytes(bytesActuales)} / {Juego.FormatearBytes(_bytesTotalesEstimados)}";
            txtCopiados.Text = _totalCopiados.ToString("N0");
            txtOmitidos.Text = _totalOmitidos.ToString("N0");
            txtErrores.Text = _totalErrores.ToString("N0");
        }

        private void EjecutarSincronizacion(CancellationToken token)
        {
            int idxJuego = 0;
            var sistemasProcesados = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            var extImagenes = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".png", ".jpg", ".jpeg", ".webp", ".bmp" };
            var extVideos = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".mp4", ".mkv", ".avi", ".mov", ".wmv" };
            var extManuales = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".pdf", ".txt", ".cbz", ".cbr" };

            foreach (var j in _juegosACopiar)
            {
                if (token.IsCancellationRequested) break;

                idxJuego++;
                Dispatcher.Invoke(() =>
                {
                    txtJuegosConteo.Text = $"Juego {idxJuego} de {_juegosACopiar.Count}";
                    txtSubtitulo.Text = $"Procesando: [{j.Sistema}] {j.Nombre}";
                });

                string carpSistemaDestino = Path.Combine(_destinoRaiz, j.Sistema);
                if (!Directory.Exists(carpSistemaDestino)) Directory.CreateDirectory(carpSistemaDestino);

                string carpSistemaOrigen = ObtenerCarpetaSistemaOrigen(j);

                // 1. Copiar y sobrescribir gamelist.xml automáticamente
                if (!string.IsNullOrEmpty(carpSistemaOrigen) && !sistemasProcesados.Contains(j.Sistema))
                {
                    CopiarYSobrescribirGamelist(carpSistemaOrigen, carpSistemaDestino);
                    sistemasProcesados.Add(j.Sistema);
                }

                // 2. Copiar Archivo Principal (.m3u, .iso, .pkg, .cue, .chd, etc.)
                if (!string.IsNullOrEmpty(j.RutaCompleta) && File.Exists(j.RutaCompleta))
                {
                    string extPrincipal = Path.GetExtension(j.RutaCompleta).ToLowerInvariant();

                    if (!extImagenes.Contains(extPrincipal) && !extVideos.Contains(extPrincipal))
                    {
                        string destArchivo = Path.Combine(carpSistemaDestino, Path.GetFileName(j.RutaCompleta));
                        CopiarArchivoConProgreso(j.RutaCompleta, destArchivo, token);

                        // Si es .m3u, resolver y copiar las subcarpetas o discos
                        if (extPrincipal == ".m3u")
                        {
                            ProcesarYCopiarContenidoM3U(j.RutaCompleta, carpSistemaOrigen, carpSistemaDestino, token);
                        }
                    }
                }

                // 3. Copiar Carpeta Principal del Juego (ej: "KING OF FIGHTERS XIII...")
                if (j.EsCarpetaOEnlazado && !string.IsNullOrEmpty(j.CarpetaEnlazadaRuta) && Directory.Exists(j.CarpetaEnlazadaRuta))
                {
                    CopiarCarpetaRelativa(j.CarpetaEnlazadaRuta, carpSistemaOrigen, carpSistemaDestino, token);
                }
                else if (!string.IsNullOrEmpty(j.RutaCompleta) && Directory.Exists(j.RutaCompleta))
                {
                    CopiarCarpetaRelativa(j.RutaCompleta, carpSistemaOrigen, carpSistemaDestino, token);
                }

                // 4. Copiar Dependencias y Carpetas de instalación (game\BCES...)
                if (j.Dependencias != null && j.Dependencias.Count > 0)
                {
                    foreach (var dep in j.Dependencias)
                    {
                        if (token.IsCancellationRequested) break;
                        if (string.IsNullOrEmpty(dep.RutaCompleta)) continue;

                        if (Directory.Exists(dep.RutaCompleta))
                        {
                            CopiarCarpetaRelativa(dep.RutaCompleta, carpSistemaOrigen, carpSistemaDestino, token);
                        }
                        else if (File.Exists(dep.RutaCompleta))
                        {
                            string extDep = Path.GetExtension(dep.RutaCompleta).ToLowerInvariant();

                            if (extImagenes.Contains(extDep))
                            {
                                string dirImg = Path.Combine(carpSistemaDestino, "images");
                                if (!Directory.Exists(dirImg)) Directory.CreateDirectory(dirImg);
                                string dest = Path.Combine(dirImg, Path.GetFileName(dep.RutaCompleta));
                                CopiarArchivoConProgreso(dep.RutaCompleta, dest, token);
                            }
                            else if (extVideos.Contains(extDep))
                            {
                                string dirVid = Path.Combine(carpSistemaDestino, "videos");
                                if (!Directory.Exists(dirVid)) Directory.CreateDirectory(dirVid);
                                string dest = Path.Combine(dirVid, Path.GetFileName(dep.RutaCompleta));
                                CopiarArchivoConProgreso(dep.RutaCompleta, dest, token);
                            }
                            else if (extManuales.Contains(extDep))
                            {
                                string dirMan = Path.Combine(carpSistemaDestino, "manuals");
                                if (!Directory.Exists(dirMan)) Directory.CreateDirectory(dirMan);
                                string dest = Path.Combine(dirMan, Path.GetFileName(dep.RutaCompleta));
                                CopiarArchivoConProgreso(dep.RutaCompleta, dest, token);
                            }
                            else
                            {
                                string destDep = Path.Combine(carpSistemaDestino, dep.NombreArchivo);
                                string? dirPadre = Path.GetDirectoryName(destDep);
                                if (!string.IsNullOrEmpty(dirPadre) && !Directory.Exists(dirPadre))
                                {
                                    Directory.CreateDirectory(dirPadre);
                                }
                                CopiarArchivoConProgreso(dep.RutaCompleta, destDep, token);
                            }
                        }
                    }
                }

                // 5. Copiar Multimedia adicional (images, videos, manuals, maps)
                if (!string.IsNullOrEmpty(carpSistemaOrigen) && Directory.Exists(carpSistemaOrigen))
                {
                    CopiarMultimediaRetroBatExclusiva(j, carpSistemaOrigen, carpSistemaDestino, token);
                }
            }
        }

        private void CopiarYSobrescribirGamelist(string carpSistemaOrigen, string carpSistemaDestino)
        {
            try
            {
                string gamelistOrigen = Path.Combine(carpSistemaOrigen, "gamelist.xml");
                if (File.Exists(gamelistOrigen))
                {
                    if (!Directory.Exists(carpSistemaDestino)) Directory.CreateDirectory(carpSistemaDestino);
                    string gamelistDestino = Path.Combine(carpSistemaDestino, "gamelist.xml");

                    File.Copy(gamelistOrigen, gamelistDestino, true);

                    long pesoGamelist = new FileInfo(gamelistOrigen).Length;
                    Interlocked.Add(ref _bytesTransferidosAcumulados, pesoGamelist);
                    Interlocked.Increment(ref _totalCopiados);

                    AgregarLog($"📄 Gamelist sobrescrito y actualizado: {Path.GetFileName(carpSistemaDestino)}\\gamelist.xml");
                }
            }
            catch (Exception ex)
            {
                AgregarLog($"⚠️ No se pudo copiar gamelist.xml: {ex.Message}");
            }
        }

        private string ObtenerCarpetaSistemaOrigen(Juego j)
        {
            if (!string.IsNullOrEmpty(j.RutaCompleta))
            {
                string? dirPadre = Path.GetDirectoryName(j.RutaCompleta);
                if (!string.IsNullOrEmpty(dirPadre))
                {
                    string norm = dirPadre.Replace("/", "\\");
                    int idxSistema = norm.LastIndexOf("\\" + j.Sistema + "\\", StringComparison.OrdinalIgnoreCase);
                    if (idxSistema != -1) return norm.Substring(0, idxSistema + j.Sistema.Length + 1);
                    if (norm.EndsWith("\\" + j.Sistema, StringComparison.OrdinalIgnoreCase)) return norm;
                    return dirPadre;
                }
            }
            return string.Empty;
        }

        private void CopiarCarpetaRelativa(string origenCarpeta, string carpSistemaOrigen, string carpSistemaDestino, CancellationToken token)
        {
            if (!Directory.Exists(origenCarpeta)) return;

            string destinoCarpetaFinal;
            if (!string.IsNullOrEmpty(carpSistemaOrigen) && origenCarpeta.StartsWith(carpSistemaOrigen, StringComparison.OrdinalIgnoreCase))
            {
                string rel = origenCarpeta.Substring(carpSistemaOrigen.Length).TrimStart('\\', '/');
                destinoCarpetaFinal = Path.Combine(carpSistemaDestino, rel);
            }
            else
            {
                string nombreCarpeta = Path.GetFileName(origenCarpeta.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
                destinoCarpetaFinal = Path.Combine(carpSistemaDestino, nombreCarpeta);
            }

            CopiarDirectorioRecursivo(origenCarpeta, destinoCarpetaFinal, token);
        }

        private void CopiarDirectorioRecursivo(string origenDir, string destinoDir, CancellationToken token)
        {
            if (token.IsCancellationRequested) return;

            var dirInfo = new DirectoryInfo(origenDir);
            if (!dirInfo.Exists) return;

            if (!Directory.Exists(destinoDir)) Directory.CreateDirectory(destinoDir);

            foreach (var file in dirInfo.GetFiles())
            {
                if (token.IsCancellationRequested) return;
                string destinoArchivo = Path.Combine(destinoDir, file.Name);
                CopiarArchivoConProgreso(file.FullName, destinoArchivo, token);
            }

            foreach (var subDir in dirInfo.GetDirectories())
            {
                if (token.IsCancellationRequested) return;
                string nuevoDestinoSub = Path.Combine(destinoDir, subDir.Name);
                CopiarDirectorioRecursivo(subDir.FullName, nuevoDestinoSub, token);
            }
        }

        private void ProcesarYCopiarContenidoM3U(string rutaM3u, string carpSistemaOrigen, string carpSistemaDestino, CancellationToken token)
        {
            try
            {
                var lineas = File.ReadAllLines(rutaM3u);
                foreach (var lin in lineas)
                {
                    if (token.IsCancellationRequested) break;
                    string lineaLimpia = lin.Trim();
                    if (string.IsNullOrEmpty(lineaLimpia) || lineaLimpia.StartsWith("#")) continue;

                    lineaLimpia = lineaLimpia.TrimStart('.', '/', '\\');
                    string rutaReferenciada = Path.Combine(carpSistemaOrigen, lineaLimpia);

                    if (Directory.Exists(rutaReferenciada))
                    {
                        CopiarCarpetaRelativa(rutaReferenciada, carpSistemaOrigen, carpSistemaDestino, token);
                    }
                    else if (File.Exists(rutaReferenciada))
                    {
                        string destFile = Path.Combine(carpSistemaDestino, lineaLimpia);
                        string? p = Path.GetDirectoryName(destFile);
                        if (!string.IsNullOrEmpty(p) && !Directory.Exists(p)) Directory.CreateDirectory(p);
                        CopiarArchivoConProgreso(rutaReferenciada, destFile, token);
                    }
                    else
                    {
                        int primerSlash = lineaLimpia.IndexOfAny(new char[] { '/', '\\' });
                        if (primerSlash > 0)
                        {
                            string carpetaRaizJuego = lineaLimpia.Substring(0, primerSlash);
                            string rutaCarpetaRaiz = Path.Combine(carpSistemaOrigen, carpetaRaizJuego);
                            if (Directory.Exists(rutaCarpetaRaiz))
                            {
                                CopiarCarpetaRelativa(rutaCarpetaRaiz, carpSistemaOrigen, carpSistemaDestino, token);
                            }
                        }
                    }
                }
            }
            catch { }
        }

        private void CopiarMultimediaRetroBatExclusiva(Juego j, string carpSistemaOrigen, string carpSistemaDestino, CancellationToken token)
        {
            string nombreArchivoSinExt = !string.IsNullOrEmpty(j.RutaCompleta) ? Path.GetFileNameWithoutExtension(j.RutaCompleta) : j.Nombre;
            string nombreLimpio = j.Nombre ?? "";

            string[] subcarpetas = { "images", "videos", "manuals", "maps" };

            foreach (var sub in subcarpetas)
            {
                if (token.IsCancellationRequested) break;
                string dirOrigenSub = Path.Combine(carpSistemaOrigen, sub);
                if (!Directory.Exists(dirOrigenSub)) continue;

                string dirDestinoSub = Path.Combine(carpSistemaDestino, sub);

                try
                {
                    var archivosMedia = Directory.GetFiles(dirOrigenSub);
                    foreach (var rutaMedia in archivosMedia)
                    {
                        if (token.IsCancellationRequested) break;
                        string nombreFichero = Path.GetFileName(rutaMedia);

                        bool coincide = nombreFichero.StartsWith(nombreArchivoSinExt, StringComparison.OrdinalIgnoreCase) ||
                                        nombreFichero.StartsWith(nombreLimpio, StringComparison.OrdinalIgnoreCase);

                        if (coincide)
                        {
                            if (!Directory.Exists(dirDestinoSub)) Directory.CreateDirectory(dirDestinoSub);
                            string destMedia = Path.Combine(dirDestinoSub, nombreFichero);
                            CopiarArchivoConProgreso(rutaMedia, destMedia, token);
                        }
                    }
                }
                catch { }
            }
        }

        private void CopiarArchivoConProgreso(string origen, string destino, CancellationToken token)
        {
            try
            {
                var fiOrigen = new FileInfo(origen);
                if (!fiOrigen.Exists) return;

                if (File.Exists(destino))
                {
                    var fiDestino = new FileInfo(destino);
                    if (fiDestino.Length == fiOrigen.Length)
                    {
                        Interlocked.Add(ref _bytesTransferidosAcumulados, fiOrigen.Length);
                        Interlocked.Increment(ref _totalOmitidos);
                        AgregarLog($"⏩ Ya existe: {fiOrigen.Name}");
                        return;
                    }
                }

                Dispatcher.Invoke(() => txtArchivoActual.Text = $"Escribiendo: {fiOrigen.Name} ({Juego.FormatearBytes(fiOrigen.Length)})");

                byte[] buffer = new byte[1024 * 1024]; // 1 MB
                using (var fsRead = new FileStream(origen, FileMode.Open, FileAccess.Read, FileShare.Read))
                using (var fsWrite = new FileStream(destino, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    int bytesLeidos;
                    while ((bytesLeidos = fsRead.Read(buffer, 0, buffer.Length)) > 0)
                    {
                        if (token.IsCancellationRequested) break;
                        fsWrite.Write(buffer, 0, bytesLeidos);
                        Interlocked.Add(ref _bytesTransferidosAcumulados, bytesLeidos);
                    }
                }

                Interlocked.Increment(ref _totalCopiados);
                AgregarLog($"✅ Copiado: {fiOrigen.Name}");
            }
            catch (Exception ex)
            {
                Interlocked.Increment(ref _totalErrores);
                AgregarLog($"❌ Error en {Path.GetFileName(origen)}: {ex.Message}");
            }
        }

        private void AgregarLog(string mensaje)
        {
            Dispatcher.InvokeAsync(() =>
            {
                txtLogs.AppendText($"[{DateTime.Now:HH:mm:ss}] {mensaje}\n");
                svLogs.ScrollToEnd();
            });
        }

        // BOTÓN "✖" EN LA ESQUINA SUPERIOR DERECHA
        private void btnCerrarVentanaSuperior_Click(object sender, RoutedEventArgs e)
        {
            CerrarOAbortarTransferencia();
        }

        // BOTÓN INFERIOR (CANCELAR / CERRAR)
        private void btnCancelar_Click(object sender, RoutedEventArgs e)
        {
            string textoBoton = btnCancelar.Content?.ToString() ?? "";

            if (textoBoton.Contains("Cerrar") || _cts.IsCancellationRequested)
            {
                Close();
                return;
            }

            CerrarOAbortarTransferencia();
        }

        private void CerrarOAbortarTransferencia()
        {
            if (!_cronometro.IsRunning)
            {
                Close();
                return;
            }

            if (MessageBox.Show("¿Deseas detener la transferencia de archivos en curso y cerrar la ventana?",
                                "Cancelar Transferencia", MessageBoxButton.YesNo, MessageBoxImage.Question) == MessageBoxResult.Yes)
            {
                _cts.Cancel();
                txtEstadoFinal.Text = "Transferencia cancelada por el usuario.";
                txtSubtitulo.Text = "Proceso detenido.";

                btnCancelar.IsEnabled = true;
                btnCancelar.Content = "✔️ Cerrar Ventana";
                btnCancelar.Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(30, 41, 59));
                btnCancelar.Foreground = System.Windows.Media.Brushes.White;

                Close();
            }
        }
    }
}