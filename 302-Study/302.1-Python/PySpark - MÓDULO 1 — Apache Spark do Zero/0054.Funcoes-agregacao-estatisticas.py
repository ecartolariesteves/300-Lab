import findspark
findspark.init()
from pyspark.sql import SparkSession
from pyspark.sql.functions import lit, col, to_date, current_date, year, month, datediff
from pyspark.sql.functions import avg, min, max, sum, stddev

# 1. Criar sessão Spark
spark = SparkSession.builder \
    .appName("PrimeiroJobPySpark") \
    .master("local[*]") \
    .getOrCreate()

# 2. Ler um CSV de exemplo
df = spark.read.csv(r"C:\Python\_Proyectos\PySpark\datos001.csv", header=True, inferSchema=True)


df.agg(
    avg("valor").alias("media"),
    min("valor").alias("minimo"),
    max("valor").alias("maximo"),
    stddev("valor").alias("desvio_padrao")
).show()

# 7. Encerrar sessão
spark.stop()
