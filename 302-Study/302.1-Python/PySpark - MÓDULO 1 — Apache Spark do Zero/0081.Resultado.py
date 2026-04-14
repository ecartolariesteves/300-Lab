#Exercício Prático Fase 3 (dados001.csv)
#Leia dados001.csv como antes.#
#
#Faça:#
#    groupBy com e sem filtragem antes → compare# n#o Spark# UI#.
#    Join com um DataFrame pequeno usando broadc#as#t.#
#    Reparticione para 4 partições e grave em Parq#uet.#
#    Compare tempo de escrita com repartition(4) vs coalesce#(1).
#    Cache um DataFrame e use-o em pelo menos 3 operações diferentes → compare tempo com e sem cache.

import findspark
findspark.init()
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, avg


# 1. Criar sessão Spark
spark = SparkSession.builder \
    .appName("TuningExample") \
    .config("spark.sql.shuffle.partitions", "8") \
    .config("spark.executor.memory", "2g") \
    .getOrCreate()


# Usar o mesmo dados001.csv.
df = spark.read.csv(r"C:\Python\_Proyectos\PySpark\datos001.csv", header=True, inferSchema=True)
df.show()

#    groupBy com e sem filtragem antes → compare# n#o Spark# UI#.
df_filter = df.filter(col("valor") >= 80).groupBy("categoria").count()
df_filter.show()

#    Join com um DataFrame pequeno usando broadc#as#t.#
from pyspark.sql.functions import broadcast

df_info = spark.createDataFrame(
    [("A", "Tipo 1"), ("B", "Tipo 2"), ("C", "Tipo 3")],
    ["categoria", "descricao"]
)
df_info.show()

## Join otimizado
df_filter.join(broadcast(df_info), "categoria").show()









##Calcular: Média de valor por categoria.
#df_grouped = df.groupBy("categoria").agg(avg("valor").alias("media"))
#df_grouped.show()
#
##Calcular: Top 2 valores por categoria usando window functions.
#from pyspark.sql.window import Window
#from pyspark.sql.functions import row_number, rank
#
#windowSpec = Window.partitionBy("categoria").orderBy(col("valor").desc())
#df_Rank = df.withColumn("rank", rank().over(windowSpec))
#df_Rank.filter(col("rank") <= 2 ).show()
#
## Criar coluna nivel:
## "Alto" se valor >= 150.
## "Médio" se entre 100 e 149.
## "Baixo" se menor que 100.
#
#from pyspark.sql.functions import when
#
#df = df.withColumn(
#    "nivel",
#    when(col("valor") >= 150, "Alto")
#    .when((col("valor") >= 100) & (col("valor") < 150), "Médio")
#    .otherwise("Baixo")
#)
#
#df.show()
#
#
## 6. Salvar resultado
#df.write.mode("overwrite").parquet("resultado.parquet")
#df.coalesce(1).write.mode("overwrite").option("header", "true").csv(r"C:\Python\_Proyectos\PySpark\resultado2.csv")
#
## 7. Encerrar sessão
spark.stop()
