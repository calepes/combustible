/***********************
 * CONFIG
 ***********************/
const URL = "https://genex.com.bo/estaciones/";
const STATION = "VANGAS";
const STATION_TITLE = "Vangas"; // ← solo primera mayúscula
const FUEL_LABEL = "G. ESPECIAL+";

/***********************
 * FETCH HTML
 ***********************/
const req = new Request(URL);
req.timeoutInterval = 15;
req.headers = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS like Mac OS X)",
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

function extractEspecialVangas(html) {
  if (!html) return null;

  const clean = html
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ");

  const re = new RegExp(
    `${STATION}[\\s\\S]*?${FUEL_LABEL
      .replace(/\./g, "\\.")
      .replace(/\+/g, "\\+")}[\\s\\S]*?(\\d{1,3}(?:[\\.,]\\d{3})*|\\d+)\\s*litros`,
    "i"
  );

  const m = clean.match(re);
  return m ? normalizeLiters(m[1]) : null;
}

const litros = extractEspecialVangas(html) ?? 0;
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

// ── TÍTULO (Capitalized)
const title = w.addText(STATION_TITLE);
title.font = Font.semiboldSystemFont(24);
title.textColor = Color.dynamic(
  new Color("#000000"),
  new Color("#FFFFFF")
);

w.addSpacer(6);

// ── VOLUMEN (más chico)
const value = w.addText(`${litros.toLocaleString("es-BO")} Lts`);
value.font = Font.systemFont(20);
value.textColor =
  litros > 0
    ? Color.dynamic(new Color("#000000"), new Color("#FFFFFF"))
    : new Color("#FF3B30");

// Baja línea de consulta
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
