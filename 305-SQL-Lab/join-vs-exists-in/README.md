# 305-02 · JOIN vs EXISTS vs IN: ¿cuál es más rápido?

> **Tipo de experimento:** Comparativa de rendimiento + comportamiento  
> **Tecnologías:** BigQuery · PostgreSQL · SQL  
> **Nivel:** Intermedio  
> **Notebook:** [`join_vs_exists_vs_in.ipynb`](./join_vs_exists_vs_in.ipynb)

---

## 🎯 Objetivo

Comparar rendimiento real y comportamiento de las tres formas más comunes de filtrar por existencia en SQL:

- **INNER JOIN** — unión estándar entre tablas
- **EXISTS** — subquery correlacionada que verifica existencia
- **IN** — filtro por lista o subquery

La pregunta de siempre en code reviews: *"¿por qué usaste JOIN en vez de EXISTS aquí?"*. Aquí la respondemos con datos.

---

## 🧪 Experimento

### Dataset

| Tabla | Filas | Descripción |
|---|---|---|
| `orders` | 500.000 | Pedidos con customer_id y amount |
| `customers` | 10.000 | Clientes con región y segmento |
| `vip_customers` | 1.000 | Top 1000 clientes por gasto total |

### Casos testados

| Caso | Descripción | Ganador |
|---|---|---|
| Case 1 | Filtrar órdenes de clientes VIP | **IN** (87ms vs 157ms JOIN) |
| Case 2 | COUNT de órdenes por cliente VIP | **IN** (5ms — 10x más rápido) |
| Case 3 | Anti-join: clientes SIN órdenes | **NOT EXISTS** (4ms vs 16ms NOT IN) |
| Case 4 | Filtro multi-condición (segment + region) | **JOIN ≈ IN** (EXISTS explota a 393ms) |

---

## 📊 Resultados completos

| Caso | JOIN | EXISTS | IN |
|---|---|---|---|
| 1 — Filtrar VIP orders | 157ms | 183ms | **87ms** |
| 2 — COUNT por VIP | 51ms | 84ms | **5ms** |
| 3 — Anti-join | 22ms | **4ms** | 16ms |
| 4 — Multi-condición | **54ms** | 393ms | **54ms** |

> ⚠️ **Trampa clásica de NOT IN:** si la subquery devuelve algún NULL, NOT IN devuelve 0 filas. Siempre. Usa NOT EXISTS para anti-joins.

---

## 🧠 Conclusiones

1. **IN** gana en casos simples de filtrado y agrupación — el optimizador lo convierte en semi-join eficiente.
2. **NOT EXISTS** es el rey del anti-join — más rápido y semánticamente correcto (no tiene el bug de NULLs de NOT IN).
3. **EXISTS** puede ser lento en filtros multi-condición — el optimizador tiene menos margen para optimizar subqueries correlacionadas complejas.
4. **JOIN** es la opción más segura cuando necesitas columnas de ambas tablas o haces GROUP BY.

---

## 📌 Regla práctica

```
JOIN      ✅ → necesitas columnas de ambas tablas / GROUP BY / agregaciones
IN        ✅ → listas simples, subqueries pequeñas, legibilidad
EXISTS    ✅ → checks correlacionados simples
NOT EXISTS ✅ → anti-joins siempre (evita el NULL trap de NOT IN)
NOT IN    ⚠️  → solo si garantizas que no hay NULLs en la subquery
```

---

## 🔗 Post de LinkedIn

→ [Ver post](https://linkedin.com/in/edgaresteves) *(publicado tras el experimento)*

---

## 📁 Archivos

```
join-vs-exists-in/
├── README.md                        ← este archivo
├── join_vs_exists_vs_in.ipynb       ← notebook con experimento completo
├── queries/
│   ├── case1_filter_vip.sql
│   ├── case2_count_per_vip.sql
│   ├── case3_antijoin.sql
│   └── case4_multi_condition.sql
└── results/
    ├── benchmark_results.json
    └── notes.md
```
