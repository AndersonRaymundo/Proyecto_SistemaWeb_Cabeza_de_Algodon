"""
Microservicio: Pacientes (Residentes)
Asilo Cabeza de Algodón

CRUD real sobre la tabla "TBL_PACIENTES" del ERD oficial del proyecto,
en la base SQL Server AsiloCabezaAlgodon. Junto con pdf_service y
email_service, es uno de los 3 microservicios que sí se mantienen como
tales (arquitectura MVC en capas + microservicios auxiliares, según el
documento de Diseño Arquitectónico del proyecto). Todo lo demás
(historial médico, citas, laboratorio/farmacia, caja, login) vive dentro
del backend .NET con Entity Framework.

Rutas iguales a las que ya llama tu wwwroot/JS/pacientes.js:
  GET    /api/Residentes
  GET    /api/Residentes/{id}
  POST   /api/Residentes
  PUT    /api/Residentes/{id}
  DELETE /api/Residentes/{id}

Puerto: 8000 (igual al que ya usa pacientes.js)
"""
import os
from datetime import datetime, date
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from sqlalchemy import create_engine, Column, Integer, String, Date, DateTime, Boolean
from sqlalchemy.orm import sessionmaker, declarative_base, Session

# Ver la nota sobre autenticación SQL Server (usuario/contraseña vs
# Trusted_Connection) en los otros microservicios: aplica igual aquí.
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
# Modelo — mismos nombres de tabla/columnas que BackendAsilo.Models.Residente
# ---------------------------------------------------------------------------
class Residente(Base):
    __tablename__ = "TBL_PACIENTES"

    id_residente = Column("id_paciente", Integer, primary_key=True, index=True, autoincrement=True)
    no_expediente = Column("expediente_no", String(50), nullable=False)
    nombre_completo = Column("nombre_completo", String(200), nullable=False)
    fecha_nacimiento = Column("fecha_nacimiento", Date, nullable=False)
    fecha_ingreso = Column("fecha_ingreso", DateTime, default=datetime.utcnow, nullable=True)
    patologia = Column("patologia", String(255), nullable=True)
    nombre_tutor = Column("nombre_tutor", String(200), nullable=False)
    telefono_tutor = Column("telefono_tutor", String(50), nullable=False)
    correo_tutor = Column("correo_tutor", String(150), nullable=True)
    estado = Column("estado", Boolean, default=True)


# ---------------------------------------------------------------------------
# Esquemas Pydantic (nombres en camelCase para calzar con lo que ya manda/lee
# pacientes.js: noExpediente, nombreCompleto, fechaNacimiento, etc.)
# ---------------------------------------------------------------------------
class ResidenteBase(BaseModel):
    noExpediente: str
    nombreCompleto: str
    fechaNacimiento: date
    fechaIngreso: Optional[date] = None
    patologia: Optional[str] = None
    nombreTutor: str
    telefonoTutor: str
    correoTutor: Optional[str] = None
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
    estado: bool

    # Mapea los nombres de columna en snake_case del modelo ORM hacia el
    # camelCase que espera el frontend.
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
            estado=bool(r.estado),
        )


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="Pacientes Service - Cabeza de Algodón")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    # No borra ni recrea la tabla si ya existe (la creó EF Core, por ejemplo);
    # solo la crea si todavía no existe.
    Base.metadata.create_all(bind=engine)


@app.get("/")
def read_root():
    return {"status": "Pacientes service running"}


@app.get("/api/Residentes", response_model=List[ResidenteOut])
def listar_residentes(db: Session = Depends(get_db)):
    residentes = db.query(Residente).order_by(Residente.nombre_completo).all()
    return [ResidenteOut.from_orm_model(r) for r in residentes]


@app.get("/api/Residentes/{id_residente}", response_model=ResidenteOut)
def obtener_residente(id_residente: int, db: Session = Depends(get_db)):
    residente = db.query(Residente).filter(Residente.id_residente == id_residente).first()
    if not residente:
        raise HTTPException(status_code=404, detail="Residente no encontrado")
    return ResidenteOut.from_orm_model(residente)


@app.post("/api/Residentes", response_model=ResidenteOut, status_code=201)
def crear_residente(datos: ResidenteCreate, db: Session = Depends(get_db)):
    if datos.fechaIngreso:
        fecha_ing_dt = datetime.combine(datos.fechaIngreso, datetime.min.time())
    else:
        fecha_ing_dt = datetime.now()
    nuevo = Residente(
        no_expediente=datos.noExpediente,
        nombre_completo=datos.nombreCompleto,
        fecha_nacimiento=datos.fechaNacimiento,
        fecha_ingreso=fecha_ing_dt,
        patologia=datos.patologia,
        nombre_tutor=datos.nombreTutor,
        telefono_tutor=datos.telefonoTutor,
        correo_tutor=datos.correoTutor,
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
        "estado": "estado",
    }
    for campo_entrada, valor in datos.model_dump(exclude_unset=True).items():
        setattr(residente, mapa_campos[campo_entrada], valor)

    db.commit()
    db.refresh(residente)
    return ResidenteOut.from_orm_model(residente)


@app.delete("/api/Residentes/{id_residente}", status_code=204)
def eliminar_residente(id_residente: int, db: Session = Depends(get_db)):
    residente = db.query(Residente).filter(Residente.id_residente == id_residente).first()
    if not residente:
        raise HTTPException(status_code=404, detail="Residente no encontrado")
    db.delete(residente)
    db.commit()
    return None
