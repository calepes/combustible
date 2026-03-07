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
  },
  {
    name: "Vangas",
    type: "genex",
    company: "Genex",
    url: "https://genex.com.bo/estaciones/",
    key: "VANGAS",
    fuel: "G. ESPECIAL+",
  },
  {
    name: "Urubó",
    type: "gasgroup",
    company: "Orsa",
    url: "https://gasgroup.com.bo/api/obtener-datos-temporales/CTqmwWgj",
    product: "GASOLINA ESPECIAL",
  },
  {
    name: "Equipetrol",
    type: "ec2",
    company: "Biopetrol",
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "EQUIPETROL",
  },
  {
    name: "Pirai",
    type: "ec2",
    company: "Biopetrol",
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "PIRAI",
  },
  {
    name: "Alemana",
    type: "ec2",
    company: "Biopetrol",
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "Alemana",
  },
  {
    name: "López",
    type: "ec2",
    company: "Biopetrol",
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "Lopez",
  },
  {
    name: "Viru Viru",
    type: "ec2",
    company: "Biopetrol",
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "Viru Viru",
  },
  {
    name: "Gasco",
    type: "ec2",
    company: "Biopetrol",
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "Gasco",
  },
  {
    name: "Rivero",
    type: "gsheets",
    company: "Rivero",
    url:
      "https://docs.google.com/spreadsheets/u/1/d/e/" +
      "2CAIWO3els60V5S1vVAh0cccQxdcZ1MYZhD9A1pQ-ojCNPoNh-" +
      "vJjHhJaUalVsDLQivYf_Z23Un8mEaePxSg" +
      "/gviz/chartiframe?oid=970629425&resourcekey",
    product: "ESPECIAL",
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

async function fetchChartData(url, product) {
  const upper = product.toUpperCase();
  try {
    // Strategy 1: fetch raw HTML and look for embedded data
    const html = await fetchHTML(url, false);
    if (html) {
      // Google Charts embed data via google.visualization.Query.setResponse({...})
      const jsonMatch = html.match(/setResponse\(([\s\S]+?)\);/);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          const rows = data?.table?.rows;
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
      }
      // Look for data arrays like ["ESPECIAL",55000]
      const re1 = new RegExp(
        `["']([^"']*${upper}[^"']*)["'][\\s,]*[,\\]]\\s*(\\d[\\d.,]*)`,
        "i"
      );
      const m1 = html.match(re1);
      if (m1) return normalizeLiters(m1[2]);
      // Brute force: product name near a number in cleaned text
      const clean = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
      const re2 = new RegExp(
        `${upper}[\\s\\S]{0,80}?(\\d{1,3}(?:[.,]\\d{3})*(?:\\.\\d+)?)`,
        "i"
      );
      const m2 = clean.match(re2);
      if (m2) {
        const val = normalizeLiters(m2[1]);
        if (val >= 100) return val;
      }
    }

    // Strategy 2: use WebView to execute JS and wait for chart to render
    const wv = new WebView();
    await wv.loadURL(url);
    const text = await wv.evaluateJavaScript(
      `setTimeout(() => { completion(document.body.innerText); }, 5000);`,
      true
    );
    if (!text) return 0;
    const lines = text.split("\n");
    let best = 0;
    let found = false;
    for (const line of lines) {
      if (line.toUpperCase().includes(upper)) found = true;
      if (found) {
        const nums = line.match(/[\d]+(?:[.,]\d{3})*/g);
        if (nums) {
          for (const n of nums) {
            const val = normalizeLiters(n);
            if (val > best) best = val;
          }
        }
        if (best > 0) return best;
      }
    }
    const re = new RegExp(
      `${upper}[\\s\\S]{0,200}?(\\d{1,3}(?:[,.]\\d{3})+|\\d{4,})`,
      "i"
    );
    const m = text.match(re);
    return m ? normalizeLiters(m[1]) : 0;
  } catch (_) {
    return 0;
  }
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
    return await fetchChartData(s.url, s.product);
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
 * FONTS
 ***********************/
function monoFont(size) {
  return new Font("Menlo-Bold", size);
}

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

const header = headerStack.addText("Combustible");
header.font = Font.boldSystemFont(20);
header.textColor = textPrimary;

const subtitle = headerStack.addText("Gasolina Especial · Santa Cruz");
subtitle.font = Font.systemFont(11);
subtitle.textColor = textSecondary;

w.addSpacer(6);

// ── SEPARADOR HEADER
const sepColor = Color.dynamic(
  new Color("#D1D1D6"),
  new Color("#3A3A3C")
);
const headerSep = w.addStack();
headerSep.layoutHorizontally();
const headerLine = headerSep.addText("─".repeat(50));
headerLine.font = Font.systemFont(4);
headerLine.textColor = sepColor;

w.addSpacer(12);

// ── FILAS DE ESTACIONES
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
  nameText.font = Font.mediumSystemFont(13);
  nameText.textColor = textPrimary;
  nameText.lineLimit = 1;
  nameText.minimumScaleFactor = 0.8;

  row.addSpacer(8);

  // Empresa
  const companyText = row.addText(r.company);
  companyText.font = Font.systemFont(10);
  companyText.textColor = textSecondary;
  companyText.lineLimit = 1;

  row.addSpacer();

  // Litros (monoespaciado para alinear)
  const litrosStr = r.litros > 0
    ? `${r.litros.toLocaleString("es-BO")} Lts`
    : "Sin dato";
  const litrosText = row.addText(litrosStr);
  litrosText.font = monoFont(12);
  litrosText.textColor = r.litros > 0 ? textPrimary : colorRed;
  litrosText.lineLimit = 1;

  // Separador sutil entre filas
  if (i < results.length - 1) {
    w.addSpacer(3);
    const sepLine = w.addStack();
    sepLine.layoutHorizontally();
    sepLine.addSpacer(20);
    const line = sepLine.addText("─".repeat(50));
    line.font = Font.systemFont(3);
    line.textColor = Color.dynamic(
      new Color("#C7C7CC"),
      new Color("#48484A")
    );
    sepLine.addSpacer(4);
    w.addSpacer(3);
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
meta.font = Font.systemFont(10);
meta.textColor = textSecondary;

metaStack.addSpacer();

const countAvail = results.filter((r) => r.litros > 0).length;
const avail = metaStack.addText(
  `${countAvail}/${results.length} disponibles`
);
avail.font = Font.systemFont(10);
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
