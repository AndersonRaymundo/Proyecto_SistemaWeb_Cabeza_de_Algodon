import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Email Service - Cabeza de Algodón")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class EmailRequest(BaseModel):
    recipient: str
    subject: str
    body: str

# Configuración desde variables de entorno (.env)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

@app.get("/")
def read_root():
    return {"status": "Email service running"}

@app.post("/send-email")
def send_email(request: EmailRequest):
    try:
        # Construcción del correo electrónico
        msg = MIMEMultipart()
        msg["From"] = SMTP_USER
        msg["To"] = request.recipient
        msg["Subject"] = request.subject
        msg.attach(MIMEText(request.body, "html"))

        # Conexión y envío vía SMTP
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            if SMTP_USER and SMTP_PASSWORD:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, request.recipient, msg.as_string())

        return {
            "status": "success",
            "message": f"Email enviado con éxito a {request.recipient}",
            "data": request
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al enviar el correo: {str(e)}")