import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { readSource } from '../../proxy/readings.js';

/**
 * Los widgets de Scriptable no exportan funciones (no son ES modules).
 * Se ejecutan los parsers actuales de los widgets y se comprueba
 * su paridad con el Worker para lecturas válidas.
 */

/* ── Extraer funciones del widget via eval ── */

function extractWidgetParsers(filePath) {
  const src = readFileSync(resolve(filePath), 'utf-8');

  // Extraer funciones individuales del source
  const fnBodies = {};

  // normalizeLiters
  const normMatch = src.match(/function normalizeLiters\(raw\)\s*\{[\s\S]*?\n\}/);
  if (normMatch) fnBodies.normalizeLiters = normMatch[0];

  // parseGenex
  const genexMatch = src.match(/function parseGenex\(html, key, fuel\)\s*\{[\s\S]*?\n\}/);
  if (genexMatch) fnBodies.parseGenex = genexMatch[0];

  // parseEC2
  const ec2Match = src.match(/function parseEC2\(html, key\)\s*\{[\s\S]*?\n\}/);
  if (ec2Match) fnBodies.parseEC2 = ec2Match[0];

  // parseGasGroup (necesita GASGROUP_MIN_LITROS)
  const gasMatch = src.match(/function parseGasGroup\(json, product, codigo\)\s*\{[\s\S]*?\n\}/);
  if (gasMatch) fnBodies.parseGasGroup = gasMatch[0];

  // parseChartJson
  const chartMatch = src.match(/function parseChartJson\(html, product\)\s*\{[\s\S]*?\n\}/);
  if (chartMatch) fnBodies.parseChartJson = chartMatch[0];

  // Evaluar las funciones en un scope limpio
  const code = `
    const GASGROUP_MIN_LITROS = 1500;
    ${fnBodies.normalizeLiters || ''}
    ${fnBodies.parseGenex || ''}
    ${fnBodies.parseEC2 || ''}
    ${fnBodies.parseGasGroup || ''}
    ${fnBodies.parseChartJson || ''}
    module.exports = { normalizeLiters, parseGenex, parseEC2, parseGasGroup, parseChartJson };
  `;

  const m = { exports: {} };
  new Function('module', code)(m);
  return m.exports;
}

/* ── Tests para all-stations-widget.js ── */

describe('all-stations-widget.js parsers', () => {
  const fns = extractWidgetParsers('widget/all-stations-widget.js');

  describe('normalizeLiters', () => {
    it('extrae digitos de formato con punto', () => {
      expect(fns.normalizeLiters('1.234')).toBe(1234);
    });
    it('retorna 0 para null', () => {
      expect(fns.normalizeLiters(null)).toBe(0);
    });
  });

  describe('parseGenex', () => {
    it('extrae litros de HTML valido', () => {
      const html = '<div>GENEX I</div><span>G. ESPECIAL+</span><b>3.500 litros</b>';
      expect(fns.parseGenex(html, 'GENEX I', 'G. ESPECIAL+')).toBe(3500);
    });
    it('retorna 0 para html null', () => {
      expect(fns.parseGenex(null, 'GENEX I', 'G. ESPECIAL+')).toBe(0);
    });
  });

  describe('parseEC2', () => {
    it('extrae litros de HTML valido', () => {
      const html = '<div>T-ESPECIAL</div><span>Volumen disponible</span><b>4,200 Lts</b>';
      expect(fns.parseEC2(html, 'T-ESPECIAL')).toBe(4200);
    });
    it('retorna 0 para html null', () => {
      expect(fns.parseEC2(null, 'T-ESPECIAL')).toBe(0);
    });
  });

  describe('parseGasGroup', () => {
    const COD = 'TEST';
    it('suma litros y filtra por umbral', () => {
      const json = { estaciones: [{ codigo: COD, tanques: [
        { producto: 'GASOLINA ESPECIAL', litros: 2000 },
        { producto: 'DIESEL', litros: 3000 },
      ]}]};
      expect(fns.parseGasGroup(json, 'GASOLINA ESPECIAL', COD)).toBe(2000);
    });
    it('retorna 0 bajo umbral', () => {
      const json = { estaciones: [{ codigo: COD, tanques: [
        { producto: 'GASOLINA ESPECIAL', litros: 500 },
      ]}]};
      expect(fns.parseGasGroup(json, 'GASOLINA ESPECIAL', COD)).toBe(0);
    });
  });

  describe('parseChartJson', () => {
    it('extrae litros del chartJson', () => {
      const chart = { dataTable: { rows: [
        { c: [{ v: 'ESPECIAL' }, { v: 4500 }] },
      ]}};
      const jsonStr = JSON.stringify(chart).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const html = `<html>'chartJson' : '${jsonStr}'</html>`;
      expect(fns.parseChartJson(html, 'ESPECIAL')).toBe(4500);
    });
    it('retorna 0 para html null', () => {
      expect(fns.parseChartJson(null, 'ESPECIAL')).toBe(0);
    });
  });
});

/* ── Tests para cards-widget.js ── */

describe('cards-widget.js parsers', () => {
  let fns;

  try {
    fns = extractWidgetParsers('widget/cards-widget.js');
  } catch (_) {
    // cards-widget.js puede no tener todos los parsers
  }

  it('tiene parsers extraibles', () => {
    expect(fns).toBeDefined();
    expect(fns.normalizeLiters).toBeDefined();
  });

  it('normalizeLiters funciona igual', () => {
    if (!fns) return;
    expect(fns.normalizeLiters('2.500')).toBe(2500);
  });
});

describe('consistencia widget vs Worker para lecturas válidas', () => {
  const genex = [{ name: 'Genex Banzer', type: 'genex', key: 'GENEX I', fuel: 'G. ESPECIAL+' }];
  const html = (litros) => '<span class="station_name">GENEX I</span>'
    + '<span class="product_name">G. ESPECIAL+</span>'
    + `<span class="product_volume">${litros} litros</span>`;

  it('coincide para los formatos de volumen admitidos', () => {
    const widget = extractWidgetParsers('widget/all-stations-widget.js');
    for (const value of ['0', '1.234', '1,234', '5000', '12.345.678']) {
      expect(widget.normalizeLiters(value)).toBe(readSource(genex, html(value))[0][1]);
    }
  });

  it('coincide para una lectura de Genex', () => {
    const widget = extractWidgetParsers('widget/all-stations-widget.js');
    expect(widget.parseGenex(html('3.500'), 'GENEX I', 'G. ESPECIAL+')).toBe(readSource(genex, html('3.500'))[0][1]);
  });

  it('coincide para una lectura por encima del umbral de Gasgroup', () => {
    const widget = extractWidgetParsers('widget/all-stations-widget.js');
    const product = 'GASOLINA ESPECIAL';
    const codigo = 'X';
    const stations = [{ name: 'Urubó', type: 'gasgroup', product, codigo }];
    const json = { estaciones: [{ codigo, tanques: [
      { producto: product, litros: 2000 },
      { producto: product, litros: 1500 },
    ] }] };
    expect(widget.parseGasGroup(json, product, codigo)).toBe(readSource(stations, json)[0][1]);
  });
});
