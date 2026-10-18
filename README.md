# La Mesa · Apunte de dominó

App móvil (Android e iOS) para llevar el apunte de partidas **presenciales** de dominó. Todo vive en el teléfono: sin cuentas, sin nube, sin backend propio.

Este repositorio avanza por etapas. **Etapas 1 y 2 (este estado):** dominio de puntuación, SQLite con migraciones, el recorrido de partida rápida hasta el resultado y la revancha, corrección de manos con vista previa, modo mesa y ajustes.

## Requisitos

- Node 22 o superior y npm.
- Para ejecutar en un teléfono: un *development build* (`npx expo run:android` / `npx expo run:ios`) o un emulador. Expo Go puede abrir esta etapa porque solo usa módulos incluidos en Expo, pero no es la validación de referencia.

## Puesta en marcha

```bash
npm install
npx expo start          # servidor de desarrollo
npx expo run:android    # build nativo local (requiere Android SDK)
```

## Comprobaciones

```bash
npm run typecheck       # TypeScript estricto
npm run lint            # ESLint (config de Expo)
npm test                # Jest: dominio, SQLite real e interfaz
npx expo export --platform android   # verifica que el bundle nativo compila
```

Las pruebas de integración usan el SQLite real que trae Node (`node:sqlite`) mediante un adaptador de pruebas (`src/test/nodeSqlite.ts`); la app usa `expo-sqlite`. Ambos implementan la misma interfaz `SqlDriver`.

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `src/domain` | TypeScript puro: tipos, cálculo del desenlace, comandos (anotar, corregir, reasignar, anular, deshacer) y configuración de partida. Sin React, SQLite ni Expo. |
| `src/data` | Interfaz `SqlDriver`, adaptador de `expo-sqlite`, migraciones versionadas, repositorio de partidas y de ajustes. |
| `src/application` | `GameService`: casos de uso transaccionales e idempotentes; arranque de servicios. |
| `src/features` | Lógica de interfaz sin componentes: borrador del apunte, formulario de configuración, formatos. |
| `src/ui` | Tokens (claro/oscuro), tema y componentes compartidos. |
| `src/platform` | IDs (UUID), reloj y hápticos. |
| `src/app` | Pantallas de Expo Router. |

## Decisiones

Ver [`docs/decisiones.md`](docs/decisiones.md): modelo de datos, reglas de puntuación, idempotencia, migraciones y sistema visual.

## Estado de la especificación

Hecho en la etapa 1:

- Partida rápida (equipos A/B provisionales, meta 200) y configuración opcional: parejas o individual de 2 a 4, meta 100/150/200 o personalizada (1–9999). Nombres opcionales. Sin bonificaciones automáticas: todo se suma a mano (el dominio admite reglas de la casa si se vuelven a ofrecer).
- Una sola partida activa por instalación, garantizado también por un índice único en SQLite. Continuar o abandonar explícitamente.
- Teclado propio de enteros, atajos 10/25/50 que solo rellenan, confirmación que nombra al destinatario («Anotar 47 a La visita») y «Mano sin puntos» como acción explícita.
- Cada operación se guarda en una transacción antes de mostrar éxito; si falla, el borrador se conserva y el reintento usa el mismo `commandId` sin duplicar.
- Deshacer como operación compensatoria (no borra historial).
- Resultado con total real (212, no 200), revancha que crea una partida nueva y «Cambiar parejas» con el formulario precargado.
- Tema claro y oscuro con contrastes verificados por prueba, objetivos táctiles de 48+ (teclado 60), soporte de lector de pantalla y de «reducir movimiento».

Hecho en la etapa 2:

- Corrección de cualquier mano tocándola en la tabla: cambiar cantidad, cambiar de equipo o anular. Antes de confirmar se ve el marcador antes → después y sus consecuencias (la partida termina, se reabre, cambia el ganador, qué manos quedan fuera de resultado o vuelven a contar). Cada corrección es una revisión nueva con su historial; nada se borra.
- Las manos posteriores al cierre quedan marcadas «Fuera de resultado» en la tabla y en «Última anotación».
- Modo mesa: solo lectura con números grandes, vertical u horizontal, copia girada 180° opcional para quien está enfrente y pantalla encendida solo mientras está abierto y la app en primer plano.
- Ajustes guardados en SQLite: tema (sistema/claro/oscuro), los tres atajos del teclado, vibración y pantalla encendida en modo mesa.
- Reanudar: la partida activa se continúa desde el inicio tras cerrar la app.
- Marcadores de 3 y 4 cifras con tamaño calculado por número de cifras (no se cortan a 360 px).

Pendiente por etapa:

- **Sin hacer de la etapa 2:** sonido (no se añadió para no sumar una dependencia nativa sin poder probarla) y la revisión manual con texto al 200 % en dispositivo.
- **Etapa 3:** jugadores con identidad estable, grupos, sesiones, rotación y estadísticas; historial con filtros.
- **Etapa 4:** tarjeta de resultado y compartir, copia JSON (exportar/importar), Plus, anuncios y compras en sandbox.

## Verificación y límites conocidos

- Ejecutado aquí: typecheck, lint, 74 pruebas de Jest (dominio, integración con SQLite real, componentes y contrastes) y `expo export` del bundle Android.
- **No verificado aún en dispositivo ni emulador**: este entorno no tiene Android SDK ni Xcode. El primer objetivo de validación es un Android de gama media.
- La exportación web solo se usó para tomar capturas de diseño; no es un objetivo del producto ni sustituye la validación nativa.

## Licencias de recursos

- Tipografías Space Grotesk e Inter vía `@expo-google-fonts` (SIL Open Font License 1.1), empaquetadas localmente.
- Iconos Feather vía `@expo/vector-icons` (MIT).
- La ficha de dominó de la marca está dibujada con vistas de React Native; no usa imágenes externas.
