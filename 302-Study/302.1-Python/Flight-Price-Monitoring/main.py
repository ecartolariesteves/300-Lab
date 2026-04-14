from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from bs4 import BeautifulSoup
import pandas as pd
import time
from datetime import datetime

# Configurar opciones de Chrome para abrir en modo incógnito // Configure Chrome settings to open in incognito mode
chrome_options = Options()
chrome_options.add_argument("--incognito")
chrome_options.add_argument("--disable-application-cache")
chrome_options.add_argument("--disable-cache")
chrome_options.add_argument("--disable-cookies")
chrome_options.add_argument("--disable-history")
chrome_options.add_argument("--headless")

departure = input("Enter departure location: ")
destination = input("Enter destination: ")
dep_date = input("Enter departure date in YYYY-MM-DD format: ")

# Round-trip
#arrival_date = "2024-11-11" #input("Enter arrival date in YYYY-MM-DD format: ")
#URL = f'https://www.kayak.com/flights/{departure}-{destination}/{dep_date}/{arrival_date}?sort=bestflight_a'

# One-Way
URL = f'https://www.kayak.com/flights/{departure}-{destination}/{dep_date}?sort=bestflight_a'

PRICE_LIMIT = int(input("Enter price limit: "))
CHECKING_INTERVAL = int(input("Enter Checking Interval in seconds: "))
CHECKING_DURATION = int(input("Enter Checking Duration in seconds: "))
NUMBER_OF_CHECKS = int(CHECKING_DURATION / CHECKING_INTERVAL)

# Lista para almacenar datos // Ready to store data
data = []

for i in range(NUMBER_OF_CHECKS):
    driver = webdriver.Chrome(options=chrome_options)
    driver.get(URL)
    time.sleep(10)
    content = driver.page_source
    soup = BeautifulSoup(content)

    for i, span in enumerate(soup.findAll('div', attrs={'class': 'f8F1-price-text'})):
        if i < 3:  # TOP 3 price
            price = span.text[-4:].replace('$', '')

            # Buscar la duración del vuelo // Search for flight duration
            info_div = soup.findAll('div', attrs={'class': 'xdW8'})[i]
            time_duration = info_div.text.strip()[0:6]

            # Find the link div = 'oVHK'
            link_div = soup.findAll('div', attrs={'class': 'oVHK'})[i]
            if link_div:
                # Buscar el enlace dentro del div // Find the link inside the div
                link_tag = link_div.find('a')
                if link_tag and 'href' in link_tag.attrs:
                    url = link_tag['href']
                else:
                    url = "Enlace no disponible"
            else:
                url = "Enlace no disponible"

            # Agregar el registro a la lista de datos // Add the record to the data list
            data.append([i+1,departure,destination,dep_date, price, time_duration, "https://www.kayak.com" + url, datetime.now()])
        else:
            break  # Stop loop after first 3 records

    driver.quit()
    time.sleep(CHECKING_INTERVAL)

# Convertir la lista de datos en un DataFrame (Pandas)
# Convert list of data to a DataFrame (Pandas)
df = pd.DataFrame(data, columns=['ID','Departure','Destination','Dep_date','Price', 'Duration', 'URL', 'Datetime'])

datime_CSV = datetime.now().strftime('%Y-%m-%d_%H_%M')

# Guardar el DataFrame en un archivo CSV
# Save the DataFrame to a CSV file
ruta_archivo = fr'C:\Python\_Proyectos\Flight-Price-Monitoring\CSV\incoming\precios_vuelos_{datime_CSV}.csv'
df.to_csv(ruta_archivo, sep=';', index=False)

