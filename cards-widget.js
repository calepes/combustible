/***********************
 * ESTACIONES – CONFIG
 ***********************/
const STATIONS = [
  {
    name: "Genex Banzer",
    type: "genex",
    company: "Genex",
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
    url: "https://genex.com.bo/estaciones/",
    key: "VANGAS",
    fuel: "G. ESPECIAL+",
    waze: "https://waze.com/ul?q=Vangas%20Hernando%20Sanabria%204to%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "Urubó",
    type: "gasgroup",
    company: "Orsa",
    url: "https://gasgroup.com.bo/api/obtener-datos-temporales/CTqmwWgj",
    product: "GASOLINA ESPECIAL",
    waze: "https://waze.com/ul?q=Orsa%20Urubo%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "Equipetrol",
    type: "ec2",
    company: "Biopetrol",
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "EQUIPETROL",
    waze: "https://waze.com/ul?q=Biopetrol%20Equipetrol%204to%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "Pirai",
    type: "ec2",
    company: "Biopetrol",
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "PIRAI",
    waze: "https://waze.com/ul?q=Biopetrol%20Pirai%20Roca%20y%20Coronado%203er%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "Alemana",
    type: "ec2",
    company: "Biopetrol",
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "Alemana",
    waze: "https://waze.com/ul?q=Biopetrol%20Alemana%202do%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "López",
    type: "ec2",
    company: "Biopetrol",
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "Lopez",
    waze: "https://waze.com/ul?q=Biopetrol%20Lopez%20Banzer%207mo%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "Viru Viru",
    type: "ec2",
    company: "Biopetrol",
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "Viru Viru",
    waze: "https://waze.com/ul?q=Biopetrol%20Viru%20Viru%20Banzer%20Km%2010%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "Gasco",
    type: "ec2",
    company: "Biopetrol",
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "Gasco",
    waze: "https://waze.com/ul?q=Biopetrol%20Gasco%20Banzer%203er%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "Rivero",
    type: "gsheets",
    company: "Rivero",
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

const results = await Promise.all(
  STATIONS.map(async (s) => ({
    name: s.name,
    company: s.company,
    litros: await fetchStation(s),
  }))
);

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
const cardBg = Color.dynamic(
  new Color("#F2F2F7"),
  new Color("#1C1C1E")
);

/***********************
 * WIDGET LARGE – STATS
 ***********************/
const MAX_ITEMS = 8;
const COLS = 2;
const ROWS = Math.ceil(MAX_ITEMS / COLS);
const WIDGET_PAD = 16;
const CARD_GAP = 20;

// Large widget is ~360pt wide on most iPhones
const WIDGET_WIDTH = 360;
const CELL_WIDTH = Math.floor(
  (WIDGET_WIDTH - WIDGET_PAD * 2 - CARD_GAP) / COLS
);

// Top 8 stations
const top = results.slice(0, MAX_ITEMS);

// Accent colors
const accentBlue = new Color("#0A84FF");
const accentCyan = new Color("#64D2FF");
const separatorColor = Color.dynamic(
  new Color("#E5E5EA"),
  new Color("#38383A")
);

const w = new ListWidget();
w.backgroundColor = Color.dynamic(
  new Color("#FFFFFF"),
  new Color("#000000")
);
w.setPadding(14, WIDGET_PAD, 10, WIDGET_PAD);

// ── HEADER
const headerStack = w.addStack();
headerStack.layoutHorizontally();
headerStack.centerAlignContent();

const fuelIcon = headerStack.addText("⛽");
fuelIcon.font = Font.systemFont(22);

headerStack.addSpacer(8);

const titleCol = headerStack.addStack();
titleCol.layoutVertically();

const header = titleCol.addText("Combustible");
header.font = Font.boldRoundedSystemFont(20);
header.textColor = textPrimary;

const subtitle = titleCol.addText("Gasolina Especial · Santa Cruz");
subtitle.font = Font.systemFont(11);
subtitle.textColor = textSecondary;

headerStack.addSpacer();

// Badge – con stock count
const countAvail = top.filter((r) => r.litros > 0).length;
const badge = headerStack.addStack();
badge.layoutHorizontally();
badge.centerAlignContent();
badge.backgroundColor = new Color("#0A84FF", 0.15);
badge.cornerRadius = 10;
badge.setPadding(4, 8, 4, 8);

const badgeText = badge.addText(`${countAvail}/${top.length}`);
badgeText.font = Font.boldRoundedSystemFont(13);
badgeText.textColor = accentBlue;

w.addSpacer(12);

// ── STATS GRID (2 columns x 4 rows)
for (let row = 0; row < ROWS; row++) {
  const rowStack = w.addStack();
  rowStack.layoutHorizontally();
  rowStack.spacing = CARD_GAP;

  for (let col = 0; col < COLS; col++) {
    const idx = row * COLS + col;

    if (idx < top.length) {
      const r = top[idx];
      const available = r.litros > 0;

      // Cell – fixed equal width for symmetry
      const cell = rowStack.addStack();
      cell.layoutVertically();
      cell.spacing = 2;
      cell.size = new Size(CELL_WIDTH, 0);

      // Label: STATION NAME (uppercase, accent color)
      const label = cell.addText(r.name.toUpperCase());
      label.font = Font.boldSystemFont(10);
      label.textColor = accentBlue;
      label.lineLimit = 1;
      label.minimumScaleFactor = 0.8;

      // Number + unit on the same line
      const numRow = cell.addStack();
      numRow.layoutHorizontally();
      numRow.centerAlignContent();
      numRow.spacing = 4;

      const numStr = available
        ? r.litros.toLocaleString("es-BO")
        : "—";
      const numText = numRow.addText(numStr);
      numText.font = Font.boldRoundedSystemFont(22);
      numText.textColor = available ? textPrimary : colorRed;
      numText.lineLimit = 1;
      numText.minimumScaleFactor = 0.6;

      if (available) {
        const unitText = numRow.addText("L");
        unitText.font = Font.systemFont(13);
        unitText.textColor = textSecondary;
      }

      // Company subtitle
      const sub = cell.addText(r.company);
      sub.font = Font.systemFont(10);
      sub.textColor = textSecondary;
      sub.lineLimit = 1;
    } else {
      // Empty cell to keep symmetry
      const emptyCell = rowStack.addStack();
      emptyCell.size = new Size(CELL_WIDTH, 0);
      emptyCell.addSpacer();
    }
  }

  // Separator between rows
  if (row < ROWS - 1) {
    w.addSpacer(6);
    const sep = w.addStack();
    sep.backgroundColor = separatorColor;
    sep.size = new Size(0, 0.5);
    w.addSpacer(6);
  }
}

// ── FOOTER
w.addSpacer();

const sep2 = w.addStack();
sep2.backgroundColor = separatorColor;
sep2.size = new Size(0, 0.5);

w.addSpacer(6);

const footerStack = w.addStack();
footerStack.layoutHorizontally();
footerStack.centerAlignContent();

const hh = String(now.getHours()).padStart(2, "0");
const mm = String(now.getMinutes()).padStart(2, "0");

const meta = footerStack.addText(`Actualizado ${hh}:${mm}`);
meta.font = Font.mediumSystemFont(10);
meta.textColor = textSecondary;

footerStack.addSpacer();

const liveStack = footerStack.addStack();
liveStack.layoutHorizontally();
liveStack.centerAlignContent();
liveStack.backgroundColor = new Color("#34C759", 0.15);
liveStack.cornerRadius = 8;
liveStack.setPadding(3, 6, 3, 6);

const liveDot = liveStack.addText("●");
liveDot.font = Font.systemFont(6);
liveDot.textColor = colorGreen;

liveStack.addSpacer(3);

const liveLabel = liveStack.addText("EN VIVO");
liveLabel.font = Font.boldSystemFont(9);
liveLabel.textColor = colorGreen;

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

  for (const r of top) {
    const status = r.litros > 0
      ? `${r.litros.toLocaleString("es-BO")} L`
      : "— Sin dato";
    alert.addAction(`${r.name} — ${status}`);
  }
  alert.addCancelAction("Cancelar");

  const idx = await alert.presentSheet();
  if (idx >= 0 && idx < top.length) {
    const selected = top[idx];
    const station = STATIONS.find((s) => s.name === selected.name);
    if (station?.waze) {
      Safari.open(station.waze);
    }
  }
}

Script.complete();
