/***********************
 * CONFIG
 ***********************/
const URL =
  "https://genex.com.bo/estaciones/" +
  "?3142_product_cat%5B0%5D=294" +
  "&3142_tax_product_tag%5B0%5D=314" +
  "&3142_orderby=option_1" +
  "&3142_filtered=true";
const STATION = "GENEX I";
const STATION_TITLE = "Genex Banzer";
const FUEL_LABEL = "G. ESPECIAL+";

/***********************
 * FETCH HTML
 ***********************/
const req = new Request(URL);
req.timeoutInterval = 15;
req.headers = {
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS like Mac OS X)",
  Accept: "text/html",
};

let html = "";
try {
  html = await req.loadString();
} catch (_) {
  html = "";
}

/***********************
 * PARSEO ROBUSTO
 ***********************/
function normalizeLiters(raw) {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

function extractEspecialGenexI(html) {
  if (!html) return null;

  const clean = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ");

  // G. ESPECIAL+ → el "+" puede venir de <sup>+</sup>,
  // que al stripear tags queda "G. ESPECIAL +"
  const re = new RegExp(
    `${STATION}\\b[\\s\\S]*?G\\.\\s*ESPECIAL\\s*\\+[\\s\\S]*?(\\d[\\d.,]*)\\s*litros`,
    "i"
  );

  const m = clean.match(re);
  return m ? normalizeLiters(m[1]) : null;
}

const litros = extractEspecialGenexI(html) ?? 0;
const now = new Date();

/***********************
 * WIDGET – Apple HIG
 ***********************/
const w = new ListWidget();
w.backgroundColor = Color.dynamic(
  new Color("#FFFFFF"),
  new Color("#000000")
);

// Padding con título bien arriba
w.setPadding(6, 16, 16, 16);

// ── TÍTULO (más chico, una sola línea)
const title = w.addText(STATION_TITLE);
title.font = Font.semiboldSystemFont(18); // ⬅️ reducido
title.textColor = Color.dynamic(
  new Color("#000000"),
  new Color("#FFFFFF")
);
title.lineLimit = 1;
title.minimumScaleFactor = 0.8;

w.addSpacer(6);

// ── VOLUMEN
const value = w.addText(`${litros.toLocaleString("es-BO")} Lts`);
value.font = Font.systemFont(20);
value.textColor =
  litros > 0
    ? Color.dynamic(new Color("#000000"), new Color("#FFFFFF"))
    : new Color("#FF3B30");

// Baja la línea de consulta
w.addSpacer(34);

// ── CONSULTA (24h)
const hh = String(now.getHours()).padStart(2, "0");
const mm = String(now.getMinutes()).padStart(2, "0");

const meta = w.addText(`Consulta ${hh}:${mm}`);
meta.font = Font.systemFont(11);
meta.textColor = Color.dynamic(
  new Color("#6D6D72"),
  new Color("#8E8E93")
);

if (litros === 0) {
  w.addSpacer(2);
  const status = w.addText("Especial no disponible");
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
