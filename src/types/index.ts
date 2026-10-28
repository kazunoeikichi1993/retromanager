export type DependencyType =
  | 'DISC'
  | 'TRACK'
  | 'IMAGE'
  | 'THUMB'
  | 'MARQUEE'
  | 'FANART'
  | 'VIDEO'
  | 'MANUAL'
  | 'BEZEL'
  | 'BOXBACK'
  | 'MAP'
  | 'SWITCH_DLC'
  | 'SWITCH_UPDATE'
  | 'WIN_FOLDER'
  | 'PS3_FOLDER'
  | 'EXTRA_FILE'
  | 'M3U_FILE'
  | 'MANUAL_FILE';

export interface DependenciaItem {
  tipo: DependencyType;
  nombreArchivo: string;
  rutaCompleta: string;
  tamanoBytes: number;
}

export interface Juego {
  id: number | string;
  nombre: string;
  cleanTitle: string;
  ruta: string;
  rutaCompleta: string;
  sistema: string;
  extension: string;
  tamanoBytes: number;
  region: string;
  genero: string;
  desarrollador: string;
  anio: string;
  descripcion: string;
  imagen?: string;
  video?: string;
  jugadores?: string;
  esVerificado?: boolean;
  esCarpetaOEnlazado?: boolean;
  carpetaEnlazadaRuta?: string;
  esDuplicado?: boolean;
  rolDuplicado?: 'original' | 'descarte' | 'ambos_validos';
  grupoDuplicadoId?: string;
  dependencias: DependenciaItem[];
  rutaImage?: string;
  rutaThumb?: string;
  rutaMarquee?: string;
  rutaFanart?: string;
  rutaBezel?: string;
  rutaBoxback?: string;
  rutaMap?: string;
  rutaManual?: string;
  gameId?: string;
  publisher?: string;
  family?: string;
  rating?: string | number;
  playcount?: number | string;
  lastplayed?: string;
  gametime?: number | string;
  lang?: string;
  releasedate?: string;
  esSeleccionado?: boolean;
  customTags?: string[];
}

export interface ColeccionPersonalizada {
  id: string;
  nombre: string;
  icono: string;
  descripcion: string;
  juegosIds: string[]; // "Sistema__Nombre"
}

export type ThemePreset = 'dark' | 'light' | 'retro-cyber' | 'nord' | 'emerald' | 'sunset' | 'custom';

export interface ThemeColors {
  bg: string;
  card: string;
  border: string;
  title: string;
  text: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  badgeBg: string;
}

export interface CopyProgressState {
  activo: boolean;
  completado: boolean;
  cancelado: boolean;
  juegoActualIdx: number;
  totalJuegos: number;
  juegoNombreActual: string;
  archivoNombreActual: string;
  bytesTransferidos: number;
  bytesTotales: number;
  velocidadBytesSeg: number;
  tiempoRestanteSeg: number;
  totalCopiados: number;
  totalOmitidos: number;
  totalErrores: number;
  logs: Array<{ id: string; time: string; msg: string; type: 'info' | 'success' | 'warn' | 'error' | 'skip' }>;
}

export type ViewMode = 'table' | 'grid' | 'grouped-system' | 'duplicates';

export interface FilterOptions {
  search: string;
  sistema: string;
  genero: string;
  anio: string;
  region: string;
  soloM3U: boolean;
  soloSeleccionados: boolean;
  soloDuplicados: boolean;
  filtroRolDuplicado: 'all' | 'original' | 'descarte' | 'ambos_validos';
  tag: string;
}
