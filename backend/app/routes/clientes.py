from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from app.database import get_db
from app.models.models import User, Cliente
from app.auth import get_current_user

router = APIRouter(prefix="/api/clientes", tags=["clientes"])


class ClienteCreate(BaseModel):
    cuit: str
    razon_social: str = ""
    alias: str = ""


class ClienteUpdate(BaseModel):
    razon_social: str | None = None
    alias: str | None = None


class ClienteResponse(BaseModel):
    id: int
    cuit: str
    razon_social: str
    alias: str

    class Config:
        from_attributes = True


def _normalize_cuit(cuit: str) -> str:
    return cuit.replace("-", "").replace(" ", "").strip()


@router.get("/", response_model=List[ClienteResponse])
def list_clientes(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Cliente).filter(Cliente.user_id == user.id).order_by(Cliente.razon_social).all()


@router.post("/", response_model=ClienteResponse)
def create_cliente(req: ClienteCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cuit = _normalize_cuit(req.cuit)
    if len(cuit) != 11 or not cuit.isdigit():
        raise HTTPException(status_code=400, detail="CUIT inválido. Debe tener 11 dígitos.")

    existing = db.query(Cliente).filter(Cliente.user_id == user.id, Cliente.cuit == cuit).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un cliente con este CUIT")

    cliente = Cliente(
        user_id=user.id,
        cuit=cuit,
        razon_social=req.razon_social.strip(),
        alias=req.alias.strip(),
    )
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


@router.put("/{cliente_id}", response_model=ClienteResponse)
def update_cliente(cliente_id: int, req: ClienteUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id, Cliente.user_id == user.id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    if req.razon_social is not None:
        cliente.razon_social = req.razon_social.strip()
    if req.alias is not None:
        cliente.alias = req.alias.strip()

    db.commit()
    db.refresh(cliente)
    return cliente


@router.delete("/{cliente_id}")
def delete_cliente(cliente_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id, Cliente.user_id == user.id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    db.delete(cliente)
    db.commit()
    return {"detail": "Cliente eliminado"}
