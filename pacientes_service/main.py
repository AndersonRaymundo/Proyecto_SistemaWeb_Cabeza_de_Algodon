"""
Microservicio: Pacientes (Residentes)
Asilo Cabeza de Algodón

Lo consume la aplicación web (AsiloWeb) a través de /api/Pacientes, que reenvía
las peticiones a estas rutas por la red interna:
  GET  /api/Residentes
  GET  /api/Residentes/busqueda/autocomplete?q=texto
  GET  /api/Residentes/{id}
  POST /api/Residentes
  PUT  /api/Residentes/{id}

Un residente no se borra: se da de baja cambiando su estado, para conservar su historial.
Puerto: 8000
"""
import os
from datetime import datetime, date
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from sqlalchemy import create_engine, Column, Integer, String, Date, DateTime, Boolean, or_, func, inspect, text
from sqlalchemy.schema import CreateColumn
from sqlalchemy.orm import sessionmaker, declarative_base, Session

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


class Residente(Base):
    __tablename__ = "TBL_PACIENTES"

    id_residente = Column("id_paciente", Integer, primary_key=True, index=True, autoincrement=True)
    no_expediente = Column("expediente_no", String(50), nullable=False)
    nombre_completo = Column("nombre_completo", String(200), nullable=False)
    fecha_nacimiento = Column("fecha_nacimiento", Date, nullable=False)
    fecha_ingreso = Column("fecha_ingreso", DateTime, default=datetime.now, nullable=True)
    patologia = Column("patologia", String(255), nullable=True)
    nombre_tutor = Column("nombre_tutor", String(200), nullable=False)
    telefono_tutor = Column("telefono_tutor", String(50), nullable=False)
    correo_tutor = Column("correo_tutor", String(150), nullable=True)
    parentesco_tutor = Column("parentesco_tutor", String(60), nullable=True)
    telefono_alterno = Column("telefono_alterno", String(50), nullable=True)
    estado = Column("estado", Boolean, default=True)

# Esquemas Pydantic--------------------------------------

class ResidenteBase(BaseModel):
    noExpediente: str
    nombreCompleto: str
    fechaNacimiento: date
    fechaIngreso: Optional[date] = None
    patologia: Optional[str] = None
    nombreTutor: str
    telefonoTutor: str
    correoTutor: Optional[str] = None
    parentescoTutor: Optional[str] = None
    telefonoAlterno: Optional[str] = None
    estado: bool = True


class ResidenteCreate(ResidenteBase):
    pass


class ResidenteUpdate(BaseModel):
    noExpediente: Optional[str] = None
    nombreCompleto: Optional[str] = None
    fechaNacimiento: Optional[date] = None
    patologia: Optional[str] = None
    nombreTutor: Optional[str] = None
    telefonoTutor: Optional[str] = None
    correoTutor: Optional[str] = None
    parentescoTutor: Optional[str] = None
    telefonoAlterno: Optional[str] = None
    estado: Optional[bool] = None


class ResidenteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    idResidente: int
    noExpediente: str
    nombreCompleto: str
    fechaNacimiento: date
    fechaIngreso: Optional[datetime] = None
    patologia: Optional[str] = None
    nombreTutor: str
    telefonoTutor: str
    correoTutor: Optional[str] = None
    parentescoTutor: Optional[str] = None
    telefonoAlterno: Optional[str] = None
    estado: bool

    @classmethod
    def from_orm_model(cls, r: "Residente") -> "ResidenteOut":
        return cls(
            idResidente=r.id_residente,
            noExpediente=r.no_expediente,
            nombreCompleto=r.nombre_completo,
            fechaNacimiento=r.fecha_nacimiento,
            fechaIngreso=r.fecha_ingreso,
            patologia=r.patologia,
            nombreTutor=r.nombre_tutor,
            telefonoTutor=r.telefono_tutor,
            correoTutor=r.correo_tutor,
            parentescoTutor=r.parentesco_tutor,
            telefonoAlterno=r.telefono_alterno,
            estado=bool(r.estado),
        )

def validar_expediente_libre(db: Session, expediente: str, excluir_id: Optional[int] = None):
    """Cada residente debe tener un numero de expediente distinto."""
    consulta = db.query(Residente).filter(func.lower(Residente.no_expediente) == expediente.strip().lower())
    if excluir_id is not None:
        consulta = consulta.filter(Residente.id_residente != excluir_id)
    if consulta.first():
        raise HTTPException(
            status_code=409,
            detail=f"Ya existe un residente con el expediente {expediente.strip()}. Cada residente debe tener un número de expediente distinto.",
        )

EDAD_MAXIMA = 120


def validar_fecha_nacimiento(fecha: date):
    """Que la fecha de nacimiento no sea futura ni de mas de 120 anios."""
    hoy = date.today()
    edad = hoy.year - fecha.year - ((hoy.month, hoy.day) < (fecha.month, fecha.day))
    if fecha > hoy or edad > EDAD_MAXIMA:
        raise HTTPException(
            status_code=422,
            detail=f"La fecha de nacimiento no es válida: la edad debe estar entre 0 y {EDAD_MAXIMA} años.",
        )

def siguiente_expediente(db: Session) -> str:
    """Siguiente numero libre del anio en curso, con el formato EXP-AAAA-NNN."""
    prefijo = f"EXP-{datetime.now().year}-"
    usados = [fila[0] for fila in db.query(Residente.no_expediente).filter(Residente.no_expediente.like(prefijo + "%")).all()]
    numeros = []
    for expediente in usados:
        resto = (expediente or "").strip()[len(prefijo):]
        if resto.isdigit():
            numeros.append(int(resto))
    return f"{prefijo}{(max(numeros) if numeros else 0) + 1:03d}"

# App------------------------

app = FastAPI(title="Pacientes Service - Cabeza de Algodón")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def asegurar_columnas():
    """create_all solo crea las tablas que faltan. Si TBL_PACIENTES ya existia de una version anterior,
    agrega las columnas nuevas (parentesco y telefono alterno) sin tocar los datos."""
    inspector = inspect(engine)
    tabla = Residente.__tablename__
    if not inspector.has_table(tabla):
        return
    existentes = {columna["name"] for columna in inspector.get_columns(tabla)}
    with engine.begin() as conexion:
        for columna in Residente.__table__.columns:
            if columna.name not in existentes:
                definicion = CreateColumn(columna).compile(dialect=engine.dialect)
                conexion.execute(text(f"ALTER TABLE {tabla} ADD {definicion}"))


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    asegurar_columnas()


@app.get("/")
def read_root():
    return {"status": "Pacientes service running"}


@app.get("/api/Residentes", response_model=List[ResidenteOut])
def listar_residentes(db: Session = Depends(get_db)):
    residentes = db.query(Residente).order_by(Residente.nombre_completo).all()
    return [ResidenteOut.from_orm_model(r) for r in residentes]


@app.get("/api/Residentes/busqueda/autocomplete")
def buscar_residentes(q: str = "", db: Session = Depends(get_db)):
    if not q:
        return []

    q_clean = q.strip()
    
    residentes = db.query(Residente).filter(
        or_(
            Residente.nombre_completo.contains(q_clean),
            Residente.no_expediente.contains(q_clean)
        )
    ).limit(10).all()

    return [
        {
            "id": r.id_residente,
            "text": f"{r.no_expediente} - {r.nombre_completo}"
        } 
        for r in residentes
    ]


@app.get("/api/Residentes/siguiente-expediente")
def obtener_siguiente_expediente(db: Session = Depends(get_db)):
    # Debe declararse antes de /api/Residentes/{id_residente}, o "siguiente-expediente" se leeria como un id
    return {"noExpediente": siguiente_expediente(db)}


@app.get("/api/Residentes/{id_residente}", response_model=ResidenteOut)
def obtener_residente(id_residente: int, db: Session = Depends(get_db)):
    residente = db.query(Residente).filter(Residente.id_residente == id_residente).first()
    if not residente:
        raise HTTPException(status_code=404, detail="Residente no encontrado")
    return ResidenteOut.from_orm_model(residente)


@app.post("/api/Residentes", response_model=ResidenteOut, status_code=201)
def crear_residente(datos: ResidenteCreate, db: Session = Depends(get_db)):
    # Si no se envia expediente, se asigna el siguiente automaticamente
    expediente = datos.noExpediente.strip() or siguiente_expediente(db)
    validar_expediente_libre(db, expediente)
    validar_fecha_nacimiento(datos.fechaNacimiento)
    if not (datos.parentescoTutor or "").strip():
        raise HTTPException(status_code=422, detail="Indique el parentesco del familiar con el residente.")
    if datos.fechaIngreso:
        fecha_ing_dt = datetime.combine(datos.fechaIngreso, datetime.min.time())
    else:
        fecha_ing_dt = datetime.now()
    nuevo = Residente(
        no_expediente=expediente,
        nombre_completo=datos.nombreCompleto,
        fecha_nacimiento=datos.fechaNacimiento,
        fecha_ingreso=fecha_ing_dt,
        patologia=datos.patologia,
        nombre_tutor=datos.nombreTutor,
        telefono_tutor=datos.telefonoTutor,
        correo_tutor=datos.correoTutor,
        parentesco_tutor=(datos.parentescoTutor or "").strip() or None,
        telefono_alterno=(datos.telefonoAlterno or "").strip() or None,
        estado=datos.estado,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return ResidenteOut.from_orm_model(nuevo)


@app.put("/api/Residentes/{id_residente}", response_model=ResidenteOut)
def actualizar_residente(id_residente: int, datos: ResidenteUpdate, db: Session = Depends(get_db)):
    residente = db.query(Residente).filter(Residente.id_residente == id_residente).first()
    if not residente:
        raise HTTPException(status_code=404, detail="Residente no encontrado")

    mapa_campos = {
        "noExpediente": "no_expediente",
        "nombreCompleto": "nombre_completo",
        "fechaNacimiento": "fecha_nacimiento",
        "patologia": "patologia",
        "nombreTutor": "nombre_tutor",
        "telefonoTutor": "telefono_tutor",
        "correoTutor": "correo_tutor",
        "parentescoTutor": "parentesco_tutor",
        "telefonoAlterno": "telefono_alterno",
        "estado": "estado",
    }
    cambios = datos.model_dump(exclude_unset=True)
    if cambios.get("noExpediente") is not None:
        validar_expediente_libre(db, cambios["noExpediente"], id_residente)
        cambios["noExpediente"] = cambios["noExpediente"].strip()
    if cambios.get("fechaNacimiento") is not None:
        validar_fecha_nacimiento(cambios["fechaNacimiento"])
    for campo_entrada, valor in cambios.items():
        setattr(residente, mapa_campos[campo_entrada], valor)

    db.commit()
    db.refresh(residente)
    return ResidenteOut.from_orm_model(residente)
