from fastapi import FastAPI
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

@app.get("/")
def read_root():
    return {"status": "Email service running"}

@app.post("/send-email")
def send_email(request: EmailRequest):
    return {
        "status": "success",
        "message": f"Email enviado con éxito a {request.recipient}",
        "data": request
    }