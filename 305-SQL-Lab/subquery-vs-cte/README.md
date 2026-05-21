# 305-01 · Subquery vs CTE (WITH): ¿cuál es más rápido?

> **Tipo de experimento:** Comparativa de rendimiento + legibilidad  
> **Tecnologías:** BigQuery · PostgreSQL · SQL  
> **Nivel:** Intermedio  
> **Notebook:** [`subquery_vs_cte.ipynb`](./subquery_vs_cte.ipynb)

---

## 🎯 Objetivo

Comparar el rendimiento real, el plan de ejecución y la legibilidad de dos formas de escribir la misma lógica en SQL:

- **Subquery** (consulta anidada dentro de FROM o WHERE)
- **CTE** — Common Table Expression (cláusula `WITH`)

La pregunta que se escucha siempre en equipos de datos: *"¿uso WITH o lo meto dentro como subquery?"*. Aquí la respondemos con datos.

---

## 🧪 Experimento

### Dataset

Usamos un dataset sintético de ventas con tres tablas:

| Tabla | Filas aprox. | Descripción |
|---|---|---|
| `orders` | 5.000.000 | Pedidos con customer_id, amount, date |
| `customers` | 100.000 | Clientes con región y segmento |
| `products` | 10.000 | Catálogo de productos |

### Consultas testadas

**Caso 1 — Agregación simple:** top clientes por gasto total  
**Caso 2 — Filtrado por resultado calculado:** clientes cuyo gasto supera la media  
**Caso 3 — Múltiples niveles de anidación:** ranking por región y segmento  
**Caso 4 — Reutilización de lógica:** misma subexpresión usada dos veces

---

## 📊 Resultados (resumen)

| Caso | Subquery (ms) | CTE (ms) | Diferencia | Plan de ejecución |
|---|---|---|---|---|
| 1 — Agregación simple | ~280 | ~275 | ≈ igual | Idéntico |
| 2 — Filtrado por media | ~420 | ~415 | ≈ igual | Idéntico |
| 3 — Multi-nivel | ~890 | ~870 | ≈ igual | Idéntico |
| 4 — Reutilización | ~1100 | ~610 | **CTE 44% más rápido** | CTE materializa, subquery repite |

> 💡 **Conclusión principal:** En BigQuery y la mayoría de motores modernos, subquery y CTE generan el **mismo plan de ejecución**... excepto cuando reutilizas la misma lógica varias veces. Ahí el CTE gana claramente.

---

## 🧠 Conclusiones

1. **Rendimiento:** En el 90% de los casos, son equivalentes. El optimizador de BigQuery trata ambos igual.
2. **Excepción importante:** Si referencias la misma subexpresión más de una vez, el CTE puede materializarla (dependiendo del motor), evitando recalcular.
3. **Legibilidad:** El CTE gana siempre. Una query con 3 niveles de subqueries anidadas es ilegible para quien la mantiene 6 meses después.
4. **Regla práctica:** Usa CTE por defecto. Usa subquery solo para expresiones simples de una línea o dentro de SELECT/WHERE donde el CTE sería excesivo.

---

## 📌 Cuándo usar cada uno

```
Subquery ✅         → filtros simples de una condición (WHERE id IN (SELECT ...))
                   → expresiones escalares (SELECT (SELECT MAX(...)))
                   → cuando la query es corta y el contexto es obvio

CTE (WITH) ✅       → lógica que se reutiliza más de una vez
                   → queries con múltiples pasos de transformación
                   → cuando quieres que sea legible y mantenible
                   → cuando trabajas en equipo o con dbt/Dataform
```

---

## 🔗 Post de LinkedIn

→ [Ver post](https://linkedin.com/in/edgaresteves) *(publicado tras el experimento)*

---

## 📁 Archivos

```
subquery-vs-cte/
├── README.md                  ← este archivo
├── subquery_vs_cte.ipynb      ← notebook con experimento completo
├── queries/
│   ├── case1_aggregation.sql
│   ├── case2_filter_avg.sql
│   ├── case3_multilevel.sql
│   └── case4_reuse.sql
└── results/
    └── execution_plans.md
```
