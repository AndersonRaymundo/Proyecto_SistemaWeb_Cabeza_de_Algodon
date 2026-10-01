"""
Microservicio: Solicitudes y Citas
Asilo Cabeza de Algodón

El médico general crea una "solicitud" para remitir a un residente con un
especialista, asignando el enfermero(a) que lo acompañará. Esa solicitud
aparece en un módulo que ve la Fundación, quienes asignan fecha/hora y
médico. Cuando el médico especialista atiende, la solicitud pasa a
"Atendida" (y desde el frontend/backend se crea la visita médica
correspondiente en el servicio de Historial Médico).

También dispara un correo al familiar del residente (a través del
email_service que ya tienes) cuando se crea la solicitud, tal como pide el
enunciado ("funcionalidad adicional").

Puerto sugerido: 8004
"""
import os
from datetime import datetime
from typing import Optional, List

import httpx
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base, Session

# Ver la nota sobre autenticación SQL Server (usuario/contraseña vs
# Trusted_Connection) en historial_medico_service/main.py: aplica igual aquí.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mssql+pyodbc://usuario:password@localhost,1433/AsiloCabezaAlgodon"
    "?driver=ODBC+Driver+17+for+SQL+Server&TrustServerCertificate=yes",
)

# URL interna del microservicio de correo (nombre del servicio en docker-compose)
EMAIL_SERVICE_URL = os.getenv("EMAIL_SERVICE_URL", "http://email_service:8001")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class Solicitud(Base):
    __tablename__ = "Solicitudes"

    id_solicitud = Column("id_solicitud", Integer, primary_key=True, index=True, autoincrement=True)
    id_residente = Column("id_residente", Integer, nullable=False, index=True)
    especialidad_solicitada = Column("especialidad_solicitada", String(150), nullable=False)
    motivo_remision = Column("motivo_remision", Text, nullable=False)
    enfermero_asignado = Column("enfermero_asignado", String(150), nullable=True)
    medico_general = Column("medico_general", String(150), nullable=True)
    fecha_solicitud = Column("fecha_solicitud", DateTime, default=datetime.utcnow)
    fecha_hora_cita = Column("fecha_hora_cita", DateTime, nullable=True)
    medico_asignado = Column("medico_asignado", String(150), nullable=True)
    # Pendiente -> Agendada -> Atendida  (o Cancelada)
    estado = Column("estado", String(30), default="Pendiente")
    correo_familiar = Column("correo_familiar", String(150), nullable=True)


class SolicitudBase(BaseModel):
    id_residente: int
    especialidad_solicitada: str
    motivo_remision: str
    enfermero_asignado: Optional[str] = None
    medico_general: Optional[str] = None
    correo_familiar: Optional[str] = None


class SolicitudCreate(SolicitudBase):
    # Si el formulario ya trae fecha/hora y médico asignado, la solicitud se
    # crea directamente como "Agendada" en un solo paso.
    fecha_hora_cita: Optional[datetime] = None
    medico_asignado: Optional[str] = None


class SolicitudAgendar(BaseModel):
    fecha_hora_cita: datetime
    medico_asignado: str


class SolicitudUpdateEstado(BaseModel):
    estado: str  # Pendiente | Agendada | Atendida | Cancelada


class SolicitudOut(SolicitudBase):
    model_config = ConfigDict(from_attributes=True)
    id_solicitud: int
    fecha_solicitud: datetime
    fecha_hora_cita: Optional[datetime] = None
    medico_asignado: Optional[str] = None
    estado: str


app = FastAPI(title="Solicitudes y Citas Service - Cabeza de Algodón")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


@app.get("/")
def read_root():
    return {"status": "Solicitudes y Citas service running"}


async def notificar_familiar(solicitud: Solicitud):
    """Llama al email_service para avisar al familiar. Si falla, no rompe
    la creación de la solicitud (solo se registra el error)."""
    if not solicitud.correo_familiar:
        return
    payload = {
        "recipient": solicitud.correo_familiar,
        "subject": "Actualización del estado de su familiar - Asilo Cabeza de Algodón",
        "body": (
            f"Se ha creado una solicitud médica para el residente (ID {solicitud.id_residente}). "
            f"Fue referido a la especialidad de {solicitud.especialidad_solicitada}. "
            "Le mantendremos informado sobre la fecha y médico asignado."
        ),
    }
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(f"{EMAIL_SERVICE_URL}/send-email", json=payload)
    except Exception as exc:  # no interrumpe el flujo principal
        print(f"[aviso] No se pudo enviar el correo de notificación: {exc}")


@app.post("/solicitudes", response_model=SolicitudOut, status_code=201)
async def crear_solicitud(solicitud: SolicitudCreate, db: Session = Depends(get_db)):
    datos = solicitud.model_dump()
    fecha_hora_cita = datos.pop("fecha_hora_cita", None)
    medico_asignado = datos.pop("medico_asignado", None)

    nueva = Solicitud(**datos)
    if fecha_hora_cita and medico_asignado:
        nueva.fecha_hora_cita = fecha_hora_cita
        nueva.medico_asignado = medico_asignado
        nueva.estado = "Agendada"

    db.add(nueva)
    db.commit()
    db.refresh(nueva)

    await notificar_familiar(nueva)
    return nueva


@app.get("/solicitudes", response_model=List[SolicitudOut])
def listar_solicitudes(estado: Optional[str] = None, db: Session = Depends(get_db)):
    """Módulo que consulta la Fundación: lista todas las solicitudes,
    opcionalmente filtradas por estado (?estado=Pendiente)."""
    query = db.query(Solicitud)
    if estado:
        query = query.filter(Solicitud.estado == estado)
    return query.order_by(Solicitud.fecha_solicitud.desc()).all()


@app.get("/solicitudes/{id_solicitud}", response_model=SolicitudOut)
def obtener_solicitud(id_solicitud: int, db: Session = Depends(get_db)):
    solicitud = db.query(Solicitud).filter(Solicitud.id_solicitud == id_solicitud).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    return solicitud


@app.get("/solicitudes/residente/{id_residente}", response_model=List[SolicitudOut])
def solicitudes_por_residente(id_residente: int, db: Session = Depends(get_db)):
    return (
        db.query(Solicitud)
        .filter(Solicitud.id_residente == id_residente)
        .order_by(Solicitud.fecha_solicitud.desc())
        .all()
    )


@app.put("/solicitudes/{id_solicitud}/agendar", response_model=SolicitudOut)
def agendar_cita(id_solicitud: int, datos: SolicitudAgendar, db: Session = Depends(get_db)):
    """La Fundación usa este endpoint para asignar horario y médico."""
    solicitud = db.query(Solicitud).filter(Solicitud.id_solicitud == id_solicitud).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    solicitud.fecha_hora_cita = datos.fecha_hora_cita
    solicitud.medico_asignado = datos.medico_asignado
    solicitud.estado = "Agendada"
    db.commit()
    db.refresh(solicitud)
    return solicitud


@app.put("/solicitudes/{id_solicitud}/estado", response_model=SolicitudOut)
def cambiar_estado(id_solicitud: int, datos: SolicitudUpdateEstado, db: Session = Depends(get_db)):
    solicitud = db.query(Solicitud).filter(Solicitud.id_solicitud == id_solicitud).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    solicitud.estado = datos.estado
    db.commit()
    db.refresh(solicitud)
    return solicitud


@app.delete("/solicitudes/{id_solicitud}", status_code=204)
def eliminar_solicitud(id_solicitud: int, db: Session = Depends(get_db)):
    solicitud = db.query(Solicitud).filter(Solicitud.id_solicitud == id_solicitud).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    db.delete(solicitud)
    db.commit()
    return None
