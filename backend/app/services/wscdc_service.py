"""
Servicio WSCDC - Constatacion de Comprobantes Recibidos.
Permite verificar si una factura recibida es valida (verificar CAE).
"""
import httpx
import ssl
from datetime import datetime, timezone
from xml.etree import ElementTree as ET

from app.services.arca_service import WsaaAuth

_ssl_ctx = ssl.create_default_context()
_ssl_ctx.set_ciphers("DEFAULT:@SECLEVEL=1")

WSCDC_URL = "https://servicios1.afip.gov.ar/WSCDC/service.asmx"
WSCDC_URL_HOMO = "https://wswhomo.afip.gov.ar/WSCDC/service.asmx"
WSCDC_NS = "http://ar.gov.afip.dif.WSCDC/"

TIPOS_CBTE = {
    1: "Factura A", 2: "Nota de Débito A", 3: "Nota de Crédito A",
    6: "Factura B", 7: "Nota de Débito B", 8: "Nota de Crédito B",
    11: "Factura C", 12: "Nota de Débito C", 13: "Nota de Crédito C",
    19: "Factura E", 20: "Nota de Débito E", 21: "Nota de Crédito E",
    51: "Factura M", 52: "Nota de Débito M", 53: "Nota de Crédito M",
}


def _find_text(elem, path: str, default: str = "") -> str:
    node = elem.find(f".//{{{WSCDC_NS}}}{path}")
    if node is None:
        node = elem.find(f".//{path}")
    return node.text if node is not None and node.text else default


class WscdcService:

    @staticmethod
    async def _call(soap_action: str, body: str, homo: bool = False) -> ET.Element:
        url = WSCDC_URL_HOMO if homo else WSCDC_URL
        envelope = (
            '<?xml version="1.0" encoding="utf-8"?>'
            '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"'
            f' xmlns:ar="{WSCDC_NS}">'
            f"<soap:Body>{body}</soap:Body>"
            "</soap:Envelope>"
        )
        async with httpx.AsyncClient(timeout=30, verify=_ssl_ctx) as client:
            resp = await client.post(
                url,
                content=envelope,
                headers={
                    "Content-Type": "text/xml; charset=utf-8",
                    "SOAPAction": f"{WSCDC_NS}{soap_action}",
                },
            )
        return ET.fromstring(resp.text)

    @staticmethod
    async def verificar_servicio(homo: bool = False) -> dict:
        body = "<ar:ComprobanteDummy />"
        try:
            root = await WscdcService._call("ComprobanteDummy", body, homo)
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
    async def constatar_comprobante(
        cuit_emisor: str,
        cbte_tipo: int,
        pto_vta: int,
        cbte_nro: int,
        cbte_fecha: str,
        imp_total: float,
        cuit_receptor: str,
        doc_tipo_receptor: int = 80,
        cod_autorizacion: str = "",
        homo: bool = False,
    ) -> dict:
        """
        Constata (verifica) un comprobante recibido.
        cbte_fecha en formato YYYYMMDD o YYYY-MM-DD.
        """
        cuit_repr = cuit_receptor.replace("-", "").strip()

        auth = await WsaaAuth.login("wscdc", cuit_repr, homo)
        if not auth:
            return {
                "success": False,
                "error": "No hay certificado digital configurado para WSCDC. "
                         "Autoriza el servicio 'wscdc' en ARCA.",
                "requires_certificate": True,
            }

        fecha = cbte_fecha.replace("-", "")

        body = (
            "<ar:ComprobanteConstatar>"
            "<ar:Auth>"
            f"<ar:Token>{auth['token']}</ar:Token>"
            f"<ar:Sign>{auth['sign']}</ar:Sign>"
            f"<ar:Cuit>{cuit_repr}</ar:Cuit>"
            "</ar:Auth>"
            "<ar:CmpReq>"
            f"<ar:CbteModo>CAE</ar:CbteModo>"
            f"<ar:CuitEmisor>{cuit_emisor.replace('-', '').strip()}</ar:CuitEmisor>"
            f"<ar:PtoVta>{pto_vta}</ar:PtoVta>"
            f"<ar:CbteTipo>{cbte_tipo}</ar:CbteTipo>"
            f"<ar:CbteNro>{cbte_nro}</ar:CbteNro>"
            f"<ar:CbteFch>{fecha}</ar:CbteFch>"
            f"<ar:ImpTotal>{imp_total}</ar:ImpTotal>"
            f"<ar:CodAutorizacion>{cod_autorizacion}</ar:CodAutorizacion>"
            f"<ar:DocTipoReceptor>{doc_tipo_receptor}</ar:DocTipoReceptor>"
            f"<ar:DocNroReceptor>{cuit_repr}</ar:DocNroReceptor>"
            "</ar:CmpReq>"
            "</ar:ComprobanteConstatar>"
        )

        try:
            root = await WscdcService._call("ComprobanteConstatar", body, homo)

            resultado = _find_text(root, "Resultado")
            observaciones = []

            obs_elems = root.findall(f".//{{{WSCDC_NS}}}Observacion") or root.findall(".//Observacion")
            for obs in obs_elems:
                code = _find_text(obs, "Code")
                msg = _find_text(obs, "Msg")
                observaciones.append({"code": code, "msg": msg})

            errors = []
            err_elems = root.findall(f".//{{{WSCDC_NS}}}Err") or root.findall(".//Err")
            for err in err_elems:
                code = _find_text(err, "Code")
                msg = _find_text(err, "Msg")
                errors.append({"code": code, "msg": msg})

            tipo_label = TIPOS_CBTE.get(cbte_tipo, f"Tipo {cbte_tipo}")

            return {
                "success": True,
                "data": {
                    "resultado": resultado,
                    "valido": resultado == "A",
                    "cbte_tipo": tipo_label,
                    "cbte_tipo_code": cbte_tipo,
                    "pto_vta": pto_vta,
                    "cbte_nro": cbte_nro,
                    "cuit_emisor": cuit_emisor.replace("-", "").strip(),
                    "imp_total": imp_total,
                    "fecha": f"{fecha[:4]}-{fecha[4:6]}-{fecha[6:8]}" if len(fecha) >= 8 else fecha,
                    "observaciones": observaciones,
                    "errores": errors,
                },
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as e:
            print(f"[WSCDC] Error: {e}")
            return {"success": False, "error": str(e)}
