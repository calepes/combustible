function normalizeLiters(text) {
  const value = text.trim();
  if (!/^(?:\d+|\d{1,3}(?:[.,]\d{3})+)$/.test(value)) return null;
  const liters = Number(value.replace(/[.,]/g, ''));
  return Number.isSafeInteger(liters) ? liters : null;
}

function textOf(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|\u00a0/gi, ' ').replace(/\s+/g, ' ').trim();
}

function sections(text, pattern) {
  const markers = [...text.matchAll(pattern)];
  return markers.map((match, index) => [
    match[1].toUpperCase(),
    text.slice(match.index + match[0].length, markers[index + 1]?.index),
  ]);
}

function readGenex(html) {
  const headings = /<span\b[^>]*class=["'][^"']*\bstation_name\b[^"']*["'][^>]*>\s*([^<>]+?)\s*<\/span>/gi;
  return new Map(sections(html, headings).map(([name, section]) => {
    const fuels = /<span\b[^>]*class=["'][^"']*\bproduct_name\b[^"']*["'][^>]*>\s*([^<>]+?)\s*<\/span>/gi;
    const volumes = sections(section, fuels).map(([fuel, content]) => {
      const volume = content.match(/\bproduct_volume\b[^>]*>\s*(\[AGOTADO\]|[\d.,]+\s*litros)\s*</i)?.[1];
      return [fuel, volume?.toUpperCase() === '[AGOTADO]' ? 0 : volume ? normalizeLiters(volume.replace(/litros/i, '')) : null];
    });
    return [name, new Map(volumes)];
  }));
}

function readBiopetrol(html, stations) {
  const keys = stations.map((s) => s.key).sort((a, b) => b.length - a.length);
  const names = keys.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const headings = new RegExp(`(?<![\\p{L}\\p{N}])(${names})(?![\\p{L}\\p{N}])`, 'giu');
  const readings = new Map();
  for (const [name, section] of sections(textOf(html), headings)) {
    const match = section.match(/volumen disponible\s*[:\-]?\s*([\d.,]+)\s*lts/i);
    const liters = match ? normalizeLiters(match[1]) : null;
    if (liters != null && !readings.has(name)) readings.set(name, liters);
  }
  return readings;
}

function readGasgroup(data, station) {
  const row = Array.isArray(data?.estaciones) && data.estaciones.find((entry) => entry?.codigo === station.codigo);
  const tanks = Array.isArray(row?.tanques) && row.tanques.filter((tank) => (
    typeof tank?.producto === 'string' && tank.producto.toUpperCase().includes(station.product)
  ));
  if (!tanks?.length) return null;
  const liters = tanks.map(({ litros }) => typeof litros === 'string' && litros.trim() ? Number(litros) : litros);
  if (liters.some((amount) => !Number.isFinite(amount) || amount < 0)) return null;
  return Math.round(liters.reduce((sum, amount) => sum + amount, 0));
}

function readChart(html, product) {
  const chunk = html.match(/'chartJson'\s*:\s*'((?:[^'\\]|\\.)*)'/);
  if (!chunk) return null;
  try {
    const unescaped = chunk[1].replace(/\\(x([0-9a-f]{2})|.)/gi, (_, escaped, hex) => (
      hex ? String.fromCharCode(parseInt(hex, 16)) : escaped === 'n' ? '\n' : escaped
    ));
    const rows = JSON.parse(unescaped)?.dataTable?.rows;
    if (!Array.isArray(rows)) return null;
    for (const row of rows) {
      const cells = row?.c;
      if (!Array.isArray(cells) || !cells.some((cell) => (
        typeof cell?.v === 'string' && cell.v.toUpperCase().includes(product)
      ))) continue;
      const measure = cells.find((cell) => Number.isFinite(cell?.v) && cell.v >= 0);
      if (measure) return Math.round(measure.v);
    }
  } catch {
    return null;
  }
  return null;
}

export function readSource(stations, data) {
  const type = stations[0].type;
  const genex = type === 'genex' ? readGenex(data) : null;
  const biopetrol = type === 'ec2' ? readBiopetrol(data, stations) : null;
  return stations.map((station) => {
    let litros;
    if (type === 'genex') litros = genex.get(station.key.toUpperCase())?.get(station.fuel);
    if (type === 'ec2') litros = biopetrol.get(station.key.toUpperCase());
    if (type === 'gasgroup') litros = readGasgroup(data, station);
    if (type === 'gsheets') litros = readChart(data, station.product);
    return [station.name, litros ?? null];
  });
}
