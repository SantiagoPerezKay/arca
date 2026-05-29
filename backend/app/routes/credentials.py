from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from app.database import get_db
from app.models.models import User, ArcaCredential
from app.auth import get_current_user
from app.config import encrypt_value, decrypt_value

router = APIRouter(prefix="/api/credentials", tags=["credentials"])


class CredentialCreate(BaseModel):
    cuit: str
    password: str
    alias: str = "Principal"


class CredentialUpdate(BaseModel):
    password: str | None = None
    alias: str | None = None


class CredentialResponse(BaseModel):
    id: int
    cuit: str
    alias: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


@router.get("/", response_model=List[CredentialResponse])
def list_credentials(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    creds = db.query(ArcaCredential).filter(ArcaCredential.user_id == user.id).all()
    return [
        CredentialResponse(
            id=c.id,
            cuit=c.cuit,
            alias=c.alias,
            created_at=c.created_at.isoformat(),
            updated_at=c.updated_at.isoformat(),
        )
        for c in creds
    ]


@router.post("/", response_model=CredentialResponse)
def create_credential(req: CredentialCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Normalizar CUIT a solo digitos (sin guiones ni espacios)
    cuit_normalizado = req.cuit.replace("-", "").replace(" ", "").strip()

    existing = db.query(ArcaCredential).filter(
        ArcaCredential.user_id == user.id,
        ArcaCredential.cuit == cuit_normalizado,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una credencial para este CUIT")

    cred = ArcaCredential(
        user_id=user.id,
        cuit=cuit_normalizado,
        encrypted_password=encrypt_value(req.password),
        alias=req.alias,
    )
    db.add(cred)
    db.commit()
    db.refresh(cred)

    return CredentialResponse(
        id=cred.id,
        cuit=cred.cuit,
        alias=cred.alias,
        created_at=cred.created_at.isoformat(),
        updated_at=cred.updated_at.isoformat(),
    )


@router.put("/{credential_id}", response_model=CredentialResponse)
def update_credential(
    credential_id: int,
    req: CredentialUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cred = db.query(ArcaCredential).filter(
        ArcaCredential.id == credential_id,
        ArcaCredential.user_id == user.id,
    ).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credencial no encontrada")

    if req.password is not None:
        cred.encrypted_password = encrypt_value(req.password)
    if req.alias is not None:
        cred.alias = req.alias

    db.commit()
    db.refresh(cred)

    return CredentialResponse(
        id=cred.id,
        cuit=cred.cuit,
        alias=cred.alias,
        created_at=cred.created_at.isoformat(),
        updated_at=cred.updated_at.isoformat(),
    )


@router.delete("/{credential_id}")
def delete_credential(
    credential_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cred = db.query(ArcaCredential).filter(
        ArcaCredential.id == credential_id,
        ArcaCredential.user_id == user.id,
    ).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credencial no encontrada")

    db.delete(cred)
    db.commit()
    return {"detail": "Credencial eliminada"}
