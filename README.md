# Página Web LIS

## Arquitectura

Esta es una aplicación de página única (SPA) estática para el sitio web del laboratorio de investigación LIS. Construida con JavaScript vanilla, HTML y CSS.

- **Enrutamiento**: Enrutamiento basado en hash vía `js/router.js`, carga contenido HTML desde `content/` en `#content-container`.
- **Módulos**: Lógica específica de página en `js/modules/`, cada uno exporta un método `init()`.
- **Datos**: Archivos JSON estáticos en `data/`, cargados asincrónicamente.
- **Estilos**: CSS modular con variables en `css/base.css`, utilidades en `css/utilities.css`, componentes en `css/components.css`.

## Cómo Funciona

El sitio usa enrutamiento hash para navegar entre páginas sin recargar. Los módulos se cargan dinámicamente y manejan la lógica de cada página. Los datos se cachean globalmente para mejorar el rendimiento.

## Cómo Hacer Modificaciones

- **Páginas nuevas**: Crear `content/nuevapagina.html`, añadir a `VALID_PAGES` en router, crear `js/modules/nuevomodule.js`.
- **Estilos**: Añadir a la hoja CSS apropiada (componentes para reutilizables, páginas para específicos).
- **Datos**: Editar archivos JSON en `data/`, actualizar módulos si es necesario.

## Cómo Ejecutarlo

Abrir `index.html` en un navegador web. No requiere servidor, pero para datos locales usar un servidor local (ej. `python -m http.server`).

## Cómo Cargar Datos

Los datos se cargan automáticamente desde `data/` usando `window.LISDataCache`. Para nuevos datos, añadir JSON y actualizar módulos para usarlos.

## Despliegue (GitHub Pages)

El sitio se publica como la página raíz de la organización `UTN-LIS` (`https://utn-lis.github.io/`) vía GitHub Actions (`.github/workflows/deploy-pages.yml`). Cada push a `main` dispara el workflow, que empaqueta el repo tal cual (sin build) y lo publica. No requiere pasos manuales una vez configurado el repo (nombre `UTN-LIS.github.io`, público, Pages con origen "GitHub Actions").
