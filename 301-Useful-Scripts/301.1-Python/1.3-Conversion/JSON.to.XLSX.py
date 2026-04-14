import json
import pandas as pd

# Ruta del archivo JSON (ajusta la ruta según tu sistema)
input_file = "C:/temp/usuarios_comerciales.json"  # Cambia esto por la ruta real
output_file = "C:/temp/output.xlsx"  # Archivo de salida

try:
    # Leer el archivo JSON
    with open(input_file, "r", encoding="utf-8") as file:
        data = json.load(file)

    # Normalizar el JSON y convertirlo a DataFrame
    df = pd.json_normalize(data)

    # Exportar a Excel
    df.to_excel(output_file, index=False)
    print(f"El archivo Excel se ha generado como '{output_file}'.")
except Exception as e:
    print(f"Error: {e}")
