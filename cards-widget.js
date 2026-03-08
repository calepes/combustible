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
 * WIDGET LARGE – CARDS
 ***********************/
const COLS = 2;
const ROWS = 5;
const CARD_SPACING = 8;
const WIDGET_PAD = 12;

// Calculate card size based on device screen
const screenW = Device.screenSize().width;
const widgetW = screenW - 32; // system inset ~16 each side
const innerW = widgetW - WIDGET_PAD * 2;
const cardW = Math.floor((innerW - CARD_SPACING) / COLS);
const cardH = 62;

const w = new ListWidget();
w.backgroundColor = Color.dynamic(
  new Color("#FFFFFF"),
  new Color("#000000")
);
w.setPadding(10, WIDGET_PAD, 8, WIDGET_PAD);

// ── HEADER
const headerStack = w.addStack();
headerStack.layoutVertically();

const header = headerStack.addText("Combustible");
header.font = Font.boldSystemFont(18);
header.textColor = textPrimary;

const subtitle = headerStack.addText("Gasolina Especial · Santa Cruz");
subtitle.font = Font.systemFont(10);
subtitle.textColor = textSecondary;

w.addSpacer(8);

// ── GRID DE CARDS
for (let row = 0; row < ROWS; row++) {
  const rowStack = w.addStack();
  rowStack.layoutHorizontally();
  rowStack.spacing = CARD_SPACING;

  for (let col = 0; col < COLS; col++) {
    const idx = row * COLS + col;

    if (idx < results.length) {
      const r = results[idx];
      const available = r.litros > 0;

      // Card container – fixed size for uniform grid
      const card = rowStack.addStack();
      card.layoutVertically();
      card.backgroundColor = cardBg;
      card.cornerRadius = 10;
      card.setPadding(8, 10, 8, 10);
      card.size = new Size(cardW, cardH);

      // Top row: dot + name
      const topRow = card.addStack();
      topRow.layoutHorizontally();
      topRow.centerAlignContent();

      const dot = topRow.addText("●");
      dot.font = Font.systemFont(8);
      dot.textColor = available ? colorGreen : colorRed;

      topRow.addSpacer(4);

      const nameText = topRow.addText(r.name);
      nameText.font = Font.semiboldSystemFont(13);
      nameText.textColor = textPrimary;
      nameText.lineLimit = 1;
      nameText.minimumScaleFactor = 0.7;

      // Company
      const companyText = card.addText(r.company);
      companyText.font = Font.systemFont(9);
      companyText.textColor = textSecondary;
      companyText.lineLimit = 1;

      card.addSpacer();

      // Liters
      const litrosStr = available
        ? `${r.litros.toLocaleString("es-BO")} Lts`
        : "Sin dato";
      const litrosText = card.addText(litrosStr);
      litrosText.font = Font.boldSystemFont(15);
      litrosText.textColor = available ? textPrimary : colorRed;
      litrosText.lineLimit = 1;
      litrosText.minimumScaleFactor = 0.6;
    } else {
      // Empty placeholder – same size to keep grid aligned
      const placeholder = rowStack.addStack();
      placeholder.size = new Size(cardW, cardH);
    }
  }

  if (row < ROWS - 1) {
    w.addSpacer(4);
  }
}

// ── FOOTER
w.addSpacer();

const metaStack = w.addStack();
metaStack.layoutHorizontally();

const hh = String(now.getHours()).padStart(2, "0");
const mm = String(now.getMinutes()).padStart(2, "0");

const meta = metaStack.addText(`Consulta ${hh}:${mm}`);
meta.font = Font.systemFont(9);
meta.textColor = textSecondary;

metaStack.addSpacer();

const countAvail = results.filter((r) => r.litros > 0).length;
const avail = metaStack.addText(
  `${countAvail}/${results.length} disponibles`
);
avail.font = Font.systemFont(9);
avail.textColor = countAvail === results.length ? colorGreen : textSecondary;

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
      ? `✅ ${r.litros.toLocaleString("es-BO")} Lts`
      : "❌ Sin dato";
    alert.addAction(`${r.name} — ${status}`);
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
