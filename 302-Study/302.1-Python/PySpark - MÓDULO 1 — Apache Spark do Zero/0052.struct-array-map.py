import findspark
findspark.init()
from pyspark.sql import SparkSession
from pyspark.sql.functions import col
from pyspark.sql.functions import struct, array, create_map, lit

# 1. Criar sessão Spark
spark = SparkSession.builder \
    .appName("PrimeiroJobPySpark") \
    .master("local[*]") \
    .getOrCreate()

# 2. Ler um CSV de exemplo
df = spark.read.csv(r"C:\Python\_Proyectos\PySpark\datos001.csv", header=True, inferSchema=True)


# Struct com id e valor
df_struct = df.withColumn("info", struct("id", "valor"))
df_struct.show(truncate=False)

# Array com id e valor
df_array = df.withColumn("array_dados", array("id", "valor"))
df_array.show()

# Mapa chave=tipo, valor=valor
df_map = df.withColumn("mapa", create_map(lit("tipo"), col("categoria")))
df_map.show(truncate=False)
