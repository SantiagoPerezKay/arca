"""
Rutas de consultas: WSCDC (constatar comprobantes), cotizaciones, parametros WSFEX.
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional

from app.models.models import User
from app.auth import get_current_user
from app.services.wscdc_service import WscdcService
from app.services.wsfex_service import WsfexService
from app.services.facturas_service import FacturasService

router = APIRouter(prefix="/api/consultas", tags=["consultas"])


# ===================== WSCDC - Constatar Comprobantes =====================

@router.get("/constatar-comprobante")
async def constatar_comprobante(
    cuit_emisor: str = Query(..., description="CUIT del emisor del comprobante"),
    cbte_tipo: int = Query(..., description="Tipo de comprobante (1=Fact A, 6=Fact B, 11=Fact C, 19=Fact E)"),
    pto_vta: int = Query(..., description="Punto de venta"),
    cbte_nro: int = Query(..., description="Numero de comprobante"),
    cbte_fecha: str = Query(..., description="Fecha del comprobante YYYY-MM-DD"),
    imp_total: float = Query(..., description="Importe total"),
    cuit_receptor: str = Query(..., description="CUIT del receptor (tu CUIT)"),
    cod_autorizacion: str = Query("", description="CAE o CAEA (opcional)"),
    user: User = Depends(get_current_user),
):
    return await WscdcService.constatar_comprobante(
        cuit_emisor=cuit_emisor,
        cbte_tipo=cbte_tipo,
        pto_vta=pto_vta,
        cbte_nro=cbte_nro,
        cbte_fecha=cbte_fecha,
        imp_total=imp_total,
        cuit_receptor=cuit_receptor,
        cod_autorizacion=cod_autorizacion,
    )


@router.get("/estado-wscdc")
async def estado_wscdc(user: User = Depends(get_current_user)):
    return await WscdcService.verificar_servicio()


# ===================== Cotizaciones =====================

@router.get("/cotizacion/{moneda_id}")
async def cotizacion_moneda(
    moneda_id: str,
    cuit: str = Query(..., description="CUIT para autenticacion"),
    user: User = Depends(get_current_user),
):
    """Obtiene cotizacion oficial ARCA de una moneda. Ej: DOL, EUR, 012 (Real)."""
    return await WsfexService.obtener_cotizacion(moneda_id, cuit)


# ===================== Parametros WSFEX =====================

@router.get("/monedas")
async def listar_monedas(
    cuit: str = Query(...),
    user: User = Depends(get_current_user),
):
    return await WsfexService.obtener_monedas(cuit)


@router.get("/paises")
async def listar_paises(
    cuit: str = Query(...),
    user: User = Depends(get_current_user),
):
    return await WsfexService.obtener_paises(cuit)


@router.get("/cuits-paises")
async def listar_cuits_paises(
    cuit: str = Query(...),
    user: User = Depends(get_current_user),
):
    """CUIT genéricos por país (para facturar a clientes del exterior)."""
    return await WsfexService.obtener_cuits_paises(cuit)


@router.get("/incoterms")
async def listar_incoterms(
    cuit: str = Query(...),
    user: User = Depends(get_current_user),
):
    return await WsfexService.obtener_incoterms(cuit)


# ===================== Parametros WSFE =====================

@router.get("/tipos-comprobante")
async def listar_tipos_comprobante(
    cuit: str = Query(...),
    user: User = Depends(get_current_user),
):
    return await FacturasService.obtener_tipos_comprobante(cuit)


@router.get("/puntos-venta")
async def listar_puntos_venta(
    cuit: str = Query(...),
    user: User = Depends(get_current_user),
):
    """Puntos de venta WSFE + WSFEX combinados."""
    wsfe = await FacturasService.obtener_puntos_venta(cuit)
    wsfex = await WsfexService.obtener_puntos_venta(cuit)

    ptos = []
    if wsfe.get("success") and wsfe.get("data"):
        for p in wsfe["data"]:
            p["servicio"] = "WSFE"
            ptos.append(p)
    if wsfex.get("success") and wsfex.get("data"):
        for p in wsfex["data"]:
            p["servicio"] = "WSFEX"
            ptos.append(p)

    return {"success": True, "data": ptos}


# ===================== Estado de todos los servicios =====================

@router.get("/estado-servicios")
async def estado_todos_servicios(user: User = Depends(get_current_user)):
    """Verifica el estado de todos los servicios de ARCA."""
    from app.services.arca_service import ArcaService

    wsfe = await FacturasService.verificar_servicio()
    wsfex = await WsfexService.verificar_servicio()
    wscdc = await WscdcService.verificar_servicio()
    padron = await ArcaService.verificar_servicio()

    return {
        "success": True,
        "data": {
            "wsfe": {
                "nombre": "Facturacion Electronica (mercado interno)",
                "estado": "online" if wsfe.get("success") else "offline",
                "detalle": wsfe.get("data", {}),
            },
            "wsfex": {
                "nombre": "Facturacion Electronica Exportacion",
                "estado": "online" if wsfex.get("success") else "offline",
                "detalle": wsfex.get("data", {}),
            },
            "wscdc": {
                "nombre": "Constatacion de Comprobantes",
                "estado": "online" if wscdc.get("success") else "offline",
                "detalle": wscdc.get("data", {}),
            },
            "padron_a5": {
                "nombre": "Padron Contribuyentes (A5)",
                "estado": "online" if padron.get("success") else "offline",
                "detalle": padron.get("data", {}),
            },
        },
    }
