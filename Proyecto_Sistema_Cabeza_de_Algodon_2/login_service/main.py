"""
Microservicio: Login / Autenticación
Asilo Cabeza de Algodón

Controla el acceso al sistema y los roles que ya usa tu wwwroot/JS/roles.js
(ADMINISTRADOR, DOCTOR, ENFERMERO, FARMACIA) para mostrar/ocultar opciones
del menú.

- Las contraseñas se guardan con hash (bcrypt), nunca en texto plano.
- Al autenticar correctamente se entrega un token JWT simple que el frontend
  puede guardar (junto con rol y nombre) y mandar en futuras peticiones si
  luego quieres proteger los otros microservicios.
- Al arrancar por primera vez (si la tabla Usuarios está vacía) crea 4
  usuarios de prueba, uno por cada rol, para que puedas entrar sin tener que
  registrar nada a mano todavía:

    usuario: admin      contraseña: admin123      rol: ADMINISTRADOR
    usuario: doctor      contraseña: doctor123     rol: DOCTOR
    usuario: enfermero    contraseña: enfermero123  rol: ENFERMERO
    usuario: farmacia    contraseña: farmacia123   rol: FARMACIA

  Cámbialas (o bórralas) antes de entregar el proyecto.

Puerto sugerido: 8007
"""
import os
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from passlib.context import CryptContext
from jose import jwt

# Ver la nota sobre autenticación SQL Server (usuario/contraseña vs
# Trusted_Connection) en los otros microservicios: aplica igual aquí.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mssql+pyodbc://usuario:password@localhost,1433/AsiloCabezaAlgodon"
    "?driver=ODBC+Driver+17+for+SQL+Server&TrustServerCertificate=yes",
)

# Cambia esto por una clave larga y secreta propia antes de entregar/producción.
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "cambia-esta-clave-por-una-segura-para-el-proyecto")
ALGORITHM = "HS256"
TOKEN_EXPIRA_MINUTOS = 480  # 8 horas de jornada

ROLES_VALIDOS = {"ADMINISTRADOR", "DOCTOR", "ENFERMERO", "FARMACIA"}

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Modelo
# ---------------------------------------------------------------------------
class Usuario(Base):
    __tablename__ = "Usuarios"

    id_usuario = Column("id_usuario", Integer, primary_key=True, index=True, autoincrement=True)
    nombre_usuario = Column("nombre_usuario", String(100), unique=True, nullable=False, index=True)
    contrasena_hash = Column("contrasena_hash", String(255), nullable=False)
    nombre_completo = Column("nombre_completo", String(150), nullable=False)
    rol = Column("rol", String(30), nullable=False)  # ADMINISTRADOR | DOCTOR | ENFERMERO | FARMACIA
    correo = Column("correo", String(150), nullable=True)
    estado = Column("estado", Boolean, default=True)
    fecha_creacion = Column("fecha_creacion", DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# Esquemas
# ---------------------------------------------------------------------------
class LoginRequest(BaseModel):
    nombreUsuario: str
    contrasena: str


class LoginResponse(BaseModel):
    token: str
    idUsuario: int
    nombreUsuario: str
    nombreCompleto: str
    rol: str


class UsuarioCreate(BaseModel):
    nombreUsuario: str
    contrasena: str
    nombreCompleto: str
    rol: str
    correo: Optional[str] = None


class UsuarioUpdate(BaseModel):
    nombreCompleto: Optional[str] = None
    rol: Optional[str] = None
    correo: Optional[str] = None
    estado: Optional[bool] = None
    contrasena: Optional[str] = None  # si viene, se re-hashea


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    idUsuario: int
    nombreUsuario: str
    nombreCompleto: str
    rol: str
    correo: Optional[str] = None
    estado: bool

    @classmethod
    def from_orm_model(cls, u: "Usuario") -> "UsuarioOut":
        return cls(
            idUsuario=u.id_usuario,
            nombreUsuario=u.nombre_usuario,
            nombreCompleto=u.nombre_completo,
            rol=u.rol,
            correo=u.correo,
            estado=bool(u.estado),
        )


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="Login Service - Cabeza de Algodón")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def crear_token(usuario: Usuario) -> str:
    payload = {
        "sub": str(usuario.id_usuario),
        "nombreUsuario": usuario.nombre_usuario,
        "rol": usuario.rol,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRA_MINUTOS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

    # Sembrar usuarios de prueba solo si la tabla está vacía
    db = SessionLocal()
    try:
        if db.query(Usuario).count() == 0:
            usuarios_prueba = [
                ("admin", "admin123", "Administrador del Sistema", "ADMINISTRADOR"),
                ("doctor", "doctor123", "Dr. Raymundo", "DOCTOR"),
                ("enfermero", "enfermero123", "Licda. Sofía López", "ENFERMERO"),
                ("farmacia", "farmacia123", "Encargado de Farmacia", "FARMACIA"),
            ]
            for nombre_usuario, contrasena, nombre_completo, rol in usuarios_prueba:
                db.add(
                    Usuario(
                        nombre_usuario=nombre_usuario,
                        contrasena_hash=pwd_context.hash(contrasena),
                        nombre_completo=nombre_completo,
                        rol=rol,
                        estado=True,
                    )
                )
            db.commit()
    finally:
        db.close()


@app.get("/")
def read_root():
    return {"status": "Login service running"}


@app.post("/login", response_model=LoginResponse)
def login(datos: LoginRequest, db: Session = Depends(get_db)):
    usuario = (
        db.query(Usuario)
        .filter(Usuario.nombre_usuario == datos.nombreUsuario)
        .first()
    )
    # Mismo mensaje de error tanto si el usuario no existe como si la
    # contraseña es incorrecta, para no revelar cuáles usuarios existen.
    credenciales_invalidas = HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    if not usuario or not pwd_context.verify(datos.contrasena, usuario.contrasena_hash):
        raise credenciales_invalidas

    if not usuario.estado:
        raise HTTPException(status_code=403, detail="Este usuario está deshabilitado")

    token = crear_token(usuario)
    return LoginResponse(
        token=token,
        idUsuario=usuario.id_usuario,
        nombreUsuario=usuario.nombre_usuario,
        nombreCompleto=usuario.nombre_completo,
        rol=usuario.rol,
    )


@app.get("/usuarios", response_model=List[UsuarioOut])
def listar_usuarios(db: Session = Depends(get_db)):
    """Para la futura pantalla de administración de usuarios (Configuración)."""
    return [UsuarioOut.from_orm_model(u) for u in db.query(Usuario).order_by(Usuario.nombre_completo).all()]


@app.post("/usuarios", response_model=UsuarioOut, status_code=201)
def crear_usuario(datos: UsuarioCreate, db: Session = Depends(get_db)):
    if datos.rol not in ROLES_VALIDOS:
        raise HTTPException(status_code=400, detail=f"Rol inválido. Use uno de: {', '.join(ROLES_VALIDOS)}")

    existe = db.query(Usuario).filter(Usuario.nombre_usuario == datos.nombreUsuario).first()
    if existe:
        raise HTTPException(status_code=409, detail="Ese nombre de usuario ya existe")

    nuevo = Usuario(
        nombre_usuario=datos.nombreUsuario,
        contrasena_hash=pwd_context.hash(datos.contrasena),
        nombre_completo=datos.nombreCompleto,
        rol=datos.rol,
        correo=datos.correo,
        estado=True,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return UsuarioOut.from_orm_model(nuevo)


@app.put("/usuarios/{id_usuario}", response_model=UsuarioOut)
def actualizar_usuario(id_usuario: int, datos: UsuarioUpdate, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id_usuario == id_usuario).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if datos.rol is not None:
        if datos.rol not in ROLES_VALIDOS:
            raise HTTPException(status_code=400, detail=f"Rol inválido. Use uno de: {', '.join(ROLES_VALIDOS)}")
        usuario.rol = datos.rol
    if datos.nombreCompleto is not None:
        usuario.nombre_completo = datos.nombreCompleto
    if datos.correo is not None:
        usuario.correo = datos.correo
    if datos.estado is not None:
        usuario.estado = datos.estado
    if datos.contrasena:
        usuario.contrasena_hash = pwd_context.hash(datos.contrasena)

    db.commit()
    db.refresh(usuario)
    return UsuarioOut.from_orm_model(usuario)


@app.delete("/usuarios/{id_usuario}", status_code=204)
def eliminar_usuario(id_usuario: int, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id_usuario == id_usuario).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    db.delete(usuario)
    db.commit()
    return None
