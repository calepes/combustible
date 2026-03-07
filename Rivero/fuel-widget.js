/***********************
 * CONFIG
 ***********************/
const STATION_NAME = "Rivero";
const GSHEETS_URL =
  "https://docs.google.com/spreadsheets/d/e/" +
  "2CAIWO3els60V5S1vVAh0cccQxdcZ1MYZhD9A1pQ-ojCNPoNh-" +
  "vJjHhJaUalVsDLQivYf_Z23Un8mEaePxSg" +
  "/gviz/tq?tqx=out:csv";
const PRODUCT = "ESPECIAL";

/***********************
 * FETCH CSV
 ***********************/
const req = new Request(GSHEETS_URL);
req.timeoutInterval = 15;
req.headers = {
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS like Mac OS X)",
  Accept: "text/csv,text/plain,*/*",
};

let csv = "";
try {
  csv = await req.loadString();
} catch (_) {}

/***********************
 * PARSEO
 ***********************/
function normalizeLiters(raw) {
  if (!raw) return 0;
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function extractLiters(csv, product) {
  if (!csv) return 0;
  const lines = csv.split("\n");
  let best = 0;
  for (const line of lines) {
    if (!line.toUpperCase().includes(product.toUpperCase())) continue;
    const nums = line.match(/[\d]+(?:[.,]\d+)*/g);
    if (nums) {
      for (const n of nums) {
        const val = normalizeLiters(n);
        if (val > best) best = val;
      }
    }
  }
  return best;
}

const litros = extractLiters(csv, PRODUCT);
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

// ── TITULO
const title = w.addText(STATION_NAME);
title.font = Font.semiboldSystemFont(22);
title.textColor = Color.dynamic(
  new Color("#000000"),
  new Color("#FFFFFF")
);

w.addSpacer(4);

// ── VOLUMEN
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

// ── METADATA (hora 24 h)
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
 * PRESENTACION
 ***********************/
if (config.runsInWidget) {
  Script.setWidget(w);
} else {
  await w.presentSmall();
}

Script.complete();
