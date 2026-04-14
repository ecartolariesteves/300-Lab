from config import Config 
import pyodbc

def get_db_SQL_connection():
    connection_string = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={Config.DB_HOST};"
        f"DATABASE={Config.DB_NAME};"
        f"UID={Config.DB_USER};"
        f"PWD={Config.DB_PASSWORD};Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"
    )
    connection = pyodbc.connect(connection_string)
    return connection

