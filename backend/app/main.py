import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routes import auth, credentials, reports, certificates, facturas, consultas

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ARCA Informes API",
    description="API para consultar informes de ARCA (ex AFIP)",
    version="1.0.0",
)

# CORS: acepta origenes desde variable de entorno o defaults para desarrollo
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:3000")
# Normalizar: quitar espacios y barra final
origins = [o.strip().rstrip("/") for o in cors_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.easypanel\.host",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(credentials.router)
app.include_router(reports.router)
app.include_router(certificates.router)
app.include_router(facturas.router)
app.include_router(consultas.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "ARCA Informes"}
