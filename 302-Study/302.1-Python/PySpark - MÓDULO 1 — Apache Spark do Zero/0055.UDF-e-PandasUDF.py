# UDF (normal)
from pyspark.sql.functions import udf
from pyspark.sql.types import StringType

def categoria_label(c):
    return "Alto" if c > 100 else "Baixo"

categoria_udf = udf(categoria_label, StringType())
df.withColumn("nivel", categoria_udf(col("valor"))).show()


# Pandas UDF (muito mais rápido)
from pyspark.sql.functions import pandas_udf

@pandas_udf(StringType())
def categoria_label_pandas(c):
    return c.apply(lambda x: "Alto" if x > 100 else "Baixo")

df.withColumn("nivel", categoria_label_pandas(col("valor"))).show()

