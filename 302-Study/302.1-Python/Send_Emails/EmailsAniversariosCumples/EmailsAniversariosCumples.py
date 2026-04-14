import smtplib
import pyodbc
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from pathlib import Path


# =========================
# SQL CONFIGURACIÓN
# =========================

SQL_CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=;"
    "DATABASE=;"
    "UID=;"
    "PWD="
)

# =========================
# SMTP CONFIGURACIÓN
# =========================

SMTP_SERVER = "mail.XXX.net"
SMTP_PORT = 25
SMTP_USER = ""
SMTP_PASSWORD = ""

FROM_EMAIL = "admin@XXXX.com"

MAX_EMAILS_PER_RUN = 100 # seguridad

# =========================
# RUTAS
# =========================

BASE_DIR = Path(__file__).parent
IMG_DIR = BASE_DIR / "images"

# =========================
# BLOQUES HTML
# =========================

def bloque_aniversario(texto):
    return f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td align="center">
          <img src="cid:img_aniversario" style="display:block; width:auto; height:auto;">
        </td>
      </tr>
      <tr>
        <td style="padding:10px 20px; font-family:Arial, sans-serif;">
          <p>{texto}</p>
        </td>
      </tr>
    </table>
    """


def bloque_cumple(texto):
    return f"""
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <img src="cid:img_cumple" style="display:block; width:600px; height:150px;">
        </td>
      </tr>
      <tr>
        <td style="padding:10px 20px; font-family:Arial, sans-serif;">
          <p>{texto}</p>
        </td>
      </tr>
    </table>
    """

# =========================
# CONSTRUCCIÓN BODY
# =========================

def construir_body(
    tiene_aniversario=False,
    texto_aniversario="",
    tiene_cumple=False,
    texto_cumple=""
):
    bloques = ""

    if tiene_aniversario:
        bloques += bloque_aniversario(texto_aniversario)

    if tiene_cumple:
        bloques += bloque_cumple(texto_cumple)

    return f"""
    <html>
      <body style="margin:0; padding:0; font-family:Arial, sans-serif;">
        {bloques}
      </body>
    </html>
    """

# =========================
# ENVÍO EMAIL
# =========================

def send_email(
    to_email,
    subject,
    body_html,
    incluir_aniversario=False,
    incluir_cumple=False
):
    msg = MIMEMultipart("related")
    msg["From"] = FROM_EMAIL
    msg["To"] = to_email
    msg["Subject"] = subject

    msg.attach(MIMEText(body_html, "html", "utf-8"))

    # Adjuntar imágenes solo si se usan
    if incluir_aniversario:
        with open(IMG_DIR / "aniversario.png", "rb") as f:
            img = MIMEImage(f.read())
            img.add_header("Content-ID", "<img_aniversario>")
            img.add_header("Content-Disposition", "inline", filename="aniversario.png")
            msg.attach(img)

    if incluir_cumple:
        with open(IMG_DIR / "cumple.png", "rb") as f:
            img = MIMEImage(f.read())
            img.add_header("Content-ID", "<img_cumple>")
            img.add_header("Content-Disposition", "inline", filename="cumple.png")
            msg.attach(img)

    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)

# =========================
# MAIN
# =========================

def main():
    
    conn = pyodbc.connect(SQL_CONN_STR)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT TOP (?) 
                   Nombre, Email, Fecha_Aniversario,AñosNunsys, Fecha_Cumpleaños
        FROM 
                   PRD_VW_XLS_AniversariosCumpleaños
        WHERE
              Fecha_Aniversario = cast(GETDATE() as date)
    """, MAX_EMAILS_PER_RUN)

    emailsAniversario = cursor.fetchall()

    cursor.execute("""
        SELECT TOP (?) 
                   Nombre, Email, Fecha_Aniversario,AñosNunsys, Fecha_Cumpleaños
        FROM 
                   PRD_VW_XLS_AniversariosCumpleaños
        WHERE
              Fecha_Cumpleaños = cast(GETDATE() as date)
    
    """, MAX_EMAILS_PER_RUN)

    emailsCumpleaños= cursor.fetchall()

    print(f"Aniversariantes pendientes: {len(emailsAniversario)}")
    print(f"Cumpleaños pendientes: {len(emailsCumpleaños)}")

    # =========================
    # CONSTRUIR EMAIL DINÁMICO
    # =========================

    tiene_aniversario = len(emailsAniversario) > 0
    tiene_cumple = len(emailsCumpleaños) > 0

    texto_aniversario = ""
    texto_cumple = ""

    if tiene_aniversario:
        lineas = []
        for row in emailsAniversario:
            linea = f"🎈 🎉 ¡Felicitamos a <b> {row.Nombre} </b> por su {row.AñosNunsys}º Aniversario! 🎈 🎉"
            lineas.append(linea)

        texto_aniversario = "<br>".join(lineas)

    if tiene_cumple:
        lineas = []
        for row in emailsCumpleaños:
            linea = f"🍰 🎁 Felicitamos a <b> {row.Nombre} </b> por su Cumpleaños! 🍰 🎁"
            lineas.append(linea)

        texto_cumple = "<br>".join(lineas)

    try:
        body_html = construir_body(
                    tiene_aniversario=tiene_aniversario,
                    texto_aniversario=texto_aniversario,
                    tiene_cumple=tiene_cumple,
                    texto_cumple=texto_cumple
        )

        send_email(
            to_email="", # Email de Pruebas
            #to_email="", # Email definitivo
            subject="¡Felicidades a los Compis!",
            body_html=body_html,
            incluir_aniversario=True,
            incluir_cumple=True
        )

        print("Email enviado correctamente")

    except Exception as e:
        print(f"ERROR: {e}")
        raise
    
    conn.close()


if __name__ == "__main__":
    main()
