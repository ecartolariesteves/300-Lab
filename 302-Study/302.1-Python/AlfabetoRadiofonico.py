import pandas as pd

datos = {
    "Caracter": ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "100", "1000", ".", "."],
    "Palabra": ["Alfa", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliett", "Kilo", "Lima", "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango", "Uniform", "Victor", "Whiskey", "X-Ray", "Yankee", "Zulu", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Zero", "Hundred", "Thousand", "Decimal", "Stop"],
    "Pronunciacion": ["ˈalfa", "ˈbravo", "ˈtʃali", "ˈdɛlta", "ˈɛko", "ˈfɔkstrɔt", "ˈɡɔlf", "hoˈtɛl", "ˈɪndia", "ˈdʒuliˈɛt", "ˈkilo", "ˈlima", "ˈmai̯k", "noˈvɛmba", "ˈɔska", "paˈpa", "keˈbɛk", "ˈromio", "siˈɛra", "ˈtaŋɡo", "ˈjunifɔm o ˈunifɔm", "ˈvɪkta", "ˈwɪski", "ˈɛksrei̯", "ˈjaŋki", "ˈzulu", "ˈwan", "ˈtu", "ˈtri", "ˈfoa", "ˈfai̯f", "ˈsɪks", "ˈsɛvən", "ˈei̯t", "ˈnai̯na", "ˈziro", "ˈhandrɛd", "ˈtau̯ˈzand", "ˈdeˈsiˈmal", "ˈstɔp"]
}

df = pd.DataFrame(datos)

try:
    print("Bienvenido al Alfabeto Radiofónico Internacional")
    mensaje = input("Por favor, ingrese la palabra que desea transmitir: ")
    mensaje = mensaje.upper()
    print(f"Prueba: {mensaje}")
    
    # Lista para almacenar los resultados
    resultado = []

    for letra in mensaje:
        # Filtrar el DataFrame donde la columna "Caracter" es igual a la letra actual
        fila = df[df["Caracter"] == letra]
        if not fila.empty:
            # Extraer "Palabra" y "Pronunciacion" y agregar al resultado
            palabra = fila.iloc[0]["Palabra"]
            pronunciacion = fila.iloc[0]["Pronunciacion"]
            resultado.append((letra, palabra, pronunciacion))

    # Mostrar resultados
    for letra, palabra, pronunciacion in resultado:
        print(f"Carácter: {letra}, Palabra: {palabra}, Pronunciación: {pronunciacion}")

finally:
    print("Gracias por usar el programa.")
