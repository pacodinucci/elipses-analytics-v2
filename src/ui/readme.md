# Frontend v2 (Electron + React)

Documento de implementación

Este documento registra el estado del **front v2** y su integración con el **backend v2 (DuckDB + IPC)**.

---

## 1. Objetivo

Migrar el front v1 (layout + UX + patrones) a v2:

- Backend local embebido en Electron
- Comunicación vía **IPC tipado** (`window.electron.*`)
- Dominio v2: **no existe “Yacimiento”** en el flujo principal

### Flujo mínimo verificable (MVP UI)

1. Seleccionar / crear **Proyecto**
2. Importar **Capas** (TXT): `dry-run` + `commit`
3. Refrescar UI y mostrar **Barra de capas**
4. Seleccionar capa y alimentar Viewer / Datos / Producción

---

## 2. Decisiones y cambios respecto a v1

### 2.1 Eliminación de Yacimiento

- Se elimina selección/creación de yacimientos.
- La UI trabaja con:
  - `Proyecto` (selección principal)
  - `Capa` (selector secundario)

### 2.2 Capas por proyecto

- `useCapas()` y `ProyectoCapasBar` dependen de `proyectoId`.

### 2.3 Imports v2

- Capas:
  - `CapaTxtImportPayload = { proyectoId, content }`
- Maps:
  - `MapImportPayload = { rows: MapImportRow[] }`
  - Cada row debe tener `proyectoId` (la UI lo inyecta si falta).

### 2.4 Elipses / Producción (estado actual)

- Se mantienen **compat** para no frenar UI.
- Se migrarán a pivote por `simulacionId` (v2).

---

## 3. Estructura de carpetas

### 3.1 Layout y navegación

- `src/components/layout/`
  - `app-layout.tsx`
  - `breadcrumb-bar.tsx`
- `src/components/menu/`
  - `menu-bar.tsx`
  - `proyecto-menu.tsx`
  - `ver-menu.tsx`
  - `menu-bar.css`
  - `proyecto-menu.css`
  - `ver-menu.css`

### 3.2 Proyecto y capas

- `src/components/project/`
  - `project-yacimiento-start-screen.tsx` (**adaptado**: solo proyectos)
  - `project-capas-bar.tsx` (**adaptado**: recibe `proyectoId`)

### 3.3 Import

- `src/components/import/`
  - `import-modal.tsx`
  - `import-modal.css`

### 3.4 Shell de modales con sidebar

- `src/components/mapa/`
  - `options-shell-modal.tsx`
  - `options-shell-modal.css`

### 3.5 Hooks y stores

- Hooks:
  - `src/ui/hooks/use-capas.ts`
  - `src/hooks/use-proyectos.ts`
- Stores:
  - `src/store/selection-store.ts`
  - `src/store/proyectos-store.ts`

---

## 4. Flujo UI actual (runtime)

### 4.1 `App.tsx`

Responsabilidades:

- Selección:
  - `selectedProyecto: Proyecto | null`
  - `selectedCapaName: string | null`
- Ventanas:
  - `ViewerFloatingWindow`
  - `DatosMapaFloatingWindow`
  - `ProduccionFloatingWindow`
- Barra de capas:
  - `showCapasBar: boolean`
  - `capasBarPosition: "top" | "left"`
- Boot:
  - `fetchProyectos()` al iniciar
- Capas:
  - `useCapas(proyectoId)` (para barra y selección)

Notas:

- Elipses queda como placeholder; no bloquea UI hasta conectar `simulacionId`.

### 4.2 `AppLayout`

Render:

- `MenuBar`
- `BreadcrumbBar`
- `<main/>`

Props relevantes:

- `selectedProyecto`
- `selectedCapaName` (opcional: breadcrumb)
- toggles de ventanas y barra

### 4.3 `BreadcrumbBar`

- Muestra `proyecto.nombre`
- Si hay capa: `/ capa`

---

## 5. Menú superior

### 5.1 `ProyectoMenu`

Acciones:

- **Abrir proyecto…** → `onAbrirProyecto()`
- **Importar…** → `onOpenImportar()` → abre `ImportModal`

### 5.2 `VerMenu`

Toggles:

- Ventanas: Mapa / Producción / Datos mapa
- Barra de capas: show/hide + posición `top|left`

---

## 6. Hook `useCapas` (v2)

Archivo: `src/ui/hooks/use-capas.ts`

- Firma:
  - `useCapas(proyectoId: string | null): { capas: CapaRow[]; loading; error }`
- IPC:
  - `window.electron.coreCapaListByProject({ proyectoId })`
- Cache:
  - por sesión, **per-proyecto**
- Normalización:
  - soporta `nombre` o `name`
- Helper:
  - `invalidateCapasCache(proyectoId)` (post-commit de import)

---

## 7. `ImportModal` (v2)

Archivo: `src/components/import/import-modal.tsx`

Tabs:

- `capas` — TXT (textarea)
- `maps` — JSON (textarea)
- `database` — muestra `summary` + `errors` + JSON
- `help` — formato esperado

Acciones:

- Capas:
  - `importCapasDryRun({ proyectoId, content })`
  - `importCapasCommit({ proyectoId, content })` + `invalidateCapasCache(proyectoId)`
- Maps:
  - `importMapsDryRun({ rows })`
  - `importMapsCommit({ rows })`
  - La UI inyecta `proyectoId` por row si falta.

---

## 8. `OptionsShellModal`

Archivo: `src/components/mapa/options-shell-modal.tsx`

- Sidebar con items
- Panel con `panelTitle`, `panelSubtitle`, `children`, `footer`
- UX:
  - Cierra con `ESC`
  - Cierra con click fuera del modal

---

## 9. Tipos (TypeScript)

### 9.1 `types.d.ts`

- Es un `.d.ts` con `export {}` ⇒ es módulo.
- Para que `window.electron` sea reconocido:
  - `interface Window { electron: ... }` debe estar **dentro de `declare global { ... }`**.

### 9.2 `tsconfig.json`

Requisitos:

- `include: ["src", "types.d.ts"]`
- No usar `"types": ["./types"]` (rompe augmentations globales).

Después de cambios:

- VS Code → **TypeScript: Restart TS Server**

---

## 10. IPC consumido por el front (hasta ahora)

- Proyectos:
  - `coreProyectoList`
  - `coreProyectoCreate`
  - `coreProyectoInitialize`
- Capas:
  - `coreCapaListByProject`
- Imports:
  - `importCapasDryRun`, `importCapasCommit`
  - `importMapsDryRun`, `importMapsCommit`

---

## 11. Pendientes inmediatos

- [ ] Conectar elipses v2 por `simulacionId`
- [ ] Migrar Producción v2 (hoy sigue con prop legacy)
- [ ] Documentar formato exacto TXT de capas (según importer real)
- [ ] Ajustes UI finos (overflow, tamaños, etc.)

---

## 12. Smoke Test (UI)

1. Abrir app
2. Seleccionar/crear proyecto
3. Menú: **Proyecto → Importar…**
4. Tab “Capas”: pegar TXT
5. Ejecutar **Dry-run** y revisar summary/errores
6. Ejecutar **Commit**
7. Verificar que refresca la **Barra de capas**
8. Seleccionar una capa y verificar breadcrumb (proyecto / capa)
