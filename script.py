#!/usr/bin/env python3
import os
import sys

# Ensure site-packages from .venv are accessible
venv_site = os.path.join(os.path.dirname(__file__), ".venv", "lib", "python3.14", "site-packages")
if os.path.exists(venv_site) and venv_site not in sys.path:
    sys.path.insert(0, venv_site)

from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

BASE_PATH = "treasury/loan_packets/PeopleFund_TSBCI_Microloan_Package"

PRIMARY_COLOR = HexColor("#1A365D")   # Deep Navy
SECONDARY_COLOR = HexColor("#2B6CB0") # Slate Blue
TEXT_COLOR = HexColor("#2D3748")      # Charcoal
LIGHT_BG = HexColor("#F7FAFC")        # Cool Grey
BORDER_COLOR = HexColor("#E2E8F0")

def get_document_template(filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    doc = SimpleDocTemplate(filepath, pagesize=letter, leftMargin=54, rightMargin=54, topMargin=54, bottomMargin=54)
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle('DocHeaderTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=18, leading=22, textColor=PRIMARY_COLOR, spaceAfter=4))
    styles.add(ParagraphStyle('DocSubHeader', parent=styles['Normal'], fontName='Helvetica', fontSize=10, leading=14, textColor=SECONDARY_COLOR, spaceAfter=12))
    styles.add(ParagraphStyle('SectionHeader', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=12, leading=16, textColor=PRIMARY_COLOR, spaceBefore=10, spaceAfter=6))
    styles.add(ParagraphStyle('CustomBody', parent=styles['Normal'], fontName='Helvetica', fontSize=9.5, leading=13.5, textColor=TEXT_COLOR, spaceAfter=6))
    return doc, styles

# 1.0 Executive Cover Letter
def gen_1_0():
    filepath = f"{BASE_PATH}/Section_1_Executive_and_Entity/1.0_Executive_Cover_Letter_TSBCI.pdf"
    doc, styles = get_document_template(filepath)
    story = [
        Paragraph("TXIMHOTEP LLC", styles['DocHeaderTitle']),
        Paragraph("EXECUTIVE COVER LETTER — TSBCI MICROLOAN APPLICATION", styles['DocSubHeader']),
        HRFlowable(width="100%", thickness=1.5, color=PRIMARY_COLOR, spaceAfter=12),
        Paragraph("<b>TO:</b> Credit Underwriting Committee, PeopleFund<br/><b>DATE:</b> October 27, 2026<br/><b>APPLICANT:</b> TxImhotep LLC (Mexia, Limestone County, TX)<br/><b>FACILITY REQUEST:</b> $35,000 TSBCI Microloan Working Capital", styles['CustomBody']),
        Spacer(1, 8),
        Paragraph("Dear PeopleFund Credit Committee,", styles['CustomBody']),
        Paragraph("TxImhotep LLC respectfully submits this application for a $35,000 Texas Small Business Credit Initiative (TSBCI) Microloan. As a 100% veteran-owned cloud security software enterprise based in Mexia, Texas, TxImhotep LLC develops SecureBase—a zero-data-custody compliance automation platform serving regional banking and healthcare institutions.", styles['CustomBody']),
        Paragraph("Key Highlights:", styles['SectionHeader']),
        Paragraph("• <b>Capitalized IP Collateralization:</b> Anchored on $150,000+ capitalized software IP valuation and formal AWS Foundational Technical Review (FTR) approval.", styles['CustomBody']),
        Paragraph("• <b>Use of Funds:</b> Direct allocation to USPTO Provisional Patent filings, compliance legal validation, and Texas enterprise sales outreach.", styles['CustomBody']),
        Paragraph("• <b>Debt Service Capacity (DSCR):</b> Repayment of the facility is securely bridged by active fractional Principal Cloud Architect consulting engagements and historical W-2 earnings (Exhibit 3.6), ensuring cash flow independent of early-stage SaaS revenue.", styles['CustomBody']),
        Spacer(1, 8),
        Paragraph("<b>Communication Protocol:</b> Due to the rural, off-grid nature of our primary testing and development facility in Mexia, cellular voice service is unavailable. Please route all underwriting correspondence and documentation requests directly to my email at <b>cedrickjbyrd@gmail.com</b>.", styles['CustomBody']),
        Spacer(1, 12),
        Paragraph("Sincerely,<br/><br/><b>Cedrick Byrd</b><br/>Founder &amp; CEO, TxImhotep LLC", styles['CustomBody'])
    ]
    doc.build(story)

# 1.1 TSBCI Economic Impact Addendum
def gen_1_1():
    filepath = f"{BASE_PATH}/Section_1_Executive_and_Entity/1.1_TSBCI_Impact_and_Economic_Justification_Addendum.pdf"
    doc, styles = get_document_template(filepath)
    story = [
        Paragraph("TEXAS SMALL BUSINESS CREDIT INITIATIVE (TSBCI)", styles['DocHeaderTitle']),
        Paragraph("ECONOMIC IMPACT &amp; COMMUNITY JUSTIFICATION ADDENDUM", styles['DocSubHeader']),
        HRFlowable(width="100%", thickness=1.5, color=PRIMARY_COLOR, spaceAfter=12),
        Paragraph("<b>Applicant Entity:</b> TxImhotep LLC | <b>Location:</b> Mexia, Limestone County, TX | <b>Request:</b> $35,000", styles['CustomBody']),
        Spacer(1, 8),
        Paragraph("1. Veteran &amp; Rural Business Profile", styles['SectionHeader']),
        Paragraph("100% veteran-owned cloud security enterprise bringing high-technology software IP development into rural Central Texas.", styles['CustomBody']),
        Paragraph("2. Capitalized IP Collateral &amp; Asset-Light Structure", styles['SectionHeader']),
        Paragraph("Anchored on $150,000+ capitalized software IP and AWS FTR approval, preserving real estate assets while backing debt service via Cloud Architect consulting revenues.", styles['CustomBody']),
        Paragraph("3. Economic Impact &amp; Job Creation", styles['SectionHeader']),
        Paragraph("Bridging non-dilutive capital to finalize patent filings and establish local cloud engineering pathways in Limestone County.", styles['CustomBody']),
        Spacer(1, 12),
        Paragraph("Submitted by,<br/><br/><b>Cedrick Byrd</b><br/>Founder &amp; CEO, TxImhotep LLC", styles['CustomBody'])
    ]
    doc.build(story)

# 1.3 Single-Member LLC Operating Agreement
def gen_1_3():
    filepath = f"{BASE_PATH}/Section_1_Executive_and_Entity/1.3_LLC_Operating_Agreement.pdf"
    doc, styles = get_document_template(filepath)
    story = [
        Paragraph("TXIMHOTEP LLC", styles['DocHeaderTitle']),
        Paragraph("SINGLE-MEMBER LIMITED LIABILITY COMPANY OPERATING AGREEMENT", styles['DocSubHeader']),
        HRFlowable(width="100%", thickness=1.5, color=PRIMARY_COLOR, spaceAfter=12),
        Paragraph("<b>Entity Name:</b> TxImhotep LLC<br/><b>Jurisdiction:</b> State of Texas (Organized April 2019)<br/><b>Sole Member &amp; Manager:</b> Cedrick Byrd (100% Equity Owner)", styles['CustomBody']),
        Spacer(1, 8),
        Paragraph("1. Organization & Management Authority", styles['SectionHeader']),
        Paragraph("TxImhotep LLC is a manager-managed single-member limited liability company organized under the laws of the State of Texas. Cedrick Byrd holds 100% membership interest and possesses sole executive authority to execute contracts, enter financial agreements, and bind the entity.", styles['CustomBody']),
        Paragraph("2. Capitalization & Borrowing Authority", styles['SectionHeader']),
        Paragraph("The Sole Member is fully authorized to secure commercial credit facilities, encumber company-owned intellectual property assets, and execute debt obligations on behalf of TxImhotep LLC for commercial expansion.", styles['CustomBody']),
        Spacer(1, 12),
        Paragraph("Executed and Certified by,<br/><br/><b>Cedrick Byrd</b>, Sole Member &amp; Manager", styles['CustomBody'])
    ]
    doc.build(story)

# 1.5 Texas Certificate of Good Standing Notice
def gen_1_5():
    filepath = f"{BASE_PATH}/Section_1_Executive_and_Entity/1.5_Texas_Certificate_of_Good_Standing.pdf"
    doc, styles = get_document_template(filepath)
    story = [
        Paragraph("TXIMHOTEP LLC", styles['DocHeaderTitle']),
        Paragraph("TEXAS COMPTROLLER FRANCHISE TAX &amp; GOOD STANDING VERIFICATION", styles['DocSubHeader']),
        HRFlowable(width="100%", thickness=1.5, color=PRIMARY_COLOR, spaceAfter=12),
        Paragraph("<b>Entity Name:</b> TxImhotep LLC<br/><b>Texas SOS File Number:</b> Active Operating Entity<br/><b>Franchise Tax Status:</b> In Good Standing / Right to Transact Business Active", styles['CustomBody']),
        Spacer(1, 8),
        Paragraph("1. Entity Standing Statement", styles['SectionHeader']),
        Paragraph("TxImhotep LLC maintains active registration with the Texas Secretary of State and is in full compliance with all Texas Comptroller franchise tax requirements. The entity holds full legal authority to transact business in the State of Texas.", styles['CustomBody']),
        Spacer(1, 12),
        Paragraph("Certified by,<br/><br/><b>Cedrick Byrd</b>, Founder &amp; CEO", styles['CustomBody'])
    ]
    doc.build(story)

# 1.7 Owner ID & Resume Summary
def gen_1_7():
    filepath = f"{BASE_PATH}/Section_1_Executive_and_Entity/1.7_Owner_ID_and_Management_Resume.pdf"
    doc, styles = get_document_template(filepath)
    story = [
        Paragraph("TXIMHOTEP LLC", styles['DocHeaderTitle']),
        Paragraph("MANAGEMENT PROFILE &amp; EXECUTIVE SUMMARY — CEDRICK BYRD", styles['DocSubHeader']),
        HRFlowable(width="100%", thickness=1.5, color=PRIMARY_COLOR, spaceAfter=12),
        Paragraph("<b>Principal:</b> Cedrick Byrd, Founder &amp; CEO<br/><b>Location:</b> Mexia, Texas | <b>Role:</b> Principal Cloud Architect &amp; Sole Member", styles['CustomBody']),
        Spacer(1, 8),
        Paragraph("Professional Background &amp; Technical Qualifications", styles['SectionHeader']),
        Paragraph("• <b>25+ Years Experience:</b> Enterprise cloud architecture, telecom infrastructure engineering, including 18 years at AT&amp;T.", styles['CustomBody']),
        Paragraph("• <b>Military Service:</b> Veteran background bringing disciplined operational leadership and technical strategy.", styles['CustomBody']),
        Paragraph("• <b>Key Milestones:</b> Sole founder of SecureBase; achieved formal AWS Foundational Technical Review (FTR) validation in May 2026.", styles['CustomBody']),
        Spacer(1, 12),
        Paragraph("Certified by,<br/><br/><b>Cedrick Byrd</b>, Founder &amp; CEO", styles['CustomBody'])
    ]
    doc.build(story)

# 2.1 Capitalized IP Valuation Schedule
def gen_2_1():
    filepath = f"{BASE_PATH}/Section_2_IP_Collateral/2.1_Capitalized_IP_Valuation_Schedule.pdf"
    doc, styles = get_document_template(filepath)
    story = [
        Paragraph("TXIMHOTEP LLC", styles['DocHeaderTitle']),
        Paragraph("CAPITALIZED IP VALUATION SCHEDULE — SECUREBASE CONTROL PLANE", styles['DocSubHeader']),
        HRFlowable(width="100%", thickness=1.5, color=PRIMARY_COLOR, spaceAfter=12),
        Paragraph("<b>Asset:</b> SecureBase Multi-Cloud Compliance Engine | <b>Valuation Standard:</b> ASC 350-40 Capitalized Software", styles['CustomBody']),
        Spacer(1, 8),
        Paragraph("IP Asset Summary Table", styles['SectionHeader']),
    ]
    data = [
        ["Asset Component", "Engineering Hours", "Valuation / Capitalized Cost", "Status / Validation"],
        ["SecureBase Core Engine", "252 hrs", "$42,760.00", "AWS FTR Validated"],
        ["securebase-mcp & Shift-Left", "310 hrs", "$58,500.00", "Public GitHub Action"],
        ["Cryptographic WORM Anchor", "280 hrs", "$48,740.00", "Provisional Patent Staged"],
        ["TOTAL CAPITALIZED IP VALUE", "842 hrs", "$150,000.00+", "Secured Collateral Base"]
    ]
    t = Table(data, colWidths=[150, 90, 120, 144])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY_COLOR),
        ('TEXTCOLOR', (0,0), (-1,0), HexColor("#FFFFFF")),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 8.5),
        ('ROWBACKGROUNDS', (0,1), (-1,-2), [LIGHT_BG, HexColor("#FFFFFF")]),
        ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
        ('BACKGROUND', (0,-1), (-1,-1), HexColor("#E2E8F0")),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR)
    ]))
    story.append(t)
    doc.build(story)

# 3.0b Form 413 Addendum (Land Status & Personal Debt Disclosure)
def gen_3_0b():
    filepath = f"{BASE_PATH}/Section_3_Financial_Statements_and_Tax/3.0b_SBA_Form_413_Asset_Light_Addendum.pdf"
    doc, styles = get_document_template(filepath)
    story = [
        Paragraph("CEDRICK BYRD — PERSONAL GUARANTOR", styles['DocHeaderTitle']),
        Paragraph("SBA FORM 413: PERSONAL FINANCIAL STATEMENT ADDENDUM", styles['DocSubHeader']),
        HRFlowable(width="100%", thickness=1.5, color=PRIMARY_COLOR, spaceAfter=12),
        Paragraph("<b>Guarantor:</b> Cedrick Byrd | <b>Entity:</b> TxImhotep LLC | <b>Date:</b> October 27, 2026", styles['CustomBody']),
        Spacer(1, 8),
        
        Paragraph("1. Real Estate Asset Clarification (Section 4 Reference)", styles['SectionHeader']),
        Paragraph("The 5.61-acre unencumbered parcel located in Limestone County, TX (Parcel ID 17836) is listed on the attached Form 413 as a personal asset. However, this property is currently pending strategic liquidation. Therefore, it is designated as <b>Non-Collateralizable</b> and is unavailable for UCC encumbrance or Deed of Trust for this commercial facility. Collateralization for TxImhotep LLC relies entirely upon the $150,000+ capitalized software IP valuation.", styles['CustomBody']),
        
        Paragraph("2. Letter of Explanation: Derogatory Personal Credit Marks", styles['SectionHeader']),
        Paragraph("During the pre-revenue R&amp;D phase of TxImhotep LLC (2023-2025), personal credit lines were utilized extensively as a strategic bootstrapping mechanism. These funds directly financed the engineering, cloud architecture, and compliance overhead required to successfully launch SecureBase and achieve formal AWS Foundational Technical Review (FTR) approval.", styles['CustomBody']),
        Paragraph("Specifically, the <b>Bank of America (~$21k reduced to ~$17k estimated settlement)</b> and <b>Bank of the West (~$35k reduced to ~$27k estimated settlement)</b> accounts are personal obligations tied to my SSN. They are currently in active settlement/collections. These are personal obligations that will be resolved independently and are strictly isolated from TxImhotep LLC’s commercial cash flow, commercial balance sheet, and TSBCI loan proceeds.", styles['CustomBody']),
        
        Spacer(1, 12),
        Paragraph("Certified by,<br/><br/><b>Cedrick Byrd</b>", styles['CustomBody'])
    ]
    doc.build(story)
    print(f"Successfully generated: {filepath}")

# 3.3 Business Tax Return Explanation Letter
def gen_3_3():
    filepath = f"{BASE_PATH}/Section_3_Financial_Statements_and_Tax/3.3_Business_Tax_Returns_or_Zero_Revenue_Letter.pdf"
    doc, styles = get_document_template(filepath)
    story = [
        Paragraph("MEMORANDUM OF EXPLANATION", styles['DocHeaderTitle']),
        Paragraph("HISTORICAL BUSINESS TAX RETURN &amp; R&amp;D PHASE CLARIFICATION", styles['DocSubHeader']),
        HRFlowable(width="100%", thickness=1.5, color=PRIMARY_COLOR, spaceAfter=12),
        Paragraph("<b>TO:</b> Credit Underwriting Department, PeopleFund<br/><b>FROM:</b> Cedrick Byrd, Founder &amp; CEO, TxImhotep LLC<br/><b>DATE:</b> October 27, 2026", styles['CustomBody']),
        Spacer(1, 8),
        Paragraph("1. Entity Formation & Dormant Period (2019 - 2022)", styles['SectionHeader']),
        Paragraph("Upon formation in April 2019, TxImhotep LLC operated as a dormant holding entity until capital allocation and active software R&amp;D for the SecureBase platform formally commenced in 2023.", styles['CustomBody']),
        Paragraph("2. R&amp;D Pre-Revenue Phase (2023 - 2025)", styles['SectionHeader']),
        Paragraph("TxImhotep LLC operated primarily as an R&amp;D vehicle to build SecureBase. Revenue was nominal/zero prior to AWS FTR completion in May 2026.", styles['CustomBody']),
        Paragraph("3. Disregarded Entity Filings", styles['SectionHeader']),
        Paragraph("All business R&amp;D activities flowed through personal Form 1040 Schedule C filings, attached in Section 3.4.", styles['CustomBody']),
        Spacer(1, 12),
        Paragraph("Respectfully submitted,<br/><br/><b>Cedrick Byrd</b>, Founder &amp; CEO", styles['CustomBody'])
    ]
    doc.build(story)

# 3.5 Business Debt Schedule ($0 Commercial Debt)
def gen_3_5():
    filepath = f"{BASE_PATH}/Section_3_Financial_Statements_and_Tax/3.5_Business_Debt_Schedule_SBA_Form_2202.pdf"
    doc, styles = get_document_template(filepath)
    story = [
        Paragraph("TXIMHOTEP LLC", styles['DocHeaderTitle']),
        Paragraph("SCHEDULE OF BUSINESS DEBT — SBA FORM 2202 EQUIVALENT", styles['DocSubHeader']),
        HRFlowable(width="100%", thickness=1.5, color=PRIMARY_COLOR, spaceAfter=12),
        Paragraph("<b>Borrower:</b> TxImhotep LLC | <b>Status:</b> Zero Commercial Debt ($0 Liabilities)", styles['CustomBody']),
        Spacer(1, 8),
        Paragraph("I certify that TxImhotep LLC maintains zero outstanding institutional debt, commercial lines of credit, or business-issued liabilities as of October 27, 2026. All bootstrapping liabilities were secured personally by the Guarantor and are disclosed on the accompanying SBA Form 413.", styles['CustomBody']),
        Spacer(1, 12),
        Paragraph("Certified by,<br/><br/><b>Cedrick Byrd</b>, Founder &amp; CEO", styles['CustomBody'])
    ]
    doc.build(story)

# 4.2 Use of Funds Budget
def gen_4_2():
    filepath = f"{BASE_PATH}/Section_4_Operations_and_Strategy/4.2_Detailed_Use_of_Funds_Budget.pdf"
    doc, styles = get_document_template(filepath)
    story = [
        Paragraph("TXIMHOTEP LLC", styles['DocHeaderTitle']),
        Paragraph("PEOPLEFUND TSBCI MICROLOAN PROGRAM — USE OF FUNDS BUDGET", styles['DocSubHeader']),
        HRFlowable(width="100%", thickness=1.5, color=PRIMARY_COLOR, spaceAfter=12),
        Paragraph("<b>Facility Request:</b> $35,000 Working Capital | <b>Deployment:</b> Q4 2026 - Q2 2027", styles['CustomBody']),
        Spacer(1, 8),
        Paragraph("Summary Budget Breakdown", styles['SectionHeader']),
    ]
    data = [
        ["Category", "Allocation", "%", "Objective"],
        ["Commercialization & Marketing", "$14,000", "40.0%", "Bank CISO outreach & battlecard deployment"],
        ["Legal & IP Strategy", "$11,000", "31.4%", "USPTO Provisional Patent & SOC 2 Type I gap analysis"],
        ["Multi-Cloud Infrastructure", "$6,000", "17.1%", "AWS/GCP staging & benchmark suite runs"],
        ["Working Capital Reserve", "$4,000", "11.5%", "General administrative & state filing buffer"],
        ["TOTAL FACILITY", "$35,000", "100.0%", "Full Microloan Deployment"]
    ]
    t = Table(data, colWidths=[140, 65, 45, 254])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY_COLOR),
        ('TEXTCOLOR', (0,0), (-1,0), HexColor("#FFFFFF")),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('ROWBACKGROUNDS', (0,1), (-1,-2), [LIGHT_BG, HexColor("#FFFFFF")]),
        ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
        ('BACKGROUND', (0,-1), (-1,-1), HexColor("#E2E8F0")),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR)
    ]))
    story.append(t)
    doc.build(story)

if __name__ == "__main__":
    gen_1_0()
    gen_1_1()
    gen_1_3()
    gen_1_5()
    gen_1_7()
    gen_2_1()
    gen_3_0b()
    gen_3_3()
    gen_3_5()
    gen_4_2()
