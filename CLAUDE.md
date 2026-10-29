# Castronegro · Asistente del narrador

App web (móvil primero, en español de España) que ayuda al narrador de **Hombre Lobo de Castronegro**
a dirigir la partida: reparte roles, guía cada turno de la noche con el texto a leer, resuelve el
amanecer, la votación y la condición de victoria. Un solo móvil (el del narrador). En el futuro
podrá usarse en modo cooperativo (cada jugador en su móvil), pero **ahora no se construye nada de red**.

## Comandos

- `npm run dev` · servidor de desarrollo
- `npm test` · tests de las reglas (Vitest)
- `npm run build` · comprueba tipos y construye
- `npm run lint` · oxlint

## Arquitectura

- `src/game/` · **reglas puras, sin React ni DOM**. Aquí vive toda la lógica.
  - `types.ts` tipos (`GameState`, `Player`, `Action`…)
  - `roles.ts` roles definidos como **datos** (`RoleDef`): añadir un rol = añadir un objeto
  - `setup.ts` validación, reparto sugerido, barajado (único sitio con aleatoriedad, recibe `rng`) y `createGame`
  - `night.ts` pasos de la noche y objetivos válidos
  - `resolve.ts` muertes encadenadas (amantes, cazador) y condición de victoria
  - `reducer.ts` `aplicar(estado, accion) => estado` (puro, lanza `GameRuleError` si la acción no es válida)
  - `view.ts` `vistaPara(estado, 'narrador' | idJugador)` oculta lo secreto
- `src/storage/` · guardado en localStorage (versionado y validado) y pila de deshacer
- `src/ui/` · pantallas y componentes React. La UI **solo** llama a `aplicar` y a los helpers de `game/`
- `prototipo/guia-castronegro.html` · beta original. **Referencia; no se toca.**

## Reglas de trabajo

1. Cambios pequeños, una tarea por vez. Commit tras cada paso que funcione.
2. Toda regla nueva o cambiada lleva test en `src/game/*.test.ts`.
3. Nada de `Math.random` dentro de las reglas: el azar entra por parámetro (`rng`) y el resultado se guarda en el estado.
4. El estado debe ser siempre serializable a JSON y se trata como inmutable (cada acción devuelve uno nuevo).
5. Identificar jugadores por `id` estable, nunca por nombre ni posición.
6. Los nombres de jugador se pintan como texto (React ya escapa); nunca `dangerouslySetInnerHTML`.
7. Textos de interfaz y de narración en español de España.

## Reglas de la casa (decididas; cambiar solo con el usuario)

Configurables en `HouseRules` (pantalla de configuración):

- Guardián puede protegerse a sí mismo: **sí**
- Guardián puede repetir protección dos noches seguidas: **no**
- Si guardián y bruja salvan a la misma víctima: **sobrevive** (alternativa: muere)
- La bruja puede salvarse a sí misma: **sí**
- La bruja puede usar las dos pociones la misma noche: **sí**
- Empate en la votación: **no muere nadie**
- Cupido solo actúa la primera noche. Si muere un amante, muere el otro. El cazador dispara al morir (de noche, por voto o de pena).
- Victoria: aldeanos si no quedan lobos; lobos si igualan o superan al resto; amantes si son los dos últimos vivos y de bandos distintos.

## Pendiente (hoja de ruta)

- PWA / modo sin conexión · más roles (Ladrón, Niña con espionaje, Alguacil, Chivo expiatorio…)
- Temporizador de debate · historial de partidas · varios idiomas
- Modo cooperativo: anfitrión como autoridad + servicio en tiempo real (decidir entonces)
