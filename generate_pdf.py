#!/usr/bin/env python3
import sys
import json
from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

# COLORS
RED = HexColor('#E00020')
BLACK_DEEP = HexColor('#0D0D0D')
BLACK_BG = HexColor('#1A1A1A')
GRAY = HexColor('#888888')
LIGHT_GRAY = HexColor('#F5F5F5')
WHITE = white
DARK_ROW = HexColor('#F9F9F9')

W, H = A4

def draw_header(c, title, subtitle, ref):
    c.setFillColor(BLACK_DEEP)
    c.rect(0, H - 55*mm, W, 55*mm, fill=1, stroke=0)

    # Logo J4CK'S
    c.setFillColor(RED)
    c.setFont("Helvetica-Bold", 28)
    c.drawString(20*mm, H - 28*mm, "J4CK'S")
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 28)
    c.drawString(20*mm + 72, H - 28*mm, " LOCATION")

    # Tagline
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 8)
    c.drawString(20*mm, H - 38*mm, "Agence de Location Premium  —  Mulhouse, France")

    # Trait rouge
    c.setFillColor(RED)
    c.rect(0, H - 42*mm, W, 2, fill=1, stroke=0)

    # Titre document
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 18)
    c.drawRightString(W - 20*mm, H - 28*mm, title.upper())
    c.setFont("Helvetica", 9)
    c.setFillColor(GRAY)
    c.drawRightString(W - 20*mm, H - 37*mm, subtitle)
    c.drawRightString(W - 20*mm, H - 44*mm, ref)

def draw_footer(c, page_num):
    c.setFillColor(HexColor('#EEEEEE'))
    c.rect(0, 0, W, 18*mm, fill=1, stroke=0)
    c.setFillColor(RED)
    c.rect(0, 16*mm, W, 1, fill=1, stroke=0)
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 7)
    c.drawString(20*mm, 10*mm, "J4CK'S LOCATION  —  contact@j4cks.fr  —  Mulhouse, France")
    c.drawString(20*mm, 5*mm, "Document confidentiel — à conserver précieusement")
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(RED)
    c.drawRightString(W - 20*mm, 8*mm, f"Page {page_num}")

def section_title(txt):
    return Paragraph(f'<font color="#E00020"><b>{txt}</b></font>', ParagraphStyle(
        'sec', fontName='Helvetica-Bold', fontSize=11, spaceBefore=14, spaceAfter=6,
        borderPad=4, leftIndent=0,
        borderColor=HexColor('#E00020'), borderWidth=0,
    ))

def field_table(rows):
    data = []
    for label, value in rows:
        data.append([
            Paragraph(f'<b>{label}</b>', ParagraphStyle('lbl', fontName='Helvetica-Bold', fontSize=9, textColor=HexColor('#444444'))),
            Paragraph(str(value) if value else '___________________________', ParagraphStyle('val', fontName='Helvetica', fontSize=9, textColor=black if value else HexColor('#AAAAAA')))
        ])
    t = Table(data, colWidths=[65*mm, 115*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), LIGHT_GRAY),
        ('GRID', (0,0), (-1,-1), 0.3, HexColor('#DDDDDD')),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [WHITE, DARK_ROW]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
    ]))
    return t

def signature_table():
    data = [
        [Paragraph('<b>LE LOUEUR</b>', ParagraphStyle('s', fontName='Helvetica-Bold', fontSize=10, textColor=RED)),
         Paragraph('<b>LE LOCATAIRE</b>', ParagraphStyle('s', fontName='Helvetica-Bold', fontSize=10, textColor=RED))],
        [Paragraph('J4CK\'S LOCATION\nNom : ___________________________\n\n\nSignature :', ParagraphStyle('s2', fontName='Helvetica', fontSize=9, leading=16)),
         Paragraph('Nom : ___________________________\n\n\nSignature :', ParagraphStyle('s2', fontName='Helvetica', fontSize=9, leading=16))],
    ]
    t = Table(data, colWidths=[90*mm, 90*mm])
    t.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, HexColor('#DDDDDD')),
        ('BACKGROUND', (0,0), (-1,0), HexColor('#F5F5F5')),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 40),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
    ]))
    return t

def generate_contrat_location(data):
    buf = BytesIO()
    now = datetime.now()
    ref = f"LOC-{now.strftime('%Y%m%d-%H%M')}"

    c_canvas = canvas.Canvas(buf, pagesize=A4)
    c_canvas.setTitle(f"Contrat de Location — {ref}")
    draw_header(c_canvas, "Contrat de Location", "Document officiel", ref)
    draw_footer(c_canvas, 1)
    c_canvas.save()

    buf2 = BytesIO()
    doc = SimpleDocTemplate(buf2, pagesize=A4,
        topMargin=62*mm, bottomMargin=22*mm,
        leftMargin=20*mm, rightMargin=20*mm)

    styles_base = ParagraphStyle('base', fontName='Helvetica', fontSize=9, leading=14, textColor=black)
    styles_bold = ParagraphStyle('bold', fontName='Helvetica-Bold', fontSize=9, leading=14)

    story = []

    # INTRO BOX
    intro = Table([[Paragraph(
        f'<b>Référence :</b> {ref} &nbsp;&nbsp; <b>Date :</b> {now.strftime("%d/%m/%Y")} &nbsp;&nbsp; <b>Heure :</b> {now.strftime("%H:%M")}',
        ParagraphStyle('intro', fontName='Helvetica', fontSize=9, textColor=HexColor('#555555'))
    )]], colWidths=[170*mm])
    intro.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), HexColor('#FFF0F0')),
        ('BOX', (0,0), (-1,-1), 1, RED),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(intro)
    story.append(Spacer(1, 8*mm))

    # PARTIES
    story.append(section_title("1. PARTIES AU CONTRAT"))
    story.append(field_table([
        ("Loueur", "J4CK'S LOCATION — SAS — Mulhouse, France"),
        ("Représentant loueur", data.get('representant', '')),
        ("Locataire — Nom", data.get('nom_client', '')),
        ("Locataire — Adresse", data.get('adresse_client', '')),
        ("N° Permis de conduire", data.get('permis', '')),
        ("Date de naissance", data.get('date_naissance', '')),
        ("Téléphone", data.get('telephone', '')),
        ("Email", data.get('email', '')),
    ]))
    story.append(Spacer(1, 4*mm))

    # VÉHICULE
    story.append(section_title("2. VÉHICULE LOUÉ"))
    story.append(field_table([
        ("Marque & Modèle", data.get('vehicule', '')),
        ("Immatriculation", data.get('immatriculation', '')),
        ("Couleur", data.get('couleur', '')),
        ("Kilométrage départ", data.get('kilometrage', '')),
        ("Niveau carburant départ", data.get('carburant', 'Plein')),
    ]))
    story.append(Spacer(1, 4*mm))

    # DURÉE & PRIX
    story.append(section_title("3. DURÉE ET TARIFS"))
    story.append(field_table([
        ("Date de début", data.get('date_debut', '')),
        ("Date de fin", data.get('date_fin', '')),
        ("Nombre de jours", data.get('nb_jours', '')),
        ("Prix par jour (€)", data.get('prix_jour', '')),
        ("Options souscrites", data.get('options', 'Aucune')),
        ("Montant total (€)", data.get('prix_total', '')),
        ("Caution bloquée (€)", data.get('caution', '800')),
    ]))
    story.append(Spacer(1, 4*mm))

    # CONDITIONS
    story.append(section_title("4. CONDITIONS GÉNÉRALES"))
    conditions = [
        "⛽  Carburant : le véhicule est remis plein. Il doit être restitué plein, faute de quoi le coût du carburant + 40€ de frais seront prélevés sur la caution.",
        "🔑  Restitution : le véhicule doit être rendu à la date et l'heure convenues. Tout retard sera facturé 30€/heure supplémentaire.",
        "🛡️  Assurance : le véhicule est couvert par l'assurance professionnelle du loueur. En cas de sinistre, une franchise de 500€ est à la charge du locataire (sauf option franchise 0€).",
        "💳  Caution : un montant de " + data.get('caution', '800') + "€ est bloqué à la prise en charge. Restitué sous 48h après retour du véhicule en bon état.",
        "🚫  Interdictions : sous-location, compétition, sortie du territoire sans accord écrit, conduite sous l'emprise d'alcool ou de stupéfiants.",
        "👤  Conducteur supplémentaire : tout conducteur additionnel doit être déclaré et son permis présenté. Non déclaré = annulation d'assurance.",
        "🚗  Dommages : tout dommage constaté au retour non mentionné à l'état des lieux de départ sera facturé au locataire.",
    ]
    for cond in conditions:
        story.append(Paragraph(cond, ParagraphStyle('cond', fontName='Helvetica', fontSize=8.5, leading=14, spaceBefore=3, leftIndent=5)))
    story.append(Spacer(1, 6*mm))

    # SIGNATURES
    story.append(section_title("5. SIGNATURES"))
    story.append(Paragraph("Lu et approuvé — Bon pour accord", ParagraphStyle('luap', fontName='Helvetica-Oblique', fontSize=8, textColor=GRAY, spaceBefore=2, spaceAfter=6)))
    story.append(signature_table())

    def first_page(canvas, doc):
        draw_header(canvas, "Contrat de Location", "Document officiel", ref)
        draw_footer(canvas, 1)

    def later_pages(canvas, doc):
        draw_header(canvas, "Contrat de Location", "Document officiel", ref)
        draw_footer(canvas, doc.page)

    doc.build(story, onFirstPage=first_page, onLaterPages=later_pages)
    return buf2.getvalue()

def generate_caution(data):
    buf = BytesIO()
    now = datetime.now()
    ref = f"CAUT-{now.strftime('%Y%m%d-%H%M')}"

    doc = SimpleDocTemplate(buf, pagesize=A4,
        topMargin=62*mm, bottomMargin=22*mm,
        leftMargin=20*mm, rightMargin=20*mm)

    story = []
    story.append(Spacer(1, 4*mm))
    story.append(section_title("DÉPÔT DE GARANTIE"))
    story.append(Spacer(1, 4*mm))

    amount = data.get('caution', '800')
    client = data.get('nom_client', '')
    veh = data.get('vehicule', '')

    # Montant mis en valeur
    montant_box = Table([[
        Paragraph(f'<b><font color="#E00020" size="28">{amount} €</font></b><br/><font color="#888888" size="9">Montant bloqué en garantie</font>',
            ParagraphStyle('m', fontName='Helvetica', fontSize=9, alignment=TA_CENTER))
    ]], colWidths=[170*mm])
    montant_box.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), HexColor('#0D0D0D')),
        ('BOX', (0,0), (-1,-1), 2, RED),
        ('TOPPADDING', (0,0), (-1,-1), 16),
        ('BOTTOMPADDING', (0,0), (-1,-1), 16),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ]))
    story.append(montant_box)
    story.append(Spacer(1, 6*mm))

    story.append(field_table([
        ("Client", client),
        ("Véhicule concerné", veh),
        ("Immatriculation", data.get('immatriculation', '')),
        ("Date de dépôt", data.get('date_depot', now.strftime('%d/%m/%Y'))),
        ("Mode de blocage", "☐ Empreinte CB   ☐ Espèces   ☐ Virement"),
        ("Référence transaction", ""),
    ]))
    story.append(Spacer(1, 5*mm))
    story.append(section_title("CONDITIONS DE RESTITUTION"))
    conditions = [
        "La caution sera restituée intégralement dans les 48h suivant le retour du véhicule, sous réserve d'absence de dommages, de plein de carburant effectué, et de restitution à l'heure convenue.",
        "En cas de dommage, le montant des réparations sera déduit de la caution. Un devis contradictoire peut être demandé.",
        "En cas de retard de restitution non signalé, 30€/heure seront prélevés.",
        "En cas de carburant manquant, le coût + 40€ de frais seront prélevés.",
    ]
    for c in conditions:
        story.append(Paragraph(f"• {c}", ParagraphStyle('c', fontName='Helvetica', fontSize=8.5, leading=14, spaceBefore=3, leftIndent=5)))
    story.append(Spacer(1, 8*mm))
    story.append(section_title("SIGNATURES"))
    story.append(signature_table())

    def fp(canvas, doc):
        draw_header(canvas, "Dépôt de Garantie", "Document officiel", ref)
        draw_footer(canvas, 1)

    doc.build(story, onFirstPage=fp, onLaterPages=fp)
    return buf.getvalue()

def generate_etat_lieux(data):
    buf = BytesIO()
    now = datetime.now()
    ref = f"EDL-{now.strftime('%Y%m%d-%H%M')}"

    doc = SimpleDocTemplate(buf, pagesize=A4,
        topMargin=62*mm, bottomMargin=22*mm,
        leftMargin=20*mm, rightMargin=20*mm)

    story = []
    story.append(Spacer(1, 3*mm))

    # Infos véhicule
    story.append(section_title("INFORMATIONS VÉHICULE"))
    story.append(field_table([
        ("Véhicule", data.get('vehicule', '')),
        ("Immatriculation", data.get('immatriculation', '')),
        ("Kilométrage", data.get('kilometrage', '')),
        ("Niveau carburant", "☐ Vide  ☐ 1/4  ☐ 1/2  ☐ 3/4  ☐ Plein"),
        ("Client", data.get('nom_client', '')),
        ("Date état des lieux", data.get('date', now.strftime('%d/%m/%Y'))),
        ("Type", f"☐ Départ  ☐ Retour"),
    ]))
    story.append(Spacer(1, 5*mm))

    # Grille zones
    story.append(section_title("ÉTAT PAR ZONE"))

    zones = [
        ["Zone", "État", "Observations"],
        ["Avant (pare-choc, capot, phares)", "☐ RAS  ☐ Dommage", ""],
        ["Arrière (pare-choc, feux, coffre)", "☐ RAS  ☐ Dommage", ""],
        ["Côté conducteur (portière, aile)", "☐ RAS  ☐ Dommage", ""],
        ["Côté passager (portière, aile)", "☐ RAS  ☐ Dommage", ""],
        ["Toit & Pavillon", "☐ RAS  ☐ Dommage", ""],
        ["Vitres & Pare-brise", "☐ RAS  ☐ Dommage", ""],
        ["Roues & Pneumatiques (4)", "☐ RAS  ☐ Dommage", ""],
        ["Intérieur — Sièges", "☐ RAS  ☐ Dommage", ""],
        ["Intérieur — Tableau de bord", "☐ RAS  ☐ Dommage", ""],
        ["Intérieur — Coffre", "☐ RAS  ☐ Dommage", ""],
        ["Documents de bord", "☐ Présents  ☐ Manquants", ""],
        ["Jeu de clés complet", "☐ Oui  ☐ Non", ""],
    ]
    zstyle = [ParagraphStyle(f'z{i}', fontName='Helvetica' if i>0 else 'Helvetica-Bold', fontSize=9)]
    z_data = [[Paragraph(str(cell), ParagraphStyle(f'zz{i}{j}', fontName='Helvetica-Bold' if i==0 else 'Helvetica', fontSize=8.5, textColor=RED if i==0 else black)) for j, cell in enumerate(row)] for i, row in enumerate(zones)]
    zt = Table(z_data, colWidths=[70*mm, 60*mm, 40*mm])
    zt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BLACK_DEEP),
        ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, DARK_ROW]),
        ('GRID', (0,0), (-1,-1), 0.3, HexColor('#DDDDDD')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(zt)
    story.append(Spacer(1, 5*mm))

    story.append(section_title("OBSERVATIONS GÉNÉRALES"))
    obs_box = Table([['']], colWidths=[170*mm], rowHeights=[35*mm])
    obs_box.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.5, HexColor('#DDDDDD')),
        ('BACKGROUND', (0,0), (-1,-1), LIGHT_GRAY),
    ]))
    story.append(obs_box)
    story.append(Spacer(1, 5*mm))
    story.append(section_title("SIGNATURES"))
    story.append(signature_table())

    def fp(canvas, doc):
        draw_header(canvas, "État des Lieux Véhicule", "Départ / Retour", ref)
        draw_footer(canvas, 1)

    doc.build(story, onFirstPage=fp, onLaterPages=fp)
    return buf.getvalue()

def generate_facture(data):
    buf = BytesIO()
    now = datetime.now()
    num = f"FAC-{now.strftime('%Y%m%d-%H%M')}"

    doc = SimpleDocTemplate(buf, pagesize=A4,
        topMargin=62*mm, bottomMargin=22*mm,
        leftMargin=20*mm, rightMargin=20*mm)

    story = []
    story.append(Spacer(1, 3*mm))

    # Infos facture
    story.append(field_table([
        ("N° Facture", num),
        ("Date d'émission", now.strftime('%d/%m/%Y')),
        ("Client", data.get('nom_client', '')),
        ("Adresse client", data.get('adresse_client', '')),
    ]))
    story.append(Spacer(1, 5*mm))

    # Tableau prestations
    story.append(section_title("DÉTAIL DES PRESTATIONS"))
    prix_ht = float(data.get('prix_ht', 0) or 0)
    tva_rate = float(data.get('tva', 20) or 20) / 100
    tva_montant = round(prix_ht * tva_rate, 2)
    ttc = round(prix_ht + tva_montant, 2)
    extras_ht = float(data.get('extras_ht', 0) or 0)
    extras_tva = round(extras_ht * tva_rate, 2)
    extras_ttc = round(extras_ht + extras_tva, 2)
    total_ht = round(prix_ht + extras_ht, 2)
    total_tva = round(tva_montant + extras_tva, 2)
    total_ttc = round(ttc + extras_ttc, 2)

    fact_data = [
        [Paragraph('<b>Désignation</b>', ParagraphStyle('fh', fontName='Helvetica-Bold', fontSize=9, textColor=WHITE)),
         Paragraph('<b>Qté</b>', ParagraphStyle('fh2', fontName='Helvetica-Bold', fontSize=9, textColor=WHITE, alignment=TA_CENTER)),
         Paragraph('<b>PU HT</b>', ParagraphStyle('fh3', fontName='Helvetica-Bold', fontSize=9, textColor=WHITE, alignment=TA_RIGHT)),
         Paragraph('<b>TVA</b>', ParagraphStyle('fh4', fontName='Helvetica-Bold', fontSize=9, textColor=WHITE, alignment=TA_CENTER)),
         Paragraph('<b>Total TTC</b>', ParagraphStyle('fh5', fontName='Helvetica-Bold', fontSize=9, textColor=WHITE, alignment=TA_RIGHT))],
        [Paragraph(f"Location {data.get('vehicule','')} — {data.get('date_debut','')} au {data.get('date_fin','')}", ParagraphStyle('fd', fontName='Helvetica', fontSize=9)),
         Paragraph(str(data.get('nb_jours','1')+' j'), ParagraphStyle('fd2', fontName='Helvetica', fontSize=9, alignment=TA_CENTER)),
         Paragraph(f"{prix_ht:.2f}€", ParagraphStyle('fd3', fontName='Helvetica', fontSize=9, alignment=TA_RIGHT)),
         Paragraph(f"{int(data.get('tva',20))}%", ParagraphStyle('fd4', fontName='Helvetica', fontSize=9, alignment=TA_CENTER)),
         Paragraph(f"{ttc:.2f}€", ParagraphStyle('fd5', fontName='Helvetica', fontSize=9, alignment=TA_RIGHT))],
    ]
    if extras_ht > 0:
        fact_data.append([
            Paragraph(f"Options : {data.get('options','')}", ParagraphStyle('fo', fontName='Helvetica', fontSize=9)),
            Paragraph('1', ParagraphStyle('fo2', fontName='Helvetica', fontSize=9, alignment=TA_CENTER)),
            Paragraph(f"{extras_ht:.2f}€", ParagraphStyle('fo3', fontName='Helvetica', fontSize=9, alignment=TA_RIGHT)),
            Paragraph(f"{int(data.get('tva',20))}%", ParagraphStyle('fo4', fontName='Helvetica', fontSize=9, alignment=TA_CENTER)),
            Paragraph(f"{extras_ttc:.2f}€", ParagraphStyle('fo5', fontName='Helvetica', fontSize=9, alignment=TA_RIGHT)),
        ])

    ft = Table(fact_data, colWidths=[80*mm, 20*mm, 25*mm, 20*mm, 25*mm])
    ft.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BLACK_DEEP),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, DARK_ROW]),
        ('GRID', (0,0), (-1,-1), 0.3, HexColor('#DDDDDD')),
        ('TOPPADDING', (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
        ('LEFTPADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(ft)
    story.append(Spacer(1, 4*mm))

    # Total
    total_data = [
        ['Total HT', f"{total_ht:.2f} €"],
        [f'TVA ({int(data.get("tva",20))}%)', f"{total_tva:.2f} €"],
        ['TOTAL TTC', f"{total_ttc:.2f} €"],
    ]
    tt = Table(total_data, colWidths=[140*mm, 30*mm])
    tt.setStyle(TableStyle([
        ('ALIGN', (1,0), (1,-1), 'RIGHT'),
        ('FONTNAME', (0,2), (-1,2), 'Helvetica-Bold'),
        ('FONTSIZE', (0,2), (-1,2), 11),
        ('TEXTCOLOR', (0,2), (-1,2), RED),
        ('LINEABOVE', (0,2), (-1,2), 1, RED),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (1,0), (1,-1), 4),
    ]))
    story.append(tt)
    story.append(Spacer(1, 6*mm))

    story.append(Paragraph(
        "Paiement à réception — Merci pour votre confiance.",
        ParagraphStyle('merci', fontName='Helvetica-Oblique', fontSize=9, textColor=GRAY)
    ))

    def fp(canvas, doc):
        draw_header(canvas, "Facture", "Document comptable officiel", num)
        draw_footer(canvas, 1)

    doc.build(story, onFirstPage=fp, onLaterPages=fp)
    return buf.getvalue()

if __name__ == '__main__':
    doc_type = sys.argv[1]
    data = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    generators = {
        'location': generate_contrat_location,
        'caution': generate_caution,
        'etatLieux': generate_etat_lieux,
        'facture': generate_facture,
    }
    fn = generators.get(doc_type, generate_contrat_location)
    pdf_bytes = fn(data)
    sys.stdout.buffer.write(pdf_bytes)
