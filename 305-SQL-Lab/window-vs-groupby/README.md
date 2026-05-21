# 305-03 · GROUP BY vs Window Functions: ¿cuándo gana cada uno?

> **Tipo de experimento:** Comparativa de rendimiento + complejidad algorítmica  
> **Tecnologías:** BigQuery · PostgreSQL · SQL  
> **Nivel:** Intermedio-Avanzado  
> **Notebook:** [`window_vs_groupby.ipynb`](./window_vs_groupby.ipynb)

---

## 🎯 Objetivo

Comparar GROUP BY clásico contra Window Functions en 4 patrones reales de uso. No se trata de cuál es "mejor" — se trata de saber cuándo cada uno tiene sentido.

---

## 🧪 Dataset

| Tabla | Filas | Descripción |
|---|---|---|
| `orders` | 500.000 | Pedidos con customer_id, amount, category |
| `customers` | 10.000 | Clientes con región y segmento |

---

## 📊 Resultados

| Caso | GROUP BY | Window Fn | Ganador |
|---|---|---|---|
| Case 1 — % del total por cliente | 374ms | 379ms | **TIE** |
| Case 2 — RANK dentro de región | 840ms | 798ms | **WF** |
| Case 3 — Running total (acumulado) | 8.5ms | **1.0ms** | **WF 8x** |
| Case 4 — Desviación de la media | 5.1ms | 5.2ms | **TIE** |

> 💡 El caso 3 es el más revelador: la correlated subquery es O(n²). La window function escanea una sola vez.

---

## 🧠 Conclusiones

1. **GROUP BY** gana en agregación pura donde no necesitas detalle por fila.
2. **Window Functions** son imbatibles para ranking, running totals, lag/lead y desviaciones — acceso al contexto del grupo sin colapsar filas.
3. **Regla de oro:** si tienes una correlated subquery calculando algo fila a fila, sustitúyela por una window function.

---

## 📌 Cuándo usar cada uno

```
GROUP BY         → agregación pura (SUM, COUNT, AVG por grupo)
                 → no necesitas el detalle de cada fila

Window Function  → RANK, ROW_NUMBER, DENSE_RANK
                 → running totals / cumulative sums
                 → LAG / LEAD (valor fila anterior/siguiente)
                 → desviación respecto a la media del grupo
                 → cualquier correlated subquery fila a fila
```

---

## 🔧 Cheatsheet window functions

| Función | Uso |
|---|---|
| `ROW_NUMBER()` | Rank único, sin empates |
| `RANK()` | Rank con gaps en empates |
| `DENSE_RANK()` | Rank sin gaps |
| `LAG(col, n)` | Valor de n filas anteriores |
| `LEAD(col, n)` | Valor de n filas siguientes |
| `SUM/AVG OVER` | Totales acumulados o de grupo |
| `NTILE(n)` | Divide en n buckets |

---

## 📁 Archivos

```
window-vs-groupby/
├── README.md
├── window_vs_groupby.ipynb
├── queries/
│   ├── case1_pct_of_total.sql
│   ├── case2_rank_by_region.sql
│   ├── case3_running_total.sql
│   └── case4_deviation_from_avg.sql
└── results/
    └── benchmark_results.json
```
