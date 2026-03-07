# Widget Combustible - GENEX I

Widget de [Scriptable](https://scriptable.app/) para iOS que muestra la disponibilidad de **Gasolina Especial+** en la estación **GENEX I (Genex Banzer)**.

## Funcionalidad

- Consulta en tiempo real los litros disponibles desde [genex.com.bo/estaciones/](https://genex.com.bo/estaciones/)
- Muestra un widget pequeño con:
  - Nombre de la estación
  - Tipo de combustible
  - Litros disponibles (o estado de error)
  - Hora de la última consulta

## Estados

| Estado | Color | Significado |
|--------|-------|-------------|
| `X.Xk Lts` | Verde | Combustible disponible |
| `0 Lts` | Rojo | Sin combustible |
| `Sin datos` | Amarillo | No se encontró la información en la página |
| `Sin conexión` | Amarillo | Error de red al consultar |

## Instalación

1. Instalar [Scriptable](https://apps.apple.com/app/scriptable/id1405459188) en tu iPhone
2. Copiar el contenido de `fuel-widget.js` como nuevo script en Scriptable
3. Agregar un widget de Scriptable (tamaño pequeño) al Home Screen
4. Seleccionar el script creado en la configuración del widget
