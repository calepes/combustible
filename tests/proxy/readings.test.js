import { describe, it, expect } from 'vitest';
import { STATIONS } from '../../pwa/shared/stations.js';
import { readSource } from '../../proxy/readings.js';

const station = (name) => STATIONS.find((entry) => entry.name === name);
const heading = (name) => `<span class="station_name">${name}</span>`;
const fuel = (name, volume) => `<span class="product_name">${name}</span><span class="product_volume">${volume}</span>`;

describe('lecturas de los proveedores', () => {
  it('Genex distingue I de IV y la Gasolina Especial de otros productos', () => {
    const stations = ['Genex Banzer', 'Genex IV', 'Vangas'].map(station);
    const html = heading('GENEX IV') + fuel('G. ESPECIAL+', '9,000 litros')
      + heading('GENEX I') + fuel('G. ESPECIAL+', '3.500 LITROS')
      + heading('VANGAS') + fuel('DIESEL+', '6.000 litros');
    expect(readSource(stations, html)).toEqual([
      ['Genex Banzer', 3500], ['Genex IV', 9000], ['Vangas', null],
    ]);
  });

  it('Genex reconoce un volumen agotado explícito', () => {
    const html = heading('GENEX I') + fuel('G. ESPECIAL+', '[AGOTADO]');
    expect(readSource([station('Genex Banzer')], html)).toEqual([['Genex Banzer', 0]]);
  });

  it('Biopetrol asigna cada volumen a su estación y admite 0', () => {
    const stations = ['Equipetrol', 'Pirai', 'Alemana'].map(station);
    const card = (name, volume = '') =>
      `<div class="font-18 font-weight-bold bg-oscuro-1 py-2">${name} <span class="distancia"></span></div>${volume}`;
    const html = card('EQUIPETROL') + card('CHACO', 'Volumen disponible: 9,000 Lts')
      + card('PIRAI', 'Volumen disponible: 4,200 Lts')
      + card('ALEMANA', 'Volumen disponible <b>0 Lts</b>');
    expect(readSource(stations, html)).toEqual([
      ['Equipetrol', null], ['Pirai', 4200], ['Alemana', 0],
    ]);
  });

  it('Gasgroup conserva un volumen bajo y rechaza una lectura incompleta', () => {
    const urubo = station('Urubó');
    const tank = (litros) => ({ producto: 'Gasolina Especial', litros });
    const input = (tanques) => ({ estaciones: [{ codigo: urubo.codigo, tanques }] });
    expect(readSource([urubo], input([tank(0), tank(500)]))).toEqual([['Urubó', 500]]);
    expect(readSource([urubo], input([tank(0)]))).toEqual([['Urubó', 0]]);
    expect(readSource([urubo], input([tank(undefined), tank(500)]))).toEqual([['Urubó', null]]);
    expect(readSource([urubo], { estaciones: {} })).toEqual([['Urubó', null]]);
  });

  it('Rivero distingue el cero de un gráfico sin el producto o con JSON inválido', () => {
    const graph = (product, litros) => "'chartJson':'" + JSON.stringify({
      dataTable: { rows: [{ c: [{ v: product }, { v: litros }] }] },
    }) + "'";
    const rivero = [station('Rivero')];
    expect(readSource(rivero, graph('Gasolina Especial', 3200))).toEqual([['Rivero', 3200]]);
    expect(readSource(rivero, graph('Gasolina Especial', 0))).toEqual([['Rivero', 0]]);
    expect(readSource(rivero, graph('Diesel', 3000))).toEqual([['Rivero', null]]);
    expect(readSource(rivero, "'chartJson':'incompleto'")).toEqual([['Rivero', null]]);
  });
});
