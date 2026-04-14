# Spark lê praticamente de qualquer lugar: CSV, JSON, Parquet, ORC, Avro, banco de dados via JDBC, S3, HDFS etc.
from pyspark.sql import SparkSession

spark = SparkSession.builder.appName("Fase2").getOrCreate()

# CSV
df_csv = spark.read.option("header", True).csv("dados.csv")

# Parquet
df_parquet = spark.read.parquet("dados.parquet")

# JSON
df_json = spark.read.json("dados.json")

# JDBC (ex.: PostgreSQL)
df_jdbc = spark.read.format("jdbc") \
    .option("url", "jdbc:postgresql://host:5432/db") \
    .option("dbtable", "tabela") \
    .option("user", "usuario") \
    .option("password", "senha") \
    .load()

#Dica: Prefira Parquet ou ORC sempre que possível → são colunar e compactam bem, muito mais rápidos que CSV.