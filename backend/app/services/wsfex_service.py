import httpx
import ssl
from datetime import datetime, timezone
from xml.etree import ElementTree as ET
from typing import Optional

from app.services.arca_service import WsaaAuth

_ssl_ctx = ssl.create_default_context()
_ssl_ctx.set_ciphers("DEFAULT:@SECLEVEL=1")

WSFEX_URL = "https://servicios1.afip.gov.ar/wsfexv1/service.asmx"
WSFEX_URL_HOMO = "https://wswhomo.afip.gov.ar/wsfexv1/service.asmx"
WSFEX_NS = "http://ar.gov.afip.dif.FEXv1/"


def _soap_envelope(body: str) -> str:
    return (
        '<?xml version="1.0" encoding="utf-8"?>'
        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"'
        f' xmlns:ar="{WSFEX_NS}">'
        f"<soap:Body>{body}</soap:Body>"
        "</soap:Envelope>"
    )


def _find_text(elem, path: str, default: str = "") -> str:
    node = elem.find(f".//{{{WSFEX_NS}}}{path}")
    if node is None:
        node = elem.find(f".//{path}")
    return node.text if node is not None and node.text else default


def _find_all(elem, path: str):
    results = elem.findall(f".//{{{WSFEX_NS}}}{path}")
    if not results:
        results = elem.findall(f".//{path}")
    return results


def _format_fecha(fecha_str: str) -> str:
    if not fecha_str or len(fecha_str) < 8:
        return fecha_str or ""
    try:
        return f"{fecha_str[:4]}-{fecha_str[4:6]}-{fecha_str[6:8]}"
    except Exception:
        return fecha_str


class WsfexService:

    @staticmethod
    async def _call_wsfex(soap_action: str, body: str, homo: bool = False) -> ET.Element:
        url = WSFEX_URL_HOMO if homo else WSFEX_URL
        envelope = _soap_envelope(body)
        async with httpx.AsyncClient(timeout=30, verify=_ssl_ctx) as client:
            resp = await client.post(
                url,
                content=envelope,
                headers={
                    "Content-Type": "text/xml; charset=utf-8",
                    "SOAPAction": f"{WSFEX_NS}{soap_action}",
                },
            )
        return ET.fromstring(resp.text)

    @staticmethod
    async def verificar_servicio(homo: bool = False) -> dict:
        body = "<ar:FEXDummy />"
        try:
            root = await WsfexService._call_wsfex("FEXDummy", body, homo)
            return {
                "success": True,
                "data": {
                    "appserver": _find_text(root, "AppServer"),
                    "dbserver": _find_text(root, "DbServer"),
                    "authserver": _find_text(root, "AuthServer"),
                },
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    async def _obtener_ultimo_id(cuit_clean: str, auth: dict, homo: bool = False) -> int:
        """Obtiene el ultimo ID de request para generar el siguiente."""
        body = (
            "<ar:FEXGetLast_ID>"
            "<ar:Auth>"
            f"<ar:Token>{auth['token']}</ar:Token>"
            f"<ar:Sign>{auth['sign']}</ar:Sign>"
            f"<ar:Cuit>{cuit_clean}</ar:Cuit>"
            "</ar:Auth>"
            "</ar:FEXGetLast_ID>"
        )
        try:
            root = await WsfexService._call_wsfex("FEXGetLast_ID", body, homo)
            return int(_find_text(root, "Id", "0"))
        except Exception:
            return 0

    @staticmethod
    async def emitir_factura_e(
        cuit: str,
        pto_vta: int,
        cliente: str,
        cuit_pais_cliente: str,
        domicilio_cliente: str,
        dst_pais: int,
        moneda_id: str,
        moneda_cotiz: float,
        descripcion: str,
        imp_total: float,
        cbte_tipo: int = 19,
        tipo_expo: int = 2,
        incoterms: str = "",
        idioma: int = 2,
        forma_pago: str = "Transferencia bancaria",
        homo: bool = False,
    ) -> dict:
        """
        Emite una Factura E de exportacion via WSFEX (FEXAuthorize).
        tipo_expo: 1=Bienes, 2=Servicios, 4=Otros
        idioma: 1=Espanol, 2=Ingles, 3=Portugues
        """
        cuit_clean = cuit.replace("-", "").strip()
        auth = await WsaaAuth.login("wsfex", cuit_clean, homo)
        if not auth:
            return {"success": False, "error": "Sin certificado para WSFEX", "requires_certificate": True}

        # Siguiente numero de comprobante y de ID
        ultimo = await WsfexService.obtener_ultimo_comprobante(cuit_clean, pto_vta, cbte_tipo, homo)
        if not ultimo.get("success"):
            return {"success": False, "error": f"No se pudo obtener ultimo comprobante: {ultimo.get('error')}"}
        nro = ultimo["data"]["cbte_nro"] + 1

        last_id = await WsfexService._obtener_ultimo_id(cuit_clean, auth, homo)
        nuevo_id = last_id + 1

        hoy = datetime.now().strftime("%Y%m%d")
        imp_total_r = round(imp_total, 2)

        # Permiso_existente: solo aplica a exportacion de bienes (tipo 1).
        # Para servicios (tipo 2) y otros (tipo 4) debe ir vacio.
        permiso = "N" if tipo_expo == 1 else ""

        body = (
            "<ar:FEXAuthorize>"
            "<ar:Auth>"
            f"<ar:Token>{auth['token']}</ar:Token>"
            f"<ar:Sign>{auth['sign']}</ar:Sign>"
            f"<ar:Cuit>{cuit_clean}</ar:Cuit>"
            "</ar:Auth>"
            "<ar:Cmp>"
            f"<ar:Id>{nuevo_id}</ar:Id>"
            f"<ar:Fecha_cbte>{hoy}</ar:Fecha_cbte>"
            f"<ar:Cbte_Tipo>{cbte_tipo}</ar:Cbte_Tipo>"
            f"<ar:Punto_vta>{pto_vta}</ar:Punto_vta>"
            f"<ar:Cbte_nro>{nro}</ar:Cbte_nro>"
            f"<ar:Tipo_expo>{tipo_expo}</ar:Tipo_expo>"
            f"<ar:Permiso_existente>{permiso}</ar:Permiso_existente>"
            f"<ar:Dst_cmp>{dst_pais}</ar:Dst_cmp>"
            f"<ar:Cliente>{cliente}</ar:Cliente>"
            f"<ar:Cuit_pais_cliente>{cuit_pais_cliente}</ar:Cuit_pais_cliente>"
            f"<ar:Domicilio_cliente>{domicilio_cliente}</ar:Domicilio_cliente>"
            f"<ar:Moneda_Id>{moneda_id}</ar:Moneda_Id>"
            f"<ar:Moneda_ctz>{moneda_cotiz}</ar:Moneda_ctz>"
            f"<ar:Imp_total>{imp_total_r}</ar:Imp_total>"
            f"<ar:Idioma_cbte>{idioma}</ar:Idioma_cbte>"
            f"<ar:Forma_pago>{forma_pago}</ar:Forma_pago>"
            + (f"<ar:Incoterms>{incoterms}</ar:Incoterms>" if incoterms else "")
            + "<ar:Items>"
            "<ar:Item>"
            "<ar:Pro_codigo>1</ar:Pro_codigo>"
            f"<ar:Pro_ds>{descripcion}</ar:Pro_ds>"
            "<ar:Pro_qty>1</ar:Pro_qty>"
            "<ar:Pro_umed>7</ar:Pro_umed>"
            f"<ar:Pro_precio_uni>{imp_total_r}</ar:Pro_precio_uni>"
            f"<ar:Pro_total_item>{imp_total_r}</ar:Pro_total_item>"
            "</ar:Item>"
            "</ar:Items>"
            "</ar:Cmp>"
            "</ar:FEXAuthorize>"
        )

        try:
            root = await WsfexService._call_wsfex("FEXAuthorize", body, homo)

            resultado = _find_text(root, "Resultado")
            cae = _find_text(root, "Cae")
            cae_vto = _find_text(root, "Fch_venc_Cae")

            errores = []
            for err in _find_all(root, "FEXErr"):
                errores.append({"code": _find_text(err, "ErrCode"), "msg": _find_text(err, "ErrMsg")})

            if cae and resultado == "A":
                return {
                    "success": True,
                    "data": {
                        "resultado": resultado,
                        "cae": cae,
                        "cae_vto": _format_fecha(cae_vto),
                        "cbte_nro": nro,
                        "pto_vta": pto_vta,
                        "cbte_tipo": "Factura E",
                        "cbte_tipo_code": cbte_tipo,
                        "imp_total": imp_total_r,
                        "moneda_id": moneda_id,
                        "fecha": _format_fecha(hoy),
                    },
                }
            return {
                "success": False,
                "error": "ARCA rechazo el comprobante",
                "resultado": resultado,
                "errores": errores,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    async def obtener_ultimo_comprobante(cuit: str, pto_vta: int, cbte_tipo: int = 19, homo: bool = False) -> dict:
        cuit_clean = cuit.replace("-", "").strip()
        auth = await WsaaAuth.login("wsfex", cuit_clean, homo)
        if not auth:
            return {"success": False, "error": "Sin certificado para WSFEX", "requires_certificate": True}

        body = (
            "<ar:FEXGetLast_CMP>"
            "<ar:Auth>"
            f"<ar:Token>{auth['token']}</ar:Token>"
            f"<ar:Sign>{auth['sign']}</ar:Sign>"
            f"<ar:Cuit>{cuit_clean}</ar:Cuit>"
            "</ar:Auth>"
            f"<ar:Pto_venta>{pto_vta}</ar:Pto_venta>"
            f"<ar:Cbte_Tipo>{cbte_tipo}</ar:Cbte_Tipo>"
            "</ar:FEXGetLast_CMP>"
        )
        try:
            root = await WsfexService._call_wsfex("FEXGetLast_CMP", body, homo)
            cbte_nro = int(_find_text(root, "Cbte_nro", "0"))
            return {
                "success": True,
                "data": {
                    "pto_vta": pto_vta,
                    "cbte_tipo": cbte_tipo,
                    "cbte_nro": cbte_nro,
                },
            }
        except Exception as e:
            print(f"[WSFEX] Error obtener_ultimo: {e}")
            return {"success": False, "error": str(e)}

    @staticmethod
    async def consultar_comprobante(cuit: str, pto_vta: int, cbte_tipo: int, cbte_nro: int, homo: bool = False) -> Optional[dict]:
        cuit_clean = cuit.replace("-", "").strip()
        auth = await WsaaAuth.login("wsfex", cuit_clean, homo)
        if not auth:
            return None

        body = (
            "<ar:FEXGetCMP>"
            "<ar:Auth>"
            f"<ar:Token>{auth['token']}</ar:Token>"
            f"<ar:Sign>{auth['sign']}</ar:Sign>"
            f"<ar:Cuit>{cuit_clean}</ar:Cuit>"
            "</ar:Auth>"
            "<ar:Cmp>"
            f"<ar:Cbte_tipo>{cbte_tipo}</ar:Cbte_tipo>"
            f"<ar:Punto_vta>{pto_vta}</ar:Punto_vta>"
            f"<ar:Cbte_nro>{cbte_nro}</ar:Cbte_nro>"
            "</ar:Cmp>"
            "</ar:FEXGetCMP>"
        )
        try:
            root = await WsfexService._call_wsfex("FEXGetCMP", body, homo)

            result_elem = root.find(f".//{{{WSFEX_NS}}}FEXResultGet")
            if result_elem is None:
                result_elem = root.find(".//FEXResultGet")
            if result_elem is None:
                print(f"[WSFEX] No se encontro FEXResultGet")
                return None

            fecha_cbte = _find_text(result_elem, "Fecha_cbte")
            fecha_pago = _find_text(result_elem, "Fecha_pago")

            moneda_id = _find_text(result_elem, "Moneda_Id")
            moneda_cotiz = float(_find_text(result_elem, "Moneda_ctz", "1"))

            # Items
            items = []
            for item in _find_all(result_elem, "Item"):
                items.append({
                    "descripcion": _find_text(item, "Pro_ds"),
                    "cantidad": float(_find_text(item, "Pro_qty", "0")),
                    "precio_unitario": float(_find_text(item, "Pro_precio_uni", "0")),
                    "total": float(_find_text(item, "Pro_total_item", "0")),
                    "codigo": _find_text(item, "Pro_codigo"),
                })

            imp_total = float(_find_text(result_elem, "Imp_total", "0"))
            cbte_tipo_code = int(_find_text(result_elem, "Cbte_tipo", "19"))

            TIPOS_CBTE_EX = {
                19: "Factura E",
                20: "Nota de Debito E",
                21: "Nota de Credito E",
            }

            return {
                "concepto": "2",  # Servicios (exportacion)
                "doc_tipo": "CUIT",
                "doc_tipo_code": 80,
                "doc_nro": _find_text(result_elem, "Dst_cuit"),
                "cbte_tipo": TIPOS_CBTE_EX.get(cbte_tipo_code, f"Tipo {cbte_tipo_code}"),
                "cbte_tipo_code": cbte_tipo_code,
                "cbte_nro": int(_find_text(result_elem, "Cbte_nro", "0")),
                "pto_vta": int(_find_text(result_elem, "Punto_vta", "0")),
                "fecha": _format_fecha(fecha_cbte),
                "fecha_raw": fecha_cbte,
                "fecha_vto": _format_fecha(fecha_pago),
                "imp_total": imp_total,
                "imp_neto": 0,
                "imp_neto_gravado": imp_total,
                "imp_iva": 0,
                "imp_tributos": 0,
                "imp_op_ex": 0,
                "moneda_id": moneda_id,
                "moneda_cotiz": moneda_cotiz,
                "cae": _find_text(result_elem, "Cae"),
                "cae_vto": _format_fecha(_find_text(result_elem, "Fch_venc_Cae")),
                "resultado": _find_text(result_elem, "Resultado"),
                "items": items,
                "destino_pais": _find_text(result_elem, "Dst_ds"),
                "idioma": _find_text(result_elem, "Idioma_id"),
                "incoterms": _find_text(result_elem, "Incoterms"),
                "permiso_existente": _find_text(result_elem, "Permiso_existente"),
                "fecha_proceso": "",
                "iva_detalle": [],
                "source": "wsfex",
            }
        except Exception as e:
            print(f"[WSFEX] Error consultar_comprobante: {e}")
            return None

    @staticmethod
    async def obtener_puntos_venta(cuit: str, homo: bool = False) -> dict:
        cuit_clean = cuit.replace("-", "").strip()
        auth = await WsaaAuth.login("wsfex", cuit_clean, homo)
        if not auth:
            return {"success": False, "error": "Sin certificado para WSFEX", "requires_certificate": True}

        body = (
            "<ar:FEXGetPARAM_PtoVenta>"
            "<ar:Auth>"
            f"<ar:Token>{auth['token']}</ar:Token>"
            f"<ar:Sign>{auth['sign']}</ar:Sign>"
            f"<ar:Cuit>{cuit_clean}</ar:Cuit>"
            "</ar:Auth>"
            "</ar:FEXGetPARAM_PtoVenta>"
        )
        try:
            root = await WsfexService._call_wsfex("FEXGetPARAM_PtoVenta", body, homo)
            ptos = []
            for pto in _find_all(root, "ClsFEXResponse_PtoVta"):
                ptos.append({
                    "numero": _find_text(pto, "Pve_Nro"),
                    "bloqueado": _find_text(pto, "Pve_Bloqueado"),
                    "fecha_baja": _find_text(pto, "Pve_FchBaja"),
                })
            return {"success": True, "data": ptos}
        except Exception as e:
            print(f"[WSFEX] Error puntos_venta: {e}")
            return {"success": False, "error": str(e)}

    @staticmethod
    async def obtener_cotizacion(moneda_id: str, cuit: str, homo: bool = False) -> dict:
        """Obtiene la cotizacion oficial de una moneda (ej: DOL, EUR)."""
        cuit_clean = cuit.replace("-", "").strip()
        auth = await WsaaAuth.login("wsfex", cuit_clean, homo)
        if not auth:
            return {"success": False, "error": "Sin certificado para WSFEX", "requires_certificate": True}

        body = (
            "<ar:FEXGetPARAM_Ctz>"
            "<ar:Auth>"
            f"<ar:Token>{auth['token']}</ar:Token>"
            f"<ar:Sign>{auth['sign']}</ar:Sign>"
            f"<ar:Cuit>{cuit_clean}</ar:Cuit>"
            "</ar:Auth>"
            f"<ar:Mon_id>{moneda_id}</ar:Mon_id>"
            "</ar:FEXGetPARAM_Ctz>"
        )
        try:
            root = await WsfexService._call_wsfex("FEXGetPARAM_Ctz", body, homo)
            cotiz = float(_find_text(root, "Mon_ctz", "0"))
            fecha = _find_text(root, "Mon_fecha")
            return {
                "success": True,
                "data": {
                    "moneda": moneda_id,
                    "cotizacion": cotiz,
                    "fecha": fecha,
                },
            }
        except Exception as e:
            print(f"[WSFEX] Error cotizacion: {e}")
            return {"success": False, "error": str(e)}

    @staticmethod
    async def obtener_monedas(cuit: str, homo: bool = False) -> dict:
        """Lista todas las monedas disponibles."""
        cuit_clean = cuit.replace("-", "").strip()
        auth = await WsaaAuth.login("wsfex", cuit_clean, homo)
        if not auth:
            return {"success": False, "error": "Sin certificado para WSFEX", "requires_certificate": True}

        body = (
            "<ar:FEXGetPARAM_MON>"
            "<ar:Auth>"
            f"<ar:Token>{auth['token']}</ar:Token>"
            f"<ar:Sign>{auth['sign']}</ar:Sign>"
            f"<ar:Cuit>{cuit_clean}</ar:Cuit>"
            "</ar:Auth>"
            "</ar:FEXGetPARAM_MON>"
        )
        try:
            root = await WsfexService._call_wsfex("FEXGetPARAM_MON", body, homo)
            monedas = []
            for mon in _find_all(root, "ClsFEXResponse_Mon"):
                monedas.append({
                    "id": _find_text(mon, "Mon_Id"),
                    "descripcion": _find_text(mon, "Mon_Ds"),
                    "vigente_desde": _find_text(mon, "Mon_vig_desde"),
                    "vigente_hasta": _find_text(mon, "Mon_vig_hasta"),
                })
            return {"success": True, "data": monedas}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    async def obtener_paises(cuit: str, homo: bool = False) -> dict:
        """Lista todos los paises destino disponibles."""
        cuit_clean = cuit.replace("-", "").strip()
        auth = await WsaaAuth.login("wsfex", cuit_clean, homo)
        if not auth:
            return {"success": False, "error": "Sin certificado para WSFEX", "requires_certificate": True}

        body = (
            "<ar:FEXGetPARAM_DST_pais>"
            "<ar:Auth>"
            f"<ar:Token>{auth['token']}</ar:Token>"
            f"<ar:Sign>{auth['sign']}</ar:Sign>"
            f"<ar:Cuit>{cuit_clean}</ar:Cuit>"
            "</ar:Auth>"
            "</ar:FEXGetPARAM_DST_pais>"
        )
        try:
            root = await WsfexService._call_wsfex("FEXGetPARAM_DST_pais", body, homo)
            paises = []
            for pais in _find_all(root, "ClsFEXResponse_DST_pais"):
                paises.append({
                    "id": _find_text(pais, "DST_Codigo"),
                    "descripcion": _find_text(pais, "DST_Ds"),
                })
            return {"success": True, "data": paises}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    async def obtener_cuits_paises(cuit: str, homo: bool = False) -> dict:
        """Lista CUIT genéricos por país (para facturar a clientes del exterior)."""
        cuit_clean = cuit.replace("-", "").strip()
        auth = await WsaaAuth.login("wsfex", cuit_clean, homo)
        if not auth:
            return {"success": False, "error": "Sin certificado para WSFEX", "requires_certificate": True}

        body = (
            "<ar:FEXGetPARAM_DST_CUIT>"
            "<ar:Auth>"
            f"<ar:Token>{auth['token']}</ar:Token>"
            f"<ar:Sign>{auth['sign']}</ar:Sign>"
            f"<ar:Cuit>{cuit_clean}</ar:Cuit>"
            "</ar:Auth>"
            "</ar:FEXGetPARAM_DST_CUIT>"
        )
        try:
            root = await WsfexService._call_wsfex("FEXGetPARAM_DST_CUIT", body, homo)
            cuits = []
            for item in _find_all(root, "ClsFEXResponse_DST_cuit"):
                cuits.append({
                    "id": _find_text(item, "DST_CUIT"),
                    "descripcion": _find_text(item, "DST_Ds"),
                })
            return {"success": True, "data": cuits}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    async def obtener_incoterms(cuit: str, homo: bool = False) -> dict:
        """Lista los Incoterms disponibles."""
        cuit_clean = cuit.replace("-", "").strip()
        auth = await WsaaAuth.login("wsfex", cuit_clean, homo)
        if not auth:
            return {"success": False, "error": "Sin certificado para WSFEX", "requires_certificate": True}

        body = (
            "<ar:FEXGetPARAM_Incoterms>"
            "<ar:Auth>"
            f"<ar:Token>{auth['token']}</ar:Token>"
            f"<ar:Sign>{auth['sign']}</ar:Sign>"
            f"<ar:Cuit>{cuit_clean}</ar:Cuit>"
            "</ar:Auth>"
            "</ar:FEXGetPARAM_Incoterms>"
        )
        try:
            root = await WsfexService._call_wsfex("FEXGetPARAM_Incoterms", body, homo)
            items = []
            for item in _find_all(root, "ClsFEXResponse_Inc"):
                items.append({
                    "id": _find_text(item, "Inc_Id"),
                    "descripcion": _find_text(item, "Inc_Ds"),
                })
            return {"success": True, "data": items}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    async def listar_facturas(
        cuit: str,
        fecha_desde: str,
        fecha_hasta: str,
        pto_vta: Optional[int] = None,
        cbte_tipo: int = 19,
        max_results: int = 100,
        homo: bool = False,
    ) -> dict:
        """Lista facturas E emitidas en un rango de fechas via WSFEX."""
        cuit_clean = cuit.replace("-", "").strip()
        auth = await WsaaAuth.login("wsfex", cuit_clean, homo)
        if not auth:
            return {
                "success": False,
                "error": "No hay certificado digital configurado para WSFEX. "
                         "Necesitas autorizar el servicio 'wsfex' en ARCA.",
                "requires_certificate": True,
            }

        desde = fecha_desde.replace("-", "")
        hasta = fecha_hasta.replace("-", "")

        tipos_buscar = [cbte_tipo] if cbte_tipo > 0 else [19, 20, 21]

        if pto_vta:
            ptos_buscar = [pto_vta]
        else:
            ptos_result = await WsfexService.obtener_puntos_venta(cuit_clean, homo)
            if not ptos_result.get("success") or not ptos_result.get("data"):
                ptos_buscar = [1]
            else:
                ptos_buscar = [int(p["numero"]) for p in ptos_result["data"] if not p.get("fecha_baja")]

        facturas = []
        for pv in ptos_buscar:
            for ct in tipos_buscar:
                ultimo = await WsfexService.obtener_ultimo_comprobante(cuit_clean, pv, ct, homo)
                if not ultimo.get("success") or ultimo["data"]["cbte_nro"] == 0:
                    continue

                last_num = ultimo["data"]["cbte_nro"]
                print(f"[WSFEX] Pto {pv}, Tipo {ct}: ultimo comprobante #{last_num}")

                for nro in range(last_num, max(0, last_num - max_results), -1):
                    comp = await WsfexService.consultar_comprobante(cuit_clean, pv, ct, nro, homo)
                    if comp is None:
                        continue

                    fecha_raw = comp.get("fecha_raw", "")
                    if fecha_raw and fecha_raw < desde:
                        break
                    if fecha_raw and desde <= fecha_raw <= hasta:
                        facturas.append(comp)

                    if len(facturas) >= max_results:
                        break

                if len(facturas) >= max_results:
                    break
            if len(facturas) >= max_results:
                break

        facturas.sort(key=lambda f: f.get("fecha_raw", ""), reverse=True)
        total = sum(f.get("imp_total", 0) for f in facturas)

        return {
            "success": True,
            "data": {
                "facturas": facturas,
                "cantidad": len(facturas),
                "total": round(total, 2),
                "fecha_desde": fecha_desde,
                "fecha_hasta": fecha_hasta,
                "cuit": cuit_clean,
                "source": "wsfex",
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
