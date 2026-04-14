import hashlib
from flask import Flask, Blueprint, render_template, request, redirect, url_for, session, flash
from functools import wraps
from datetime import datetime
#from .db import get_db_SQL_connection
import pyodbc
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_sqlalchemy import SQLAlchemy

main_routes = Blueprint('main_routes', __name__)
app = Flask(__name__)
app.config.from_object('config.Config')

#app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(minutes=30)  # Sesión expira tras 30 minutos
app.config['SESSION_COOKIE_HTTPONLY'] = True  # Prohibir acceso a las cookies desde JavaScript
app.config['SESSION_COOKIE_SECURE'] = False  # Cambia a True si usas HTTPS
#app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # Limitar el envío de cookies a solicitudes cruzadas

def get_db_SQL_connection():
    conn = pyodbc.connect(
        'DRIVER={ODBC Driver 17 for SQL Server};'
        'SERVER=;'
        'DATABASE=;'
        'UID=;'
        'PWD='
    )
    return conn

# -------------------------------------------------------
# Index, login, messege, navbar
# -------------------------------------------------------
@main_routes.route('/')
def index():
    return render_template('index.html')

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'email' not in session:
            flash('Please log in to access this page.')
            return redirect(url_for('main_routes.login'))
        return f(*args, **kwargs)
    return decorated_function

# Función para encriptar contraseña en MD5
def encrypt_password(password):
    return hashlib.md5(password.encode()).hexdigest()

# Configura Flask-Limiter
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["5 per minute"]  # Limitar a 5 intentos por minuto
)

# Ruta para la página de login
@main_routes.route('/login', methods=['GET', 'POST'])
@limiter.limit("5 per minute")  # Aplica límites solo a la ruta de login
def login():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        
        # Encripta la contraseña ingresada
        password_hash = encrypt_password(password)
        
        conn = get_db_SQL_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tbl_SYS_Users WHERE Email = ? AND PasswordHash = ?",
                        (email, password_hash))
        user = cursor.fetchone()
        conn.close()

        if user:
            session.permanent = True  # Marca la sesión como permanente
            session['email'] = email
            return render_template('message.html', 
                           message="Login successful!", 
                           alert_class="alert-success", 
                           next_page="/home")
        else:
            #flash('Invalid credentials', 'danger')
            return render_template('message.html', 
                           message="Invalid credentials.", 
                           alert_class="alert-danger")
        

    return render_template('login.html')

# Ruta para cerrar sesión
@main_routes.route('/logout')
def logout():
    session.clear()
    flash("You have been logged out.", "info")
    return redirect(url_for('main_routes.login'))

# -------------------------------------------------------
# Register
# -------------------------------------------------------
@main_routes.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        try:
            name = request.form['name']
            email = request.form['email']
            birthdate = request.form['birthdate']
            password = request.form['password']
            confirm_password = request.form.get('confirm_password')

            # Validaciones básicas
            if not name or not email or not birthdate or not password:
                return render_template('message.html', 
                           message="All fields are required.", 
                           alert_class="alert-danger")

            if password != confirm_password:
                return render_template('message.html', 
                           message="Passwords do not match.", 
                           alert_class="alert-danger")

            # Verificar si el usuario ya existe
            conn = get_db_SQL_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM tbl_SYS_Users WHERE Email = ? ",
                            (email))
            user = cursor.fetchone()
            if user:
                return render_template('message.html', 
                           message="Email is already registered.", 
                           alert_class="alert-danger")
            else:
                # Encripta la contraseña ingresada
                password_hash = encrypt_password(password)

                # Crear nuevo usuario
                cursor.execute('''
                    INSERT INTO tbl_SYS_Users (Name,Email,Birthdate,PasswordHash)
                    VALUES (?, ?, ?, ?)
                ''', (name, email, birthdate, password_hash))
                conn.commit()

                return render_template('message.html', 
                           message="User registered successfully!", 
                           alert_class="alert-success", 
                           next_page="/login")

        except Exception as e:
            message = f"An error occurred: {e}"
        finally:
            conn.close()

    return render_template('register.html')


# -------------------------------------------------------
# Home
# -------------------------------------------------------
@main_routes.route('/home', endpoint='home')
@login_required
def home():
    if 'email' not in session:
        return redirect(url_for('main_routes.login'))
    return render_template('home.html')


# -------------------------------------------------------
# Dashboard
# -------------------------------------------------------
@main_routes.route('/dashboard')
@login_required
def dashboard():
    return "<h1>Dashboard Page (Coming Soon)</h1>"

# -------------------------------------------------------
# Settings
# -------------------------------------------------------
@main_routes.route('/settings')
def settings():
    return "<h1>Settings Page (Coming Soon)</h1>"

# -------------------------------------------------------
# Add Social Account
# -------------------------------------------------------
@main_routes.route('/add-social-account')
def add_social_account():
    return "<h1>Add Social Account Page (Coming Soon)</h1>"


# Registro del blueprint en el app principal
app.register_blueprint(main_routes)