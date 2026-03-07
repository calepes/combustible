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

function extractFuelData(html) {
  if (!html) return null;

  const clean = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ");

  // Locate the station block
  const stationIdx = clean.indexOf(STATION);
  if (stationIdx === -1) return null;

  // Get text from the station until the next GENEX station
  const afterStation = clean.substring(stationIdx);
  const nextStation = afterStation.indexOf("GENEX", STATION.length);
  const block = nextStation > 0
    ? afterStation.substring(0, nextStation)
    : afterStation.substring(0, 800);

  // Extract "Última actualización: DD/MM/YY HH:MM am/pm"
  const updMatch = block.match(
    /[Úú]ltima\s+actualizaci[oó]n:\s*(\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}\s*[ap]m)/i
  );
  const lastUpdate = updMatch ? updMatch[1] : null;

  // Extract G. ESPECIAL+ data
  // Pattern: G. ESPECIAL+ LITERS litros QUEUE_STATUS disponible TIME para PEOPLE espera WAIT
  const espRe =
    /G\.\s*ESPECIAL\s*\+\s*([\d.,]+)\s*litros\s+(.*?)\s*disponible\s+([\dhm\s]+?)\s*para\s+([\d.,]+)\s*espera\s+([\dhms\s]+?)\s*x/i;
  const espAgotado = /G\.\s*ESPECIAL\s*\+\s*\[AGOTADO\]/i;

  let especial = null;
  const espM = block.match(espRe);
  if (espM) {
    especial = {
      litros: normalizeLiters(espM[1]),
      cola: espM[2].trim(),
      disponible: espM[3].trim(),
      enCola: normalizeLiters(espM[4]),
      espera: espM[5].trim(),
      agotado: false,
    };
  } else if (espAgotado.test(block)) {
    especial = { litros: 0, agotado: true };
  }

  return { especial, lastUpdate };
}

const data = extractFuelData(html);
const litros = data?.especial?.litros ?? 0;
const agotado = data?.especial?.agotado ?? false;
const cola = data?.especial?.cola ?? null;
const disponible = data?.especial?.disponible ?? null;
const espera = data?.especial?.espera ?? null;
const lastUpdate = data?.lastUpdate ?? null;
const now = new Date();

/***********************
 * WIDGET – Apple HIG
 ***********************/
const w = new ListWidget();
w.backgroundColor = Color.dynamic(
  new Color("#FFFFFF"),
  new Color("#000000")
);

w.setPadding(6, 16, 10, 16);

// ── TÍTULO
const title = w.addText(STATION_TITLE);
title.font = Font.semiboldSystemFont(16);
title.textColor = Color.dynamic(
  new Color("#000000"),
  new Color("#FFFFFF")
);
title.lineLimit = 1;
title.minimumScaleFactor = 0.8;

w.addSpacer(2);

// ── SUBTÍTULO: tipo de combustible
const sub = w.addText(FUEL_LABEL);
sub.font = Font.systemFont(11);
sub.textColor = Color.dynamic(
  new Color("#6D6D72"),
  new Color("#8E8E93")
);

w.addSpacer(4);

// ── VOLUMEN
if (agotado) {
  const val = w.addText("AGOTADO");
  val.font = Font.boldSystemFont(22);
  val.textColor = new Color("#FF3B30");
} else {
  const val = w.addText(`${litros.toLocaleString("es-BO")} Lts`);
  val.font = Font.systemFont(22);
  val.textColor =
    litros > 0
      ? Color.dynamic(new Color("#000000"), new Color("#FFFFFF"))
      : new Color("#FF3B30");
}

// ── COLA / ESPERA
if (cola && !agotado) {
  w.addSpacer(2);
  const queueColor = /mucha/i.test(cola)
    ? new Color("#FF9500")
    : /no\s*hay/i.test(cola)
      ? new Color("#34C759")
      : Color.dynamic(new Color("#6D6D72"), new Color("#8E8E93"));

  const queueText = w.addText(cola);
  queueText.font = Font.mediumSystemFont(11);
  queueText.textColor = queueColor;
  queueText.lineLimit = 1;
}

if (espera && !agotado) {
  const waitText = w.addText(`Espera: ${espera}`);
  waitText.font = Font.systemFont(10);
  waitText.textColor = Color.dynamic(
    new Color("#6D6D72"),
    new Color("#8E8E93")
  );
  waitText.lineLimit = 1;
}

w.addSpacer(null);

// ── PIE: hora de actualización del sitio + hora de consulta
const hh = String(now.getHours()).padStart(2, "0");
const mm = String(now.getMinutes()).padStart(2, "0");

const footerParts = [];
if (lastUpdate) footerParts.push(`Upd: ${lastUpdate}`);
footerParts.push(`Consulta ${hh}:${mm}`);

const meta = w.addText(footerParts.join(" · "));
meta.font = Font.systemFont(9);
meta.textColor = Color.dynamic(
  new Color("#8E8E93"),
  new Color("#636366")
);
meta.lineLimit = 1;
meta.minimumScaleFactor = 0.7;

/***********************
 * PRESENTACIÓN
 ***********************/
if (config.runsInWidget) {
  Script.setWidget(w);
} else {
  await w.presentSmall();
}

Script.complete();
