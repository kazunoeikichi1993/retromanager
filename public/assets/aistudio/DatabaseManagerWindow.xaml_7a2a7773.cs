using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using WinForms = System.Windows.Forms; // Alias para evitar ambigüedades con WPF

namespace RetroBatManager
{
    public partial class DatabaseManagerWindow : Window
    {
        private List<Juego> _todosLosJuegos;

        public DatabaseManagerWindow(List<Juego> juegos)
        {
            InitializeComponent();
            _todosLosJuegos = juegos ?? new List<Juego>();

            var sistemas = _todosLosJuegos.Select(j => j.Sistema).Distinct().OrderBy(s => s).ToList();
            sistemas.Insert(0, "Todos los Sistemas");
            cmbSistemasDB.ItemsSource = sistemas;
            cmbSistemasDB.SelectedIndex = 0;

            Filtrar();
        }

        private void Filtrar()
        {
            if (_todosLosJuegos == null) return;
            string txt = (txtBuscarDB?.Text ?? "").ToLowerInvariant().Trim();
            string? sys = cmbSistemasDB?.SelectedItem?.ToString();

            var res = _todosLosJuegos.AsEnumerable();

            if (!string.IsNullOrEmpty(txt))
                res = res.Where(j => j.Nombre.ToLowerInvariant().Contains(txt) || j.Ruta.ToLowerInvariant().Contains(txt));

            if (!string.IsNullOrEmpty(sys) && sys != "Todos los Sistemas")
                res = res.Where(j => j.Sistema == sys);

            if (chkSoloM3UDB?.IsChecked == true)
                res = res.Where(j => j.Dependencias.Count > 0 || j.Extension == ".m3u");

            var lista = res.ToList();
            dgEditable.ItemsSource = lista;
            txtTotalFiltrados.Text = $"Total: {lista.Count} juegos";
        }

        private void txtBuscarDB_TextChanged(object sender, TextChangedEventArgs e) => Filtrar();
        private void cmbSistemasDB_SelectionChanged(object sender, SelectionChangedEventArgs e) => Filtrar();
        private void chkSoloM3UDB_Click(object sender, RoutedEventArgs e) => Filtrar();

        // DEPURACIÓN RÁPIDA POR FORMATO
        private void btnDepurarFormato_Click(object sender, RoutedEventArgs e)
        {
            string? sistemaSeleccionado = cmbSistemasDB.SelectedItem?.ToString();
            var query = _todosLosJuegos.AsEnumerable();

            if (!string.IsNullOrEmpty(sistemaSeleccionado) && sistemaSeleccionado != "Todos los Sistemas")
            {
                query = query.Where(j => j.Sistema == sistemaSeleccionado);
            }

            var formatosDisponibles = query.Select(j => j.Extension.ToLowerInvariant())
                                          .Where(ext => !string.IsNullOrEmpty(ext))
                                          .Distinct()
                                          .OrderBy(ext => ext)
                                          .ToList();

            if (formatosDisponibles.Count == 0)
            {
                System.Windows.MessageBox.Show("No hay formatos para depurar en la vista actual.", "Aviso");
                return;
            }

            string formatosTexto = string.Join(", ", formatosDisponibles);
            string entrada = Microsoft.VisualBasic.Interaction.InputBox(
                $"Formatos presentes en {(sistemaSeleccionado ?? "todos los sistemas")}:\n[{formatosTexto}]\n\nEscribe la extensión que deseas ELIMINAR (ejemplo: .xex o .exe):",
                "Depuración Masiva por Extensión",
                ".xex"
            ).Trim().ToLowerInvariant();

            if (string.IsNullOrEmpty(entrada)) return;

            if (!entrada.StartsWith(".")) entrada = "." + entrada;

            int eliminados = _todosLosJuegos.RemoveAll(j =>
                (sistemaSeleccionado == "Todos los Sistemas" || j.Sistema == sistemaSeleccionado) &&
                j.Extension.Equals(entrada, StringComparison.OrdinalIgnoreCase));

            Filtrar();
            System.Windows.MessageBox.Show($"Se eliminaron {eliminados} registros con formato '{entrada}'.\nRecuerda hacer clic en 'Guardar Cambios' para persistir en SQLite.", "Depuración Completa");
        }

        private void btnAgregarJuegoManual_Click(object sender, RoutedEventArgs e)
        {
            using var ofd = new WinForms.OpenFileDialog
            {
                Title = "Selecciona el archivo del juego a registrar manualmente"
            };

            if (ofd.ShowDialog() == WinForms.DialogResult.OK)
            {
                var fi = new System.IO.FileInfo(ofd.FileName);
                string sys = cmbSistemasDB.SelectedItem?.ToString() ?? "manual";
                if (sys == "Todos los Sistemas") sys = "custom";

                var nuevo = new Juego
                {
                    Nombre = System.IO.Path.GetFileNameWithoutExtension(fi.Name),
                    CleanTitle = ScannerEngine.LimpiarTitulo(fi.Name),
                    Ruta = "./" + fi.Name,
                    RutaCompleta = fi.FullName,
                    Sistema = sys,
                    Extension = fi.Extension.ToLowerInvariant(),
                    TamanoBytes = fi.Length,
                    Region = "Global",
                    Genero = "Manual"
                };

                _todosLosJuegos.Add(nuevo);
                Filtrar();
                System.Windows.MessageBox.Show($"Juego '{nuevo.Nombre}' añadido a la lista. Haz clic en 'Guardar Cambios' para persistir.", "Aviso");
            }
        }

        private void btnEliminarJuego_Click(object sender, RoutedEventArgs e)
        {
            var seleccionados = dgEditable.SelectedItems.Cast<Juego>().ToList();

            if (seleccionados.Count == 0)
            {
                System.Windows.MessageBox.Show("Por favor selecciona uno o varios juegos para eliminar.", "Aviso");
                return;
            }

            string mensaje = seleccionados.Count == 1
                ? $"¿Deseas eliminar '{seleccionados[0].Nombre}' de la base de datos?"
                : $"¿Deseas eliminar los {seleccionados.Count} juegos seleccionados de la base de datos?";

            if (System.Windows.MessageBox.Show(mensaje, "Confirmar eliminación", MessageBoxButton.YesNo, MessageBoxImage.Warning) == MessageBoxResult.Yes)
            {
                foreach (var item in seleccionados)
                {
                    _todosLosJuegos.Remove(item);
                }
                Filtrar();
            }
        }

        private void btnGuardar_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                if (dgEditable != null)
                {
                    dgEditable.CommitEdit(DataGridEditingUnit.Row, true);
                    dgEditable.CancelEdit();
                }

                foreach (var j in _todosLosJuegos)
                {
                    if (j.TamanoBytes == 0 && !string.IsNullOrEmpty(j.TamanoTextoEditable))
                    {
                        j.TamanoBytes = Juego.ParsearTamano(j.TamanoTextoEditable);
                    }
                }

                var db = new DatabaseHelper();
                db.LimpiarBaseDeDatos();
                db.GuardarJuegosLote(_todosLosJuegos);
                DialogResult = true;
                Close();
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show("Error al guardar: " + ex.Message, "Error");
            }
        }

        private void btnCerrar_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }

    }
}