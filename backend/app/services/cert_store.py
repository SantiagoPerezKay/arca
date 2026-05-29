"""
Almacenamiento de certificados digitales en PostgreSQL.
Reemplaza el almacenamiento en filesystem para que sea persistente.
"""
from app.database import SessionLocal
from app.models.models import Certificate


def _normalize(cuit: str) -> str:
    return cuit.replace("-", "").replace(" ", "").strip()


def save_key_csr(cuit: str, key_pem: str, csr_pem: str) -> None:
    """Guarda (o actualiza) la clave privada y el CSR. Resetea el crt."""
    cuit = _normalize(cuit)
    db = SessionLocal()
    try:
        cert = db.query(Certificate).filter(Certificate.cuit == cuit).first()
        if cert is None:
            cert = Certificate(cuit=cuit)
            db.add(cert)
        cert.key_pem = key_pem
        cert.csr_pem = csr_pem
        cert.crt_pem = None  # nuevo CSR invalida el cert anterior
        db.commit()
    finally:
        db.close()


def save_key(cuit: str, key_pem: str) -> None:
    """Guarda (o actualiza) solo la clave privada. Para importar una clave existente."""
    cuit = _normalize(cuit)
    db = SessionLocal()
    try:
        cert = db.query(Certificate).filter(Certificate.cuit == cuit).first()
        if cert is None:
            cert = Certificate(cuit=cuit)
            db.add(cert)
        cert.key_pem = key_pem
        db.commit()
    finally:
        db.close()


def save_crt(cuit: str, crt_pem: str) -> None:
    """Guarda el certificado firmado (.crt) descargado de ARCA."""
    cuit = _normalize(cuit)
    db = SessionLocal()
    try:
        cert = db.query(Certificate).filter(Certificate.cuit == cuit).first()
        if cert is None:
            cert = Certificate(cuit=cuit)
            db.add(cert)
        cert.crt_pem = crt_pem
        db.commit()
    finally:
        db.close()


def _get(cuit: str) -> Certificate | None:
    cuit = _normalize(cuit)
    db = SessionLocal()
    try:
        return db.query(Certificate).filter(Certificate.cuit == cuit).first()
    finally:
        db.close()


def get_key(cuit: str) -> str | None:
    cert = _get(cuit)
    return cert.key_pem if cert else None


def get_csr(cuit: str) -> str | None:
    cert = _get(cuit)
    return cert.csr_pem if cert else None


def get_crt(cuit: str) -> str | None:
    cert = _get(cuit)
    return cert.crt_pem if cert else None


def has_certificate(cuit: str) -> bool:
    cert = _get(cuit)
    return bool(cert and cert.crt_pem and cert.key_pem)


def status(cuit: str) -> dict:
    cert = _get(cuit)
    if not cert:
        return {"has_certificate": False, "has_key": False, "has_csr": False, "ready": False}
    return {
        "has_certificate": bool(cert.crt_pem),
        "has_key": bool(cert.key_pem),
        "has_csr": bool(cert.csr_pem),
        "ready": bool(cert.crt_pem and cert.key_pem),
    }
