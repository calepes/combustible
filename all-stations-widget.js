/***********************
 * ESTACIONES – CONFIG
 ***********************/
const STATIONS = [
  {
    name: "Genex Banzer",
    type: "genex",
    company: "Genex",
    lat: -17.7580, lon: -63.1783,
    url:
      "https://genex.com.bo/estaciones/" +
      "?3142_product_cat%5B0%5D=294" +
      "&3142_tax_product_tag%5B0%5D=314" +
      "&3142_orderby=option_1" +
      "&3142_filtered=true",
    key: "GENEX I",
    fuel: "G. ESPECIAL+",
    waze: "https://waze.com/ul?q=Genex%20Banzer%203er%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "Vangas",
    type: "genex",
    company: "Genex",
    lat: -17.8100, lon: -63.1650,
    url: "https://genex.com.bo/estaciones/",
    key: "VANGAS",
    fuel: "G. ESPECIAL+",
    waze: "https://waze.com/ul?q=Vangas%20Hernando%20Sanabria%204to%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "Urubó",
    type: "gasgroup",
    company: "Orsa",
    lat: -17.7533, lon: -63.2213,
    url: "https://gasgroup.com.bo/api/obtener-datos-temporales/CTqmwWgj",
    product: "GASOLINA ESPECIAL",
    waze: "https://waze.com/ul?q=Orsa%20Urubo%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "Equipetrol",
    type: "ec2",
    company: "Biopetrol",
    lat: -17.7542, lon: -63.1967,
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "EQUIPETROL",
    waze: "https://waze.com/ul?q=Biopetrol%20Equipetrol%204to%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "Pirai",
    type: "ec2",
    company: "Biopetrol",
    lat: -17.7800, lon: -63.2000,
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "PIRAI",
    waze: "https://waze.com/ul?q=Biopetrol%20Pirai%20Roca%20y%20Coronado%203er%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "Alemana",
    type: "ec2",
    company: "Biopetrol",
    lat: -17.7718, lon: -63.1682,
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "Alemana",
    waze: "https://waze.com/ul?q=Biopetrol%20Alemana%202do%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "López",
    type: "ec2",
    company: "Biopetrol",
    lat: -17.7400, lon: -63.2200,
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "Lopez",
    waze: "https://waze.com/ul?q=Biopetrol%20Lopez%20Banzer%207mo%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "Viru Viru",
    type: "ec2",
    company: "Biopetrol",
    lat: -17.7200, lon: -63.1700,
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "Viru Viru",
    waze: "https://waze.com/ul?q=Biopetrol%20Viru%20Viru%20Banzer%20Km%2010%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "Gasco",
    type: "ec2",
    company: "Biopetrol",
    lat: -17.7580, lon: -63.1783,
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "Gasco",
    waze: "https://waze.com/ul?q=Biopetrol%20Gasco%20Banzer%203er%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "Rivero",
    type: "gsheets",
    company: "Rivero",
    lat: -17.7700, lon: -63.1900,
    url:
      "https://docs.google.com/spreadsheets/u/0/d/e/" +
      "2CAIWO3els60V5S1vVAh0cccQxdcZ1MYZhD9A1pQ-ojCNPoNh-" +
      "vJjHhJaUalVsDLQivYf_Z23Un8mEaePxSg" +
      "/gviz/chartiframe?oid=1546358769&resourcekey",
    product: "ESPECIAL",
    waze: "https://waze.com/ul?q=Surtidor%20Rivero%20Banzer%20Km%201.5%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
];

/***********************
 * HELPERS
 ***********************/
function normalizeLiters(raw) {
  if (!raw) return 0;
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

// Limpia caracteres invisibles de URLs (problema de copy-paste)
function sanitizeURL(url) {
  return url.replace(/[<>\u200B\u200C\u200D\uFEFF\u00AD\u2060]/g, "").trim();
}

// Haversine — distancia en línea recta (fallback)
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// OSRM — distancia real por ruta (driving)
async function osrmDistances(originLat, originLon, stations) {
  try {
    const coords = [`${originLon},${originLat}`];
    for (const s of stations) {
      coords.push(`${s.lon},${s.lat}`);
    }
    const url = `https://router.project-osrm.org/table/v1/driving/${coords.join(";")}?sources=0&annotations=distance`;
    const cleanUrl = sanitizeURL(url);
    const r = new Request(cleanUrl);
    r.timeoutInterval = 10;
    const json = await r.loadJSON();
    if (json && json.code === "Ok" && json.distances && json.distances[0]) {
      return json.distances[0].slice(1).map((m) => m / 1000);
    }
    return null;
  } catch (e) {
    console.log("OSRM ERROR: " + e.message);
    return null;
  }
}

/***********************
 * FETCH + PARSE
 ***********************/
async function fetchHTML(url, insecure) {
  const r = new Request(url);
  r.timeoutInterval = 15;
  if (insecure) r.allowInsecureLoads = true;
  r.headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS like Mac OS X)",
    Accept: "text/html",
  };
  try {
    return await r.loadString();
  } catch (_) {
    return "";
  }
}

async function fetchJSON(url) {
  const r = new Request(url);
  r.timeoutInterval = 15;
  r.headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS like Mac OS X)",
  };
  try {
    return await r.loadJSON();
  } catch (_) {
    return null;
  }
}

function parseGenex(html, key, fuel) {
  if (!html) return 0;
  const clean = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ");

  const escapedFuel = fuel
    .replace(/\./g, "\\.")
    .replace(/\+/g, "\\+");

  const re = new RegExp(
    `${key}[\\s\\S]*?${escapedFuel}[\\s\\S]*?(\\d{1,3}(?:[\\.,]\\d{3})*|\\d+)\\s*litros`,
    "i"
  );
  const m = clean.match(re);
  return m ? normalizeLiters(m[1]) : 0;
}

function parseEC2(html, key) {
  if (!html) return 0;
  const clean = html.replace(/\s+/g, " ");
  const re = new RegExp(
    `${key}[\\s\\S]*?Volumen disponible[\\s\\S]*?(\\d{1,3}(?:,\\d{3})*)\\s*Lts`,
    "i"
  );
  const m = clean.match(re);
  return m ? normalizeLiters(m[1]) : 0;
}

const GASGROUP_MIN_LITROS = 1500;

function parseGasGroup(json, product) {
  if (!json?.data?.tanques) return 0;
  let total = 0;
  for (const t of json.data.tanques) {
    if (t.producto?.toUpperCase().includes(product)) {
      total += t.volumen || 0;
    }
  }
  const rounded = Math.round(total);
  return rounded >= GASGROUP_MIN_LITROS ? rounded : 0;
}

function parseChartJson(html, product) {
  if (!html) return 0;
  const upper = product.toUpperCase();
  // Google Sheets chartiframe embeds data in chartJson as hex-escaped JSON
  // e.g. 'chartJson': '\x7b\x22dataTable\x22:...\x7d'
  const m = html.match(/'chartJson'\s*:\s*'((?:[^'\\]|\\.)*)'/);
  if (!m) return 0;
  try {
    // Unescape JS string escapes left-to-right: \\ then \xNN
    const unescaped = m[1].replace(/\\(x([0-9a-fA-F]{2})|.)/g, (match, esc, hex) => {
      if (hex) return String.fromCharCode(parseInt(hex, 16));
      if (esc === '\\') return '\\';
      if (esc === "'") return "'";
      if (esc === 'n') return '\n';
      return esc;
    });
    const chart = JSON.parse(unescaped);
    const rows = chart?.dataTable?.rows;
    if (rows) {
      for (const row of rows) {
        const cells = row.c || [];
        const hasProduct = cells.some(
          (c) =>
            typeof c?.v === "string" &&
            c.v.toUpperCase().includes(upper)
        );
        if (!hasProduct) continue;
        for (const c of cells) {
          if (typeof c?.v === "number" && c.v > 0)
            return Math.round(c.v);
        }
      }
    }
  } catch (_) {}
  return 0;
}

/***********************
 * FETCH ALL (paralelo)
 ***********************/
const htmlCache = {};
const jsonCache = {};

async function getHTML(url, insecure) {
  if (!htmlCache[url]) {
    htmlCache[url] = fetchHTML(url, insecure);
  }
  return htmlCache[url];
}

async function getJSON(url) {
  if (!jsonCache[url]) {
    jsonCache[url] = fetchJSON(url);
  }
  return jsonCache[url];
}

async function fetchStation(s) {
  if (s.type === "genex") {
    const html = await getHTML(s.url, false);
    return parseGenex(html, s.key, s.fuel);
  }
  if (s.type === "ec2") {
    const html = await getHTML(s.url, true);
    return parseEC2(html, s.key);
  }
  if (s.type === "gasgroup") {
    const json = await getJSON(s.url);
    return parseGasGroup(json, s.product);
  }
  if (s.type === "gsheets") {
    const html = await getHTML(s.url, false);
    return parseChartJson(html, s.product);
  }
  return 0;
}

// Obtener ubicación primero
let userLat = null;
let userLon = null;
try {
  const loc = await Location.current();
  if (loc) {
    userLat = loc.latitude;
    userLon = loc.longitude;
  }
} catch (_) {}

const stationResults = await Promise.all(
  STATIONS.map(async (s) => ({
    name: s.name,
    company: s.company,
    lat: s.lat,
    lon: s.lon,
    litros: await fetchStation(s),
  }))
);

// Calcular distancia (OSRM por ruta, fallback Haversine)
let routeDistances = null;
if (userLat != null) {
  routeDistances = await osrmDistances(userLat, userLon, stationResults);
}

const results = stationResults.map((r, i) => ({
  ...r,
  distKm: userLat != null
    ? (routeDistances != null ? routeDistances[i] : haversineKm(userLat, userLon, r.lat, r.lon))
    : null,
}));

// Ordenar por distancia si hay ubicación, sino por litros
if (userLat != null) {
  results.sort((a, b) => a.distKm - b.distKm);
} else {
  results.sort((a, b) => b.litros - a.litros);
}

const now = new Date();

/***********************
 * COLORES
 ***********************/
const textPrimary = Color.dynamic(
  new Color("#000000"),
  new Color("#FFFFFF")
);
const textSecondary = Color.dynamic(
  new Color("#6D6D72"),
  new Color("#8E8E93")
);
const textTertiary = Color.dynamic(
  new Color("#AEAEB2"),
  new Color("#636366")
);
const systemBlue = Color.dynamic(
  new Color("#007AFF"),
  new Color("#0A84FF")
);
const colorRed = new Color("#FF3B30");
const colorGreen = new Color("#34C759");

// Color de distancia: verde (cerca) → naranja → rojo (lejos) en 0–15 km
function distanceColor(km) {
  const t = Math.min(km / 15, 1);
  const r = Math.round(t < 0.5 ? 52 + t * 2 * 199 : 239 + (1 - t) * 2 * 12);
  const g = Math.round(t < 0.5 ? 211 - t * 2 * 65 : 146 - (t - 0.5) * 2 * 78);
  const b = Math.round(t < 0.5 ? 153 - t * 2 * 93 : 60 - (t - 0.5) * 2 * (60 - 68));
  return new Color(`#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`);
}
const sepColor = Color.dynamic(
  new Color("#C6C6C8"),
  new Color("#38383A")
);

/***********************
 * WIDGET LARGE
 ***********************/
const w = new ListWidget();
w.backgroundColor = Color.dynamic(
  new Color("#F2F2F7"),
  new Color("#000000")
);
w.setPadding(12, 16, 8, 16);

// ── HEADER ─────────────────────────────
const headerStack = w.addStack();
headerStack.layoutHorizontally();
headerStack.centerAlignContent();

const titleCol = headerStack.addStack();
titleCol.layoutVertically();

const header = titleCol.addText("Combustible (test)");
header.font = Font.boldSystemFont(16);
header.textColor = textPrimary;

const subtitle = titleCol.addText("Gasolina Especial · Santa Cruz");
subtitle.font = Font.systemFont(11);
subtitle.textColor = textSecondary;

headerStack.addSpacer();

// Pill – estaciones con stock
const countAvail = results.filter((r) => r.litros > 0).length;
const pill = headerStack.addStack();
pill.layoutHorizontally();
pill.centerAlignContent();
pill.backgroundColor = new Color(systemBlue.hex, 0.12);
pill.cornerRadius = 10;
pill.setPadding(2, 7, 2, 7);

const pillText = pill.addText(`${countAvail}/${results.length}`);
pillText.font = Font.boldSystemFont(12);
pillText.textColor = systemBlue;

w.addSpacer(6);

// ── CONTENEDOR DE LISTA (fondo tarjeta) ──
const listCard = w.addStack();
listCard.layoutVertically();
listCard.backgroundColor = Color.dynamic(
  new Color("#FFFFFF"),
  new Color("#1C1C1E")
);
listCard.cornerRadius = 12;
listCard.setPadding(2, 10, 2, 10);

for (let i = 0; i < results.length; i++) {
  const r = results[i];

  const row = listCard.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  row.setPadding(6, 0, 6, 0);

  // Indicador de estado (punto)
  const dot = row.addText("●");
  dot.font = Font.systemFont(6);
  dot.textColor = r.litros > 0 ? colorGreen : colorRed;

  row.addSpacer(8);

  // Nombre estación
  const nameText = row.addText(r.name);
  nameText.font = Font.semiboldSystemFont(13);
  nameText.textColor = textPrimary;
  nameText.lineLimit = 1;
  nameText.minimumScaleFactor = 0.8;

  row.addSpacer(6);

  // Empresa
  const companyText = row.addText(r.company);
  companyText.font = Font.systemFont(11);
  companyText.textColor = textTertiary;
  companyText.lineLimit = 1;

  // Distancia
  if (r.distKm != null) {
    row.addSpacer(4);
    const distStr = r.distKm < 1
      ? `${Math.round(r.distKm * 1000)} m`
      : `${r.distKm.toFixed(1)} km`;
    const distText = row.addText(distStr);
    distText.font = Font.systemFont(10);
    distText.textColor = distanceColor(r.distKm);
    distText.lineLimit = 1;
  }

  row.addSpacer();

  // Litros
  const litrosStr = r.litros > 0
    ? `${r.litros.toLocaleString("es-BO")} L`
    : "Sin dato";
  const litrosText = row.addText(litrosStr);
  litrosText.font = Font.mediumSystemFont(13);
  litrosText.textColor = r.litros > 0 ? textPrimary : colorRed;
  litrosText.lineLimit = 1;

  // Separador entre filas (1px real, no texto)
  if (i < results.length - 1) {
    const sepRow = listCard.addStack();
    sepRow.layoutHorizontally();
    sepRow.addSpacer(22); // alinear con el texto (después del dot)
    const line = sepRow.addStack();
    line.backgroundColor = sepColor;
    line.size = new Size(0, 0.5);
    line.addSpacer();
  }
}

// Empujar footer al fondo
w.addSpacer();

// ── FOOTER ─────────────────────────────
const footerStack = w.addStack();
footerStack.layoutHorizontally();
footerStack.centerAlignContent();

const hh = String(now.getHours()).padStart(2, "0");
const mm = String(now.getMinutes()).padStart(2, "0");

footerStack.addSpacer();

const meta = footerStack.addText(`Actualizado ${hh}:${mm}`);
meta.font = Font.mediumSystemFont(10);
meta.textColor = textSecondary;

/***********************
 * PRESENTACIÓN
 ***********************/
Script.setWidget(w);

if (config.runsInWidget) {
  // En home screen: solo actualizar datos
} else {
  // Al tocar: mostrar widget actualizado y luego menú Waze
  await w.presentLarge();

  const alert = new Alert();
  alert.title = "Navegar a estación";
  alert.message = "Selecciona una estación para abrir en Waze";

  for (const r of results) {
    const status = r.litros > 0
      ? `${r.litros.toLocaleString("es-BO")} L`
      : "Sin dato";
    const dist = r.distKm != null
      ? ` · ${r.distKm.toFixed(1)} km`
      : "";
    alert.addAction(`${r.name} — ${status}${dist}`);
  }
  alert.addCancelAction("Cancelar");

  const idx = await alert.presentSheet();
  if (idx >= 0 && idx < results.length) {
    const selected = results[idx];
    const station = STATIONS.find((s) => s.name === selected.name);
    if (station?.waze) {
      Safari.open(station.waze);
    }
  }
}

Script.complete();
