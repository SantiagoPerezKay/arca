import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User, ArcaCredential
from app.auth import get_current_user
from app.services.arca_service import WsaaAuth, ArcaService, CERTS_DIR

router = APIRouter(prefix="/api/certificates", tags=["certificates"])


def _find_credential(db: Session, user: User, cuit: str):
    """Busca una credencial comparando CUIT normalizado (sin guiones ni espacios)."""
    cuit_clean = cuit.replace("-", "").replace(" ", "").strip()
    creds = db.query(ArcaCredential).filter(ArcaCredential.user_id == user.id).all()
    for c in creds:
        if c.cuit.replace("-", "").replace(" ", "").strip() == cuit_clean:
            return c
    return None


@router.post("/generate-csr/{cuit}")
def generate_csr(cuit: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cuit_clean = cuit.replace("-", "").strip()
    cred = _find_credential(db, user, cuit)
    if not cred:
        raise HTTPException(status_code=404, detail="No hay credencial para este CUIT")

    result = WsaaAuth.generate_key_and_csr(cuit_clean)
    return {
        "success": True,
        "csr_pem": result["csr_pem"],
        "instrucciones": [
            "1. Copia el CSR de abajo",
            "2. Ingresa a ARCA con tu clave fiscal: https://auth.arca.gob.ar/contribuyente_/login.xhtml",
            "3. Accede a 'Administracion de Certificados Digitales'",
            "4. Selecciona 'Agregar alias' para el servicio que necesites (ej: ws_sr_padron_a5)",
            "5. Pega el CSR y descarga el certificado (.crt)",
            "6. Subi el archivo .crt usando el endpoint de subir certificado",
        ],
    }


@router.get("/download-csr/{cuit}")
def download_csr(cuit: str, user: User = Depends(get_current_user)):
    cuit_clean = cuit.replace("-", "").strip()
    csr_path = os.path.join(CERTS_DIR, f"{cuit_clean}.csr")

    if not os.path.exists(csr_path):
        raise HTTPException(status_code=404, detail="No hay CSR generado para este CUIT. Genera uno primero.")

    return FileResponse(
        path=csr_path,
        filename=f"{cuit_clean}.csr",
        media_type="application/pkcs10",
    )


@router.post("/upload-cert/{cuit}")
async def upload_cert(
    cuit: str,
    cert_file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cuit_clean = cuit.replace("-", "").strip()
    cred = _find_credential(db, user, cuit)
    if not cred:
        raise HTTPException(status_code=404, detail="No hay credencial para este CUIT")

    os.makedirs(CERTS_DIR, exist_ok=True)
    cert_path = os.path.join(CERTS_DIR, f"{cuit_clean}.crt")

    content = await cert_file.read()
    with open(cert_path, "wb") as f:
        f.write(content)

    return {
        "success": True,
        "message": f"Certificado guardado para CUIT {cuit_clean}",
        "has_key": os.path.exists(os.path.join(CERTS_DIR, f"{cuit_clean}.key")),
    }


@router.get("/status/{cuit}")
def cert_status(cuit: str, user: User = Depends(get_current_user)):
    cuit_clean = cuit.replace("-", "").strip()
    has_cert = ArcaService.has_certificate(cuit_clean)
    has_key = os.path.exists(os.path.join(CERTS_DIR, f"{cuit_clean}.key"))
    has_csr = os.path.exists(os.path.join(CERTS_DIR, f"{cuit_clean}.csr"))

    return {
        "cuit": cuit_clean,
        "has_certificate": has_cert,
        "has_key": has_key,
        "has_csr": has_csr,
        "ready": has_cert and has_key,
    }
