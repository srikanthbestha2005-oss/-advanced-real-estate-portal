import os

settings_path = 'config/settings.py'
with open(settings_path, 'r') as f:
    content = f.read()

import_env = """
import os
import pymysql
from dotenv import load_dotenv

load_dotenv()
pymysql.install_as_MySQLdb()
"""

content = content.replace("from pathlib import Path", "from pathlib import Path\n" + import_env)

content = content.replace(
    "INSTALLED_APPS = [",
    "INSTALLED_APPS = [\n    'rest_framework',\n    'corsheaders',\n    'api',"
)

content = content.replace(
    "'django.middleware.security.SecurityMiddleware',",
    "'corsheaders.middleware.CorsMiddleware',\n    'django.middleware.security.SecurityMiddleware',"
)

content = content.replace(
    "DATABASES = {\n    'default': {\n        'ENGINE': 'django.db.backends.sqlite3',\n        'NAME': BASE_DIR / 'db.sqlite3',\n    }\n}",
    """DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': os.getenv('DB_NAME', 'real_estate_portal'),
        'USER': os.getenv('DB_USER', 'root'),
        'PASSWORD': os.getenv('DB_PASSWORD', 'root'),
        'HOST': os.getenv('DB_HOST', '127.0.0.1'),
        'PORT': os.getenv('DB_PORT', '3306'),
    }
}"""
)

content += "\nCORS_ALLOW_ALL_ORIGINS = True\n"

with open(settings_path, 'w') as f:
    f.write(content)
