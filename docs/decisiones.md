# Decisiones de las etapas 1 y 2

## Modelo de datos (migración 1)

IDs UUID generados en el teléfono; nunca el nombre como clave.

- `players`, `groups`, `group_members`, `sessions`: creadas ya para que las etapas siguientes no reescriban el esquema base; la interfaz las usa a partir de la etapa 3.
- `games`: modo, meta, estado (`active`, `finished`, `abandoned`), `rules_snapshot` (JSON congelado), `winner_side_id`, fechas y `revision`. Un índice único parcial (`WHERE status = 'active'`) impide dos partidas activas.
- `game_sides` y `game_participants`: nombres guardados como *snapshot*; `composition_key` son los `playerId` ordenados (nulo si hay invitados sin identidad). `UNIQUE (game_id, player_id)` evita repetir a una persona en la partida.
- `score_entries` (`sequence` única por partida, `kind`: `hand`, `bonus`, `scoreless_hand`) y `score_entry_revisions` (revisiones inmutables con `side_id`, `base_points`, `bonuses` JSON con etiqueta, código y valor usados, `voided`, `reason`, `command_id`).
- `operations`: una fila por `commandId` (clave primaria). Da idempotencia y la pila de deshacer (`undone_by`, `undoes`).
- `app_settings` y `schema_version`.

Las tablas comerciales (derechos de Plus, exposición y elegibilidad de anuncios) llegarán en su propia migración, separadas del dominio y fuera de la copia JSON.

## Reglas de puntuación

- El desenlace se calcula siempre a partir de las revisiones vigentes no anuladas, en orden de `sequence`. No hay un total editable aparte.
- Gana el primer lado que alcanza o pasa la meta; se conserva el total real. Los apuntes posteriores al cierre quedan «fuera de resultado», visibles y nunca borrados.
- Corregir crea una revisión; anular crea una revisión con `voided`; deshacer crea una revisión compensatoria y marca la operación como deshecha. Deshacer funciona como pila.
- Si una corrección baja al ganador por debajo de la meta, la partida se reabre, salvo que ya exista otra activa (entonces se rechaza).
- Un cero no se anota como mano: «Mano sin puntos» es un tipo propio que cuenta como mano jugada sin sumar. Un apunte de bonificación independiente no cuenta como mano.
- La tranca no infiere ganador: se anota lo que acuerde la mesa.

## Durabilidad

- `GameService.execute` hace todo en una transacción exclusiva: comprobar `commandId`, cargar estado, aplicar el comando puro, insertar revisión y operación, actualizar la cabecera de la partida. La interfaz solo muestra éxito cuando la promesa resuelve tras el `COMMIT`.
- Reintentar un `commandId` ya confirmado devuelve el estado actual (`replayed: true`) sin duplicar. Dos comandos distintos con los mismos puntos son dos apuntes legítimos.
- Al abrir: `journal_mode = WAL` y `foreign_keys = ON`. Cada migración corre en su propia transacción; si falla se revierte, se muestra el error y no se borra nada. Una base de una versión más nueva se rechaza.

## Sistema visual

- Paleta de la especificación (marfil, tinta, cobalto y terracota) con tintes por equipo y variantes para el tema oscuro. `src/ui/__tests__/contrast.test.ts` exige 4.5:1 en cada combinación de texto.
- Estilo «pegatina»: trazo de 2 px y sombra sólida desplazada, sin difuminados, degradados ni transparencias detrás del texto. El botón principal lleva la sombra en cobalto como único acento de marca; el oro aparece solo en la cinta «Ganador».
- Space Grotesk para títulos y cifras (tabulares), Inter para la interfaz. La ficha de dominó de la marca y la barra de avance hacia la meta están hechas con puntos de ficha.
- Los equipos conservan siempre su posición (A izquierda, B derecha) y se identifican por letra, nombre y color, nunca solo por color.

## Etapa 2

- **Corregir es un comando más.** La hoja de corrección construye `edit_entry`, `reassign_entry` o `void_entry` y los pasa por `previewCommand` antes de guardar; la vista previa y el guardado usan el mismo cálculo del dominio, así que lo que se ve es lo que queda. El `commandId` se conserva al reintentar y se renueva si cambia la propuesta.
- **Fuera de resultado, no borrado.** Si una corrección adelanta el cierre, las manos posteriores pasan a `out_of_result`; si otra corrección reabre la partida, vuelven a contar. La interfaz siempre lo dice antes de confirmar.
- **Ajustes en SQLite** (tabla `app_settings`, clave `preferences`), validados con zod campo a campo: un valor dañado vuelve a su valor por defecto sin perder los demás. Se guarda primero y luego se notifica a la interfaz.
- **Pantalla encendida** con `expo-keep-awake` solo mientras el modo mesa tiene el foco y la app está activa; se libera al salir o al pasar a segundo plano.
- **Tamaño del marcador por cifras** (`scoreFontSize`): `adjustsFontSizeToFit` no existe en web y falla en Android con fuentes propias, así que el tamaño se calcula y `adjustsFontSizeToFit` queda solo como respaldo en iOS.

## Etapa 3

- **Nada obligatorio.** Jugadores, grupos y sesiones son opcionales: la partida rápida y los nombres vacíos siguen funcionando igual que antes.
- **Jugadores sin pasos extra.** Al armar una partida, los nombres nuevos que se escriben se guardan como jugadores en la misma transacción que crea la partida (ajuste «Guardar nombres nuevos», activo por defecto). Los jugadores guardados aparecen como pastillas: un toque los sienta en el primer puesto libre. Un nombre escrito que coincide con uno guardado **no** se vincula solo (dos personas pueden llamarse José): se ofrece «Usar a José guardado» y, si no se toca, queda como invitado.
- **Sesiones automáticas.** Cada partida se asigna a la sesión abierta si la anterior tuvo actividad hace menos de 3 horas (`SESSION_GAP_MS`) y no cambió el grupo; si no, se cierra la anterior y se abre otra. La revancha cae en la misma sesión.
- **Grupos.** Lista local con integrantes. «Jugar con este grupo» ofrece solo a sus jugadores y marca la sesión con el grupo. Sus cifras cuentan las partidas donde todos los jugadores eran del grupo. Borrar un grupo no borra partidas ni jugadores.
- **Estadísticas** (`src/domain/stats.ts`): puras, recalculadas desde `games.winner_side_id` y los participantes en cada consulta, así que siempre reflejan correcciones. Victoria = integrar el lado ganador de una partida terminada; abandonadas y activas no cuentan; cero partidas no se muestra como 0 %; toda cifra lleva su denominador («1 de 2»). Pareja exacta por `composition_key`.
- **Guías.** Cada pantalla nueva muestra una tarjeta breve la primera vez; «Entendido» la cierra (se guarda en `guidesSeen`) y el botón «?» la vuelve a abrir.
- **Migración 2:** solo índices (`game_participants.player_id`, `games.session_id`, `group_members.player_id`, `sessions.started_at`). Las tablas ya venían de la migración 1.
