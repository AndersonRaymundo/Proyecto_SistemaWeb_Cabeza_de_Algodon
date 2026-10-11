import io
from datetime import datetime
from typing import List
from xml.sax.saxutils import escape

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

app = FastAPI(title="PDF Service - Cabeza de Algodón")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


# ---------------------------------------------------------------------------
# Modelo de entrada: el backend .NET consulta la base de datos y manda aqui el
# contenido ya armado. Este microservicio solo se encarga de dibujar el PDF
# (CU-05: "Generacion de Reportes PDF").
# ---------------------------------------------------------------------------
class Seccion(BaseModel):
    encabezado: str = ""
    columnas: List[str] = []
    filas: List[List[str]] = []
    totales: List[str] = []


class ReporteRequest(BaseModel):
    titulo: str
    subtitulo: str = ""
    filtros: List[str] = []
    secciones: List[Seccion] = []


AZUL_OSCURO = colors.HexColor("#1A2530")
AZUL = colors.HexColor("#007BFF")
GRIS_ZEBRA = colors.HexColor("#F4F6F8")
GRIS_TOTAL = colors.HexColor("#E3EAF2")


def _pie_de_pagina(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#777777"))
    canvas.drawString(doc.leftMargin, 0.9 * cm, "Asilo Cabeza de Algodón - Sistema de Administración")
    canvas.drawRightString(doc.pagesize[0] - doc.rightMargin, 0.9 * cm, f"Página {doc.page}")
    canvas.restoreState()


@app.get("/")
def read_root():
    return {"status": "PDF service running"}


@app.post("/generate-report")
def generate_report(reporte: ReporteRequest):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.7 * cm,
        title=reporte.titulo,
        author="Asilo Cabeza de Algodón",
    )

    base = getSampleStyleSheet()["Normal"]
    est_inst = ParagraphStyle("inst", parent=base, fontName="Helvetica-Bold", fontSize=11, textColor=AZUL)
    est_titulo = ParagraphStyle("titulo", parent=base, fontName="Helvetica-Bold", fontSize=18,
                                textColor=AZUL_OSCURO, spaceAfter=2, leading=22)
    est_sub = ParagraphStyle("sub", parent=base, fontSize=10, textColor=colors.HexColor("#555555"), spaceAfter=4)
    est_info = ParagraphStyle("info", parent=base, fontSize=9, textColor=colors.HexColor("#333333"), leading=12)
    est_sec = ParagraphStyle("sec", parent=base, fontName="Helvetica-Bold", fontSize=12,
                             textColor=AZUL_OSCURO, spaceBefore=12, spaceAfter=5)
    est_celda = ParagraphStyle("celda", parent=base, fontSize=8, leading=10)
    est_celda_b = ParagraphStyle("celdab", parent=est_celda, fontName="Helvetica-Bold")
    est_cab = ParagraphStyle("cab", parent=est_celda, fontName="Helvetica-Bold", textColor=colors.white)

    story = [
        Paragraph("ASILO CABEZA DE ALGODÓN", est_inst),
        Paragraph(escape(reporte.titulo), est_titulo),
    ]
    if reporte.subtitulo:
        story.append(Paragraph(escape(reporte.subtitulo), est_sub))
    if reporte.filtros:
        story.append(Paragraph("<b>Filtros:</b> " + escape("  |  ".join(reporte.filtros)), est_info))
    story.append(Paragraph(f"<b>Generado:</b> {datetime.now():%d/%m/%Y %H:%M}", est_info))
    story.append(Spacer(1, 6))

    for sec in reporte.secciones:
        if sec.encabezado:
            story.append(Paragraph(escape(sec.encabezado), est_sec))

        if not sec.filas:
            story.append(Paragraph("Sin registros para los filtros seleccionados.", est_info))
            continue

        ncols = len(sec.columnas) or len(sec.filas[0])

        def ajustar(fila):
            fila = [str(c) for c in fila][:ncols]
            return fila + [""] * (ncols - len(fila))

        datos = []
        if sec.columnas:
            datos.append([Paragraph(escape(c), est_cab) for c in ajustar(sec.columnas)])
        for fila in sec.filas:
            datos.append([Paragraph(escape(c), est_celda) for c in ajustar(fila)])
        con_totales = bool(sec.totales)
        if con_totales:
            datos.append([Paragraph(escape(c), est_celda_b) for c in ajustar(sec.totales)])

        ancho = doc.width / ncols
        tabla = Table(datos, colWidths=[ancho] * ncols, repeatRows=1 if sec.columnas else 0)

        estilo = [
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#C9D1D9")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]
        inicio = 0
        if sec.columnas:
            estilo.append(("BACKGROUND", (0, 0), (-1, 0), AZUL_OSCURO))
            inicio = 1
        ultima = len(datos) - 1 - (1 if con_totales else 0)
        for i in range(inicio, ultima + 1):
            if (i - inicio) % 2 == 1:
                estilo.append(("BACKGROUND", (0, i), (-1, i), GRIS_ZEBRA))
        if con_totales:
            estilo.append(("BACKGROUND", (0, -1), (-1, -1), GRIS_TOTAL))
        tabla.setStyle(TableStyle(estilo))
        story.append(tabla)

    doc.build(story, onFirstPage=_pie_de_pagina, onLaterPages=_pie_de_pagina)

    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="reporte.pdf"'},
    )
