"""
Microservicio: Pacientes (Residentes)
Asilo Cabeza de Algodón

Rutas iguales a las que ya llama wwwroot/JS/pacientes.js:
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
from sqlalchemy import create_engine, Column, Integer, String, Date, DateTime, Boolean, or_
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
    fecha_ingreso = Column("fecha_ingreso", DateTime, default=datetime.utcnow, nullable=True)
    patologia = Column("patologia", String(255), nullable=True)
    nombre_tutor = Column("nombre_tutor", String(200), nullable=False)
    telefono_tutor = Column("telefono_tutor", String(50), nullable=False)
    correo_tutor = Column("correo_tutor", String(150), nullable=True)
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

# App------------------------

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
    Base.metadata.create_all(bind=engine)


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