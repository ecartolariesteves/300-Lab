import findspark
findspark.init()
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, avg

# 1. Criar sessão Spark
spark = SparkSession.builder \
    .appName("PrimeiroJobPySpark") \
    .master("local[*]") \
    .config("spark.sql.execution.pyspark.udf.faulthandler.enabled", "true") \
    .config("spark.python.worker.faulthandler.enabled", "true") \
    .getOrCreate()

# Usar o mesmo dados001.csv.
df = spark.read.csv(r"C:\Python\_Proyectos\PySpark\datos001.csv", header=True, inferSchema=True)

# Filtrar apenas linhas com valor > 80.
df.filter(col("valor") > 100).show()

#Calcular: Média de valor por categoria.
df_grouped = df.groupBy("categoria").agg(avg("valor").alias("media"))
df_grouped.show()

#Calcular: Top 2 valores por categoria usando window functions.
from pyspark.sql.window import Window
from pyspark.sql.functions import row_number, rank

windowSpec = Window.partitionBy("categoria").orderBy(col("valor").desc())
df_Rank = df.withColumn("rank", rank().over(windowSpec))
df_Rank.filter(col("rank") <= 2 ).show()

# Criar coluna nivel:
# "Alto" se valor >= 150.
# "Médio" se entre 100 e 149.
# "Baixo" se menor que 100.

from pyspark.sql.functions import when

df = df.withColumn(
    "nivel",
    when(col("valor") >= 150, "Alto")
    .when((col("valor") >= 100) & (col("valor") < 150), "Médio")
    .otherwise("Baixo")
)

df.show()


# 6. Salvar resultado
df.write.mode("overwrite").parquet("resultado.parquet")
df.coalesce(1).write.mode("overwrite").option("header", "true").csv(r"C:\Python\_Proyectos\PySpark\resultado2.csv")

# 7. Encerrar sessão
spark.stop()
