# Widget Combustible

Widget de [Scriptable](https://scriptable.app/) para iOS que muestra la disponibilidad de **Gasolina Especial** en múltiples estaciones de servicio en Santa Cruz, Bolivia.

## Estaciones monitoreadas

| Estación | Empresa | Fuente | Tipo |
|----------|---------|--------|------|
| Genex Banzer | Genex | genex.com.bo | HTML scraping |
| Vangas | Genex | genex.com.bo | HTML scraping |
| Urubó | Orsa | gasgroup.com.bo | API JSON |
| Equipetrol | Biopetrol | ec2 API | HTML scraping |
| Pirai | Biopetrol | ec2 API | HTML scraping |
| Alemana | Biopetrol | ec2 API | HTML scraping |
| López | Biopetrol | ec2 API | HTML scraping |
| Viru Viru | Biopetrol | ec2 API | HTML scraping |
| Gasco | Biopetrol | ec2 API | HTML scraping |
| Rivero | Rivero | Google Sheets | Chart JSON parsing |

## Funcionalidad

- Consulta en tiempo real los litros disponibles de cada estación
- Widget tamaño **Large** con todas las estaciones ordenadas por disponibilidad
- Indicador visual (punto verde/rojo) por estación
- Nombre de estación, empresa y litros disponibles en cada fila
- Separadores visuales entre filas a ancho completo
- Hora de última consulta y contador de estaciones disponibles
- Soporte para modo claro y oscuro
- **Navegación con Waze**: al tocar el widget se muestra un menú para navegar directamente a cualquier estación
- Vista previa del widget al tocar antes del menú de navegación
- Umbral mínimo de 1,500 Lts para datos de Gasgroup/Orsa (filtra datos poco confiables)
- Caché de requests HTTP/JSON para evitar consultas duplicadas a la misma URL
- Español neutro en toda la interfaz

## Fuentes de datos

| Tipo | Método | Estaciones |
|------|--------|------------|
| `genex` | Scraping HTML de genex.com.bo | Genex Banzer, Vangas |
| `ec2` | Scraping HTML de API Biopetrol (EC2) | Equipetrol, Pirai, Alemana, López, Viru Viru, Gasco |
| `gasgroup` | API JSON de gasgroup.com.bo | Urubó |
| `gsheets` | Parsing de chartJson embebido en Google Sheets | Rivero |

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `all-stations-widget.js` | Widget principal con todas las estaciones |
| `loader-combustible.js` | Loader que descarga y ejecuta el widget desde GitHub |
| `loader-test.js` | Loader de pruebas |
| `fuel-widget.js` | Widget original (solo Genex Banzer, tamaño pequeño) |
| `Equipetrol/` | Widget individual — Equipetrol |
| `Pirai/` | Widget individual — Pirai |
| `Urubo/` | Widget individual — Urubó |
| `Vangas/` | Widget individual — Vangas |
| `Rivero/` | Widget individual — Rivero |

## Instalación

1. Instalar [Scriptable](https://apps.apple.com/app/scriptable/id1405459188) en tu iPhone
2. Crear un nuevo script en Scriptable y pegar el contenido del loader:

```js
// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: gas-pump;

const REPO_OWNER = "calepes";
const REPO_NAME = "Widget-combustible";
const BRANCH = "main";
const FILE = "all-stations-widget.js";

const API_URL = "https://api.github.com/repos/" + REPO_OWNER + "/" + REPO_NAME + "/contents/" + FILE + "?ref=" + encodeURIComponent(BRANCH);

const fm = FileManager.iCloud();
const dir = fm.joinPath(fm.documentsDirectory(), "combustible-cache");
const localPath = fm.joinPath(dir, "all-stations-widget.js");

if (!fm.fileExists(dir)) {
  fm.createDirectory(dir, true);
}

let code;

try {
  const req = new Request(API_URL);
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

await eval("(async () => { " + code + " })()");
```

3. Agregar un widget de Scriptable (tamaño **Large**) al Home Screen
4. Seleccionar el script creado en la configuración del widget

El loader descarga automáticamente la última versión del widget desde este repositorio. Si no hay conexión, usa la copia local en caché.

## Uso

- **En Home Screen**: el widget se actualiza automáticamente mostrando disponibilidad de todas las estaciones
- **Al tocar el widget**: muestra una vista previa actualizada y luego un menú para navegar con Waze a la estación seleccionada
