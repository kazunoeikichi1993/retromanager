using System;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Imaging;

namespace RetroBatManager
{
    public partial class GameDetailModal : Window
    {
        public Juego JuegoActual { get; set; }

        public GameDetailModal(Juego juego)
        {
            InitializeComponent();
            JuegoActual = juego;
            DataContext = JuegoActual;

            // 1. Asegurar que las dependencias incluyan todas las imágenes, videos y manuales existentes
            CargarArchivosExistentesEnLista();

            Loaded += GameDetailModal_Loaded;
        }

        private void GameDetailModal_Loaded(object sender, RoutedEventArgs e)
        {
            RefrescarListaDependencias();
        }

        /// <summary>
        /// Escanea e integra en la lista visual todas las imágenes, videos y manuales existentes de este juego
        /// </summary>
        private void CargarArchivosExistentesEnLista()
        {
            if (JuegoActual == null) return;
            if (JuegoActual.Dependencias == null)
                JuegoActual.Dependencias = new System.Collections.ObjectModel.ObservableCollection<DependenciaItem>();

            string carpetaSistema = "";
            if (!string.IsNullOrEmpty(JuegoActual.RutaCompleta))
            {
                string? dir = System.IO.Path.GetDirectoryName(JuegoActual.RutaCompleta);
                if (dir != null) carpetaSistema = dir;
            }

            string romName = !string.IsNullOrEmpty(JuegoActual.RutaCompleta)
                ? System.IO.Path.GetFileNameWithoutExtension(JuegoActual.RutaCompleta)
                : JuegoActual.Nombre;

            // A. Carátula Principal (Boxart / Image)
            string rImg = JuegoActual.ObtenerRutaCaratula();
            AgregarSiExisteYNoEsta(rImg, "IMAGE");

            // B. Miniatura (Thumbnail)
            string rThumb = JuegoActual.ObtenerRutaThumb();
            if (!string.IsNullOrEmpty(rThumb) && !rThumb.Equals(rImg, StringComparison.OrdinalIgnoreCase))
            {
                AgregarSiExisteYNoEsta(rThumb, "THUMB");
            }

            // C. Marquee / Wheel (Logo)
            string rMarq = JuegoActual.ObtenerRutaMarquee();
            AgregarSiExisteYNoEsta(rMarq, "MARQUEE");

            // D. Fanart (Fondo)
            string rFan = JuegoActual.ObtenerRutaFanart();
            AgregarSiExisteYNoEsta(rFan, "FANART");

            // E. Video MP4/MKV
            if (!string.IsNullOrEmpty(JuegoActual.Video))
            {
                AgregarSiExisteYNoEsta(JuegoActual.Video, "VIDEO");
            }

            // F. Buscar si existen archivos físicos en carpetas images/, videos/, manuals/ con el nombre exacto de la ROM
            if (!string.IsNullOrEmpty(carpetaSistema) && System.IO.Directory.Exists(carpetaSistema))
            {
                BuscarYAgregarMultimediaFisica(carpetaSistema, romName);
            }

            // Recalcular peso total mostrado
            JuegoActual.RecalcularTamanoTotal();
        }

        private void AgregarSiExisteYNoEsta(string? ruta, string tipo)
        {
            if (string.IsNullOrEmpty(ruta) || !System.IO.File.Exists(ruta)) return;

            // Si ya está en la lista (por ruta completa), no duplicar
            if (JuegoActual.Dependencias.Any(d => d.RutaCompleta.Equals(ruta, StringComparison.OrdinalIgnoreCase)))
                return;

            var fi = new System.IO.FileInfo(ruta);
            JuegoActual.Dependencias.Add(new DependenciaItem
            {
                NombreArchivo = fi.Name,
                RutaCompleta = fi.FullName,
                TamanoBytes = fi.Length,
                Tipo = tipo
            });
        }

        private void BuscarYAgregarMultimediaFisica(string carpetaSistema, string romName)
        {
            string dirImages = System.IO.Path.Combine(carpetaSistema, "images");
            string dirVideos = System.IO.Path.Combine(carpetaSistema, "videos");
            string dirManuals = System.IO.Path.Combine(carpetaSistema, "manuals");

            string[] extImgs = { ".png", ".jpg", ".jpeg", ".webp" };
            string[] extVids = { ".mp4", ".mkv", ".avi" };
            string[] extMans = { ".pdf", ".txt", ".cbz" };

            // Boxart
            foreach (var ext in extImgs)
            {
                string p1 = System.IO.Path.Combine(dirImages, $"{romName}-image{ext}");
                string p2 = System.IO.Path.Combine(dirImages, $"{romName}{ext}");
                if (System.IO.File.Exists(p1)) AgregarSiExisteYNoEsta(p1, "IMAGE");
                else if (System.IO.File.Exists(p2)) AgregarSiExisteYNoEsta(p2, "IMAGE");
            }

            // Thumb
            foreach (var ext in extImgs)
            {
                string p = System.IO.Path.Combine(dirImages, $"{romName}-thumb{ext}");
                if (System.IO.File.Exists(p)) AgregarSiExisteYNoEsta(p, "THUMB");
            }

            // Marquee
            foreach (var ext in extImgs)
            {
                string p = System.IO.Path.Combine(dirImages, $"{romName}-marquee{ext}");
                if (System.IO.File.Exists(p)) AgregarSiExisteYNoEsta(p, "MARQUEE");
            }

            // Fanart
            foreach (var ext in extImgs)
            {
                string p = System.IO.Path.Combine(dirImages, $"{romName}-fanart{ext}");
                if (System.IO.File.Exists(p)) AgregarSiExisteYNoEsta(p, "FANART");
            }

            // Video
            foreach (var ext in extVids)
            {
                string p1 = System.IO.Path.Combine(dirVideos, $"{romName}-video{ext}");
                string p2 = System.IO.Path.Combine(dirVideos, $"{romName}{ext}");
                if (System.IO.File.Exists(p1)) AgregarSiExisteYNoEsta(p1, "VIDEO");
                else if (System.IO.File.Exists(p2)) AgregarSiExisteYNoEsta(p2, "VIDEO");
            }

            // Manual
            if (System.IO.Directory.Exists(dirManuals))
            {
                foreach (var ext in extMans)
                {
                    string p1 = System.IO.Path.Combine(dirManuals, $"{romName}-manual{ext}");
                    string p2 = System.IO.Path.Combine(dirManuals, $"{romName}{ext}");
                    if (System.IO.File.Exists(p1)) AgregarSiExisteYNoEsta(p1, "MANUAL");
                    else if (System.IO.File.Exists(p2)) AgregarSiExisteYNoEsta(p2, "MANUAL");
                }
            }
        }

        private void RefrescarListaDependencias()
        {
            if (lstDependencias != null)
            {
                lstDependencias.ItemsSource = null;
                lstDependencias.ItemsSource = JuegoActual.Dependencias;
            }
        }

        private void MostrarImagen(string ruta, string etiqueta)
        {
            try
            {
                if (!string.IsNullOrEmpty(ruta) && File.Exists(ruta))
                {
                    var bmp = new BitmapImage();
                    bmp.BeginInit();
                    bmp.CacheOption = BitmapCacheOption.OnLoad;
                    bmp.UriSource = new Uri(ruta, UriKind.Absolute);
                    bmp.EndInit();
                    imgGrandeHD.Source = bmp;
                    txtTipoArteActivo.Text = $"Mostrando: {etiqueta}";
                }
                else
                {
                    imgGrandeHD.Source = null;
                    txtTipoArteActivo.Text = $"No disponible: {etiqueta}";
                }
            }
            catch
            {
                imgGrandeHD.Source = null;
            }
        }

        private void btnVerBoxart_Click(object sender, RoutedEventArgs e)
        {
            ResaltarBoton(btnVerBoxart);
            MostrarImagen(JuegoActual.ObtenerRutaCaratula(), "Carátula (Boxart)");
        }

        private void btnVerThumb_Click(object sender, RoutedEventArgs e)
        {
            ResaltarBoton(btnVerThumb);
            MostrarImagen(JuegoActual.ObtenerRutaThumb(), "Miniatura (Thumb)");
        }

        private void btnVerMarquee_Click(object sender, RoutedEventArgs e)
        {
            ResaltarBoton(btnVerMarquee);
            MostrarImagen(JuegoActual.ObtenerRutaMarquee(), "Logo (Marquee)");
        }

        private void btnVerFanart_Click(object sender, RoutedEventArgs e)
        {
            ResaltarBoton(btnVerFanart);
            MostrarImagen(JuegoActual.ObtenerRutaFanart(), "Fanart / Fondo");
        }

        private void ResaltarBoton(Button activo)
        {
            var inactivoBg = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(30, 41, 59));
            var inactivoFg = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(148, 163, 184));

            btnVerBoxart.Background = inactivoBg;
            btnVerThumb.Background = inactivoBg;
            btnVerMarquee.Background = inactivoBg;
            btnVerFanart.Background = inactivoBg;

            btnVerBoxart.Foreground = inactivoFg;
            btnVerThumb.Foreground = inactivoFg;
            btnVerMarquee.Foreground = inactivoFg;
            btnVerFanart.Foreground = inactivoFg;

            activo.Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(37, 99, 235));
            activo.Foreground = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(255, 255, 255));
        }

        private void btnAgregarDependencia_Click(object sender, RoutedEventArgs e)
        {
            using var ofd = new System.Windows.Forms.OpenFileDialog { Title = "Selecciona archivos a vincular", Multiselect = true };
            if (ofd.ShowDialog() == System.Windows.Forms.DialogResult.OK)
            {
                foreach (var arch in ofd.FileNames)
                {
                    var fi = new FileInfo(arch);
                    JuegoActual.Dependencias.Add(new DependenciaItem
                    {
                        Tipo = "MANUAL",
                        NombreArchivo = fi.Name,
                        RutaCompleta = fi.FullName,
                        TamanoBytes = fi.Length
                    });
                }
                JuegoActual.RecalcularTamanoTotal();
            }
        }

        private void btnAgregarCarpeta_Click(object sender, RoutedEventArgs e)
        {
            using var fbd = new System.Windows.Forms.FolderBrowserDialog { Description = "Selecciona carpeta a vincular" };
            if (fbd.ShowDialog() == System.Windows.Forms.DialogResult.OK)
            {
                var dir = new DirectoryInfo(fbd.SelectedPath);
                long bytes = ScannerEngine.CalcularTamanoCarpeta(fbd.SelectedPath);
                JuegoActual.Dependencias.Add(new DependenciaItem
                {
                    Tipo = "WIN_FOLDER",
                    NombreArchivo = dir.Name,
                    RutaCompleta = dir.FullName,
                    TamanoBytes = bytes
                });
                JuegoActual.RecalcularTamanoTotal();
            }
        }

        private void btnEliminarDep_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.DataContext is DependenciaItem item)
            {
                JuegoActual.Dependencias.Remove(item);
                JuegoActual.RecalcularTamanoTotal();
            }
        }

        private void btnGuardar_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                if (JuegoActual != null)
                {
                    if (txtNombreJuego != null)
                    {
                        JuegoActual.Nombre = txtNombreJuego.Text.Trim();
                        JuegoActual.CleanTitle = ScannerEngine.LimpiarTitulo(JuegoActual.Nombre);
                    }

                    // Recalcular el tamaño total (ROM + dependencias agregadas + carpeta enlazada)
                    long pesoDeps = 0;
                    if (JuegoActual.Dependencias != null)
                    {
                        pesoDeps = JuegoActual.Dependencias.Sum(d => d.TamanoBytes);
                    }

                    long pesoBase = 0;
                    if (!string.IsNullOrEmpty(JuegoActual.RutaCompleta) && System.IO.File.Exists(JuegoActual.RutaCompleta))
                    {
                        pesoBase = new System.IO.FileInfo(JuegoActual.RutaCompleta).Length;
                    }

                    JuegoActual.TamanoBytes = pesoBase + pesoDeps;

                    // Guardar y persistir inmediatamente en SQLite físico
                    var db = new DatabaseHelper();
                    db.ActualizarJuego(JuegoActual);
                }

                DialogResult = true;
                Close();
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show("Error al guardar cambios en la base de datos: " + ex.Message, "Error");
            }
        }

        private void btnCerrar_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }
        
    }
}