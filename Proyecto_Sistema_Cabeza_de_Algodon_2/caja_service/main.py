"""
Microservicio: Caja, Donaciones y Finanzas
Asilo Cabeza de Algodón

Controla:
  - Donaciones (empresas, gobierno, particulares, etc.)
  - Cobros a la cuenta del familiar (mensualidad, consulta, laboratorio,
    farmacia) con el descuento de la fundación ya aplicado
  - Gastos del asilo (luz, agua, etc.)
  - Un resumen para poder fiscalizar entradas/salidas y saber qué cuentas
    de familiares están pendientes de pago.

Puerto sugerido: 8006
"""
import os
from datetime import datetime
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from sqlalchemy import create_engine, Column, Integer, String, DateTime, DECIMAL, func
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


class Donacion(Base):
    __tablename__ = "Donaciones"

    id_donacion = Column("id_donacion", Integer, primary_key=True, index=True, autoincrement=True)
    # Empresa Nacional | Empresa Internacional | Gobierno | Particular
    tipo_donante = Column("tipo_donante", String(50), nullable=False)
    nombre_donante = Column("nombre_donante", String(200), nullable=False)
    monto = Column("monto", DECIMAL(10, 2), nullable=False)
    concepto = Column("concepto", String(255), nullable=True)
    fecha = Column("fecha", DateTime, default=datetime.utcnow)


class Cobro(Base):
    __tablename__ = "Cobros"

    id_cobro = Column("id_cobro", Integer, primary_key=True, index=True, autoincrement=True)
    id_residente = Column("id_residente", Integer, nullable=False, index=True)
    # Mensualidad | Consulta | Laboratorio | Farmacia | Otro
    tipo = Column("tipo", String(50), nullable=False)
    concepto = Column("concepto", String(255), nullable=False)
    monto = Column("monto", DECIMAL(10, 2), nullable=False)
    fecha = Column("fecha", DateTime, default=datetime.utcnow)
    estado = Column("estado", String(30), default="Pendiente")  # Pendiente | Pagado


class Gasto(Base):
    __tablename__ = "Gastos"

    id_gasto = Column("id_gasto", Integer, primary_key=True, index=True, autoincrement=True)
    concepto = Column("concepto", String(255), nullable=False)  # ej. luz, agua
    monto = Column("monto", DECIMAL(10, 2), nullable=False)
    fecha = Column("fecha", DateTime, default=datetime.utcnow)


class PagoFundacion(Base):
    """Lo que el asilo le debe/paga a la fundación por consultas, exámenes
    y medicamentos consumidos, para el reporte 'Pagos a la fundación'."""
    __tablename__ = "PagosFundacion"

    id_pago = Column("id_pago", Integer, primary_key=True, index=True, autoincrement=True)
    concepto = Column("concepto", String(255), nullable=False)
    monto = Column("monto", DECIMAL(10, 2), nullable=False)
    fecha = Column("fecha", DateTime, default=datetime.utcnow)
    estado = Column("estado", String(30), default="Pendiente")


# --------------------------- Esquemas Pydantic ------------------------------
class DonacionBase(BaseModel):
    tipo_donante: str
    nombre_donante: str
    monto: float
    concepto: Optional[str] = None


class DonacionCreate(DonacionBase):
    pass


class DonacionOut(DonacionBase):
    model_config = ConfigDict(from_attributes=True)
    id_donacion: int
    fecha: datetime


class CobroBase(BaseModel):
    id_residente: int
    tipo: str
    concepto: str
    monto: float
    estado: Optional[str] = "Pendiente"


class CobroCreate(CobroBase):
    pass


class CobroUpdateEstado(BaseModel):
    estado: str  # Pendiente | Pagado


class CobroOut(CobroBase):
    model_config = ConfigDict(from_attributes=True)
    id_cobro: int
    fecha: datetime


class GastoBase(BaseModel):
    concepto: str
    monto: float


class GastoCreate(GastoBase):
    pass


class GastoOut(GastoBase):
    model_config = ConfigDict(from_attributes=True)
    id_gasto: int
    fecha: datetime


class PagoFundacionBase(BaseModel):
    concepto: str
    monto: float
    estado: Optional[str] = "Pendiente"


class PagoFundacionCreate(PagoFundacionBase):
    pass


class PagoFundacionOut(PagoFundacionBase):
    model_config = ConfigDict(from_attributes=True)
    id_pago: int
    fecha: datetime


class ResumenFinanciero(BaseModel):
    total_donaciones: float
    total_cobros_pagados: float
    total_cobros_pendientes: float
    total_gastos: float
    balance: float


# --------------------------------- App --------------------------------------
app = FastAPI(title="Caja y Finanzas Service - Cabeza de Algodón")

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
    return {"status": "Caja y Finanzas service running"}


# ---- Donaciones ----
@app.post("/donaciones", response_model=DonacionOut, status_code=201)
def crear_donacion(donacion: DonacionCreate, db: Session = Depends(get_db)):
    nueva = Donacion(**donacion.model_dump())
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


@app.get("/donaciones", response_model=List[DonacionOut])
def listar_donaciones(db: Session = Depends(get_db)):
    return db.query(Donacion).order_by(Donacion.fecha.desc()).all()


# ---- Cobros (cuenta del familiar) ----
@app.post("/cobros", response_model=CobroOut, status_code=201)
def crear_cobro(cobro: CobroCreate, db: Session = Depends(get_db)):
    nuevo = Cobro(**cobro.model_dump())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@app.get("/cobros", response_model=List[CobroOut])
def listar_cobros(estado: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Cobro)
    if estado:
        query = query.filter(Cobro.estado == estado)
    return query.order_by(Cobro.fecha.desc()).all()


@app.get("/cobros/residente/{id_residente}", response_model=List[CobroOut])
def cobros_por_residente(id_residente: int, db: Session = Depends(get_db)):
    """Cuenta de cobros de un residente/familiar, filtrable luego por
    rango de fecha desde el reporte."""
    return (
        db.query(Cobro)
        .filter(Cobro.id_residente == id_residente)
        .order_by(Cobro.fecha.desc())
        .all()
    )


@app.put("/cobros/{id_cobro}/estado", response_model=CobroOut)
def marcar_cobro(id_cobro: int, datos: CobroUpdateEstado, db: Session = Depends(get_db)):
    cobro = db.query(Cobro).filter(Cobro.id_cobro == id_cobro).first()
    if not cobro:
        raise HTTPException(status_code=404, detail="Cobro no encontrado")
    cobro.estado = datos.estado
    db.commit()
    db.refresh(cobro)
    return cobro


# ---- Gastos ----
@app.post("/gastos", response_model=GastoOut, status_code=201)
def crear_gasto(gasto: GastoCreate, db: Session = Depends(get_db)):
    nuevo = Gasto(**gasto.model_dump())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@app.get("/gastos", response_model=List[GastoOut])
def listar_gastos(db: Session = Depends(get_db)):
    return db.query(Gasto).order_by(Gasto.fecha.desc()).all()


# ---- Pagos a la fundación ----
@app.post("/pagos-fundacion", response_model=PagoFundacionOut, status_code=201)
def crear_pago_fundacion(pago: PagoFundacionCreate, db: Session = Depends(get_db)):
    nuevo = PagoFundacion(**pago.model_dump())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@app.get("/pagos-fundacion", response_model=List[PagoFundacionOut])
def listar_pagos_fundacion(db: Session = Depends(get_db)):
    return db.query(PagoFundacion).order_by(PagoFundacion.fecha.desc()).all()


# ---- Resumen para el módulo de reportes ----
@app.get("/resumen", response_model=ResumenFinanciero)
def resumen_financiero(db: Session = Depends(get_db)):
    total_donaciones = db.query(func.coalesce(func.sum(Donacion.monto), 0)).scalar()
    total_cobros_pagados = (
        db.query(func.coalesce(func.sum(Cobro.monto), 0))
        .filter(Cobro.estado == "Pagado")
        .scalar()
    )
    total_cobros_pendientes = (
        db.query(func.coalesce(func.sum(Cobro.monto), 0))
        .filter(Cobro.estado == "Pendiente")
        .scalar()
    )
    total_gastos = db.query(func.coalesce(func.sum(Gasto.monto), 0)).scalar()

    balance = float(total_donaciones) + float(total_cobros_pagados) - float(total_gastos)

    return ResumenFinanciero(
        total_donaciones=float(total_donaciones),
        total_cobros_pagados=float(total_cobros_pagados),
        total_cobros_pendientes=float(total_cobros_pendientes),
        total_gastos=float(total_gastos),
        balance=balance,
    )
