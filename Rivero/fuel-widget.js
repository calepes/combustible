/***********************
 * CONFIG
 ***********************/
const STATION_NAME = "Rivero";
const CHART_URL =
  "https://docs.google.com/spreadsheets/u/1/d/e/" +
  "2CAIWO3els60V5S1vVAh0cccQxdcZ1MYZhD9A1pQ-ojCNPoNh-" +
  "vJjHhJaUalVsDLQivYf_Z23Un8mEaePxSg" +
  "/gviz/chartiframe?oid=970629425&resourcekey";
const PRODUCT = "ESPECIAL";

/***********************
 * HELPERS
 ***********************/
function normalizeLiters(raw) {
  if (!raw) return 0;
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

/***********************
 * FETCH via WebView
 ***********************/
async function fetchChartData(url, product) {
  const upper = product.toUpperCase();
  try {
    const wv = new WebView();
    await wv.loadURL(url);
    const text = await wv.evaluateJavaScript(
      `completion(document.body.innerText);`,
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

const litros = await fetchChartData(CHART_URL, PRODUCT);
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
