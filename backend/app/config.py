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


def _build_fernet(key: str) -> Fernet:
    """Construye un Fernet validando la clave. Si es invalida, genera una nueva."""
    if key:
        try:
            key_bytes = key.encode() if isinstance(key, str) else key
            return Fernet(key_bytes)
        except (ValueError, Exception):
            print("[CONFIG] ENCRYPTION_KEY invalida (debe ser una clave Fernet base64 de 32 bytes). "
                  "Generando una temporal. Configura una clave valida con: "
                  "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"")
    # Generar clave temporal
    generated = Fernet.generate_key()
    settings.ENCRYPTION_KEY = generated.decode()
    return Fernet(generated)


fernet = _build_fernet(settings.ENCRYPTION_KEY)


def encrypt_value(value: str) -> str:
    return fernet.encrypt(value.encode()).decode()


def decrypt_value(value: str) -> str:
    return fernet.decrypt(value.encode()).decode()
