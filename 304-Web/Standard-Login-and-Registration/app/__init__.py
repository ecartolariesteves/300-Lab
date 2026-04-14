from flask import Flask
from .routes import main_routes 
from config import Config



def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Registro del blueprint
    app.register_blueprint(main_routes, url_prefix='/')
    return app
