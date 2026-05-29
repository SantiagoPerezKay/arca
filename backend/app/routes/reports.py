from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import json

from app.database import get_db
from app.models.models import User, Report
from app.auth import get_current_user
from app.services.arca_service import ArcaService

router = APIRouter(prefix="/api/reports", tags=["reports"])


class ReportResponse(BaseModel):
    id: int
    cuit: str
    report_type: str
    data: dict
    created_at: str

    class Config:
        from_attributes = True


def _save_report(db: Session, user: User, cuit: str, report_type: str, data: dict):
    report = Report(
        user_id=user.id,
        cuit=cuit,
        report_type=report_type,
        data=json.dumps(data, ensure_ascii=False),
    )
    db.add(report)
    db.commit()


@router.get("/consulta-cuit/{cuit}")
async def consultar_cuit(cuit: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = await ArcaService.consultar_cuit_publico(cuit)
    if result.get("success"):
        _save_report(db, user, cuit, "consulta_cuit", result["data"])
    return result


@router.get("/informe-completo/{cuit}")
async def informe_completo(
    cuit: str,
    cuit_representada: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = await ArcaService.generar_informe_completo(cuit, cuit_representada)
    if result.get("success"):
        _save_report(db, user, cuit, "informe_completo", result["data"])
    return result


@router.get("/persona/{cuit}")
async def consultar_persona(
    cuit: str,
    cuit_representada: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = await ArcaService.consultar_persona(cuit, cuit_representada)
    if result.get("success"):
        _save_report(db, user, cuit, "persona_padron", result["data"])
    return result


@router.get("/estado-servicio")
async def estado_servicio(user: User = Depends(get_current_user)):
    return await ArcaService.verificar_servicio()


@router.get("/historial", response_model=List[ReportResponse])
def listar_historial(
    cuit: Optional[str] = Query(None),
    report_type: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Report).filter(Report.user_id == user.id)
    if cuit:
        query = query.filter(Report.cuit == cuit)
    if report_type:
        query = query.filter(Report.report_type == report_type)

    reports = query.order_by(Report.created_at.desc()).limit(limit).all()
    return [
        ReportResponse(
            id=r.id,
            cuit=r.cuit,
            report_type=r.report_type,
            data=json.loads(r.data),
            created_at=r.created_at.isoformat(),
        )
        for r in reports
    ]
