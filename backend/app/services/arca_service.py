import httpx
import ssl
import json
import base64
import os
from datetime import datetime, timezone, timedelta
from xml.etree import ElementTree as ET
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs7
from typing import Optional

_ssl_ctx = ssl.create_default_context()
_ssl_ctx.set_ciphers("DEFAULT:@SECLEVEL=1")

WSAA_URL = "https://wsaa.arca.gob.ar/ws/services/LoginCms"
WSAA_URL_HOMO = "https://wsaahomo.afip.gov.ar/ws/services/LoginCms"
PADRON_A5_URL = "https://aws.arca.gob.ar/sr-padron/webservices/personaServiceA5"
PADRON_A5_URL_HOMO = "https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5"

CERTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "certs")


class WsaaAuth:
    """Maneja autenticación WSAA con ARCA."""

    _cache: dict = {}

    @staticmethod
    def generate_key_and_csr(cuit: str) -> dict:
        """Genera clave privada y CSR, y los guarda en la base de datos."""
        from app.services import cert_store

        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

        csr = (
            x509.CertificateSigningRequestBuilder()
            .subject_name(
                x509.Name([
                    x509.NameAttribute(NameOID.COMMON_NAME, f"ARCA Informes - CUIT {cuit}"),
                    x509.NameAttribute(NameOID.SERIAL_NUMBER, f"CUIT {cuit}"),
                    x509.NameAttribute(NameOID.COUNTRY_NAME, "AR"),
                ])
            )
            .sign(key, hashes.SHA256())
        )

        key_pem = key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode()
        csr_pem = csr.public_bytes(serialization.Encoding.PEM).decode()

        cert_store.save_key_csr(cuit, key_pem, csr_pem)

        return {"csr_pem": csr_pem}

    @staticmethod
    def _build_tra(service: str) -> str:
        now = datetime.now(timezone.utc)
        expiry = now + timedelta(hours=12)
        return (
            '<?xml version="1.0" encoding="UTF-8"?>'
            "<loginTicketRequest>"
            f"<header><uniqueId>{int(now.timestamp())}</uniqueId>"
            f'<generationTime>{now.strftime("%Y-%m-%dT%H:%M:%S-00:00")}</generationTime>'
            f'<expirationTime>{expiry.strftime("%Y-%m-%dT%H:%M:%S-00:00")}</expirationTime>'
            "</header>"
            f"<service>{service}</service>"
            "</loginTicketRequest>"
        )

    @staticmethod
    def _sign_tra(tra: str, cert_pem: str, key_pem: str) -> str:
        cert = x509.load_pem_x509_certificate(cert_pem.encode())
        key = serialization.load_pem_private_key(key_pem.encode(), password=None)

        signed = (
            pkcs7.PKCS7SignatureBuilder()
            .set_data(tra.encode("utf-8"))
            .add_signer(cert, key, hashes.SHA256())
            .sign(serialization.Encoding.DER, [pkcs7.PKCS7Options.Binary])
        )
        return base64.b64encode(signed).decode()

    @staticmethod
    async def login(service: str, cuit: str, homo: bool = False) -> Optional[dict]:
        from app.services import cert_store

        cache_key = f"{cuit}:{service}"
        cached = WsaaAuth._cache.get(cache_key)
        if cached and cached["expiry"] > datetime.now(timezone.utc):
            return cached

        cert_pem = cert_store.get_crt(cuit)
        key_pem = cert_store.get_key(cuit)

        if not cert_pem or not key_pem:
            return None

        tra = WsaaAuth._build_tra(service)
        cms = WsaaAuth._sign_tra(tra, cert_pem, key_pem)

        soap_body = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"'
            ' xmlns:wsaa="https://wsaa.afip.gov.ar/ws/services/LoginCms">'
            "<soapenv:Body>"
            f"<wsaa:loginCms><wsaa:in0>{cms}</wsaa:in0></wsaa:loginCms>"
            "</soapenv:Body></soapenv:Envelope>"
        )

        url = WSAA_URL_HOMO if homo else WSAA_URL
        try:
            async with httpx.AsyncClient(timeout=30, verify=_ssl_ctx) as client:
                resp = await client.post(url, content=soap_body, headers={
                    "Content-Type": "text/xml",
                    "SOAPAction": "\"\"",
                })
        except Exception as e:
            print(f"[WSAA] Error de conexion: {e}")
            return None

        root = ET.fromstring(resp.text)

        # Check for SOAP fault
        fault = root.find(".//{http://schemas.xmlsoap.org/soap/envelope/}Fault")
        if fault is not None:
            fault_msg = fault.findtext("faultstring") or "Error desconocido"
            print(f"[WSAA] SOAP Fault: {fault_msg}")
            return None

        login_resp = root.find(".//{https://wsaa.afip.gov.ar/ws/services/LoginCms}loginCmsReturn")
        if login_resp is None:
            print(f"[WSAA] No se encontro loginCmsReturn en la respuesta")
            return None

        cred_xml = ET.fromstring(login_resp.text)
        token = cred_xml.findtext(".//token")
        sign = cred_xml.findtext(".//sign")

        if not token or not sign:
            print(f"[WSAA] Token o sign vacios")
            return None

        result = {
            "token": token,
            "sign": sign,
            "expiry": datetime.now(timezone.utc) + timedelta(hours=11),
        }
        WsaaAuth._cache[cache_key] = result
        return result


class ArcaService:
    """Servicio para consultar datos de ARCA (ex AFIP) via Web Services SOAP."""

    @staticmethod
    def has_certificate(cuit: str) -> bool:
        from app.services import cert_store
        return cert_store.has_certificate(cuit)

    @staticmethod
    async def consultar_persona(cuit: str, cuit_representada: str = None) -> dict:
        """Consulta datos de una persona via WS_SR_PADRON_A5."""
        cuit_clean = cuit.replace("-", "").strip()
        cuit_repr = (cuit_representada or cuit).replace("-", "").strip()

        auth = await WsaaAuth.login("ws_sr_padron_a5", cuit_repr)
        if not auth:
            has_cert = ArcaService.has_certificate(cuit_repr)
            if has_cert:
                return {
                    "success": False,
                    "error": "El certificado existe pero WSAA rechazó la autenticación. "
                             "Verifica que el certificado esté autorizado para el servicio 'ws_sr_padron_a5' en ARCA. "
                             "Revisa la consola del backend para más detalles.",
                }
            return {
                "success": False,
                "error": "No hay certificado digital configurado para este CUIT. "
                         "Genera el CSR desde la seccion de credenciales y tramita el certificado en ARCA.",
                "requires_certificate": True,
            }

        soap_body = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"'
            ' xmlns:a5="http://a5.soap.ws.server.puc.sr/">'
            "<soapenv:Body>"
            "<a5:getPersona_v2>"
            f"<token>{auth['token']}</token>"
            f"<sign>{auth['sign']}</sign>"
            f"<cuitRepresentada>{cuit_repr}</cuitRepresentada>"
            f"<idPersona>{cuit_clean}</idPersona>"
            "</a5:getPersona_v2>"
            "</soapenv:Body></soapenv:Envelope>"
        )

        async with httpx.AsyncClient(timeout=30, verify=_ssl_ctx) as client:
            try:
                resp = await client.post(
                    PADRON_A5_URL,
                    content=soap_body,
                    headers={"Content-Type": "text/xml"},
                )
                data = ArcaService._parse_persona_response(resp.text)
                return {
                    "success": True,
                    "data": data,
                    "source": "ws_sr_padron_a5",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            except Exception as e:
                return {"success": False, "error": str(e)}

    @staticmethod
    def _parse_persona_response(xml_text: str) -> dict:
        root = ET.fromstring(xml_text)
        ns = {"a5": "http://a5.soap.ws.server.puc.sr/"}
        persona = root.find(".//personaReturn") or root.find(".//{http://a5.soap.ws.server.puc.sr/}personaReturn")

        if persona is None:
            return {"raw": xml_text}

        result = {}
        for elem in persona:
            tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
            children = list(elem)
            if children:
                child_data = {}
                for child in children:
                    child_tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
                    child_data[child_tag] = child.text
                if tag in result:
                    if not isinstance(result[tag], list):
                        result[tag] = [result[tag]]
                    result[tag].append(child_data)
                else:
                    result[tag] = child_data
            else:
                result[tag] = elem.text

        return result

    @staticmethod
    async def consultar_cuit_publico(cuit: str) -> dict:
        """Consulta básica de CUIT usando el servicio dummy para verificar estado del servicio."""
        cuit_clean = cuit.replace("-", "").strip()

        if len(cuit_clean) != 11 or not cuit_clean.isdigit():
            return {"success": False, "error": "CUIT inválido. Debe tener 11 dígitos."}

        tipo = cuit_clean[:2]
        tipos_map = {
            "20": "Persona Física Masculino",
            "23": "Persona Física Ambos",
            "24": "Persona Física Ambos",
            "27": "Persona Física Femenino",
            "30": "Persona Jurídica",
            "33": "Persona Jurídica",
            "34": "Persona Jurídica",
        }

        has_cert = ArcaService.has_certificate(cuit_clean)

        return {
            "success": True,
            "data": {
                "cuit": cuit_clean,
                "cuit_formateado": f"{cuit_clean[:2]}-{cuit_clean[2:10]}-{cuit_clean[10]}",
                "tipo_cuit": tipos_map.get(tipo, "Desconocido"),
                "certificado_disponible": has_cert,
                "mensaje": (
                    "Para obtener datos completos del padron (nombre, domicilio, actividades, impuestos), "
                    "necesitas configurar un certificado digital. "
                    "Ve a Credenciales > Generar CSR, tramita el certificado en ARCA, y subilo."
                ) if not has_cert else "Certificado disponible. Podes consultar datos completos.",
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    async def generar_informe_completo(cuit: str, cuit_representada: str = None) -> dict:
        """Genera informe completo: intenta WS autenticado, sino devuelve datos básicos."""
        cuit_clean = cuit.replace("-", "").strip()

        if ArcaService.has_certificate(cuit_representada or cuit_clean):
            return await ArcaService.consultar_persona(cuit_clean, cuit_representada)

        return await ArcaService.consultar_cuit_publico(cuit_clean)

    @staticmethod
    async def verificar_servicio() -> dict:
        """Verifica que los servicios de ARCA estén activos."""
        async with httpx.AsyncClient(timeout=15, verify=_ssl_ctx) as client:
            try:
                soap = (
                    '<?xml version="1.0" encoding="UTF-8"?>'
                    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"'
                    ' xmlns:a5="http://a5.soap.ws.server.puc.sr/">'
                    "<soapenv:Body><a5:dummy/></soapenv:Body></soapenv:Envelope>"
                )
                resp = await client.post(PADRON_A5_URL, content=soap, headers={"Content-Type": "text/xml"})
                root = ET.fromstring(resp.text)
                app = root.findtext(".//{http://a5.soap.ws.server.puc.sr/}appserver") or "?"
                auth = root.findtext(".//{http://a5.soap.ws.server.puc.sr/}authserver") or "?"
                db = root.findtext(".//{http://a5.soap.ws.server.puc.sr/}dbserver") or "?"
                return {
                    "success": True,
                    "data": {
                        "padron_a5": {"appserver": app, "authserver": auth, "dbserver": db},
                    },
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            except Exception as e:
                return {"success": False, "error": str(e)}
