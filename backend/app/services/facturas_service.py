import httpx
import ssl
from datetime import datetime, timezone, timedelta
from xml.etree import ElementTree as ET
from typing import Optional

from app.services.arca_service import WsaaAuth

_ssl_ctx = ssl.create_default_context()
_ssl_ctx.set_ciphers("DEFAULT:@SECLEVEL=1")

WSFE_URL = "https://servicios1.afip.gov.ar/wsfev1/service.asmx"
WSFE_URL_HOMO = "https://wswhomo.afip.gov.ar/wsfev1/service.asmx"
WSFE_NS = "http://ar.gov.afip.dif.FEV1/"

TIPOS_CBTE = {
    1: "Factura A", 2: "Nota de Débito A", 3: "Nota de Crédito A",
    6: "Factura B", 7: "Nota de Débito B", 8: "Nota de Crédito B",
    11: "Factura C", 12: "Nota de Débito C", 13: "Nota de Crédito C",
    19: "Factura E", 20: "Nota de Débito E", 21: "Nota de Crédito E",
    51: "Factura M", 52: "Nota de Débito M", 53: "Nota de Crédito M",
    201: "Factura de Crédito Electrónica A", 206: "Factura de Crédito Electrónica B",
    211: "Factura de Crédito Electrónica C",
}

TIPOS_DOC = {
    80: "CUIT", 86: "CUIL", 87: "CDI", 89: "LE", 90: "LC",
    91: "CI Extranjera", 92: "en trámite", 93: "Acta Nacimiento",
    95: "CI Bs. As. RNP", 96: "DNI", 99: "Doc. (Otro)", 0: "CI Policía Federal",
}


def _soap_envelope(body: str) -> str:
    return (
        '<?xml version="1.0" encoding="utf-8"?>'
        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"'
        f' xmlns:ar="{WSFE_NS}">'
        f"<soap:Body>{body}</soap:Body>"
        "</soap:Envelope>"
    )


def _auth_block(token: str, sign: str, cuit: str) -> str:
    return (
        "<ar:Auth>"
        f"<ar:Token>{token}</ar:Token>"
        f"<ar:Sign>{sign}</ar:Sign>"
        f"<ar:Cuit>{cuit}</ar:Cuit>"
        "</ar:Auth>"
    )


def _find_text(elem, path: str, default: str = "") -> str:
    node = elem.find(f".//{{{WSFE_NS}}}{path}")
    if node is None:
        node = elem.find(f".//{path}")
    return node.text if node is not None and node.text else default


def _find_all(elem, path: str):
    results = elem.findall(f".//{{{WSFE_NS}}}{path}")
    if not results:
        results = elem.findall(f".//{path}")
    return results


class FacturasService:

    @staticmethod
    async def _call_wsfe(soap_action: str, body: str, homo: bool = False) -> ET.Element:
        url = WSFE_URL_HOMO if homo else WSFE_URL
        envelope = _soap_envelope(body)
        async with httpx.AsyncClient(timeout=30, verify=_ssl_ctx) as client:
            resp = await client.post(
                url,
                content=envelope,
                headers={
                    "Content-Type": "text/xml; charset=utf-8",
                    "SOAPAction": f'"{WSFE_NS}{soap_action}"',
                },
            )
        return ET.fromstring(resp.text)

    @staticmethod
    async def verificar_servicio(homo: bool = False) -> dict:
        body = "<ar:FEDummy />"
        try:
            root = await FacturasService._call_wsfe("FEDummy", body, homo)
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
    async def obtener_puntos_venta(cuit: str, homo: bool = False) -> dict:
        cuit_clean = cuit.replace("-", "").strip()
        auth = await WsaaAuth.login("wsfe", cuit_clean, homo)
        if not auth:
            return {"success": False, "error": "Sin certificado para WSFE", "requires_certificate": True}

        body = f"<ar:FEParamGetPtosVenta>{_auth_block(auth['token'], auth['sign'], cuit_clean)}</ar:FEParamGetPtosVenta>"
        try:
            root = await FacturasService._call_wsfe("FEParamGetPtosVenta", body, homo)
            ptos = []
            for pto in _find_all(root, "PtoVenta"):
                ptos.append({
                    "numero": _find_text(pto, "Nro"),
                    "emision_tipo": _find_text(pto, "EmisionTipo"),
                    "bloqueado": _find_text(pto, "Bloqueado"),
                    "fecha_baja": _find_text(pto, "FchBaja"),
                })
            return {"success": True, "data": ptos}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    async def obtener_ultimo_comprobante(cuit: str, pto_vta: int, cbte_tipo: int, homo: bool = False) -> dict:
        cuit_clean = cuit.replace("-", "").strip()
        auth = await WsaaAuth.login("wsfe", cuit_clean, homo)
        if not auth:
            return {"success": False, "error": "Sin certificado para WSFE", "requires_certificate": True}

        body = (
            "<ar:FECompUltimoAutorizado>"
            f"{_auth_block(auth['token'], auth['sign'], cuit_clean)}"
            f"<ar:PtoVta>{pto_vta}</ar:PtoVta>"
            f"<ar:CbteTipo>{cbte_tipo}</ar:CbteTipo>"
            "</ar:FECompUltimoAutorizado>"
        )
        try:
            root = await FacturasService._call_wsfe("FECompUltimoAutorizado", body, homo)
            return {
                "success": True,
                "data": {
                    "pto_vta": int(_find_text(root, "PtoVta", "0")),
                    "cbte_tipo": int(_find_text(root, "CbteTipo", "0")),
                    "cbte_nro": int(_find_text(root, "CbteNro", "0")),
                },
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    async def consultar_comprobante(cuit: str, pto_vta: int, cbte_tipo: int, cbte_nro: int, homo: bool = False) -> Optional[dict]:
        cuit_clean = cuit.replace("-", "").strip()
        auth = await WsaaAuth.login("wsfe", cuit_clean, homo)
        if not auth:
            return None

        body = (
            "<ar:FECompConsultar>"
            f"{_auth_block(auth['token'], auth['sign'], cuit_clean)}"
            "<ar:FeCompConsReq>"
            f"<ar:CbteTipo>{cbte_tipo}</ar:CbteTipo>"
            f"<ar:CbteNro>{cbte_nro}</ar:CbteNro>"
            f"<ar:PtoVta>{pto_vta}</ar:PtoVta>"
            "</ar:FeCompConsReq>"
            "</ar:FECompConsultar>"
        )
        try:
            root = await FacturasService._call_wsfe("FECompConsultar", body, homo)

            result_elem = root.find(f".//{{{WSFE_NS}}}ResultGet")
            if result_elem is None:
                result_elem = root.find(".//ResultGet")
            if result_elem is None:
                return None

            fecha_cbte = _find_text(result_elem, "CbteFch")
            fecha_vto = _find_text(result_elem, "FchVto")
            fecha_proceso = _find_text(result_elem, "FchProceso")

            doc_tipo_code = int(_find_text(result_elem, "DocTipo", "0"))
            cbte_tipo_code = int(_find_text(result_elem, "CbteTipo", "0"))

            iva_items = []
            for iva in _find_all(result_elem, "AlicIva"):
                iva_items.append({
                    "id": _find_text(iva, "Id"),
                    "base_imp": float(_find_text(iva, "BaseImp", "0")),
                    "importe": float(_find_text(iva, "Importe", "0")),
                })

            return {
                "concepto": _find_text(result_elem, "Concepto"),
                "doc_tipo": TIPOS_DOC.get(doc_tipo_code, str(doc_tipo_code)),
                "doc_tipo_code": doc_tipo_code,
                "doc_nro": _find_text(result_elem, "DocNro"),
                "cbte_tipo": TIPOS_CBTE.get(cbte_tipo_code, str(cbte_tipo_code)),
                "cbte_tipo_code": cbte_tipo_code,
                "cbte_nro": int(_find_text(result_elem, "CbteHasta", "0")),
                "pto_vta": int(_find_text(result_elem, "PtoVta", "0")),
                "fecha": _format_fecha(fecha_cbte),
                "fecha_raw": fecha_cbte,
                "fecha_vto": _format_fecha(fecha_vto),
                "imp_total": float(_find_text(result_elem, "ImpTotal", "0")),
                "imp_neto": float(_find_text(result_elem, "ImpTotConc", "0")),
                "imp_neto_gravado": float(_find_text(result_elem, "ImpNeto", "0")),
                "imp_iva": float(_find_text(result_elem, "ImpIVA", "0")),
                "imp_tributos": float(_find_text(result_elem, "ImpTrib", "0")),
                "imp_op_ex": float(_find_text(result_elem, "ImpOpEx", "0")),
                "moneda_id": _find_text(result_elem, "MonId"),
                "moneda_cotiz": float(_find_text(result_elem, "MonCotiz", "1")),
                "cae": _find_text(result_elem, "CodAutorizacion"),
                "cae_vto": _format_fecha(_find_text(result_elem, "FchVto")),
                "resultado": _find_text(result_elem, "Resultado"),
                "iva_detalle": iva_items,
                "fecha_proceso": fecha_proceso,
            }
        except Exception:
            return None

    @staticmethod
    async def listar_facturas(
        cuit: str,
        fecha_desde: str,
        fecha_hasta: str,
        pto_vta: Optional[int] = None,
        cbte_tipo: int = 0,
        max_results: int = 100,
        homo: bool = False,
    ) -> dict:
        """
        Lista facturas emitidas en un rango de fechas.
        fecha_desde/fecha_hasta en formato YYYY-MM-DD.
        Si cbte_tipo=0, busca los tipos más comunes (1,6,11 = Factura A/B/C).
        """
        cuit_clean = cuit.replace("-", "").strip()
        auth = await WsaaAuth.login("wsfe", cuit_clean, homo)
        if not auth:
            return {
                "success": False,
                "error": "No hay certificado digital configurado para WSFE. "
                         "Genera el CSR en Credenciales y tramitá el certificado en ARCA "
                         "para el servicio 'wsfe'.",
                "requires_certificate": True,
            }

        desde = fecha_desde.replace("-", "")
        hasta = fecha_hasta.replace("-", "")

        tipos_buscar = [cbte_tipo] if cbte_tipo > 0 else [1, 2, 3, 6, 7, 8, 11, 12, 13, 19, 20, 21]

        if pto_vta:
            ptos_buscar = [pto_vta]
        else:
            ptos_result = await FacturasService.obtener_puntos_venta(cuit_clean, homo)
            print(f"[WSFE] Puntos de venta para {cuit_clean}: {ptos_result}")
            if not ptos_result.get("success") or not ptos_result.get("data"):
                ptos_buscar = [1]
            else:
                ptos_buscar = [int(p["numero"]) for p in ptos_result["data"] if not p.get("fecha_baja")]

        print(f"[WSFE] Buscando en puntos: {ptos_buscar}, tipos: {tipos_buscar}")

        facturas = []
        for pv in ptos_buscar:
            for ct in tipos_buscar:
                ultimo = await FacturasService.obtener_ultimo_comprobante(cuit_clean, pv, ct, homo)
                if not ultimo.get("success") or ultimo["data"]["cbte_nro"] == 0:
                    continue

                last_num = ultimo["data"]["cbte_nro"]
                print(f"[WSFE] Pto {pv}, Tipo {ct}: ultimo comprobante #{last_num}")
                for nro in range(last_num, max(0, last_num - max_results), -1):
                    comp = await FacturasService.consultar_comprobante(cuit_clean, pv, ct, nro, homo)
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
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    async def emitir_factura(
        cuit: str,
        pto_vta: int,
        cbte_tipo: int,
        doc_tipo: int,
        doc_nro: str,
        imp_neto: float,
        imp_iva: float = 0.0,
        concepto: int = 2,
        condicion_iva_receptor: int = 5,
        fecha_serv_desde: str = None,
        fecha_serv_hasta: str = None,
        fecha_vto_pago: str = None,
        homo: bool = False,
    ) -> dict:
        """
        Emite una factura via WSFE (FECAESolicitar).
        cbte_tipo: 1=Fact A, 6=Fact B, 11=Fact C
        concepto: 1=Productos, 2=Servicios, 3=Ambos
        Para Factura C, imp_iva debe ser 0 (no discrimina IVA).
        condicion_iva_receptor: 1=RI, 4=Exento, 5=Consumidor Final, 6=Monotributo
        """
        cuit_clean = cuit.replace("-", "").strip()
        auth = await WsaaAuth.login("wsfe", cuit_clean, homo)
        if not auth:
            return {"success": False, "error": "Sin certificado para WSFE", "requires_certificate": True}

        # Obtener ultimo comprobante para calcular el siguiente numero
        ultimo = await FacturasService.obtener_ultimo_comprobante(cuit_clean, pto_vta, cbte_tipo, homo)
        if not ultimo.get("success"):
            return {"success": False, "error": f"No se pudo obtener el ultimo comprobante: {ultimo.get('error')}"}

        nro = ultimo["data"]["cbte_nro"] + 1
        hoy = datetime.now().strftime("%Y%m%d")

        es_factura_c = cbte_tipo in (11, 12, 13)
        imp_total = round(imp_neto + imp_iva, 2)

        # Factura C: ImpNeto va en ImpNeto, ImpIVA=0, sin AlicIva
        # Factura A/B: ImpNeto gravado + ImpIVA + AlicIva
        iva_block = ""
        if not es_factura_c and imp_iva > 0:
            iva_block = (
                "<ar:Iva>"
                "<ar:AlicIva>"
                "<ar:Id>5</ar:Id>"  # 5 = 21%
                f"<ar:BaseImp>{imp_neto}</ar:BaseImp>"
                f"<ar:Importe>{imp_iva}</ar:Importe>"
                "</ar:AlicIva>"
                "</ar:Iva>"
            )

        # Fechas de servicio (requeridas si concepto 2 o 3)
        fecha_serv = ""
        if concepto in (2, 3):
            fsd = (fecha_serv_desde or hoy).replace("-", "")
            fsh = (fecha_serv_hasta or hoy).replace("-", "")
            fvp = (fecha_vto_pago or hoy).replace("-", "")
            fecha_serv = (
                f"<ar:FchServDesde>{fsd}</ar:FchServDesde>"
                f"<ar:FchServHasta>{fsh}</ar:FchServHasta>"
                f"<ar:FchVtoPago>{fvp}</ar:FchVtoPago>"
            )

        body = (
            "<ar:FECAESolicitar>"
            f"{_auth_block(auth['token'], auth['sign'], cuit_clean)}"
            "<ar:FeCAEReq>"
            "<ar:FeCabReq>"
            "<ar:CantReg>1</ar:CantReg>"
            f"<ar:PtoVta>{pto_vta}</ar:PtoVta>"
            f"<ar:CbteTipo>{cbte_tipo}</ar:CbteTipo>"
            "</ar:FeCabReq>"
            "<ar:FeDetReq>"
            "<ar:FECAEDetRequest>"
            f"<ar:Concepto>{concepto}</ar:Concepto>"
            f"<ar:DocTipo>{doc_tipo}</ar:DocTipo>"
            f"<ar:DocNro>{doc_nro}</ar:DocNro>"
            f"<ar:CbteDesde>{nro}</ar:CbteDesde>"
            f"<ar:CbteHasta>{nro}</ar:CbteHasta>"
            f"<ar:CbteFch>{hoy}</ar:CbteFch>"
            f"<ar:ImpTotal>{imp_total}</ar:ImpTotal>"
            "<ar:ImpTotConc>0</ar:ImpTotConc>"
            f"<ar:ImpNeto>{imp_neto}</ar:ImpNeto>"
            "<ar:ImpOpEx>0</ar:ImpOpEx>"
            "<ar:ImpTrib>0</ar:ImpTrib>"
            f"<ar:ImpIVA>{0 if es_factura_c else imp_iva}</ar:ImpIVA>"
            f"{fecha_serv}"
            f"<ar:CondicionIVAReceptorId>{condicion_iva_receptor}</ar:CondicionIVAReceptorId>"
            "<ar:MonId>PES</ar:MonId>"
            "<ar:MonCotiz>1</ar:MonCotiz>"
            f"{iva_block}"
            "</ar:FECAEDetRequest>"
            "</ar:FeDetReq>"
            "</ar:FeCAEReq>"
            "</ar:FECAESolicitar>"
        )

        try:
            root = await FacturasService._call_wsfe("FECAESolicitar", body, homo)

            resultado = _find_text(root, "Resultado")
            cae = _find_text(root, "CAE")
            cae_vto = _find_text(root, "CAEFchVto")

            # Errores
            errores = []
            for err in _find_all(root, "Err"):
                errores.append({"code": _find_text(err, "Code"), "msg": _find_text(err, "Msg")})
            observaciones = []
            for obs in _find_all(root, "Obs"):
                observaciones.append({"code": _find_text(obs, "Code"), "msg": _find_text(obs, "Msg")})

            if resultado == "A" and cae:
                return {
                    "success": True,
                    "data": {
                        "resultado": resultado,
                        "cae": cae,
                        "cae_vto": _format_fecha(cae_vto),
                        "cbte_nro": nro,
                        "pto_vta": pto_vta,
                        "cbte_tipo": TIPOS_CBTE.get(cbte_tipo, str(cbte_tipo)),
                        "cbte_tipo_code": cbte_tipo,
                        "imp_total": imp_total,
                        "fecha": _format_fecha(hoy),
                        "observaciones": observaciones,
                    },
                }
            return {
                "success": False,
                "error": "ARCA rechazo el comprobante",
                "resultado": resultado,
                "errores": errores,
                "observaciones": observaciones,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    async def obtener_tipos_comprobante(cuit: str, homo: bool = False) -> dict:
        cuit_clean = cuit.replace("-", "").strip()
        auth = await WsaaAuth.login("wsfe", cuit_clean, homo)
        if not auth:
            return {"success": False, "error": "Sin certificado para WSFE", "requires_certificate": True}

        body = f"<ar:FEParamGetTiposCbte>{_auth_block(auth['token'], auth['sign'], cuit_clean)}</ar:FEParamGetTiposCbte>"
        try:
            root = await FacturasService._call_wsfe("FEParamGetTiposCbte", body, homo)
            tipos = []
            for tipo in _find_all(root, "CbteTipo"):
                code = int(_find_text(tipo, "Id", "0"))
                tipos.append({
                    "id": code,
                    "desc": _find_text(tipo, "Desc"),
                    "fch_desde": _find_text(tipo, "FchDesde"),
                    "fch_hasta": _find_text(tipo, "FchHasta"),
                })
            return {"success": True, "data": tipos}
        except Exception as e:
            return {"success": False, "error": str(e)}


def _format_fecha(fecha_str: str) -> str:
    if not fecha_str or len(fecha_str) < 8:
        return fecha_str or ""
    try:
        return f"{fecha_str[:4]}-{fecha_str[4:6]}-{fecha_str[6:8]}"
    except Exception:
        return fecha_str
