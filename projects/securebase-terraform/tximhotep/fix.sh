#!/bin/zsh

DOWNLOADS="/Users/cedrickbyrd/Downloads"
TARGET_DIR="treasury/loan_packets/PeopleFund_Microloan_2026"

# 1. Create target subdirectories in treasury
mkdir -p "$TARGET_DIR"/{00_Memorandum,01_Entity_Docs,02_Financials_and_SBA_Forms,03_Exhibits_Technical_and_Traction,04_Collateral_Real_Estate}

# 2. Copy files from Downloads into repo treasury
cp "$DOWNLOADS/TxImhotep_PeopleFund_Loan_Packet.md" "$TARGET_DIR/00_Memorandum/" 2>/dev/null || true

cp "$DOWNLOADS/IRS_EIN_CP575G_Notice.pdf" "$TARGET_DIR/01_Entity_Docs/" 2>/dev/null || true
cp "$DOWNLOADS/Certificate_of_Formation_SOS_803279216.pdf" "$TARGET_DIR/01_Entity_Docs/" 2>/dev/null || true

cp "$DOWNLOADS/TxImhotep_SBA_Business_Plan_2026-3.pdf" "$TARGET_DIR/02_Financials_and_SBA_Forms/SBA_Business_Plan_2026.pdf" 2>/dev/null || true
cp "$DOWNLOADS/TxImhotep_3_Year_Financial_Projections.pdf" "$TARGET_DIR/02_Financials_and_SBA_Forms/" 2>/dev/null || true
cp "$DOWNLOADS/TxImhotep_LLC_Financial_Schedules-1-2.pdf" "$TARGET_DIR/02_Financials_and_SBA_Forms/" 2>/dev/null || true
cp "$DOWNLOADS/SBA 2202 Schedule of Liabilities (1).pdf" "$TARGET_DIR/02_Financials_and_SBA_Forms/" 2>/dev/null || true
cp "$DOWNLOADS/SBA_Form_413_Personal_Financial_Statement_Completed-1.pdf" "$TARGET_DIR/02_Financials_and_SBA_Forms/" 2>/dev/null || true

cp "$DOWNLOADS/Exhibits_A_and_B_TxImhotep.pdf" "$TARGET_DIR/03_Exhibits_Technical_and_Traction/" 2>/dev/null || true
cp "$DOWNLOADS/SecureBase_AWS_Architecture_FTR.pdf" "$TARGET_DIR/03_Exhibits_Technical_and_Traction/" 2>/dev/null || true
cp "$DOWNLOADS/AWS_MP_GTM_ProgramOverview.pdf" "$TARGET_DIR/03_Exhibits_Technical_and_Traction/" 2>/dev/null || true
cp "$DOWNLOADS/SecureBase_FFIEC_Integration_Strategy.pdf" "$TARGET_DIR/03_Exhibits_Technical_and_Traction/" 2>/dev/null || true
cp "$DOWNLOADS/SecureBase_Security_Whitepaper.pdf" "$TARGET_DIR/03_Exhibits_Technical_and_Traction/" 2>/dev/null || true
cp "$DOWNLOADS/Securebase-Demand-Events.pdf" "$TARGET_DIR/03_Exhibits_Technical_and_Traction/" 2>/dev/null || true

cp "$DOWNLOADS/City-of-Mexia---Zoninig-Map-rotated.pdf" "$TARGET_DIR/04_Collateral_Real_Estate/" 2>/dev/null || true

# 3. Output structure for review
ls -R "$TARGET_DIR"
