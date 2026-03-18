import io
import os
import base64
import uuid
from datetime import datetime
from django.conf import settings

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas as rl_canvas
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, PageBreak
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False

try:
    from pypdf import PdfReader, PdfWriter, PdfMerger
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False


def generate_agreement_pdf(employee, agreement, clauses):
    if not HAS_REPORTLAB:
        return None

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=30*mm, bottomMargin=25*mm, leftMargin=25*mm, rightMargin=25*mm)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('AgrTitle', parent=styles['Title'], fontSize=18, spaceAfter=20, alignment=TA_CENTER)
    heading_style = ParagraphStyle('AgrHeading', parent=styles['Heading2'], fontSize=12, spaceBefore=16, spaceAfter=8, textColor='#1e40af')
    body_style = ParagraphStyle('AgrBody', parent=styles['Normal'], fontSize=10, leading=14, alignment=TA_JUSTIFY, spaceAfter=6)
    meta_style = ParagraphStyle('AgrMeta', parent=styles['Normal'], fontSize=10, leading=14, alignment=TA_CENTER, spaceAfter=4)
    footer_style = ParagraphStyle('AgrFooter', parent=styles['Normal'], fontSize=9, leading=12, alignment=TA_CENTER, textColor='#6b7280')

    elements = []

    elements.append(Paragraph("EMPLOYMENT AGREEMENT", title_style))
    elements.append(Spacer(1, 6))

    agreement_date = ''
    if agreement.agreement_date:
        agreement_date = agreement.agreement_date.strftime('%d %B %Y')
    elements.append(Paragraph(f'This Employment Agreement ("Agreement") is made on {agreement_date}', meta_style))
    elements.append(Spacer(1, 16))

    for clause in clauses:
        title = clause.get('title', '')
        content = clause.get('content', '')
        order = clause.get('order', 0)

        content = content.replace('[Employee Name]', employee.full_name or '')
        content = content.replace('[Position Name]', agreement.position or employee.position or '')
        content = content.replace('[Join Date]', agreement.effective_from.strftime('%d %B %Y') if agreement.effective_from else '[Join Date]')
        content = content.replace('[Expire Date]', agreement.effective_to.strftime('%d %B %Y') if agreement.effective_to else '[Expire Date]')
        content = content.replace('[Join date]', agreement.effective_from.strftime('%d %B %Y') if agreement.effective_from else '[Join Date]')
        content = content.replace('[Expire date]', agreement.effective_to.strftime('%d %B %Y') if agreement.effective_to else '[Expire Date]')
        if agreement.gross_salary:
            content = content.replace('[Amount]', f'{agreement.gross_salary:,.0f}')

        elements.append(Paragraph(f'{order}. {title}', heading_style))
        for line in content.split('\n'):
            line = line.strip()
            if line:
                line_safe = line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                if line.startswith('- ') or line.startswith('• '):
                    line_safe = '&bull; ' + line_safe[2:]
                elements.append(Paragraph(line_safe, body_style))
            else:
                elements.append(Spacer(1, 4))

    elements.append(Spacer(1, 40))
    elements.append(Paragraph("_" * 40, body_style))
    elements.append(Paragraph("Employee Signature", footer_style))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph("Date: _______________", footer_style))
    elements.append(Spacer(1, 30))
    elements.append(Paragraph("_" * 40, body_style))
    elements.append(Paragraph("For Study Info Centre Pvt. Ltd.", footer_style))
    elements.append(Spacer(1, 20))
    elements.append(Paragraph("Study Info Centre Pvt. Ltd. | New Baneshwor, Kathmandu 44600, Nepal", footer_style))

    doc.build(elements)
    buf.seek(0)
    return buf


def embed_signature_to_pdf(pdf_bytes, signature_base64, signed_date=None):
    if not HAS_REPORTLAB or not HAS_PYPDF:
        return None

    if ',' in signature_base64:
        signature_base64 = signature_base64.split(',', 1)[1]

    sig_bytes = base64.b64decode(signature_base64)
    sig_image = io.BytesIO(sig_bytes)

    reader = PdfReader(io.BytesIO(pdf_bytes))
    last_page = reader.pages[-1]
    page_width = float(last_page.mediabox.width)
    page_height = float(last_page.mediabox.height)

    overlay_buf = io.BytesIO()
    c = rl_canvas.Canvas(overlay_buf, pagesize=(page_width, page_height))

    sig_width = 150
    sig_height = 60
    sig_x = 72
    sig_y = 200

    try:
        sig_image.seek(0)
        c.drawImage(
            RLImage(sig_image, width=sig_width, height=sig_height) if False else None,
            sig_x, sig_y, width=sig_width, height=sig_height, mask='auto'
        )
    except Exception:
        from reportlab.lib.utils import ImageReader
        sig_image.seek(0)
        img_reader = ImageReader(sig_image)
        c.drawImage(img_reader, sig_x, sig_y, width=sig_width, height=sig_height, mask='auto')

    if signed_date:
        date_str = signed_date.strftime('%d %B %Y, %I:%M %p')
    else:
        date_str = datetime.utcnow().strftime('%d %B %Y, %I:%M %p')

    c.setFont("Helvetica", 9)
    c.setFillColorRGB(0.3, 0.3, 0.3)
    c.drawString(sig_x, sig_y - 15, f"Signed on: {date_str}")

    c.save()
    overlay_buf.seek(0)

    overlay_reader = PdfReader(overlay_buf)
    overlay_page = overlay_reader.pages[0]

    writer = PdfWriter()
    for i, page in enumerate(reader.pages):
        if i == len(reader.pages) - 1:
            page.merge_page(overlay_page)
        writer.add_page(page)

    output_buf = io.BytesIO()
    writer.write(output_buf)
    output_buf.seek(0)
    return output_buf.getvalue()


def upload_pdf_to_s3(pdf_bytes, key):
    try:
        import boto3
        s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_S3_REGION_NAME,
        )
        s3_client.put_object(
            Bucket=settings.AWS_S3_BUCKET_NAME,
            Key=key,
            Body=pdf_bytes,
            ContentType='application/pdf',
        )
        return key
    except Exception as e:
        print(f'S3 upload failed: {e}')
        return None
