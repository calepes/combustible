// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: gas-pump;

// Widget de Gasolina Especial+ - Estación GENEX I (Genex Banzer)
// Consulta la disponibilidad de litros desde genex.com.bo/estaciones/

const STATION_NAME = "GENEX I";
const FUEL_TYPE = "Gasolina Especial+";
const URL = "https://genex.com.bo/estaciones/";

async function fetchFuelData() {
  try {
    const req = new Request(URL);
    req.timeoutInterval = 10;
    const html = await req.loadString();

    // Buscar la sección de GENEX I (Genex Banzer)
    const stationPattern = /GENEX\s*I\b[^]*?Gasolina\s*Especial\+[^]*?(\d[\d.,]*)\s*(?:Lts|lts|litros)/i;
    const match = html.match(stationPattern);

    if (!match) {
      // Intento alternativo: buscar en estructura de tabla/cards
      const altPattern = /Banzer[^]*?Especial\+?[^]*?(\d[\d.,]*)\s*(?:Lts|lts|litros)/i;
      const altMatch = html.match(altPattern);

      if (!altMatch) {
        return { error: "Sin datos", litros: null };
      }
      const litros = parseFloat(altMatch[1].replace(",", ""));
      return litros === 0
        ? { error: "0 Lts", litros: 0 }
        : { error: null, litros };
    }

    const litros = parseFloat(match[1].replace(",", ""));
    return litros === 0
      ? { error: "0 Lts", litros: 0 }
      : { error: null, litros };
  } catch (e) {
    return { error: "Sin conexión", litros: null };
  }
}

function formatLitros(litros) {
  if (litros >= 1000) {
    return `${(litros / 1000).toFixed(1)}k Lts`;
  }
  return `${litros.toLocaleString("es-BO")} Lts`;
}

function getTimestamp() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

async function createWidget() {
  const widget = new ListWidget();
  widget.backgroundColor = new Color("#1a1a2e");
  widget.setPadding(12, 14, 12, 14);

  const data = await fetchFuelData();

  // Título: nombre de estación
  const title = widget.addText(`⛽ ${STATION_NAME}`);
  title.font = Font.boldSystemFont(13);
  title.textColor = new Color("#e0e0e0");

  widget.addSpacer(2);

  // Subtítulo: tipo de combustible
  const subtitle = widget.addText(FUEL_TYPE);
  subtitle.font = Font.systemFont(10);
  subtitle.textColor = new Color("#888888");

  widget.addSpacer(6);

  // Valor principal: litros o error
  if (data.error) {
    const errorText = widget.addText(data.error);
    errorText.font = Font.boldSystemFont(18);
    errorText.textColor =
      data.error === "0 Lts" ? new Color("#ff4444") : new Color("#ffaa00");
  } else {
    const litrosText = widget.addText(formatLitros(data.litros));
    litrosText.font = Font.boldSystemFont(18);
    litrosText.textColor = new Color("#00cc66");
  }

  widget.addSpacer(4);

  // Hora de consulta
  const time = widget.addText(`Consulta: ${getTimestamp()}`);
  time.font = Font.systemFont(9);
  time.textColor = new Color("#666666");

  return widget;
}

const widget = await createWidget();

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  widget.presentSmall();
}

Script.complete();
