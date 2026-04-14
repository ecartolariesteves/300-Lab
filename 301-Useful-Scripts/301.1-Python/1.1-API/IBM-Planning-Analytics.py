%pip install TM1py

# ─────────────────────────────────────────
# Bloque para analisis y cuadre
# ─────────────────────────────────────────

from TM1py import TM1Service
from TM1py.Objects import Cube, Dimension, Hierarchy
from TM1py.Objects.Element import Element as Elem
from TM1py.Objects.ElementAttribute import ElementAttribute
import pandas as pd
from datetime import datetime
from dateutil.relativedelta import relativedelta

# ─────────────────────────────────────────
# CONFIGURACION — unico bloque a tocar
# ─────────────────────────────────────────
LAKEHOUSE   = "" # LH en Fabric
CUBO_NAME   = "" # Cubo en IBM

MODO_TEST   = True   # True = test (borra/recrea) | False = produccion (incremental)
MESES_ATRAS = 4      # 4 en test, 12 en produccion

PA_PARAMS = {
    "base_url": "https://eu-central-1.planninganalytics.saas.ibm.com/api/[Hash]/v0/tm1/[Nombre_Proyecto]/", # URL del proyecto en IBM
    "user":     "apikey",
    "password": "[hash_api_key]",
    "async_requests_mode": True,
    "ssl":      True,
    "verify":   True,
}

