import findspark
findspark.init()
from pyspark.sql import SparkSession
from pyspark.sql.functions import lit, col, to_date, current_date, year, month, datediff

# 1. Criar sessão Spark
spark = SparkSession.builder \
    .appName("PrimeiroJobPySpark") \
    .master("local[*]") \
    .getOrCreate()

# 2. Ler um CSV de exemplo
df = spark.read.csv(r"C:\Python\_Proyectos\PySpark\datos001.csv", header=True, inferSchema=True)


# Manipulação de datas e timestamps
# Como nosso CSV não tem data, vamos criar uma coluna de exemplo:
df_data = df.withColumn("data_str", lit("2023-08-01"))
df_data = df_data.withColumn("data_fmt", to_date(col("data_str"), "yyyy-MM-dd"))

df_data.withColumn("mes", month(col("data_fmt"))) \
    .withColumn("dias_desde", datediff(current_date(), col("data_fmt"))) \
    .show()


# 7. Encerrar sessão
spark.stop()
