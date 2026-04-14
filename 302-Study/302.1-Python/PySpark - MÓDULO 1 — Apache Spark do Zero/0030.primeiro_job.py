import findspark
findspark.init()

from pyspark.sql import SparkSession

# 1. Criar sessão Spark
spark = SparkSession.builder \
    .appName("PrimeiroJobPySpark") \
    .master("local[*]") \
    .getOrCreate()

# 2. Ler um CSV de exemplo
df = spark.read.csv("dados001.csv", header=True, inferSchema=True)

# 3. Mostrar primeiras linhas
df.show(5)

# 4. Contar registros
print("Total de linhas:", df.count())

# 5. Fazer transformação simples
df_grouped = df.groupBy("categoria").count()
df_grouped.show()

# 6. Salvar resultado
df_grouped.write.mode("overwrite").parquet("resultado.parquet")

# 7. Encerrar sessão
spark.stop()
