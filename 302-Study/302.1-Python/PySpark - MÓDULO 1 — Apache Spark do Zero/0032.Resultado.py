import findspark
findspark.init()

from pyspark.sql import SparkSession

# 1. Criar sessão Spark
spark = SparkSession.builder \
    .appName("PrimeiroJobPySpark") \
    .master("local[*]") \
    .getOrCreate()

# 2. Ler um CSV de exemplo
df = spark.read.csv(r"C:\Python\_Proyectos\PySpark\datos001.csv", header=True, inferSchema=True)

# 3. Mostrar primeiras linhas
df.show(5)

# 4. Contar registros
print("Total de linhas:", df.count())

# 5. Fazer transformação simples
df_grouped = df.groupBy("categoria").avg("valor")
# Ver la estructura del DF agrupado
df_grouped.printSchema()

df_filtered = df_grouped.filter(df_grouped["avg(valor)"] > 100)
df_filtered.show()

# 6. Salvar resultado
df_filtered.write.mode("overwrite").parquet("resultado.parquet")
# Si necesitamos gerar um unico CVS usar: coalesce(1) exemplo: df_filtered.coalesce(1).write.mode("overwrite").option("header", "true").csv(r"C:\Python\_Proyectos\PySpark\resultado_unico")
df_filtered.write.mode("overwrite").option("header", "true").csv(r"C:\Python\_Proyectos\PySpark\resultado.csv")

# 7. Encerrar sessão
spark.stop()
