/***********************
 * CONFIG
 ***********************/
const STATION_NAME = "Rivero";
const CHART_URL =
  "https://docs.google.com/spreadsheets/u/0/d/e/" +
  "2CAIWO3els60V5S1vVAh0cccQxdcZ1MYZhD9A1pQ-ojCNPoNh-" +
  "vJjHhJaUalVsDLQivYf_Z23Un8mEaePxSg" +
  "/gviz/chartiframe?oid=1546358769&resourcekey";
const PRODUCT = "ESPECIAL";

/***********************
 * FETCH
 ***********************/
const req = new Request(CHART_URL);
req.timeoutInterval = 15;
req.headers = {
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS like Mac OS X)",
  Accept: "text/html,*/*",
};

let html = "";
try {
  html = await req.loadString();
} catch (_) {}

/***********************
 * PARSEO
 ***********************/
function normalizeLiters(raw) {
  if (!raw) return 0;
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function parseChartJson(html, product) {
  if (!html) return 0;
  const upper = product.toUpperCase();
  // Google Sheets chartiframe embeds data in chartJson as hex-escaped JSON
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

const litros = parseChartJson(html, PRODUCT);
const now = new Date();

/***********************
 * WIDGET – APPLE HIG
 ***********************/
const w = new ListWidget();

w.backgroundColor = Color.dynamic(
  new Color("#FFFFFF"),
  new Color("#000000")
);

w.setPadding(8, 16, 16, 16);

const title = w.addText(STATION_NAME);
title.font = Font.semiboldSystemFont(22);
title.textColor = Color.dynamic(
  new Color("#000000"),
  new Color("#FFFFFF")
);

w.addSpacer(4);

const value = w.addText(
  litros > 0
    ? `${litros.toLocaleString("es-BO")} Lts`
    : "0 Lts"
);
value.font = Font.systemFont(22);
value.textColor =
  litros > 0
    ? Color.dynamic(new Color("#000000"), new Color("#FFFFFF"))
    : new Color("#FF3B30");

w.addSpacer(28);

const meta = w.addText(
  `Consulta ${now.toLocaleTimeString("es-BO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })}`
);
meta.font = Font.systemFont(11);
meta.textColor = Color.dynamic(
  new Color("#6D6D72"),
  new Color("#8E8E93")
);

if (litros === 0) {
  w.addSpacer(2);
  const status = w.addText("Dato no disponible");
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
