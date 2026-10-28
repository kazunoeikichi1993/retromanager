const { spawn, exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const ROOT_DIR = path.resolve(__dirname, '..');
process.chdir(ROOT_DIR);

function log(msg) {
  console.log(msg);
}

// 1. Ensure node_modules exists
const viteBin = path.join(ROOT_DIR, 'node_modules', 'vite', 'bin', 'vite.js');
if (!fs.existsSync(viteBin)) {
  log('[*] Instalando dependencias de Node.js...');
  try {
    execSync('npm install --legacy-peer-deps', {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });
  } catch (err) {
    log('[!] Reintentando con npm install --force...');
    execSync('npm install --force', {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });
  }
}

console.clear ? console.clear() : null;
log('=========================================================');
log('   RetroBat & Game Library Manager Pro - Windows Launcher');
log('=========================================================');
log('');
log('Selecciona el modo de inicio:');
log('  [1] Modo Aplicacion de Escritorio Ligera (Recomendado)');
log('  [2] Modo Electron Nativo');
log('  [3] Compilar Instalador (.exe)');
log('  [4] Solo Iniciar Servidor Web');
log('');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Opcion (1-4) [1]: ', (ans) => {
  rl.close();
  const option = (ans || '1').trim();

  switch (option) {
    case '1':
      startLightDesktop();
      break;
    case '2':
      startElectron();
      break;
    case '3':
      buildWindowsInstaller();
      break;
    case '4':
      startWebServer();
      break;
    default:
      startLightDesktop();
      break;
  }
});

function startLightDesktop() {
  log('\n[*] Iniciando servidor local en segundo plano...');
  const viteProcess = spawn(process.execPath, [viteBin, '--port', '3000', '--host', '127.0.0.1'], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });

  setTimeout(() => {
    log('[*] Abriendo en modo ventana de aplicacion...');
    const url = 'http://127.0.0.1:3000';
    if (process.platform === 'win32') {
      exec(`start msedge --app=${url}`, (err) => {
        if (err) {
          exec(`start chrome --app=${url}`, (err2) => {
            if (err2) {
              exec(`start ${url}`);
            }
          });
        }
      });
    } else {
      exec(`xdg-open ${url} || open ${url}`);
    }

    log('\n[*] Servidor activo en http://127.0.0.1:3000');
    log('[*] Presiona Ctrl+C en esta consola cuando termines de usar la app.');
  }, 2500);

  process.on('SIGINT', () => {
    viteProcess.kill();
    process.exit(0);
  });
}

function startElectron() {
  log('\n[*] Compilando aplicacion web...');
  execSync(`"${process.execPath}" "${viteBin}" build`, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });

  const electronBin = path.join(ROOT_DIR, 'node_modules', 'electron', 'cli.js');
  const mainScript = path.join(ROOT_DIR, 'electron', 'main.cjs');
  log('[*] Lanzando ventana de Electron...');
  spawn(process.execPath, [electronBin, mainScript], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });
}

function buildWindowsInstaller() {
  log('\n[*] Compilando aplicacion web optimizada...');
  execSync(`"${process.execPath}" "${viteBin}" build`, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });

  const builderBin = path.join(ROOT_DIR, 'node_modules', 'electron-builder', 'cli.js');
  log('[*] Empaquetando instalador de Windows (.exe / NSIS)...');
  execSync(`"${process.execPath}" "${builderBin}" --win`, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });

  log('\n=========================================================');
  log('[OK] Compilacion completada con exito.');
  log('Los instaladores se encuentran en la carpeta:');
  log('   dist-electron\\');
  log('=========================================================\n');
}

function startWebServer() {
  log('\n[*] Iniciando servidor web para toda la red local...');
  spawn(process.execPath, [viteBin, '--port', '3000', '--host', '0.0.0.0'], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });
}
