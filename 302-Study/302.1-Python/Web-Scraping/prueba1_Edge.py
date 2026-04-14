from selenium import webdriver
from selenium.webdriver.support.ui import Select
from selenium.webdriver.common.by import By
from selenium.webdriver.edge.service import Service
from webdriver_manager.microsoft import EdgeChromiumDriverManager


import time

# Configura el servicio del EdgeDriver
service = Service(EdgeChromiumDriverManager().install())

# Inicializa el WebDriver de Microsoft Edge
driver = webdriver.Edge(service=service)

# Abre la página
# Open the page
url = 'https://expinterweb.mites.gob.es/ibi_apps/WFServlet?IBIF_ex=SEFCNT01&OPC_PAD=18&OPC_PRN=2&VTIP_LLA=R&URL_INTERNET=INTERNET&RND=2024101517.42.21'
driver.get(url)

# Espera a que la página cargue completamente (ajusta el tiempo si es necesario)
# Wait for the page to fully load (adjust the time if necessary)
time.sleep(3)

# Encuentra los elementos de los dropdowns y selecciona una opción
# Por ejemplo, si el dropdown tiene el id 'dropdown1', puedes seleccionar un valor así:
# Find the dropdown items and select an option
# For example, if the dropdown has the id 'dropdown1', you can select a value like this:

dropdown = Select(driver.find_element(By.ID, 'SELCLA'))
dropdown.select_by_visible_text('Ámbito y comunidad autónoma e interautonómico')

######## Select: TOTAL
time.sleep(1)
# Encuentra el listbox por su ID, nombre o cualquier otro selector
# Find the listbox by its ID, name or any other selector
listbox = driver.find_element(By.ID, 'SEL1RES')

# Encuentra todas las opciones dentro del listbox
# Find all the options inside the listbox
options = listbox.find_elements(By.TAG_NAME, 'option')

# Itera sobre las opciones y muestra su texto
# Iterate over the options and display their text
for option in options:
    print(option.text)  # Muestra el texto de cada opción -- # Display the text of each option

# (Opcional) Selecciona una opción por su texto visible
# (Optional) Select an option by its visible text
for option in options:
    if option.text == 'TOTAL':
        option.click()
        break

######## Select: MURCIA
time.sleep(1)

# Encuentra el listbox por su ID, nombre o cualquier otro selector
# Find the listbox by its ID, name or any other selector
listbox = driver.find_element(By.ID, 'GEO')

# Encuentra todas las opciones dentro del listbox
# Find all the options inside the listbox
options = listbox.find_elements(By.TAG_NAME, 'option')

# Itera sobre las opciones y muestra su texto
# Iterate over the options and display their text
for option in options:
    print(option.text)  # Muestra el texto de cada opción -- # Display the text of each option

# (Opcional) Selecciona una opción por su texto visible
# (Optional) Select an option by its visible text
for option in options:
    if option.text == 'Murcia (Región de)':
        option.click()
        break

######## Select: AÑO
time.sleep(1)

# Encuentra el listbox por su ID, nombre o cualquier otro selector
# Find the listbox by its ID, name or any other selector
listbox = driver.find_element(By.ID, 'ANYO')

# Encuentra todas las opciones dentro del listbox
# Find all the options inside the listbox
options = listbox.find_elements(By.TAG_NAME, 'option')

# Itera sobre las opciones y muestra su texto
# Iterate over the options and display their text
for option in options:
    print(option.text)  # Muestra el texto de cada opción -- # Display the text of each option

# Años ue necesita leer
# Years you need to read
years = ['2024', '2023', '2022', '2021'] 

# (Opcional) Selecciona una opción por su texto visible
# (Optional) Select an option by its visible text
for option in options:
    if option.text in years:
        option.click()

######## Radionbutton
time.sleep(1)

# Encuentra el radio button por su atributo 'name' y 'value'
# Find the radio button by its 'name' and 'value' attributes
radio_button = driver.find_element(By.CSS_SELECTOR, "input[name='TIP_FOR'][value='EXC2K']")

# Verifica si el radio button no está seleccionado
# Check if the radio button is not selected
if not radio_button.is_selected():
    radio_button.click()  # Selecciona el radio buttonión con otros IDs -- Select the radio button with other IDs


# # Después de seleccionar las opciones necesarias, puedes hacer clic en un botón de búsqueda (si existe)
# # por ejemplo, si el botón tiene el id 'search_button', puedes hacer clic así:
# # After selecting the necessary options, you can click on a search button (if it exists)
# # For example, if the button has the id 'search_button', you can click it like this:
search_button = driver.find_element(By.ID, 'submitaceptar')
search_button.click()

# # Espera los resultados
# # Wait for the results
time.sleep(5)

# # Extraer el HTML de la página de resultados
# # Extract the HTML from the results page
# html = driver.page_source

# # (Opcional) Usar BeautifulSoup para analizar el HTML y extraer datos
# # (Optional) Use BeautifulSoup to parse the HTML and extract data
# from bs4 import BeautifulSoup
# soup = BeautifulSoup(html, 'html.parser')

# # Aquí puedes hacer análisis o extracción de datos del HTML
# # Por ejemplo, imprimir todo el HTML
# # Here you can do analysis or data extraction from HTML
# # For example, print all HTML
# print(soup.prettify())

# # Cerrar el navegador
# # Close the browser
driver.quit()