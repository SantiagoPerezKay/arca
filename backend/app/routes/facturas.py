from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta
import json

from app.database import get_db
from app.models.models import User, Report
from app.auth import get_current_user
from app.services.facturas_service import FacturasService
from app.services.wsfex_service import WsfexService

router = APIRouter(prefix="/api/facturas", tags=["facturas"])


TIPOS_WSFEX = {19, 20, 21}


async def _buscar_combinado(cuit, fecha_desde, fecha_hasta, pto_vta, cbte_tipo, max_results=100):
    """Busca en WSFE y/o WSFEX segun el tipo de comprobante."""
    resultados = []
    errors = []

    # Determinar en que servicios buscar
    buscar_wsfe = cbte_tipo == 0 or cbte_tipo not in TIPOS_WSFEX
    buscar_wsfex = cbte_tipo == 0 or cbte_tipo in TIPOS_WSFEX

    if buscar_wsfe:
        wsfe_result = await FacturasService.listar_facturas(
            cuit=cuit, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
            pto_vta=pto_vta, cbte_tipo=cbte_tipo if cbte_tipo not in TIPOS_WSFEX else 0,
            max_results=max_results,
        )
        if wsfe_result.get("success") and wsfe_result.get("data", {}).get("facturas"):
            resultados.extend(wsfe_result["data"]["facturas"])
        elif not wsfe_result.get("success"):
            errors.append(f"WSFE: {wsfe_result.get('error', 'Error desconocido')}")

    if buscar_wsfex:
        print(f"[RUTA] Buscando en WSFEX para {cuit}...")
        wsfex_result = await WsfexService.listar_facturas(
            cuit=cuit, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
            pto_vta=pto_vta, cbte_tipo=cbte_tipo if cbte_tipo in TIPOS_WSFEX else 0,
            max_results=max_results,
        )
        print(f"[RUTA] WSFEX resultado: success={wsfex_result.get('success')}, error={wsfex_result.get('error', 'ninguno')}")
        if wsfex_result.get("success") and wsfex_result.get("data", {}).get("facturas"):
            print(f"[RUTA] WSFEX encontro {len(wsfex_result['data']['facturas'])} facturas")
            resultados.extend(wsfex_result["data"]["facturas"])
        elif not wsfex_result.get("success"):
            errors.append(f"WSFEX: {wsfex_result.get('error', 'Error desconocido')}")

    # Si busca "Todos" y al menos un servicio respondio, no mostrar error del otro
    ambos_fallaron = (buscar_wsfe and buscar_wsfex and len(errors) == 2)
    solo_uno_fallo = (buscar_wsfe and buscar_wsfex and len(errors) == 1)

    # Solo mostrar error si el unico servicio consultado fallo, o si ambos fallaron
    if not resultados and (ambos_fallaron or (not solo_uno_fallo and errors)):
        return {
            "success": False,
            "error": " | ".join(errors),
        }

    resultados.sort(key=lambda f: f.get("fecha_raw", ""), reverse=True)
    total = sum(f.get("imp_total", 0) for f in resultados)

    warnings = errors if solo_uno_fallo else []

    return {
        "success": True,
        "data": {
            "facturas": resultados[:max_results],
            "cantidad": min(len(resultados), max_results),
            "total": round(total, 2),
            "fecha_desde": fecha_desde,
            "fecha_hasta": fecha_hasta,
            "cuit": cuit.replace("-", "").strip(),
            "warnings": warnings,
        },
    }


@router.get("/ultimo-mes/{cuit}")
async def facturas_ultimo_mes(
    cuit: str,
    pto_vta: Optional[int] = Query(None),
    cbte_tipo: int = Query(0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    hoy = datetime.now()
    hace_un_mes = hoy - timedelta(days=30)
    result = await _buscar_combinado(
        cuit=cuit,
        fecha_desde=hace_un_mes.strftime("%Y-%m-%d"),
        fecha_hasta=hoy.strftime("%Y-%m-%d"),
        pto_vta=pto_vta,
        cbte_tipo=cbte_tipo,
    )
    if result.get("success"):
        report = Report(
            user_id=user.id,
            cuit=cuit.replace("-", ""),
            report_type="facturas_ultimo_mes",
            data=json.dumps(result["data"], ensure_ascii=False),
        )
        db.add(report)
        db.commit()
    return result


@router.get("/por-fecha/{cuit}")
async def facturas_por_fecha(
    cuit: str,
    fecha_desde: str = Query(..., description="YYYY-MM-DD"),
    fecha_hasta: str = Query(..., description="YYYY-MM-DD"),
    pto_vta: Optional[int] = Query(None),
    cbte_tipo: int = Query(0),
    max_results: int = Query(100, le=500),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = await _buscar_combinado(
        cuit=cuit,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        pto_vta=pto_vta,
        cbte_tipo=cbte_tipo,
        max_results=max_results,
    )
    if result.get("success"):
        report = Report(
            user_id=user.id,
            cuit=cuit.replace("-", ""),
            report_type="facturas_por_fecha",
            data=json.dumps(result["data"], ensure_ascii=False),
        )
        db.add(report)
        db.commit()
    return result


@router.get("/comprobante/{cuit}")
async def consultar_comprobante(
    cuit: str,
    pto_vta: int = Query(...),
    cbte_tipo: int = Query(...),
    cbte_nro: int = Query(...),
    user: User = Depends(get_current_user),
):
    result = await FacturasService.consultar_comprobante(cuit, pto_vta, cbte_tipo, cbte_nro)
    if result is None:
        return {"success": False, "error": "No se encontró el comprobante"}
    return {"success": True, "data": result}


@router.get("/puntos-venta/{cuit}")
async def puntos_venta(cuit: str, user: User = Depends(get_current_user)):
    return await FacturasService.obtener_puntos_venta(cuit)


@router.get("/tipos-comprobante/{cuit}")
async def tipos_comprobante(cuit: str, user: User = Depends(get_current_user)):
    return await FacturasService.obtener_tipos_comprobante(cuit)


@router.get("/estado-wsfe")
async def estado_wsfe(user: User = Depends(get_current_user)):
    return await FacturasService.verificar_servicio()


