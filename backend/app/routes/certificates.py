from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User, ArcaCredential
from app.auth import get_current_user
from app.services.arca_service import WsaaAuth, ArcaService
from app.services import cert_store

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
            "1. Descarga el archivo CSR",
            "2. Ingresa a ARCA: https://serviciosweb.afip.gob.ar/clavefiscal/adminrel/detalleCertificado.aspx",
            "3. Crea un alias, subi el archivo .csr y descarga el certificado .crt",
            "4. Subi el archivo .crt aca en la app",
            "5. Autoriza los servicios (wsfe, wsfex, wscdc, padron) asociandolos al certificado",
        ],
    }


@router.get("/download-csr/{cuit}")
def download_csr(cuit: str, user: User = Depends(get_current_user)):
    cuit_clean = cuit.replace("-", "").strip()
    csr_pem = cert_store.get_csr(cuit_clean)

    if not csr_pem:
        raise HTTPException(status_code=404, detail="No hay CSR generado para este CUIT. Genera uno primero.")

    return Response(
        content=csr_pem,
        media_type="application/pkcs10",
        headers={"Content-Disposition": f'attachment; filename="{cuit_clean}.csr"'},
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

    content = await cert_file.read()
    crt_pem = content.decode("utf-8", "ignore")

    if "BEGIN CERTIFICATE" not in crt_pem:
        raise HTTPException(status_code=400, detail="El archivo no parece ser un certificado PEM valido (.crt)")

    cert_store.save_crt(cuit_clean, crt_pem)

    st = cert_store.status(cuit_clean)
    return {
        "success": True,
        "message": f"Certificado guardado para CUIT {cuit_clean}",
        "has_key": st["has_key"],
        "ready": st["ready"],
    }


@router.post("/upload-key/{cuit}")
async def upload_key(
    cuit: str,
    key_file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Importa una clave privada (.key) existente. Util para reusar un certificado ya autorizado."""
    cuit_clean = cuit.replace("-", "").strip()
    cred = _find_credential(db, user, cuit)
    if not cred:
        raise HTTPException(status_code=404, detail="No hay credencial para este CUIT")

    content = await key_file.read()
    key_pem = content.decode("utf-8", "ignore")

    if "PRIVATE KEY" not in key_pem:
        raise HTTPException(status_code=400, detail="El archivo no parece ser una clave privada PEM valida (.key)")

    cert_store.save_key(cuit_clean, key_pem)

    st = cert_store.status(cuit_clean)
    return {
        "success": True,
        "message": f"Clave privada guardada para CUIT {cuit_clean}",
        "ready": st["ready"],
    }


@router.get("/status/{cuit}")
def cert_status(cuit: str, user: User = Depends(get_current_user)):
    cuit_clean = cuit.replace("-", "").strip()
    st = cert_store.status(cuit_clean)
    return {
        "cuit": cuit_clean,
        "has_certificate": st["has_certificate"],
        "has_key": st["has_key"],
        "has_csr": st["has_csr"],
        "ready": st["ready"],
    }
