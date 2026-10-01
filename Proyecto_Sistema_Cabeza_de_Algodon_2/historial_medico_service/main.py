"""
Microservicio: Historial Médico / Fichas Clínicas
Asilo Cabeza de Algodón

Registra cada visita médica de un residente: motivo, médico tratante,
exámenes solicitados, resultados, diagnóstico, medicamento aplicado y
observaciones. Es el módulo que arma el "expediente" que pide el
enunciado del proyecto.

Puerto sugerido: 8003
"""
import os
from datetime import datetime
from typing import Optional, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, DECIMAL
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from fastapi import Depends

# ---------------------------------------------------------------------------
# Conexión a la base de datos (misma BD SQL Server que usa el proyecto .NET:
# AsiloCabezaAlgodon). Se configura por variable de entorno DATABASE_URL.
#
# IMPORTANTE: tu appsettings.json usa "Trusted_Connection=True" (autenticación
# integrada de Windows). Eso funciona desde .NET porque corre en Windows, pero
# un contenedor Docker (Linux) NO puede usar autenticación integrada de
# Windows contra tu SQL Server. Para que este microservicio (y los otros 3
# nuevos) se puedan conectar, necesitas:
#   1) Habilitar en tu SQL Server el modo de autenticación "SQL Server and
#      Windows Authentication mode" (mixto).
#   2) Crear un login de SQL (usuario/contraseña) con permisos sobre la BD
#      AsiloCabezaAlgodon.
#   3) Usar ese usuario/contraseña en el DATABASE_URL de abajo.
# Si vas a correr el microservicio directo con "python main.py" en la misma
# máquina Windows (sin Docker), sí podrías usar Trusted_Connection, pero para
# docker-compose se recomienda usuario/contraseña.
# ---------------------------------------------------------------------------
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mssql+pyodbc://usuario:password@localhost,1433/AsiloCabezaAlgodon"
    "?driver=ODBC+Driver+17+for+SQL+Server&TrustServerCertificate=yes",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Modelo de la tabla VisitasMedicas
# ---------------------------------------------------------------------------
class VisitaMedica(Base):
    __tablename__ = "VisitasMedicas"

    id_visita = Column("id_visita", Integer, primary_key=True, index=True, autoincrement=True)
    id_residente = Column("id_residente", Integer, nullable=False, index=True)
    id_solicitud = Column("id_solicitud", Integer, nullable=True)  # liga con Solicitudes y Citas
    fecha_visita = Column("fecha_visita", DateTime, default=datetime.utcnow)
    motivo_visita = Column("motivo_visita", String(255), nullable=False)
    medico_tratante = Column("medico_tratante", String(150), nullable=False)
    especialidad = Column("especialidad", String(100), nullable=True)
    examenes_solicitados = Column("examenes_solicitados", Text, nullable=True)
    resultados_examenes = Column("resultados_examenes", Text, nullable=True)
    diagnostico = Column("diagnostico", Text, nullable=False)
    medicamento_aplicado = Column("medicamento_aplicado", String(255), nullable=True)
    cantidad_medicamento = Column("cantidad_medicamento", String(100), nullable=True)
    tiempo_aplicacion = Column("tiempo_aplicacion", String(100), nullable=True)
    observaciones = Column("observaciones", Text, nullable=True)
    costo_consulta = Column("costo_consulta", DECIMAL(10, 2), nullable=True)


# ---------------------------------------------------------------------------
# Esquemas Pydantic
# ---------------------------------------------------------------------------
class VisitaMedicaBase(BaseModel):
    id_residente: int
    id_solicitud: Optional[int] = None
    motivo_visita: str
    medico_tratante: str
    especialidad: Optional[str] = None
    examenes_solicitados: Optional[str] = None
    resultados_examenes: Optional[str] = None
    diagnostico: str
    medicamento_aplicado: Optional[str] = None
    cantidad_medicamento: Optional[str] = None
    tiempo_aplicacion: Optional[str] = None
    observaciones: Optional[str] = None
    costo_consulta: Optional[float] = None


class VisitaMedicaCreate(VisitaMedicaBase):
    pass


class VisitaMedicaUpdate(BaseModel):
    motivo_visita: Optional[str] = None
    medico_tratante: Optional[str] = None
    especialidad: Optional[str] = None
    examenes_solicitados: Optional[str] = None
    resultados_examenes: Optional[str] = None
    diagnostico: Optional[str] = None
    medicamento_aplicado: Optional[str] = None
    cantidad_medicamento: Optional[str] = None
    tiempo_aplicacion: Optional[str] = None
    observaciones: Optional[str] = None
    costo_consulta: Optional[float] = None


class VisitaMedicaOut(VisitaMedicaBase):
    model_config = ConfigDict(from_attributes=True)
    id_visita: int
    fecha_visita: datetime


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="Historial Médico Service - Cabeza de Algodón")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    # Crea la tabla si no existe (útil para no depender de migraciones manuales)
    Base.metadata.create_all(bind=engine)


@app.get("/")
def read_root():
    return {"status": "Historial Médico service running"}


@app.post("/visitas", response_model=VisitaMedicaOut, status_code=201)
def crear_visita(visita: VisitaMedicaCreate, db: Session = Depends(get_db)):
    nueva = VisitaMedica(**visita.model_dump())
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


@app.get("/visitas", response_model=List[VisitaMedicaOut])
def listar_visitas(db: Session = Depends(get_db)):
    return db.query(VisitaMedica).order_by(VisitaMedica.fecha_visita.desc()).all()


@app.get("/visitas/{id_visita}", response_model=VisitaMedicaOut)
def obtener_visita(id_visita: int, db: Session = Depends(get_db)):
    visita = db.query(VisitaMedica).filter(VisitaMedica.id_visita == id_visita).first()
    if not visita:
        raise HTTPException(status_code=404, detail="Visita médica no encontrada")
    return visita


@app.get("/visitas/residente/{id_residente}", response_model=List[VisitaMedicaOut])
def historial_por_residente(id_residente: int, db: Session = Depends(get_db)):
    """Ficha médica completa (historial) de un residente, para la vista
    'Historial Médico' del frontend."""
    return (
        db.query(VisitaMedica)
        .filter(VisitaMedica.id_residente == id_residente)
        .order_by(VisitaMedica.fecha_visita.desc())
        .all()
    )


@app.put("/visitas/{id_visita}", response_model=VisitaMedicaOut)
def actualizar_visita(id_visita: int, datos: VisitaMedicaUpdate, db: Session = Depends(get_db)):
    visita = db.query(VisitaMedica).filter(VisitaMedica.id_visita == id_visita).first()
    if not visita:
        raise HTTPException(status_code=404, detail="Visita médica no encontrada")

    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(visita, campo, valor)

    db.commit()
    db.refresh(visita)
    return visita


@app.delete("/visitas/{id_visita}", status_code=204)
def eliminar_visita(id_visita: int, db: Session = Depends(get_db)):
    visita = db.query(VisitaMedica).filter(VisitaMedica.id_visita == id_visita).first()
    if not visita:
        raise HTTPException(status_code=404, detail="Visita médica no encontrada")
    db.delete(visita)
    db.commit()
    return None
