# ============================================================
# DIAGNÓSTICO: ¿Cuántos registros reales hay en GLAccount?
# Pega en una celda nueva en Fabric y ejecuta
# ============================================================

import requests

TENANT_ID     = ""
CLIENT_ID     = "" 
CLIENT_SECRET = ""
ENVIRONMENT   = "production"

# Token
_r = requests.post(
    f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token",
    data={
        "grant_type": "client_credentials",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope": "https://api.businesscentral.dynamics.com/.default",
    }
)
TOKEN   = _r.json()["access_token"]
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/json"}

BASE = f"https://api.businesscentral.dynamics.com/v2.0/{TENANT_ID}/{ENVIRONMENT}/ODataV4/GLAccount"

for company in ["CHIC-KLES GUM, S.L.U.", "CONSOLIDADA", "MINERVA VALENCIA S.L."]:
    print(f"\n{'='*50}")
    print(f"Compañía: {company}")

    # 1. Contar total con $count=true
    r_count = requests.get(BASE, headers=HEADERS, params={
        "company": company,
        "$count": "true",
        "$top": 1
    })
    data = r_count.json()
    total = data.get("@odata.count", "no disponible")
    print(f"  Total registros (@odata.count): {total}")

    # 2. Ver si con $top=500 devuelve nextLink
    r_page = requests.get(BASE, headers=HEADERS, params={
        "company": company,
        "$top": 500
    })
    data2      = r_page.json()
    next_link  = data2.get("@odata.nextLink", None)
    batch_size = len(data2.get("value", []))
    print(f"  Registros en página 1: {batch_size}")
    print(f"  @odata.nextLink presente: {'✅ SÍ → ' + next_link[:80] if next_link else '❌ NO — probablemente hay ≤500 registros'}")

    # 3. Probar con $top=100 para forzar paginación
    r_small = requests.get(BASE, headers=HEADERS, params={
        "company": company,
        "$top": 100
    })
    data3      = r_small.json()
    next_link2 = data3.get("@odata.nextLink", None)
    print(f"  Con $top=100 → nextLink: {'✅ SÍ' if next_link2 else '❌ NO → total real ≤ 100'}")