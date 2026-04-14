import os
from dotenv import load_dotenv

class Config:
    load_dotenv()
    DB_HOST = os.getenv('DB_HOST')
    DB_NAME = os.getenv('DB_NAME')
    DB_USER = os.getenv('DB_USER')
    DB_PASSWORD = os.getenv('DB_PASSWORD')
    SECRET_KEY = os.urandom(24)  # Añadir la clave secreta dentro de la clase
    #SECRET_KEY = os.getenv("SECRET_KEY")
    UPLOAD_FOLDER = 'uploads/'
