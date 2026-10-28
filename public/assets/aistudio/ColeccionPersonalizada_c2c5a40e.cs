using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace RetroBatManager
{
    public class ColeccionPersonalizada
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Nombre { get; set; } = "Nueva Lista";
        public string Icono { get; set; } = "⭐";
        public string Descripcion { get; set; } = "";
        public List<string> JuegosIds { get; set; } = new List<string>(); // "Sistema_Nombre"

        public string NombreConIcono => $"{Icono} {Nombre} ({JuegosIds.Count})";

        private static readonly string ArchivoListas = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ListasPersonalizadas.json");

        public static List<ColeccionPersonalizada> CargarListas()
        {
            if (!File.Exists(ArchivoListas)) return new List<ColeccionPersonalizada>();
            try
            {
                string json = File.ReadAllText(ArchivoListas);
                return JsonSerializer.Deserialize<List<ColeccionPersonalizada>>(json) ?? new List<ColeccionPersonalizada>();
            }
            catch { return new List<ColeccionPersonalizada>(); }
        }

        public static void GuardarListas(List<ColeccionPersonalizada> listas)
        {
            try
            {
                string json = JsonSerializer.Serialize(listas, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(ArchivoListas, json);
            }
            catch { }
        }
    }
}