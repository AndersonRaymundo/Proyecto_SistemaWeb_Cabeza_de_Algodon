from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.pdfgen import canvas
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"]
)

class ReportRequest(BaseModel):
    patient_id: str
    patient_name: str
    notes: str

@app.post("/generate-pdf")
def generate_pdf(report: ReportRequest):
    # Carpeta temporal donde se creará el documento en hoja blanca
    os.makedirs("reports", exist_ok=True)
    file_path = f"reports/reporte_{report.patient_id}.pdf"
    
    # Creación del lienzo en hoja tamaño carta
    p = canvas.Canvas(file_path, pagesize=letter)
    
    # Encabezado del documento
    p.setFillColor(colors.HexColor("#1A2530"))
    p.setFont("Helvetica-Bold", 16)
    p.drawString(50, 750, "ASILO CABEZA DE ALGODÓN")
    
    p.setFont("Helvetica", 10)
    p.setFillColor(colors.HexColor("#555555"))
    p.drawString(50, 735, "Sistema Interno de Gestión y Reporte Automático")
    
    # Línea divisoria azul
    p.setStrokeColor(colors.HexColor("#007BFF"))
    p.setLineWidth(1.5)
    p.line(50, 725, 560, 725)
    
    # Datos del reporte
    p.setFillColor(colors.HexColor("#000000"))
    p.setFont("Helvetica-Bold", 14)
    p.drawString(50, 695, f"REPORTE: {report.patient_name.upper()}")
    
    p.setFont("Helvetica", 10)
    p.drawString(50, 675, f"Código / Referencia: {report.patient_id}")
    p.drawString(50, 660, f"Descripción: {report.notes}")
    
    # Contenido según tipo de informe
    if "001" in report.patient_id:
        p.setFont("Helvetica-Bold", 12)
        p.drawString(50, 610, "1. Ficha Médica Resumida")
        p.setFont("Helvetica", 10)
        p.drawString(70, 590, "• Estado de Salud: Estable / Monitoreo diario")
        p.drawString(70, 570, "• Medicamentos: Paracetamol (800mg), Enalapril (10mg)")
    elif "002" in report.patient_id:
        p.setFont("Helvetica-Bold", 12)
        p.drawString(50, 610, "1. Consolidado Financiero")
        p.setFont("Helvetica", 10)
        p.drawString(70, 590, "• Total Ingresos Mensualidades: Q. 15,400.00")
        p.drawString(70, 570, "• Donaciones Recibidas: Q. 4,250.00")
    else:
        p.setFont("Helvetica-Bold", 12)
        p.drawString(50, 610, "1. Detalle de Pagos y Subsidios")
        p.setFont("Helvetica", 10)
        p.drawString(70, 590, "• Subsidio Consultas Médicas: Q. 1,200.00")
        p.drawString(70, 570, "• Exámenes de Laboratorio: Q. 850.00")

    p.showPage()
    p.save()
    
    # Envía el archivo visual PDF directamente al cliente
    return FileResponse(
        path=file_path,
        filename=f"reporte_{report.patient_id}.pdf",
        media_type="application/pdf"
    )