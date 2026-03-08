// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: gas-pump;

// LOADER TEST - apunta a la rama de pruebas

var REPO_OWNER = "calepes";
var REPO_NAME = "Widget-combustible";
var BRANCH = "test";
var FILE = "all-stations-widget.js";

var API_URL = "https://api.github.com/repos/" + REPO_OWNER + "/" + REPO_NAME + "/contents/" + FILE + "?ref=" + encodeURIComponent(BRANCH);

var fm = FileManager.iCloud();
var dir = fm.joinPath(fm.documentsDirectory(), "combustible-cache-test");
var localPath = fm.joinPath(dir, "all-stations-widget.js");

if (!fm.fileExists(dir)) {
  fm.createDirectory(dir, true);
}

var code;

try {
  var req = new Request(API_URL);
  req.timeoutInterval = 10;
  req.headers = { Accept: "application/vnd.github.v3.raw" };
  code = await req.loadString();

  if (code && code.length > 100 && !code.includes('"message":"Not Found"')) {
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
    var w = new ListWidget();
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

await eval("(async () => { " + code + " })()");
