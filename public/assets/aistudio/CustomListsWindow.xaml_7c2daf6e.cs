using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Controls;

namespace RetroBatManager
{
    public partial class CustomListsWindow : Window
    {
        private List<ColeccionPersonalizada> _listas = new List<ColeccionPersonalizada>();
        private List<Juego> _todosLosJuegos = new List<Juego>();
        private ColeccionPersonalizada? _listaActiva;
        private bool _actualizandoInternamente = false;
        private List<Juego> _resultadosBusquedaActuales = new List<Juego>();

        public CustomListsWindow(List<Juego> todosLosJuegos)
        {
            InitializeComponent();
            _todosLosJuegos = todosLosJuegos ?? new List<Juego>();
            _listas = ColeccionPersonalizada.CargarListas() ?? new List<ColeccionPersonalizada>();

            PoblarComboIconosSiEstaVacio();
            RefrescarListasUI();

            if (_listas.Count > 0)
            {
                lstMisListas.SelectedIndex = 0;
            }
        }

        private void PoblarComboIconosSiEstaVacio()
        {
            if (cmbIcono != null && cmbIcono.Items.Count == 0)
            {
                string[] iconos = { "⭐", "🔥", "🏆", "🕹️", "👥", "💎", "👑", "🚀", "🎮", "❤️" };
                foreach (var ic in iconos)
                {
                    cmbIcono.Items.Add(new ComboBoxItem { Content = ic });
                }
            }
        }

        private void RefrescarListasUI()
        {
            if (lstMisListas == null) return;

            var selActual = _listaActiva;
            _actualizandoInternamente = true;

            lstMisListas.ItemsSource = null;
            lstMisListas.ItemsSource = _listas;

            if (selActual != null && _listas.Contains(selActual))
            {
                lstMisListas.SelectedItem = selActual;
            }

            _actualizandoInternamente = false;
        }

        private void lstMisListas_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (_actualizandoInternamente) return;

            _listaActiva = lstMisListas?.SelectedItem as ColeccionPersonalizada;
            if (_listaActiva == null)
            {
                if (txtNombreLista != null) txtNombreLista.Text = string.Empty;
                if (lstJuegosEnLista != null) lstJuegosEnLista.ItemsSource = null;
                if (txtTotalJuegosEnLista != null) txtTotalJuegosEnLista.Text = "JUEGOS EN ESTA LISTA (0):";
                return;
            }

            _actualizandoInternamente = true;

            if (txtNombreLista != null)
            {
                txtNombreLista.Text = _listaActiva.Nombre ?? "";
            }

            if (cmbIcono != null)
            {
                string iconoBuscado = string.IsNullOrEmpty(_listaActiva.Icono) ? "⭐" : _listaActiva.Icono;
                for (int i = 0; i < cmbIcono.Items.Count; i++)
                {
                    object itemObj = cmbIcono.Items[i];
                    string strItem = (itemObj is ComboBoxItem cbi) ? (cbi.Content?.ToString() ?? "") : (itemObj?.ToString() ?? "");

                    if (strItem.Equals(iconoBuscado, StringComparison.OrdinalIgnoreCase))
                    {
                        cmbIcono.SelectedIndex = i;
                        break;
                    }
                }
            }

            _actualizandoInternamente = false;
            RefrescarJuegosEnLista();
        }

        private void RefrescarJuegosEnLista()
        {
            if (lstJuegosEnLista == null) return;

            if (_listaActiva == null || _listaActiva.JuegosIds == null || _listaActiva.JuegosIds.Count == 0)
            {
                lstJuegosEnLista.ItemsSource = null;
                if (txtTotalJuegosEnLista != null) txtTotalJuegosEnLista.Text = "JUEGOS EN ESTA LISTA (0):";
                return;
            }

            var nombresMostrar = new List<string>();
            var setKeys = new HashSet<string>(_listaActiva.JuegosIds, StringComparer.OrdinalIgnoreCase);

            foreach (var j in _todosLosJuegos)
            {
                string key = $"{j.Sistema}__{j.Nombre}";
                if (setKeys.Contains(key))
                {
                    nombresMostrar.Add($"[{j.Sistema}] {j.Nombre} ({j.TamanoFormateado})");
                }
            }

            lstJuegosEnLista.ItemsSource = null;
            lstJuegosEnLista.ItemsSource = nombresMostrar;
            if (txtTotalJuegosEnLista != null) txtTotalJuegosEnLista.Text = $"JUEGOS EN ESTA LISTA ({nombresMostrar.Count}):";
        }

        #region BÚSQUEDA Y ADICIÓN 1 A 1
        private void txtBuscarJuegoIndividual_TextChanged(object sender, TextChangedEventArgs e)
        {
            string txt = txtBuscarJuegoIndividual?.Text?.Trim().ToLowerInvariant() ?? "";

            if (string.IsNullOrEmpty(txt) || txt.Length < 2)
            {
                lstResultadosBusqueda.Visibility = Visibility.Collapsed;
                lstResultadosBusqueda.ItemsSource = null;
                return;
            }

            _resultadosBusquedaActuales = _todosLosJuegos
                .Where(j => j.Nombre.ToLowerInvariant().Contains(txt) || j.CleanTitle.ToLowerInvariant().Contains(txt))
                .Take(50)
                .ToList();

            var lineas = _resultadosBusquedaActuales.Select(j => $"[{j.Sistema}] {j.Nombre} ({j.TamanoFormateado})").ToList();

            lstResultadosBusqueda.ItemsSource = lineas;
            lstResultadosBusqueda.Visibility = lineas.Count > 0 ? Visibility.Visible : Visibility.Collapsed;
        }

        private void btnAgregarJuegosBuscados_Click(object sender, RoutedEventArgs e)
        {
            if (_listaActiva == null)
            {
                MessageBox.Show("Por favor selecciona o crea una lista primero.", "Aviso");
                return;
            }

            if (_listaActiva.JuegosIds == null) _listaActiva.JuegosIds = new List<string>();

            // Obtener los elementos seleccionados del ListBox en WPF
            var seleccionadosItems = lstResultadosBusqueda.SelectedItems.Cast<string>().ToList();

            // Si no seleccionó ninguno en la lista pero presionó agregar y hay resultados, tomar el primero
            if (seleccionadosItems.Count == 0 && _resultadosBusquedaActuales.Count > 0)
            {
                var primerJuego = _resultadosBusquedaActuales[0];
                string primerStr = $"[{primerJuego.Sistema}] {primerJuego.Nombre} ({primerJuego.TamanoFormateado})";
                seleccionadosItems.Add(primerStr);
            }

            if (seleccionadosItems.Count == 0)
            {
                MessageBox.Show("Escribe el nombre de un juego y selecciónalo de los resultados.", "Aviso");
                return;
            }

            int agregados = 0;
            foreach (var strItem in seleccionadosItems)
            {
                int finSys = strItem.IndexOf(']');
                if (finSys > 1)
                {
                    string sys = strItem.Substring(1, finSys - 1);
                    string resto = strItem.Substring(finSys + 2);
                    int iniTam = resto.LastIndexOf('(');
                    string nombre = (iniTam > 0 ? resto.Substring(0, iniTam).Trim() : resto.Trim());

                    string key = $"{sys}__{nombre}";
                    if (!_listaActiva.JuegosIds.Contains(key))
                    {
                        _listaActiva.JuegosIds.Add(key);
                        agregados++;
                    }
                }
            }

            RefrescarJuegosEnLista();
            lstMisListas?.Items.Refresh();
            txtBuscarJuegoIndividual.Text = "";
            lstResultadosBusqueda.Visibility = Visibility.Collapsed;

            MessageBox.Show($"Se agregaron {agregados} juego(s) a '{_listaActiva.Nombre}'.", "Agregado");
        }
        #endregion

        private void btnNuevaLista_Click(object sender, RoutedEventArgs e)
        {
            var nueva = new ColeccionPersonalizada
            {
                Nombre = $"Lista {_listas.Count + 1}",
                Icono = "⭐",
                JuegosIds = new List<string>()
            };
            _listas.Add(nueva);
            _listaActiva = nueva;

            RefrescarListasUI();
            lstMisListas.SelectedItem = nueva;
        }

        private void btnEliminarLista_Click(object sender, RoutedEventArgs e)
        {
            if (_listaActiva != null)
            {
                _listas.Remove(_listaActiva);
                _listaActiva = null;
                RefrescarListasUI();
                if (_listas.Count > 0) lstMisListas.SelectedIndex = 0;
            }
        }

        private void txtNombreLista_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (_actualizandoInternamente || _listaActiva == null || txtNombreLista == null) return;

            if (!string.IsNullOrWhiteSpace(txtNombreLista.Text))
            {
                _listaActiva.Nombre = txtNombreLista.Text.Trim();
                lstMisListas?.Items.Refresh();
            }
        }

        private void cmbIcono_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (_actualizandoInternamente || _listaActiva == null || cmbIcono == null) return;

            object sel = cmbIcono.SelectedItem;
            string iconoStr = (sel is ComboBoxItem cbi) ? (cbi.Content?.ToString() ?? "⭐") : (sel?.ToString() ?? "⭐");

            _listaActiva.Icono = iconoStr;
            lstMisListas?.Items.Refresh();
        }

        private void btnAgregarSistemaCompleto_Click(object sender, RoutedEventArgs e)
        {
            if (_listaActiva == null)
            {
                MessageBox.Show("Por favor selecciona o crea una lista primero.", "Aviso");
                return;
            }

            if (_listaActiva.JuegosIds == null) _listaActiva.JuegosIds = new List<string>();

            var sistemas = _todosLosJuegos.Select(j => j.Sistema).Distinct().OrderBy(s => s).ToList();
            if (sistemas.Count == 0)
            {
                MessageBox.Show("No hay juegos ni sistemas cargados en la colección.", "Aviso");
                return;
            }

            string opciones = string.Join(", ", sistemas);

            string sysElegido = Microsoft.VisualBasic.Interaction.InputBox(
                $"Sistemas disponibles:\n[{opciones}]\n\nEscribe el nombre exacto del sistema que deseas agregar a '{_listaActiva.Nombre}':",
                "Agregar Sistema Completo a Lista",
                sistemas.FirstOrDefault() ?? ""
            ).Trim();

            if (string.IsNullOrEmpty(sysElegido)) return;

            var juegosSys = _todosLosJuegos.Where(j => j.Sistema.Equals(sysElegido, StringComparison.OrdinalIgnoreCase)).ToList();
            int agregados = 0;

            foreach (var j in juegosSys)
            {
                string key = $"{j.Sistema}__{j.Nombre}";
                if (!_listaActiva.JuegosIds.Contains(key))
                {
                    _listaActiva.JuegosIds.Add(key);
                    agregados++;
                }
            }

            RefrescarJuegosEnLista();
            lstMisListas?.Items.Refresh();
            MessageBox.Show($"Se agregaron {agregados} juegos del sistema '{sysElegido}' a '{_listaActiva.Nombre}'.", "Listo");
        }

        private void btnQuitarJuegos_Click(object sender, RoutedEventArgs e)
        {
            if (_listaActiva == null || _listaActiva.JuegosIds == null || lstJuegosEnLista?.SelectedItems.Count == 0) return;

            var seleccionados = lstJuegosEnLista.SelectedItems.Cast<string>().ToList();
            foreach (var str in seleccionados)
            {
                int finSys = str.IndexOf(']');
                if (finSys > 1)
                {
                    string sys = str.Substring(1, finSys - 1);
                    string resto = str.Substring(finSys + 2);
                    int iniTam = resto.LastIndexOf('(');
                    string nombre = (iniTam > 0 ? resto.Substring(0, iniTam).Trim() : resto.Trim());

                    string key = $"{sys}__{nombre}";
                    _listaActiva.JuegosIds.Remove(key);
                }
            }

            RefrescarJuegosEnLista();
            lstMisListas?.Items.Refresh();
        }

        private void btnGuardarListas_Click(object sender, RoutedEventArgs e)
        {
            ColeccionPersonalizada.GuardarListas(_listas);
            DialogResult = true;
            Close();
        }
    }
}