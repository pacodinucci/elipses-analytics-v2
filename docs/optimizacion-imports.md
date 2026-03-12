# Plan de optimización de imports — prueba inicial en `PozoCapa`

## Objetivo

Optimizar el rendimiento del proceso de importación de datos relacionales, empezando por el caso más simple y controlable: **`PozoCapa`**.

La idea es **probar primero la estrategia en `PozoCapa`** antes de llevarla a imports más grandes y costosos, como `SetEstadoPozo`.

---

## Por qué vamos a probar primero en `PozoCapa`

Elegimos `PozoCapa` como primer caso de implementación porque:

- tiene una lógica más simple que `SetEstadoPozo`,
- el volumen de datos suele ser menor,
- permite validar el patrón técnico sin agregar complejidad temporal (`fecha`),
- es más fácil auditar si el resultado importado es correcto,
- y si funciona bien ahí, el mismo enfoque debería servir para otros imports.

En otras palabras:

> **`PozoCapa` va a ser el banco de prueba del nuevo pipeline de importación.**

No vamos a arrancar directamente por `SetEstadoPozo` porque ese archivo es más grande, más repetitivo y más desafiante.  
Primero queremos comprobar que la estrategia nueva funciona bien en un caso más controlado.

---

## Problema actual

Hoy el import probablemente está resolviendo las relaciones así:

1. leer una fila del archivo,
2. buscar el `pozo` en base de datos,
3. buscar la `capa` en base de datos,
4. insertar la relación,
5. repetir para cada fila.

Ese enfoque tiene un costo muy alto porque:

- repite búsquedas muchas veces,
- hace demasiadas consultas a base de datos,
- y escala mal cuando el archivo crece.

El problema principal no parece ser la ausencia de índices SQL, sino el hecho de hacer **resolución fila por fila contra la base**.

---

## Hipótesis de optimización

La mejora esperada consiste en dejar de consultar la base en cada fila y pasar a un esquema de resolución en memoria.

La hipótesis es:

> Si precargamos todos los pozos y todas las capas una sola vez, construimos índices en memoria y luego resolvemos cada fila usando esos índices, el import debería volverse muchísimo más rápido.

---

## Estrategia a probar en `PozoCapa`

### 1. Precargar entidades una sola vez

Antes de procesar el archivo, traer desde la base:

- todos los pozos del proyecto,
- todas las capas del proyecto.

---

### 2. Construir índices en memoria

Armar estructuras tipo:

- `pozoIndex[nombreNormalizado] => pozoId`
- `capaIndex[nombreNormalizado] => capaId`

De esta manera, la resolución deja de depender de consultas a DB y pasa a ser lookup en memoria.

---

### 3. Normalizar nombres

Antes de resolver cualquier fila, normalizar los nombres del archivo y de las entidades cargadas.

Ejemplos de normalización:

- `trim()`
- `toLowerCase()`
- colapsar espacios
- eventualmente remover diferencias de formato menores

Esto reduce errores por variaciones superficiales de nombre.

---

### 4. Cachear la combinación `pozo + capa`

Además de los índices individuales, usar una key compuesta del tipo:

`pozoNormalizado::capaNormalizada`

para guardar un cache de resolución.

Esto sirve porque en muchos archivos la misma combinación aparece repetida muchas veces.

Ejemplo conceptual:

- primera vez que aparece `pozo A + capa X`, se resuelve,
- las veces siguientes se reutiliza el resultado ya resuelto.

---

### 5. Insertar en lotes

En lugar de insertar fila por fila:

- acumular registros válidos,
- insertar en bloques (`batch insert`).

Esto reduce mucho la sobrecarga de escritura.

---

## Qué queremos validar con esta prueba en `PozoCapa`

La implementación en `PozoCapa` nos tiene que permitir medir:

- tiempo total del import,
- tiempo de resolución de referencias,
- tiempo de inserción,
- cantidad de filas resueltas correctamente,
- cantidad de filas no resueltas,
- cantidad de duplicados detectados,
- y calidad de la normalización de nombres.

---

## Qué NO vamos a hacer todavía

En esta primera prueba **no vamos a arrancar por `SetEstadoPozo`**.

Tampoco vamos a introducir de entrada toda la complejidad temporal (`fecha`, series históricas, etc.).

La idea es validar primero el patrón base en `PozoCapa`.

---

## Por qué esta prueba es importante

Si este enfoque funciona bien en `PozoCapa`, entonces tendremos validado el núcleo de un pipeline reutilizable para imports futuros.

Ese mismo patrón después se podrá aplicar a:

- `SetEstadoPozo`
- `Escenarios`
- otros imports relacionales o masivos

Cambiando solamente:

- las columnas de entrada,
- el mapper final,
- y la tabla destino.

---

## Próximo paso después de `PozoCapa`

Si la prueba da buen resultado, el siguiente paso será llevar exactamente la misma estrategia a `SetEstadoPozo`, agregando:

- resolución de `pozo`,
- resolución de `capa`,
- parseo de `fecha`,
- persistencia de `estado`,
- y control de unicidad por `(pozoId, capaId, fecha)`.

---

## Conclusión

La decisión es:

> **Primero vamos a implementar y probar la optimización en `PozoCapa`.**

No porque sea el caso final más importante, sino porque es el mejor entorno para validar el enfoque sin ruido extra.

Si funciona bien en `PozoCapa`, entonces vamos a reutilizar el mismo patrón en `SetEstadoPozo`, donde el impacto en performance debería ser todavía mayor.
