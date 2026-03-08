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
// Usa la API pública de OSRM (sin API key)
// Retorna array de distancias en km desde el origen a cada destino
async function osrmDistances(originLat, originLon, stations) {
  try {
    // Formato OSRM: lon,lat (invertido)
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
      // distances[0] = distancias desde origen a cada destino (en metros)
      // El primer valor es origen→origen (0), los demás son las estaciones
      return json.distances[0].slice(1).map((m) => m / 1000);
    }
    console.log("OSRM respuesta inesperada: " + JSON.stringify(json).substring(0, 200));
    return null;
  } catch (e) {
    console.log("OSRM ERROR: " + e.message);
    return null;
  }
}

/***********************
 * FETCH + PARSE
 ***********************/
// Limpia caracteres invisibles de URLs (problema de copy-paste)
function sanitizeURL(url) {
  // Eliminar zero-width spaces, BOM, y otros invisibles
  return url.replace(/[<>\u200B\u200C\u200D\uFEFF\u00AD\u2060]/g, "").trim();
}

async function fetchHTML(url, insecure) {
  const cleanUrl = sanitizeURL(url);
  console.log("fetchHTML url: [" + cleanUrl + "]");
  const r = new Request(cleanUrl);
  r.timeoutInterval = 15;
  if (insecure) r.allowInsecureLoads = true;
  r.headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS like Mac OS X)",
    Accept: "text/html",
  };
  try {
    const html = await r.loadString();
    console.log("fetchHTML OK: " + cleanUrl.substring(0, 60) + " → " + html.length + " chars");
    return html;
  } catch (e) {
    console.log("fetchHTML ERROR: " + cleanUrl.substring(0, 60) + " → " + e.message);
    return "";
  }
}

async function fetchJSON(url) {
  const cleanUrl = sanitizeURL(url);
  console.log("fetchJSON url: [" + cleanUrl + "]");
  const r = new Request(cleanUrl);
  r.timeoutInterval = 15;
  r.headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS like Mac OS X)",
  };
  try {
    const json = await r.loadJSON();
    console.log("fetchJSON OK: " + cleanUrl.substring(0, 60) + " → " + JSON.stringify(json).substring(0, 100));
    return json;
  } catch (e) {
    console.log("fetchJSON ERROR: " + cleanUrl.substring(0, 60) + " → " + e.message);
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
  const m = html.match(/'chartJson'\s*:\s*'((?:[^'\\]|\\.)*)'/);
  if (!m) return 0;
  try {
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

// Obtener ubicación primero (puede mostrar diálogo de permisos)
let userLat = null;
let userLon = null;

try {
  const loc = await Location.current();
  if (loc) {
    userLat = loc.latitude;
    userLon = loc.longitude;
  }
} catch (_) {
  // Sin permiso de ubicación — continuar sin distancia
}

// Luego obtener datos de estaciones
console.log("Iniciando fetch de estaciones...");
const stationResults = await Promise.all(
  STATIONS.map(async (s) => {
    const litros = await fetchStation(s);
    console.log(s.name + ": " + litros + " litros");
    return {
      name: s.name,
      company: s.company,
      lat: s.lat,
      lon: s.lon,
      litros: litros,
    };
  })
);
console.log("Fetch completo.");

// Calcular distancia a cada estación (OSRM por ruta, fallback Haversine)
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
const colorRed = new Color("#FF3B30");
const colorGreen = new Color("#34C759");
const cardBg = Color.dynamic(
  new Color("#F2F2F7"),
  new Color("#1C1C1E")
);

/***********************
 * WIDGET LARGE – CARDS
 * Diseño basado en Apple HIG Widgets
 ***********************/
const MAX_ITEMS = 6;
const COLS = 2;
const ROWS = Math.ceil(MAX_ITEMS / COLS);
const WIDGET_PAD = 16;
const CARD_PAD = 10;
const CARD_RADIUS = 14;
const CARD_GAP = 8;

const top = results.slice(0, MAX_ITEMS);
const maxLitros = Math.max(...top.map((r) => r.litros), 1);

const accentBlue = new Color("#0A84FF");
const barBgColor = Color.dynamic(
  new Color("#E5E5EA"),
  new Color("#38383A")
);

const w = new ListWidget();
w.backgroundColor = Color.dynamic(
  new Color("#FFFFFF"),
  new Color("#000000")
);
w.setPadding(WIDGET_PAD, WIDGET_PAD, 12, WIDGET_PAD);

// ── HEADER ─────────────────────────────
const headerStack = w.addStack();
headerStack.layoutHorizontally();
headerStack.centerAlignContent();

const titleCol = headerStack.addStack();
titleCol.layoutVertically();

const header = titleCol.addText("Combustible");
header.font = Font.boldRoundedSystemFont(22);
header.textColor = textPrimary;

const subtitleStr = userLat != null
  ? "Gasolina Especial · Más cercanas"
  : "Gasolina Especial · Santa Cruz";
const subtitle = titleCol.addText(subtitleStr);
subtitle.font = Font.systemFont(12);
subtitle.textColor = textSecondary;

headerStack.addSpacer();

// Badge – estaciones con stock
const countAvail = top.filter((r) => r.litros > 0).length;
const badge = headerStack.addStack();
badge.layoutHorizontally();
badge.centerAlignContent();
badge.backgroundColor = new Color("#0A84FF", 0.12);
badge.cornerRadius = 12;
badge.setPadding(4, 10, 4, 10);

const badgeText = badge.addText(`${countAvail}/${top.length}`);
badgeText.font = Font.boldRoundedSystemFont(14);
badgeText.textColor = accentBlue;

w.addSpacer(12);

// ── GRID DE TARJETAS (2 columnas × 3 filas) ──
function addCard(parent, r) {
  const card = parent.addStack();
  card.layoutVertically();
  card.backgroundColor = cardBg;
  card.cornerRadius = CARD_RADIUS;
  card.setPadding(CARD_PAD, CARD_PAD, CARD_PAD, CARD_PAD);

  const available = r.litros > 0;

  // Fila superior: nombre + indicador de estado
  const topRow = card.addStack();
  topRow.layoutHorizontally();
  topRow.centerAlignContent();

  const label = topRow.addText(r.name);
  label.font = Font.semiboldSystemFont(13);
  label.textColor = textPrimary;
  label.lineLimit = 1;
  label.minimumScaleFactor = 0.8;

  topRow.addSpacer();

  const dot = topRow.addText("●");
  dot.font = Font.systemFont(8);
  dot.textColor = available ? colorGreen : colorRed;

  card.addSpacer(4);

  // Número de litros (dato principal — jerarquía HIG)
  const numRow = card.addStack();
  numRow.layoutHorizontally();
  numRow.bottomAlignContent();
  numRow.spacing = 3;

  const numStr = available
    ? r.litros.toLocaleString("es-BO")
    : "Sin dato";
  const numText = numRow.addText(numStr);
  numText.font = Font.boldRoundedSystemFont(available ? 22 : 14);
  numText.textColor = available ? textPrimary : textSecondary;
  numText.lineLimit = 1;
  numText.minimumScaleFactor = 0.6;

  if (available) {
    const unitText = numRow.addText("L");
    unitText.font = Font.systemFont(13);
    unitText.textColor = textSecondary;
  }

  card.addSpacer(4);

  // Barra de nivel relativo (estilo Apple Health/Fitness)
  const pct = available ? r.litros / maxLitros : 0;

  const barTrack = card.addStack();
  barTrack.layoutHorizontally();
  barTrack.cornerRadius = 3;
  barTrack.backgroundColor = barBgColor;
  barTrack.size = new Size(0, 6);

  if (pct > 0) {
    const barFill = barTrack.addStack();
    barFill.backgroundColor = new Color("#64D2FF");
    barFill.cornerRadius = 3;
    barFill.size = new Size(Math.max(pct * 120, 6), 6);
  }

  card.addSpacer(4);

  // Info secundaria: distancia + empresa
  const infoRow = card.addStack();
  infoRow.layoutHorizontally();
  infoRow.centerAlignContent();

  if (r.distKm != null) {
    const distText = infoRow.addText(
      r.distKm < 1
        ? `${Math.round(r.distKm * 1000)} m`
        : `${r.distKm.toFixed(1)} km`
    );
    distText.font = Font.mediumSystemFont(11);
    distText.textColor = accentBlue;
    distText.lineLimit = 1;

    const sep = infoRow.addText(" · ");
    sep.font = Font.systemFont(11);
    sep.textColor = textSecondary;
  }

  const sub = infoRow.addText(r.company);
  sub.font = Font.systemFont(11);
  sub.textColor = textSecondary;
  sub.lineLimit = 1;
}

for (let row = 0; row < ROWS; row++) {
  const leftIdx = row * COLS;
  const rightIdx = leftIdx + 1;

  const rowStack = w.addStack();
  rowStack.layoutHorizontally();
  rowStack.spacing = CARD_GAP;

  // Tarjeta izquierda
  if (leftIdx < top.length) {
    addCard(rowStack, top[leftIdx]);
  } else {
    rowStack.addSpacer();
  }

  // Tarjeta derecha
  if (rightIdx < top.length) {
    addCard(rowStack, top[rightIdx]);
  } else {
    rowStack.addSpacer();
  }

  // Espacio entre filas
  if (row < ROWS - 1) {
    w.addSpacer(CARD_GAP);
  }
}

// ── FOOTER ─────────────────────────────
w.addSpacer();

const footerStack = w.addStack();
footerStack.layoutHorizontally();
footerStack.centerAlignContent();

const hh = String(now.getHours()).padStart(2, "0");
const mm = String(now.getMinutes()).padStart(2, "0");

const meta = footerStack.addText(`Actualizado ${hh}:${mm}`);
meta.font = Font.mediumSystemFont(11);
meta.textColor = textSecondary;

footerStack.addSpacer();

/***********************
 * PRESENTACIÓN
 ***********************/
Script.setWidget(w);

if (config.runsInWidget) {
  // En home screen: solo actualizar datos
} else {
  await w.presentLarge();

  const alert = new Alert();
  alert.title = "Navegar a estación";
  alert.message = "Selecciona una estación para abrir en Waze";

  for (const r of results) {
    const litros = r.litros > 0
      ? `${r.litros.toLocaleString("es-BO")} L`
      : "Sin dato";
    const dist = r.distKm != null
      ? ` · ${r.distKm.toFixed(1)} km`
      : "";
    alert.addAction(`${r.name} — ${litros}${dist}`);
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
