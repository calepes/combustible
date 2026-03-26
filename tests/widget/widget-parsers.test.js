import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Los widgets de Scriptable no exportan funciones (no son ES modules).
 * Estos tests verifican que los parsers duplicados en los widgets
 * son identicos a los de pwa/shared/fetchers.js (fuente de verdad).
 *
 * Tambien ejecutamos los parsers del widget directamente evaluandolos.
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

/* ── Verificar consistencia con PWA ── */

describe('consistencia widget vs PWA', () => {
  it('normalizeLiters produce mismos resultados', async () => {
    const { normalizeLiters: pwaNorm } = await import('../../pwa/shared/fetchers.js');
    const widgetFns = extractWidgetParsers('widget/all-stations-widget.js');

    const cases = ['1.234', '1,234', '5000', '', null, 'abc', '12.345.678'];
    for (const c of cases) {
      expect(widgetFns.normalizeLiters(c)).toBe(pwaNorm(c));
    }
  });

  it('parseGenex produce mismos resultados', async () => {
    const { parseGenex: pwaFn } = await import('../../pwa/shared/fetchers.js');
    const widgetFns = extractWidgetParsers('widget/all-stations-widget.js');

    const html = '<div>GENEX I</div><span>G. ESPECIAL+</span><b>3.500 litros</b>';
    expect(widgetFns.parseGenex(html, 'GENEX I', 'G. ESPECIAL+')).toBe(
      pwaFn(html, 'GENEX I', 'G. ESPECIAL+')
    );
  });

  it('parseGasGroup produce mismos resultados', async () => {
    const { parseGasGroup: pwaFn } = await import('../../pwa/shared/fetchers.js');
    const widgetFns = extractWidgetParsers('widget/all-stations-widget.js');

    const COD = 'X';
    const json = { estaciones: [{ codigo: COD, tanques: [
      { producto: 'GASOLINA ESPECIAL', litros: 2000 },
      { producto: 'GASOLINA ESPECIAL', litros: 1500 },
    ]}]};
    expect(widgetFns.parseGasGroup(json, 'GASOLINA ESPECIAL', COD)).toBe(
      pwaFn(json, 'GASOLINA ESPECIAL', COD)
    );
  });
});
