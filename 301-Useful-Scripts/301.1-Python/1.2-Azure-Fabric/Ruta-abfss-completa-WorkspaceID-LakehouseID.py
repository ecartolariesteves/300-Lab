# ============================================================
# CELDA DE DIAGNÓSTICO
# ============================================================

from pyspark.sql import SparkSession
spark = SparkSession.builder.getOrCreate()

# Extraer IDs del contexto de Fabric
workspace_id  = spark.conf.get("trident.workspace.id",  "NO ENCONTRADO")
lakehouse_id  = spark.conf.get("trident.lakehouse.id",  "NO ENCONTRADO")
artifact_id   = spark.conf.get("trident.artifact.id",   "NO ENCONTRADO")
default_fs    = spark.conf.get("spark.hadoop.fs.defaultFS", "NO ENCONTRADO")

print("=" * 60)
print("IDs de tu entorno Fabric:")
print(f"  workspace_id : {workspace_id}")
print(f"  lakehouse_id : {lakehouse_id}")
print(f"  artifact_id  : {artifact_id}")
print(f"  defaultFS    : {default_fs}")
print("=" * 60)

# Construir y mostrar la ruta correcta
if lakehouse_id != "NO ENCONTRADO" and workspace_id != "NO ENCONTRADO":
    ruta = f"abfss://{workspace_id}@onelake.dfs.fabric.microsoft.com/{lakehouse_id}/Tables/bronze/FIN_BC_glAccount"
    print(f"\n✅ Ruta abfss:// para tu tabla:")
    print(f"   {ruta}")
else:
    print("\n⚠️  No se pudieron obtener los IDs automáticamente.")
    print("    Comparte el valor de 'defaultFS' y lo calculamos manualmente.")
