using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace RetroBatManager
{
    public class DatabaseHelper
    {
        private readonly string connectionString = "Data Source=RetroBatData.db;Cache=Shared";

        public DatabaseHelper()
        {
            using var connection = new SqliteConnection(connectionString);
            connection.Open();

            var cmd = connection.CreateCommand();
            cmd.CommandText = @"
                CREATE TABLE IF NOT EXISTS Juegos (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    Nombre TEXT NOT NULL,
                    Ruta TEXT NOT NULL,
                    Sistema TEXT NOT NULL
                );
            ";
            cmd.ExecuteNonQuery();

            AgregarColumnaSiNoExiste(connection, "CleanTitle", "TEXT DEFAULT ''");
            AgregarColumnaSiNoExiste(connection, "RutaCompleta", "TEXT DEFAULT ''");
            AgregarColumnaSiNoExiste(connection, "Extension", "TEXT DEFAULT ''");
            AgregarColumnaSiNoExiste(connection, "TamanoBytes", "INTEGER DEFAULT 0");
            AgregarColumnaSiNoExiste(connection, "Region", "TEXT DEFAULT 'Global'");
            AgregarColumnaSiNoExiste(connection, "Genero", "TEXT DEFAULT 'Varios'");
            AgregarColumnaSiNoExiste(connection, "Desarrollador", "TEXT DEFAULT 'Desconocido'");
            AgregarColumnaSiNoExiste(connection, "Anio", "TEXT DEFAULT ''");
            AgregarColumnaSiNoExiste(connection, "Descripcion", "TEXT DEFAULT ''");
            AgregarColumnaSiNoExiste(connection, "Imagen", "TEXT DEFAULT ''");
            AgregarColumnaSiNoExiste(connection, "Video", "TEXT DEFAULT ''");
            AgregarColumnaSiNoExiste(connection, "Jugadores", "TEXT DEFAULT '1 Jugador'");
            AgregarColumnaSiNoExiste(connection, "EsCarpeta", "INTEGER DEFAULT 0");
            AgregarColumnaSiNoExiste(connection, "CarpetaEnlazada", "TEXT DEFAULT ''");
            AgregarColumnaSiNoExiste(connection, "EsDuplicado", "INTEGER DEFAULT 0");
            AgregarColumnaSiNoExiste(connection, "RolDuplicado", "TEXT DEFAULT 'original'");
            AgregarColumnaSiNoExiste(connection, "GrupoId", "TEXT DEFAULT ''");
            AgregarColumnaSiNoExiste(connection, "DependenciasJson", "TEXT DEFAULT '[]'");
            AgregarColumnaSiNoExiste(connection, "RutaImage", "TEXT DEFAULT ''");
            AgregarColumnaSiNoExiste(connection, "RutaThumb", "TEXT DEFAULT ''");
            AgregarColumnaSiNoExiste(connection, "RutaMarquee", "TEXT DEFAULT ''");
            AgregarColumnaSiNoExiste(connection, "RutaFanart", "TEXT DEFAULT ''");
        }

        private void AgregarColumnaSiNoExiste(SqliteConnection conn, string nombreColumna, string tipo)
        {
            try
            {
                var cmd = conn.CreateCommand();
                cmd.CommandText = $"ALTER TABLE Juegos ADD COLUMN {nombreColumna} {tipo};";
                cmd.ExecuteNonQuery();
            }
            catch { }
        }

        public void GuardarJuegosLote(List<Juego> juegos)
        {
            using var connection = new SqliteConnection(connectionString);
            connection.Open();
            using var tx = connection.BeginTransaction();
            var cmd = connection.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = @"
                INSERT INTO Juegos (Nombre, CleanTitle, Ruta, RutaCompleta, Sistema, Extension, TamanoBytes, Region, Genero, Desarrollador, Anio, Descripcion, Imagen, Video, Jugadores, EsCarpeta, CarpetaEnlazada, EsDuplicado, RolDuplicado, GrupoId, DependenciasJson, RutaImage, RutaThumb, RutaMarquee, RutaFanart)
                VALUES ($nombre, $clean, $ruta, $rutacompleta, $sistema, $ext, $tamano, $region, $genero, $dev, $anio, $desc, $img, $vid, $jugadores, $esCarpeta, $carpEnl, $esDup, $rolDup, $grpId, $depsJson, $rImg, $rThumb, $rMarq, $rFan)";

            var pNombre = cmd.Parameters.Add("$nombre", SqliteType.Text);
            var pClean = cmd.Parameters.Add("$clean", SqliteType.Text);
            var pRuta = cmd.Parameters.Add("$ruta", SqliteType.Text);
            var pRutaCompleta = cmd.Parameters.Add("$rutacompleta", SqliteType.Text);
            var pSistema = cmd.Parameters.Add("$sistema", SqliteType.Text);
            var pExt = cmd.Parameters.Add("$ext", SqliteType.Text);
            var pTamano = cmd.Parameters.Add("$tamano", SqliteType.Integer);
            var pRegion = cmd.Parameters.Add("$region", SqliteType.Text);
            var pGenero = cmd.Parameters.Add("$genero", SqliteType.Text);
            var pDev = cmd.Parameters.Add("$dev", SqliteType.Text);
            var pAnio = cmd.Parameters.Add("$anio", SqliteType.Text);
            var pDesc = cmd.Parameters.Add("$desc", SqliteType.Text);
            var pImg = cmd.Parameters.Add("$img", SqliteType.Text);
            var pVid = cmd.Parameters.Add("$vid", SqliteType.Text);
            var pJugadores = cmd.Parameters.Add("$jugadores", SqliteType.Text);
            var pEsCarpeta = cmd.Parameters.Add("$esCarpeta", SqliteType.Integer);
            var pCarpEnl = cmd.Parameters.Add("$carpEnl", SqliteType.Text);
            var pEsDup = cmd.Parameters.Add("$esDup", SqliteType.Integer);
            var pRolDup = cmd.Parameters.Add("$rolDup", SqliteType.Text);
            var pGrpId = cmd.Parameters.Add("$grpId", SqliteType.Text);
            var pDepsJson = cmd.Parameters.Add("$depsJson", SqliteType.Text);
            var pRImg = cmd.Parameters.Add("$rImg", SqliteType.Text);
            var pRThumb = cmd.Parameters.Add("$rThumb", SqliteType.Text);
            var pRMarq = cmd.Parameters.Add("$rMarq", SqliteType.Text);
            var pRFan = cmd.Parameters.Add("$rFan", SqliteType.Text);

            foreach (var j in juegos)
            {
                pNombre.Value = j.Nombre ?? "";
                pClean.Value = string.IsNullOrEmpty(j.CleanTitle) ? (j.Nombre ?? "") : j.CleanTitle;
                pRuta.Value = j.Ruta ?? "";
                pRutaCompleta.Value = j.RutaCompleta ?? "";
                pSistema.Value = j.Sistema ?? "";
                pExt.Value = j.Extension ?? "";
                pTamano.Value = j.TamanoBytes;
                pRegion.Value = string.IsNullOrEmpty(j.Region) ? "Global" : j.Region;
                pGenero.Value = j.Genero ?? "Varios";
                pDev.Value = j.Desarrollador ?? "Desconocido";
                pAnio.Value = j.Anio ?? "";
                pDesc.Value = j.Descripcion ?? "";
                pImg.Value = j.Imagen ?? "";
                pVid.Value = j.Video ?? "";
                pJugadores.Value = j.Jugadores ?? "1 Jugador";
                pEsCarpeta.Value = j.EsCarpetaOEnlazado ? 1 : 0;
                pCarpEnl.Value = j.CarpetaEnlazadaRuta ?? "";
                pEsDup.Value = j.EsDuplicado ? 1 : 0;
                pRolDup.Value = j.RolDuplicado ?? "original";
                pGrpId.Value = j.GrupoDuplicadoId ?? "";
                pDepsJson.Value = JsonSerializer.Serialize(j.Dependencias);
                pRImg.Value = j.ObtenerRutaCaratula();
                pRThumb.Value = j.ObtenerRutaThumb();
                pRMarq.Value = j.ObtenerRutaMarquee();
                pRFan.Value = j.ObtenerRutaFanart();
                cmd.ExecuteNonQuery();
            }
            tx.Commit();
        }

        public List<Juego> ObtenerJuegos()
        {
            var lista = new List<Juego>();
            using var connection = new SqliteConnection(connectionString);
            connection.Open();
            var cmd = connection.CreateCommand();
            cmd.CommandText = "SELECT Id, Nombre, CleanTitle, Ruta, RutaCompleta, Sistema, Extension, TamanoBytes, Region, Genero, Desarrollador, Anio, Descripcion, Imagen, Video, Jugadores, EsCarpeta, CarpetaEnlazada, EsDuplicado, RolDuplicado, GrupoId, DependenciasJson, RutaImage, RutaThumb, RutaMarquee, RutaFanart FROM Juegos ORDER BY Sistema, CleanTitle";

            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                var juego = new Juego
                {
                    Id = reader.GetInt32(0),
                    Nombre = reader.GetString(1),
                    CleanTitle = reader.IsDBNull(2) ? reader.GetString(1) : reader.GetString(2),
                    Ruta = reader.GetString(3),
                    RutaCompleta = reader.IsDBNull(4) ? "" : reader.GetString(4),
                    Sistema = reader.GetString(5),
                    Extension = reader.IsDBNull(6) ? "" : reader.GetString(6),
                    TamanoBytes = reader.IsDBNull(7) ? 0 : reader.GetInt64(7),
                    Region = reader.IsDBNull(8) ? "Global" : reader.GetString(8),
                    Genero = reader.IsDBNull(9) ? "Varios" : reader.GetString(9),
                    Desarrollador = reader.IsDBNull(10) ? "Desconocido" : reader.GetString(10),
                    Anio = reader.IsDBNull(11) ? "" : reader.GetString(11),
                    Descripcion = reader.IsDBNull(12) ? "" : reader.GetString(12),
                    Imagen = reader.IsDBNull(13) ? "" : reader.GetString(13),
                    Video = reader.IsDBNull(14) ? "" : reader.GetString(14),
                    Jugadores = reader.IsDBNull(15) ? "1 Jugador" : reader.GetString(15),
                    EsCarpetaOEnlazado = !reader.IsDBNull(16) && reader.GetInt32(16) == 1,
                    CarpetaEnlazadaRuta = reader.IsDBNull(17) ? "" : reader.GetString(17),
                    EsDuplicado = !reader.IsDBNull(18) && reader.GetInt32(18) == 1,
                    RolDuplicado = reader.IsDBNull(19) ? "original" : reader.GetString(19),
                    GrupoDuplicadoId = reader.IsDBNull(20) ? "" : reader.GetString(20),
                    RutaImage = reader.IsDBNull(22) ? "" : reader.GetString(22),
                    RutaThumb = reader.IsDBNull(23) ? "" : reader.GetString(23),
                    RutaMarquee = reader.IsDBNull(24) ? "" : reader.GetString(24),
                    RutaFanart = reader.IsDBNull(25) ? "" : reader.GetString(25)
                };

                if (!reader.IsDBNull(21))
                {
                    try
                    {
                        var deps = JsonSerializer.Deserialize<List<DependenciaItem>>(reader.GetString(21));
                        if (deps != null) juego.Dependencias = new ObservableCollection<DependenciaItem>(deps);
                    }
                    catch { }
                }

                lista.Add(juego);
            }
            return lista;
        }

        // Método alias para compatibilidad total con MainWindow
        public List<Juego> CargarJuegos() => ObtenerJuegos();

        public void LimpiarBaseDeDatos()
        {
            using var connection = new SqliteConnection(connectionString);
            connection.Open();
            var cmd = connection.CreateCommand();
            cmd.CommandText = "DELETE FROM Juegos; VACUUM;";
            cmd.ExecuteNonQuery();
        }

        public void GuardarJuegosSistemaIndividual(string sistema, List<Juego> juegosDelSistema)
        {
            using var connection = new SqliteConnection(connectionString);
            connection.Open();
            using var tx = connection.BeginTransaction();

            // 1. Borrar únicamente los registros del sistema que se está actualizando
            var cmdDelete = connection.CreateCommand();
            cmdDelete.Transaction = tx;
            cmdDelete.CommandText = "DELETE FROM Juegos WHERE Sistema = $sistema";
            cmdDelete.Parameters.AddWithValue("$sistema", sistema);
            cmdDelete.ExecuteNonQuery();

            // 2. Insertar los nuevos juegos escaneados de ese sistema
            var cmd = connection.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = @"
        INSERT INTO Juegos (Nombre, CleanTitle, Ruta, RutaCompleta, Sistema, Extension, TamanoBytes, Region, Genero, Desarrollador, Anio, Descripcion, Imagen, Video, Jugadores, EsCarpeta, CarpetaEnlazada, EsDuplicado, RolDuplicado, GrupoId, DependenciasJson, RutaImage, RutaThumb, RutaMarquee, RutaFanart)
        VALUES ($nombre, $clean, $ruta, $rutacompleta, $sistema, $ext, $tamano, $region, $genero, $dev, $anio, $desc, $img, $vid, $jugadores, $esCarpeta, $carpEnl, $esDup, $rolDup, $grpId, $depsJson, $rImg, $rThumb, $rMarq, $rFan)";

            var pNombre = cmd.Parameters.Add("$nombre", SqliteType.Text);
            var pClean = cmd.Parameters.Add("$clean", SqliteType.Text);
            var pRuta = cmd.Parameters.Add("$ruta", SqliteType.Text);
            var pRutaCompleta = cmd.Parameters.Add("$rutacompleta", SqliteType.Text);
            var pSistema = cmd.Parameters.Add("$sistema", SqliteType.Text);
            var pExt = cmd.Parameters.Add("$ext", SqliteType.Text);
            var pTamano = cmd.Parameters.Add("$tamano", SqliteType.Integer);
            var pRegion = cmd.Parameters.Add("$region", SqliteType.Text);
            var pGenero = cmd.Parameters.Add("$genero", SqliteType.Text);
            var pDev = cmd.Parameters.Add("$dev", SqliteType.Text);
            var pAnio = cmd.Parameters.Add("$anio", SqliteType.Text);
            var pDesc = cmd.Parameters.Add("$desc", SqliteType.Text);
            var pImg = cmd.Parameters.Add("$img", SqliteType.Text);
            var pVid = cmd.Parameters.Add("$vid", SqliteType.Text);
            var pJugadores = cmd.Parameters.Add("$jugadores", SqliteType.Text);
            var pEsCarpeta = cmd.Parameters.Add("$esCarpeta", SqliteType.Integer);
            var pCarpEnl = cmd.Parameters.Add("$carpEnl", SqliteType.Text);
            var pEsDup = cmd.Parameters.Add("$esDup", SqliteType.Integer);
            var pRolDup = cmd.Parameters.Add("$rolDup", SqliteType.Text);
            var pGrpId = cmd.Parameters.Add("$grpId", SqliteType.Text);
            var pDepsJson = cmd.Parameters.Add("$depsJson", SqliteType.Text);
            var pRImg = cmd.Parameters.Add("$rImg", SqliteType.Text);
            var pRThumb = cmd.Parameters.Add("$rThumb", SqliteType.Text);
            var pRMarq = cmd.Parameters.Add("$rMarq", SqliteType.Text);
            var pRFan = cmd.Parameters.Add("$rFan", SqliteType.Text);

            foreach (var j in juegosDelSistema)
            {
                pNombre.Value = j.Nombre ?? "";
                pClean.Value = string.IsNullOrEmpty(j.CleanTitle) ? (j.Nombre ?? "") : j.CleanTitle;
                pRuta.Value = j.Ruta ?? "";
                pRutaCompleta.Value = j.RutaCompleta ?? "";
                pSistema.Value = j.Sistema ?? "";
                pExt.Value = j.Extension ?? "";
                pTamano.Value = j.TamanoBytes;
                pRegion.Value = string.IsNullOrEmpty(j.Region) ? "Global" : j.Region;
                pGenero.Value = j.Genero ?? "Varios";
                pDev.Value = j.Desarrollador ?? "Desconocido";
                pAnio.Value = j.Anio ?? "";
                pDesc.Value = j.Descripcion ?? "";
                pImg.Value = j.Imagen ?? "";
                pVid.Value = j.Video ?? "";
                pJugadores.Value = j.Jugadores ?? "1 Jugador";
                pEsCarpeta.Value = j.EsCarpetaOEnlazado ? 1 : 0;
                pCarpEnl.Value = j.CarpetaEnlazadaRuta ?? "";
                pEsDup.Value = j.EsDuplicado ? 1 : 0;
                pRolDup.Value = j.RolDuplicado ?? "original";
                pGrpId.Value = j.GrupoDuplicadoId ?? "";
                pDepsJson.Value = JsonSerializer.Serialize(j.Dependencias);
                pRImg.Value = j.ObtenerRutaCaratula();
                pRThumb.Value = j.ObtenerRutaThumb();
                pRMarq.Value = j.ObtenerRutaMarquee();
                pRFan.Value = j.ObtenerRutaFanart();
                cmd.ExecuteNonQuery();
            }
            tx.Commit();
        }
        public void ActualizarJuego(Juego j)
        {
            using var connection = new SqliteConnection(connectionString);
            connection.Open();
            using var cmd = connection.CreateCommand();

            cmd.CommandText = @"
        UPDATE Juegos SET
            Nombre = $nombre,
            CleanTitle = $clean,
            TamanoBytes = $tamano,
            EsCarpeta = $esCarpeta,
            CarpetaEnlazada = $carpEnl,
            DependenciasJson = $depsJson,
            RutaImage = $rImg,
            RutaThumb = $rThumb,
            RutaMarquee = $rMarq,
            RutaFanart = $rFan
        WHERE Sistema = $sistema AND (Ruta = $ruta OR RutaCompleta = $rutacompleta);
    ";

            cmd.Parameters.AddWithValue("$nombre", j.Nombre ?? "");
            cmd.Parameters.AddWithValue("$clean", string.IsNullOrEmpty(j.CleanTitle) ? (j.Nombre ?? "") : j.CleanTitle);
            cmd.Parameters.AddWithValue("$tamano", j.TamanoBytes);
            cmd.Parameters.AddWithValue("$esCarpeta", j.EsCarpetaOEnlazado ? 1 : 0);
            cmd.Parameters.AddWithValue("$carpEnl", j.CarpetaEnlazadaRuta ?? "");
            cmd.Parameters.AddWithValue("$depsJson", JsonSerializer.Serialize(j.Dependencias));
            cmd.Parameters.AddWithValue("$rImg", j.ObtenerRutaCaratula() ?? "");
            cmd.Parameters.AddWithValue("$rThumb", j.ObtenerRutaThumb() ?? "");
            cmd.Parameters.AddWithValue("$rMarq", j.ObtenerRutaMarquee() ?? "");
            cmd.Parameters.AddWithValue("$rFan", j.ObtenerRutaFanart() ?? "");
            cmd.Parameters.AddWithValue("$sistema", j.Sistema ?? "");
            cmd.Parameters.AddWithValue("$ruta", j.Ruta ?? "");
            cmd.Parameters.AddWithValue("$rutacompleta", j.RutaCompleta ?? "");

            int filasAfectadas = cmd.ExecuteNonQuery();

            // Si por alguna razón el registro no existía en la base de datos, lo inserta
            if (filasAfectadas == 0)
            {
                GuardarJuegosLote(new List<Juego> { j });
            }
        }
    }
}