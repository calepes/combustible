# Changelog

Registro de cambios del Widget Combustible.

## [2.1.0] - 2026-03-08 — Paleta Ocean Blue + Distancia dinámica

### Cambiado
- Paleta de colores: Ocean Blue (`#3B82F6` acento, `#60A5FA` barra de nivel)
- Reemplaza cyan original (`#64D2FF`) y azul iOS (`#0A84FF`)
- Dot disponible: `#30D158`, no disponible: `#FF453A`

### Agregado
- **Color de distancia dinámico**: el texto de km interpola entre verde → naranja → rojo según lejanía
  - 0 km = verde `#34D399`
  - ~7 km = naranja `#FB923C`
  - 15+ km = rojo `#EF4444`
  - Interpolación lineal en rango 0–15 km
- Fuente bold para texto de distancia (era medium)

### Nota
- Se probó paleta Purple/Indigo (`#BF5AF2`) pero se descartó a favor de Ocean Blue

## [2.0.0] - 2026-03-08 — Cards Widget (Apple HIG)

### Agregado
- Nuevo diseño `cards-widget.js` basado en tarjetas con fondo (`cardBg`) y corner radius 14pt
- Barra de nivel relativo por estación (estilo Apple Health/Fitness, color cyan #64D2FF)
- Indicador de estado verde/rojo (punto ●) en cada tarjeta

### Mejorado
- Tipografía con jerarquía HIG: nombre 13pt semibold, litros 22pt bold rounded, empresa 11pt
- Todas las fuentes cumplen mínimo HIG de 11pt
- Márgenes de 16pt en widget, 10pt padding interno en tarjetas, 8pt gap entre cards
- Header simplificado: sin emoji, título 22pt bold rounded
- Grid reducido a top 6 estaciones (3×2) para layout más espacioso
- Menú Waze ahora muestra todas las estaciones (no solo las del widget)

### Eliminado
- Separadores horizontales (reemplazados por espaciado entre tarjetas)
- Badge "EN VIVO" del footer (reduce ruido visual)
- Emoji ⛽ del header

## [1.5.0] - 2026-03-08

### Mejorado
- Separadores de fila extendidos a ancho completo (`repeat(200)`)
- Vista previa del widget (`presentLarge()`) al tocar antes del menú Waze
- Refrescar datos del widget al tocar antes de mostrar menú

## [1.4.0] - 2026-03-07

### Mejorado
- Separadores de fila a ancho completo sin padding lateral

## [1.3.0] - 2026-03-07

### Agregado
- Umbral mínimo de 1,500 Lts para datos de Gasgroup/Orsa (filtra lecturas poco confiables)

### Mejorado
- Quitar icono de combustible del encabezado
- Agregar nombre de ciudad ("Santa Cruz") al subtítulo
- Mejorar estilo de separadores

## [1.2.0] - 2026-03-06

### Mejorado
- Tamaño de fuente del nombre de estación aumentado a 15pt
- Revertir tamaño de fuente de litros a 13pt
- Tamaño de fuente de fila de estación aumentado de 13 a 14pt
- Texto de interfaz en español neutro
- Fuente unificada para nombre de estación y valor de litros
- Separadores extendidos al ancho completo del widget

### Cambiado
- Mostrar solo menú Waze al tocar (sin preview previo del widget)

## [1.1.0] - 2026-03-05

### Agregado
- Menú de navegación con Waze al tocar el widget
- Vista previa del widget antes del menú de navegación Waze
- Estación **Gasco** (Biopetrol, fuente ec2 API)
- Estación **Rivero** (fuente Google Sheets — parsing de chartJson embebido en HTML)

### Mejorado
- Rivero: múltiples estrategias de parsing (HTML embebido, WebView, chartiframe URL, endpoints gviz)
- Fix Rivero: corrección de unescape de JS string en chartJson

## [1.0.0] - Versión inicial

### Funcionalidad base
- Widget Scriptable tamaño Large con todas las estaciones
- Consulta en tiempo real de litros disponibles
- Estaciones: Genex Banzer, Vangas, Urubó, Equipetrol, Pirai, Alemana, López, Viru Viru
- Fuentes: genex.com.bo (HTML), gasgroup.com.bo (API JSON), Biopetrol ec2 (HTML)
- Indicador visual verde/rojo por estación
- Ordenamiento por disponibilidad (mayor primero)
- Hora de última consulta y contador de disponibles
- Soporte modo claro y oscuro
- Loader con caché local en iCloud
- Widgets individuales por estación (Equipetrol, Pirai, Urubó, Vangas)
