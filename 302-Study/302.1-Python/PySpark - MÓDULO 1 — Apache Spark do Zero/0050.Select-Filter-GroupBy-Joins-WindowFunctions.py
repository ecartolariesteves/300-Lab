import findspark
findspark.init()
from pyspark.sql import SparkSession
from pyspark.sql.functions import col

# 1. Criar sessão Spark
spark = SparkSession.builder \
    .appName("PrimeiroJobPySpark") \
    .master("local[*]") \
    .getOrCreate()

# 2. Ler um CSV de exemplo
df = spark.read.csv(r"C:\Python\_Proyectos\PySpark\datos001.csv", header=True, inferSchema=True)

# 3. Mostrar primeiras linhas
df.show(2)

# Ver la estructura del DF agrupado
df.printSchema()

# Filtrar columnas
df.select("categoria", "valor").show()

# Filtrar resultado > que
df.filter(col("valor") > 80).show()

# Filtrar resultado con 2 condiciones
df.filter((col("valor") > 80) & (col("categoria") == "B")).show()

# Contar registros
print("Total de linhas:", df.count())

# Group by
df.select("categoria", "valor").groupBy("categoria").count().show()


# Join
df2 = spark.read.csv(r"C:\Python\_Proyectos\PySpark\datos001.csv", header=True, inferSchema=True)
df.join(df2, df.id == df2.id, "inner").show()
df.join(df2, "id", "left").show()

# Window Functions (Rank partiton By)
from pyspark.sql.window import Window
from pyspark.sql.functions import row_number, rank

windowSpec = Window.partitionBy("categoria").orderBy(col("valor").desc())

df.withColumn("rank", rank().over(windowSpec)).show()



# 7. Encerrar sessão
spark.stop()
