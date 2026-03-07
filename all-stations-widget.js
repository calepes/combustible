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

// Cache de fetches para no duplicar requests a la misma URL
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

// Fetch en paralelo
const results = await Promise.all(
  STATIONS.map(async (s) => ({
    name: s.name,
    litros: await fetchStation(s),
  }))
);

const now = new Date();

/***********************
 * WIDGET LARGE
 ***********************/
const w = new ListWidget();
w.backgroundColor = Color.dynamic(
  new Color("#FFFFFF"),
  new Color("#000000")
);
w.setPadding(16, 16, 16, 16);

// ── HEADER
const header = w.addText("Combustible");
header.font = Font.boldSystemFont(24);
header.textColor = Color.dynamic(
  new Color("#000000"),
  new Color("#FFFFFF")
);

w.addSpacer(4);

// Línea separadora sutil
const sep = w.addText("─".repeat(30));
sep.font = Font.systemFont(8);
sep.textColor = Color.dynamic(
  new Color("#C7C7CC"),
  new Color("#38383A")
);

w.addSpacer(8);

// ── FILAS DE ESTACIONES
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

for (let i = 0; i < results.length; i++) {
  const r = results[i];

  const row = w.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();

  // Indicador de estado (punto)
  const dot = row.addText(r.litros > 0 ? "●" : "●");
  dot.font = Font.systemFont(10);
  dot.textColor = r.litros > 0 ? colorGreen : colorRed;

  row.addSpacer(8);

  // Nombre estación
  const nameText = row.addText(r.name);
  nameText.font = Font.mediumSystemFont(16);
  nameText.textColor = textPrimary;
  nameText.lineLimit = 1;

  row.addSpacer();

  // Litros
  const litrosText = row.addText(
    r.litros > 0
      ? `${r.litros.toLocaleString("es-BO")} Lts`
      : "Sin dato"
  );
  litrosText.font = Font.systemFont(16);
  litrosText.textColor = r.litros > 0 ? textPrimary : colorRed;
  litrosText.lineLimit = 1;

  // Espaciado entre filas
  if (i < results.length - 1) {
    w.addSpacer(10);
  }
}

// Empujar metadata al fondo
w.addSpacer();

// ── Separador inferior
const sep2 = w.addText("─".repeat(30));
sep2.font = Font.systemFont(8);
sep2.textColor = Color.dynamic(
  new Color("#C7C7CC"),
  new Color("#38383A")
);

w.addSpacer(4);

// ── METADATA
const hh = String(now.getHours()).padStart(2, "0");
const mm = String(now.getMinutes()).padStart(2, "0");

const meta = w.addText(`Consulta ${hh}:${mm}`);
meta.font = Font.systemFont(11);
meta.textColor = textSecondary;

/***********************
 * PRESENTACIÓN
 ***********************/
if (config.runsInWidget) {
  Script.setWidget(w);
} else {
  await w.presentLarge();
}

Script.complete();
