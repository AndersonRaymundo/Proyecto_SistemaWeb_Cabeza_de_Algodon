"""
Microservicio: Laboratorio y Farmacia
Asilo Cabeza de Algodón

Registra los exámenes de laboratorio solicitados/realizados a un residente
(con su resultado y costo con descuento de fundación) y las recetas /
despachos de farmacia (medicamento, dosis y costo a cargo familiar), tal
como pide la vista "Lab y Farmacia" del frontend.

Puerto sugerido: 8005
"""
import os
from datetime import datetime
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, DECIMAL
from sqlalchemy.orm import sessionmaker, declarative_base, Session

# Ver la nota sobre autenticación SQL Server en historial_medico_service/main.py
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


class ExamenLaboratorio(Base):
    __tablename__ = "ExamenesLaboratorio"

    id_examen = Column("id_examen", Integer, primary_key=True, index=True, autoincrement=True)
    id_visita = Column("id_visita", Integer, nullable=True, index=True)  # visita médica que lo originó
    id_residente = Column("id_residente", Integer, nullable=False, index=True)
    nombre_examen = Column("nombre_examen", String(200), nullable=False)
    resultados = Column("resultados", Text, nullable=True)
    costo = Column("costo", DECIMAL(10, 2), nullable=False, default=0)
    fecha_examen = Column("fecha_examen", DateTime, default=datetime.utcnow)
    estado = Column("estado", String(30), default="Pendiente")  # Pendiente | Realizado


class RecetaFarmacia(Base):
    __tablename__ = "RecetasFarmacia"

    id_receta = Column("id_receta", Integer, primary_key=True, index=True, autoincrement=True)
    id_visita = Column("id_visita", Integer, nullable=True, index=True)
    id_residente = Column("id_residente", Integer, nullable=False, index=True)
    medicamento = Column("medicamento", String(255), nullable=False)
    dosis_instrucciones = Column("dosis_instrucciones", String(255), nullable=True)
    cantidad = Column("cantidad", String(100), nullable=True)
    costo = Column("costo", DECIMAL(10, 2), nullable=False, default=0)
    fecha_despacho = Column("fecha_despacho", DateTime, default=datetime.utcnow)


# --------------------------- Esquemas Pydantic ------------------------------
class ExamenBase(BaseModel):
    id_visita: Optional[int] = None
    id_residente: int
    nombre_examen: str
    resultados: Optional[str] = None
    costo: float = 0
    estado: Optional[str] = "Pendiente"


class ExamenCreate(ExamenBase):
    pass


class ExamenUpdate(BaseModel):
    resultados: Optional[str] = None
    costo: Optional[float] = None
    estado: Optional[str] = None


class ExamenOut(ExamenBase):
    model_config = ConfigDict(from_attributes=True)
    id_examen: int
    fecha_examen: datetime


class RecetaBase(BaseModel):
    id_visita: Optional[int] = None
    id_residente: int
    medicamento: str
    dosis_instrucciones: Optional[str] = None
    cantidad: Optional[str] = None
    costo: float = 0


class RecetaCreate(RecetaBase):
    pass


class RecetaOut(RecetaBase):
    model_config = ConfigDict(from_attributes=True)
    id_receta: int
    fecha_despacho: datetime


class RegistroCompleto(BaseModel):
    """Coincide con el formulario único de la vista 'laboratorio-farmacia.cshtml',
    que registra examen y receta al mismo tiempo."""
    id_visita: Optional[int] = None
    id_residente: int
    nombre_examen: Optional[str] = None
    resultados: Optional[str] = None
    costo_examen: Optional[float] = 0
    medicamento: Optional[str] = None
    dosis_instrucciones: Optional[str] = None
    cantidad: Optional[str] = None
    costo_medicamento: Optional[float] = 0


class RegistroCompletoOut(BaseModel):
    examen: Optional[ExamenOut] = None
    receta: Optional[RecetaOut] = None


# --------------------------------- App --------------------------------------
app = FastAPI(title="Laboratorio y Farmacia Service - Cabeza de Algodón")

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
    return {"status": "Laboratorio y Farmacia service running"}


# ---- Exámenes de laboratorio ----
@app.post("/examenes", response_model=ExamenOut, status_code=201)
def crear_examen(examen: ExamenCreate, db: Session = Depends(get_db)):
    nuevo = ExamenLaboratorio(**examen.model_dump())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@app.get("/examenes", response_model=List[ExamenOut])
def listar_examenes(db: Session = Depends(get_db)):
    return db.query(ExamenLaboratorio).order_by(ExamenLaboratorio.fecha_examen.desc()).all()


@app.get("/examenes/residente/{id_residente}", response_model=List[ExamenOut])
def examenes_por_residente(id_residente: int, db: Session = Depends(get_db)):
    return (
        db.query(ExamenLaboratorio)
        .filter(ExamenLaboratorio.id_residente == id_residente)
        .order_by(ExamenLaboratorio.fecha_examen.desc())
        .all()
    )


@app.put("/examenes/{id_examen}", response_model=ExamenOut)
def actualizar_examen(id_examen: int, datos: ExamenUpdate, db: Session = Depends(get_db)):
    examen = db.query(ExamenLaboratorio).filter(ExamenLaboratorio.id_examen == id_examen).first()
    if not examen:
        raise HTTPException(status_code=404, detail="Examen no encontrado")
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(examen, campo, valor)
    db.commit()
    db.refresh(examen)
    return examen


# ---- Recetas / Farmacia ----
@app.post("/recetas", response_model=RecetaOut, status_code=201)
def crear_receta(receta: RecetaCreate, db: Session = Depends(get_db)):
    nueva = RecetaFarmacia(**receta.model_dump())
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


@app.get("/recetas", response_model=List[RecetaOut])
def listar_recetas(db: Session = Depends(get_db)):
    return db.query(RecetaFarmacia).order_by(RecetaFarmacia.fecha_despacho.desc()).all()


@app.get("/recetas/residente/{id_residente}", response_model=List[RecetaOut])
def recetas_por_residente(id_residente: int, db: Session = Depends(get_db)):
    return (
        db.query(RecetaFarmacia)
        .filter(RecetaFarmacia.id_residente == id_residente)
        .order_by(RecetaFarmacia.fecha_despacho.desc())
        .all()
    )


# ---- Endpoint combinado: coincide 1 a 1 con el formulario del frontend ----
@app.post("/registro-completo", response_model=RegistroCompletoOut, status_code=201)
def registrar_examen_y_farmacia(datos: RegistroCompleto, db: Session = Depends(get_db)):
    examen_creado = None
    receta_creada = None

    if datos.nombre_examen:
        examen_creado = ExamenLaboratorio(
            id_visita=datos.id_visita,
            id_residente=datos.id_residente,
            nombre_examen=datos.nombre_examen,
            resultados=datos.resultados,
            costo=datos.costo_examen or 0,
            estado="Realizado" if datos.resultados else "Pendiente",
        )
        db.add(examen_creado)

    if datos.medicamento:
        receta_creada = RecetaFarmacia(
            id_visita=datos.id_visita,
            id_residente=datos.id_residente,
            medicamento=datos.medicamento,
            dosis_instrucciones=datos.dosis_instrucciones,
            cantidad=datos.cantidad,
            costo=datos.costo_medicamento or 0,
        )
        db.add(receta_creada)

    if not examen_creado and not receta_creada:
        raise HTTPException(
            status_code=400,
            detail="Debe incluir al menos un examen o un medicamento.",
        )

    db.commit()
    if examen_creado:
        db.refresh(examen_creado)
    if receta_creada:
        db.refresh(receta_creada)

    return RegistroCompletoOut(examen=examen_creado, receta=receta_creada)
