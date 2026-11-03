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
  index.html, style.css, engine.js, game.js, ranges.json
  tests/validate-ranges.mjs, tests/test-engine.mjs
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
```

Los rangos son una referencia aproximada 6-max a 100 bb; no representan la salida exacta de un solver.

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
