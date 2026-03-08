/***********************
 * CONFIG
 ***********************/
const URL =
  "https://gasgroup.com.bo/api/obtener-datos-temporales/CTqmwWgj";

const STATION_TITLE = "Urubó";
const PRODUCT_MATCH = "GASOLINA ESPECIAL";

/***********************
 * FETCH JSON
 ***********************/
let json = null;
try {
  const r = new Request(URL);
  r.timeoutInterval = 15;
  r.headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS like Mac OS X)"
  };
  json = await r.loadJSON();
} catch (_) {
  json = null;
}

/***********************
 * EXTRACCIÓN
 ***********************/
const GASGROUP_MIN_LITROS = 1500;
let litros = 0;

if (json?.data?.tanques) {
  for (const t of json.data.tanques) {
    if (t.producto?.toUpperCase().includes(PRODUCT_MATCH)) {
      litros += t.volumen || 0;
    }
  }
}

litros = Math.round(litros);
if (litros < GASGROUP_MIN_LITROS) litros = 0;

/***********************
 * HORA DE CONSULTA
 * (hora real de ejecución)
 ***********************/
const now = new Date();

/***********************
 * WIDGET – Apple HIG
 ***********************/
const w = new ListWidget();
w.backgroundColor = Color.dynamic(
  new Color("#FFFFFF"),
  new Color("#000000")
);

// Padding idéntico a Banzer
w.setPadding(6, 16, 16, 16);

// ── TÍTULO
const title = w.addText(STATION_TITLE);
title.font = Font.semiboldSystemFont(18);
title.textColor = Color.dynamic(
  new Color("#000000"),
  new Color("#FFFFFF")
);
title.lineLimit = 1;
title.minimumScaleFactor = 0.8;

w.addSpacer(6);

// ── VOLUMEN
const value = w.addText(`${litros.toLocaleString("es-BO")} Lts`);
value.font = Font.systemFont(20);
value.textColor =
  litros > 0
    ? Color.dynamic(new Color("#000000"), new Color("#FFFFFF"))
    : new Color("#FF3B30");

// Espaciado igual al widget Banzer
w.addSpacer(34);

// ── CONSULTA (hora de ejecución)
const hh = String(now.getHours()).padStart(2, "0");
const mm = String(now.getMinutes()).padStart(2, "0");

const meta = w.addText(`Consulta ${hh}:${mm}`);
meta.font = Font.systemFont(11);
meta.textColor = Color.dynamic(
  new Color("#6D6D72"),
  new Color("#8E8E93")
);

if (litros === 0) {
  w.addSpacer(2);
  const status = w.addText("Especial no disponible");
  status.font = Font.systemFont(11);
  status.textColor = new Color("#FF3B30");
}

/***********************
 * PRESENTACIÓN
 ***********************/
if (config.runsInWidget) {
  Script.setWidget(w);
} else {
  await w.presentSmall();
}

Script.complete();
