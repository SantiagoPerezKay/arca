from pydantic_settings import BaseSettings
from cryptography.fernet import Fernet
import os


class Settings(BaseSettings):
    SECRET_KEY: str = "cambiar-en-produccion"
    DATABASE_URL: str = "sqlite:///./arca.db"
    ENCRYPTION_KEY: str = ""
    AFIP_WSAA_URL: str = "https://wsaa.afip.gov.ar/ws/services/LoginCms"
    AFIP_WSAA_URL_HOMO: str = "https://wsaahomo.afip.gov.ar/ws/services/LoginCms"
    AFIP_ENV: str = "homo"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    class Config:
        env_file = ".env"


settings = Settings()

if not settings.ENCRYPTION_KEY:
    settings.ENCRYPTION_KEY = Fernet.generate_key().decode()

fernet = Fernet(settings.ENCRYPTION_KEY.encode() if isinstance(settings.ENCRYPTION_KEY, str) else settings.ENCRYPTION_KEY)


def encrypt_value(value: str) -> str:
    return fernet.encrypt(value.encode()).decode()


def decrypt_value(value: str) -> str:
    return fernet.decrypt(value.encode()).decode()
