# Sala de Juegos

Juegos clásicos de navegador hechos con HTML, CSS y JavaScript, sin librerías.

## Estructura

```
index.html            Página inicial (catálogo de juegos)
assets/base.css       Colores, tipografías y márgenes compartidos (modo claro y oscuro)
buscaminas/
  index.html          Estructura de la página del juego
  style.css           Estilos propios del Buscaminas
  game.js             Lógica del juego
2048/
  index.html, style.css, game.js
solitario/
  index.html, style.css, game.js
sudoku/
  index.html, style.css, game.js   (generador con solución única)
serpiente/
  index.html, style.css, game.js   (juego clásico con teclado y controles táctiles)
ultima-parada/
  index.html, style.css, levels.js, game.js, test-levels.mjs
poker/
  index.html, style.css, engine.js, sizing.js, betting.js, evaluation.js
  game.js, ranges.json
  tests/validate-ranges.mjs, tests/test-engine.mjs, tests/test-sizing.mjs
  tests/test-betting.mjs, tests/test-evaluation.mjs
  tools/build-ranges.mjs   (genera ranges.json a partir de rangos en notación de póker)
spider/
  index.html, style.css, rules.js, game.js
  tests/test-rules.mjs
parejas/
  index.html, style.css, rules.js, game.js
  tests/test-rules.mjs
cuatro-en-raya/
  index.html, style.css, rules.js, game.js, ai-worker.js
  tests/test-rules.mjs
aprende/
  index.html          Portada de los tutoriales
  aprende.css         Estilos de los tutoriales
  buscaminas/         Tutorial "Haz tu propio Buscaminas" con demos (demos.js)
```

Para añadir un juego nuevo: crea una carpeta (`2048/`, `solitario/`…) con sus tres archivos,
enlaza `../assets/base.css` en su `index.html` y cambia su tarjeta en la página inicial de
"Próximamente" a un enlace.

## Probar Mesa de Estudio

Desde la carpeta del juego:

```
node tests/validate-ranges.mjs ranges.json
node tests/test-engine.mjs
node tests/test-sizing.mjs
node tests/test-betting.mjs
node tests/test-evaluation.mjs
```

Los rangos son una referencia aproximada 6-max a 100 bb; no representan la salida exacta de un solver.

Mesa de Estudio v2 añade tamaños configurables (apertura, 3-bet IP/OOP, 4-bet y apuestas postflop), validación de acciones NLHE (subida mínima, short all-in y límite de stack) y puntuaciones separadas para acción y tamaño. Los tamaños personalizados se guardan localmente en el dispositivo.

## Probar en local

Abre `index.html` en el navegador, o levanta un servidor sencillo:

```
python -m http.server 8000
```

y entra en http://localhost:8000

## Publicar en Azure Static Web Apps

1. El sitio vive en `303-Games/sala-de-juegos` del repositorio `300-Lab`.
2. En el portal de Azure: Crear recurso → Static Web App → plan Free.
3. Origen: GitHub, repositorio `300-Lab`, rama `main`.
4. Detalles de compilación: preset **Custom**, App location `/303-Games/sala-de-juegos`, Api location vacío, Output location vacío.
5. Azure crea un workflow de GitHub Actions; cada `git push` publica la nueva versión.

### Cambiar los rangos de referencia

Los rangos se escriben en `poker/tools/build-ranges.mjs`, en notación de póker (`22+`, `A2s+`, `KTs:0.5`…).
Después se regenera el JSON y se valida:

```
node tools/build-ranges.mjs ranges.json
node tests/validate-ranges.mjs ranges.json
```

### Módulos del póker (Mesa de Estudio)

La lógica no depende de la página, así que se prueba con Node desde `poker/`:

- `engine.js`: baraja, evaluador de 7 cartas y equity Monte Carlo.
- `sizing.js`: tamaños de referencia preflop (apertura 2,5 bb, 3 bb desde la SB; 3-bet 3× en posición y 4× sin posición; 4-bet 2,2× y 2,5×) y su factor (1 de referencia, 0,85 aceptable, 0,6 fuera de banda).
- `betting.js`: acciones legales (fold, check, call/limp, bet/raise, all-in), subida mínima (apuesta actual + último incremento) y botones de tamaño postflop.
- `evaluation.js`: frecuencias de la tabla, nota de la acción × factor del tamaño, limp, manos dudosas, pot odds, SPR y fold necesario para un farol.
- `game.js`: mesa, bots, entrenamiento, estadísticas e interfaz.
