
df.createOrReplaceTempView("tabela_dados")

spark.sql("""
    SELECT categoria, AVG(valor) AS media_valor
    FROM tabela_dados
    WHERE valor > 80
    GROUP BY categoria
""").show()