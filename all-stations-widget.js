/***********************
 * ESTACIONES – CONFIG
 ***********************/
const STATIONS = [
  {
    name: "Genex Banzer",
    type: "genex",
    url:
      "https://genex.com.bo/estaciones/" +
      "?3142_product_cat%5B0%5D=294" +
      "&3142_tax_product_tag%5B0%5D=314" +
      "&3142_orderby=option_1" +
      "&3142_filtered=true",
    key: "GENEX I",
    fuel: "G. ESPECIAL+",
  },
  {
    name: "Vangas",
    type: "genex",
    url: "https://genex.com.bo/estaciones/",
    key: "VANGAS",
    fuel: "G. ESPECIAL+",
  },
  {
    name: "Urubó",
    type: "gasgroup",
    url: "https://gasgroup.com.bo/api/obtener-datos-temporales/CTqmwWgj",
    product: "GASOLINA ESPECIAL",
  },
  {
    name: "Equipetrol",
    type: "ec2",
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "EQUIPETROL",
  },
  {
    name: "Pirai",
    type: "ec2",
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "PIRAI",
  },
  {
    name: "Alemana",
    type: "ec2",
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "Alemana",
  },
  {
    name: "López",
    type: "ec2",
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "Lopez",
  },
  {
    name: "Viru Viru",
    type: "ec2",
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "Viru Viru",
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

function parseGasGroup(json, product) {
  if (!json?.data?.tanques) return 0;
  let total = 0;
  for (const t of json.data.tanques) {
    if (t.producto?.toUpperCase().includes(product)) {
      total += t.volumen || 0;
    }
  }
  return Math.round(total);
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
  return 0;
}

const results = await Promise.all(
  STATIONS.map(async (s) => ({
    name: s.name,
    litros: await fetchStation(s),
  }))
);

// Ordenar: mayor disponibilidad primero, sin dato al final
results.sort((a, b) => b.litros - a.litros);

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

/***********************
 * WIDGET LARGE
 ***********************/
const w = new ListWidget();
w.backgroundColor = Color.dynamic(
  new Color("#FFFFFF"),
  new Color("#000000")
);
w.setPadding(12, 14, 10, 14);

// ── HEADER
const headerStack = w.addStack();
headerStack.layoutVertically();

const headerRow = headerStack.addStack();
headerRow.layoutHorizontally();
headerRow.centerAlignContent();

const fuelIcon = headerRow.addText("\u26FD");
fuelIcon.font = Font.systemFont(18);
headerRow.addSpacer(6);

const header = headerRow.addText("Combustible");
header.font = Font.boldRoundedSystemFont(20);
header.textColor = textPrimary;

const subtitle = headerStack.addText("Gasolina Especial");
subtitle.font = Font.roundedSystemFont(11);
subtitle.textColor = textSecondary;

w.addSpacer(8);

// ── FILAS DE ESTACIONES
const sepColor = Color.dynamic(
  new Color("#E5E5EA"),
  new Color("#3A3A3C")
);

for (let i = 0; i < results.length; i++) {
  const r = results[i];

  const row = w.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  row.setPadding(0, 4, 0, 4);

  // Indicador de estado (punto)
  const dot = row.addText("●");
  dot.font = Font.systemFont(6);
  dot.textColor = r.litros > 0 ? colorGreen : colorRed;

  row.addSpacer(6);

  // Nombre estación
  const nameText = row.addText(r.name);
  nameText.font = Font.mediumRoundedSystemFont(13);
  nameText.textColor = textPrimary;
  nameText.lineLimit = 1;

  row.addSpacer();

  // Litros (monoespaciado para alinear)
  const litrosStr = r.litros > 0
    ? `${r.litros.toLocaleString("es-BO")} Lts`
    : "Sin dato";
  const litrosText = row.addText(litrosStr);
  litrosText.font = Font.semiboldMonospacedSystemFont(13);
  litrosText.textColor = r.litros > 0 ? textPrimary : colorRed;
  litrosText.lineLimit = 1;

  // Separador fino entre filas
  if (i < results.length - 1) {
    w.addSpacer(4);
    const sepLine = w.addStack();
    sepLine.layoutHorizontally();
    sepLine.addSpacer(24);
    const line = sepLine.addText("─".repeat(40));
    line.font = Font.systemFont(3);
    line.textColor = sepColor;
    sepLine.addSpacer(8);
    w.addSpacer(4);
  }
}

// Empujar al fondo
w.addSpacer();

// ── METADATA
const metaStack = w.addStack();
metaStack.layoutHorizontally();

const hh = String(now.getHours()).padStart(2, "0");
const mm = String(now.getMinutes()).padStart(2, "0");

const meta = metaStack.addText(`Consulta ${hh}:${mm}`);
meta.font = Font.roundedSystemFont(10);
meta.textColor = textSecondary;

metaStack.addSpacer();

const countAvail = results.filter((r) => r.litros > 0).length;
const avail = metaStack.addText(
  `${countAvail}/${results.length} disponibles`
);
avail.font = Font.roundedSystemFont(10);
avail.textColor = countAvail === results.length ? colorGreen : textSecondary;

/***********************
 * PRESENTACIÓN
 ***********************/
if (config.runsInWidget) {
  Script.setWidget(w);
} else {
  await w.presentLarge();
}

Script.complete();
