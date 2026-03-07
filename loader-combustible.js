// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: gas-pump;

/*****************************************************
 * LOADER – Descarga y ejecuta el widget desde GitHub
 *
 * 1. Crea este archivo en Scriptable como "Loader Combustible"
 * 2. El script descarga la ultima version desde GitHub
 * 3. Lo guarda localmente y lo ejecuta
 * 4. Si no hay internet, usa la copia local
 *****************************************************/

const REPO_OWNER = "calepes";
const REPO_NAME = "Widget-combustible";
const BRANCH = "main";
const FILE = "all-stations-widget.js";

const API_URL = "https://api.github.com/repos/" + REPO_OWNER + "/" + REPO_NAME + "/contents/" + FILE + "?ref=" + encodeURIComponent(BRANCH);

const fm = FileManager.iCloud();
const dir = fm.joinPath(fm.documentsDirectory(), "combustible-cache");
const localPath = fm.joinPath(dir, "all-stations-widget.js");

// Crear carpeta cache si no existe
if (!fm.fileExists(dir)) {
  fm.createDirectory(dir, true);
}

let code;

try {
  // Descargar la ultima version desde GitHub
  const req = new Request(API_URL);
  req.timeoutInterval = 10;
  req.headers = { Accept: "application/vnd.github.v3.raw" };
  code = await req.loadString();

  if (code && code.length > 100 && !code.includes('"message":"Not Found"')) {
    // Guardar copia local
    fm.writeString(localPath, code);
    console.log("Widget actualizado desde GitHub");
  } else {
    throw new Error("Respuesta invalida");
  }
} catch (e) {
  console.log("Sin conexion, usando copia local: " + e.message);
  if (fm.fileExists(localPath)) {
    if (fm.isFileStoredIniCloud(localPath) && !fm.isFileDownloaded(localPath)) {
      await fm.downloadFileFromiCloud(localPath);
    }
    code = fm.readString(localPath);
  } else {
    // No hay copia local ni internet
    const w = new ListWidget();
    w.addText("Sin conexion y sin cache local");
    if (config.runsInWidget) {
      Script.setWidget(w);
    } else {
      await w.presentMedium();
    }
    Script.complete();
    return;
  }
}

// Ejecutar el widget descargado
await eval("(async () => { " + code + " })()");
