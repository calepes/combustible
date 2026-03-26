import { describe, it, expect } from 'vitest';
import {
  normalizeLiters,
  parseGenex,
  parseEC2,
  parseGasGroup,
  parseChartJson,
  haversineKm,
} from '../../pwa/shared/fetchers.js';

/* ── normalizeLiters ─────────────────── */

describe('normalizeLiters', () => {
  it('extrae digitos de formato con punto', () => {
    expect(normalizeLiters('1.234')).toBe(1234);
  });

  it('extrae digitos de formato con coma', () => {
    expect(normalizeLiters('1,234')).toBe(1234);
  });

  it('maneja numero sin separador', () => {
    expect(normalizeLiters('5000')).toBe(5000);
  });

  it('retorna 0 para null/undefined', () => {
    expect(normalizeLiters(null)).toBe(0);
    expect(normalizeLiters(undefined)).toBe(0);
  });

  it('retorna 0 para string vacio', () => {
    expect(normalizeLiters('')).toBe(0);
  });

  it('retorna 0 para string sin digitos', () => {
    expect(normalizeLiters('abc')).toBe(0);
  });

  it('maneja numeros grandes', () => {
    expect(normalizeLiters('12.345.678')).toBe(12345678);
  });
});

/* ── parseGenex ──────────────────────── */

describe('parseGenex', () => {
  const makeHtml = (key, fuel, litros) =>
    `<div>${key}</div><span>${fuel}</span><b>${litros} litros</b>`;

  it('extrae litros de HTML valido', () => {
    const html = makeHtml('GENEX I', 'G. ESPECIAL+', '3.500');
    expect(parseGenex(html, 'GENEX I', 'G. ESPECIAL+')).toBe(3500);
  });

  it('retorna 0 si no encuentra key', () => {
    const html = makeHtml('OTRA KEY', 'G. ESPECIAL+', '3.500');
    expect(parseGenex(html, 'GENEX I', 'G. ESPECIAL+')).toBe(0);
  });

  it('retorna 0 si no encuentra fuel', () => {
    const html = makeHtml('GENEX I', 'DIESEL', '3.500');
    expect(parseGenex(html, 'GENEX I', 'G. ESPECIAL+')).toBe(0);
  });

  it('retorna 0 para html null', () => {
    expect(parseGenex(null, 'GENEX I', 'G. ESPECIAL+')).toBe(0);
  });

  it('maneja nbsp y espacios multiples', () => {
    const html = '<div>GENEX I</div>&nbsp;&nbsp;<span>G. ESPECIAL+</span>  <b>2,100 litros</b>';
    expect(parseGenex(html, 'GENEX I', 'G. ESPECIAL+')).toBe(2100);
  });

  it('es case insensitive en litros', () => {
    const html = '<div>GENEX I</div><span>G. ESPECIAL+</span><b>1500 LITROS</b>';
    expect(parseGenex(html, 'GENEX I', 'G. ESPECIAL+')).toBe(1500);
  });
});

/* ── parseEC2 ────────────────────────── */

describe('parseEC2', () => {
  const makeHtml = (key, litros) =>
    `<div>${key}</div><span>Volumen disponible</span><b>${litros} Lts</b>`;

  it('extrae litros de HTML valido', () => {
    const html = makeHtml('T-ESPECIAL', '4,200');
    expect(parseEC2(html, 'T-ESPECIAL')).toBe(4200);
  });

  it('retorna 0 si no encuentra key', () => {
    const html = makeHtml('OTRO', '4,200');
    expect(parseEC2(html, 'T-ESPECIAL')).toBe(0);
  });

  it('retorna 0 para html null', () => {
    expect(parseEC2(null, 'T-ESPECIAL')).toBe(0);
  });

  it('retorna 0 si no tiene Volumen disponible', () => {
    const html = '<div>T-ESPECIAL</div><span>Otro campo</span><b>4,200 Lts</b>';
    expect(parseEC2(html, 'T-ESPECIAL')).toBe(0);
  });
});

/* ── parseGasGroup ───────────────────── */

describe('parseGasGroup', () => {
  const COD = 'ABC123';
  const makeJson = (tanques) => ({
    estaciones: [{ codigo: COD, tanques }],
  });

  it('suma litros de tanques con el producto correcto', () => {
    const json = makeJson([
      { producto: 'GASOLINA ESPECIAL', litros: 2000 },
      { producto: 'GASOLINA ESPECIAL', litros: 1500 },
      { producto: 'DIESEL', litros: 3000 },
    ]);
    expect(parseGasGroup(json, 'GASOLINA ESPECIAL', COD)).toBe(3500);
  });

  it('retorna 0 si total esta bajo el umbral (1500)', () => {
    const json = makeJson([
      { producto: 'GASOLINA ESPECIAL', litros: 500 },
    ]);
    expect(parseGasGroup(json, 'GASOLINA ESPECIAL', COD)).toBe(0);
  });

  it('retorna 0 para json null', () => {
    expect(parseGasGroup(null, 'GASOLINA ESPECIAL', COD)).toBe(0);
  });

  it('retorna 0 si no hay tanques', () => {
    expect(parseGasGroup({ estaciones: [{ codigo: COD }] }, 'GASOLINA ESPECIAL', COD)).toBe(0);
  });

  it('retorna 0 si codigo no coincide', () => {
    const json = makeJson([
      { producto: 'GASOLINA ESPECIAL', litros: 5000 },
    ]);
    expect(parseGasGroup(json, 'GASOLINA ESPECIAL', 'OTRO')).toBe(0);
  });

  it('match es case insensitive via includes', () => {
    const json = makeJson([
      { producto: 'gasolina especial', litros: 2000 },
    ]);
    expect(parseGasGroup(json, 'GASOLINA ESPECIAL', COD)).toBe(2000);
  });

  it('maneja litros undefined como 0', () => {
    const json = makeJson([
      { producto: 'GASOLINA ESPECIAL' },
      { producto: 'GASOLINA ESPECIAL', litros: 2000 },
    ]);
    expect(parseGasGroup(json, 'GASOLINA ESPECIAL', COD)).toBe(2000);
  });
});

/* ── parseChartJson ──────────────────── */

describe('parseChartJson', () => {
  const makeChartHtml = (rows) => {
    const chart = { dataTable: { rows } };
    const jsonStr = JSON.stringify(chart)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'");
    return `<html>'chartJson' : '${jsonStr}'</html>`;
  };

  it('extrae litros del producto correcto', () => {
    const html = makeChartHtml([
      { c: [{ v: 'GASOLINA ESPECIAL' }, { v: 4500 }] },
      { c: [{ v: 'DIESEL' }, { v: 8000 }] },
    ]);
    expect(parseChartJson(html, 'GASOLINA ESPECIAL')).toBe(4500);
  });

  it('retorna 0 si no encuentra el producto', () => {
    const html = makeChartHtml([
      { c: [{ v: 'DIESEL' }, { v: 8000 }] },
    ]);
    expect(parseChartJson(html, 'GASOLINA ESPECIAL')).toBe(0);
  });

  it('retorna 0 para html null', () => {
    expect(parseChartJson(null, 'GASOLINA ESPECIAL')).toBe(0);
  });

  it('retorna 0 si no hay chartJson en el html', () => {
    expect(parseChartJson('<html>nada</html>', 'GASOLINA ESPECIAL')).toBe(0);
  });

  it('es case insensitive en producto', () => {
    const html = makeChartHtml([
      { c: [{ v: 'gasolina especial' }, { v: 3200 }] },
    ]);
    expect(parseChartJson(html, 'GASOLINA ESPECIAL')).toBe(3200);
  });
});

/* ── haversineKm ─────────────────────── */

describe('haversineKm', () => {
  it('retorna 0 para el mismo punto', () => {
    expect(haversineKm(-17.78, -63.18, -17.78, -63.18)).toBe(0);
  });

  it('calcula distancia conocida (SCZ centro a Pirai ~5km)', () => {
    const dist = haversineKm(-17.7833, -63.1821, -17.7642, -63.1350);
    expect(dist).toBeGreaterThan(4);
    expect(dist).toBeLessThan(7);
  });

  it('calcula distancia larga (SCZ a La Paz ~550km)', () => {
    const dist = haversineKm(-17.78, -63.18, -16.50, -68.15);
    expect(dist).toBeGreaterThan(500);
    expect(dist).toBeLessThan(600);
  });

  it('es simetrica', () => {
    const d1 = haversineKm(-17.78, -63.18, -16.50, -68.15);
    const d2 = haversineKm(-16.50, -68.15, -17.78, -63.18);
    expect(d1).toBeCloseTo(d2, 6);
  });
});

/* ── stations.js ─────────────────────── */

describe('stations config', () => {
  it('exporta STATIONS como array no vacio', async () => {
    const { STATIONS } = await import('../../pwa/shared/stations.js');
    expect(Array.isArray(STATIONS)).toBe(true);
    expect(STATIONS.length).toBeGreaterThan(0);
  });

  it('cada estacion tiene campos requeridos', async () => {
    const { STATIONS } = await import('../../pwa/shared/stations.js');
    for (const s of STATIONS) {
      expect(s).toHaveProperty('name');
      expect(s).toHaveProperty('type');
      expect(s).toHaveProperty('company');
      expect(s).toHaveProperty('lat');
      expect(s).toHaveProperty('lon');
      expect(s).toHaveProperty('url');
      expect(s).toHaveProperty('waze');
      expect(['genex', 'ec2', 'gasgroup', 'gsheets']).toContain(s.type);
    }
  });

  it('coordenadas estan en rango de Santa Cruz', async () => {
    const { STATIONS } = await import('../../pwa/shared/stations.js');
    for (const s of STATIONS) {
      expect(s.lat).toBeGreaterThan(-19);
      expect(s.lat).toBeLessThan(-16);
      expect(s.lon).toBeGreaterThan(-64);
      expect(s.lon).toBeLessThan(-62);
    }
  });

  it('GASGROUP_MIN_LITROS es 1500', async () => {
    const { GASGROUP_MIN_LITROS } = await import('../../pwa/shared/stations.js');
    expect(GASGROUP_MIN_LITROS).toBe(1500);
  });
});
