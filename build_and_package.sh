#!/bin/bash

# Define absolute paths and target directories
PROJECT_ROOT="/Users/cedrickbyrd/projects/securebase-terraform/tximhotep"
VENV_PYTHON="${PROJECT_ROOT}/.venv/bin/python3.14"
PACKAGE_DIR="${PROJECT_ROOT}/treasury/loan_packets/PeopleFund_TSBCI_Microloan_Package"
ZIP_OUTPUT="${PROJECT_ROOT}/treasury/loan_packets/PeopleFund_TSBCI_Microloan_Package_Master.zip"

echo "========================================================"
echo "  PeopleFund TSBCI Microloan Package - Master Build Engine"
echo "========================================================"

# 1. Execute script.py using explicit Python 3.14 interpreter
echo "1. Generating PDFs via Python 3.14 script.py..."
if [ -f "${VENV_PYTHON}" ]; then
    "${VENV_PYTHON}" "${PROJECT_ROOT}/script.py"
else
    echo "ERROR: Virtual environment Python 3.14 not found at ${VENV_PYTHON}"
    exit 1
fi

echo "--------------------------------------------------------"
echo "2. Auditing PDF File Sizes in Package..."
echo "--------------------------------------------------------"

# 2. Audit all PDF files for zero-byte placeholders
ZERO_BYTE_COUNT=0
TOTAL_FILE_COUNT=0

while IFS= read -r pdf_file; do
    TOTAL_FILE_COUNT=$((TOTAL_FILE_COUNT + 1))
    FILE_SIZE=$(wc -c < "$pdf_file" | tr -d ' ')
    FILE_NAME=$(basename "$pdf_file")
    
    if [ "$FILE_SIZE" -eq 0 ]; then
        echo "  [FAIL] $FILE_NAME -> $FILE_SIZE bytes (ZERO-BYTE PLACEHOLDER)"
        ZERO_BYTE_COUNT=$((ZERO_BYTE_COUNT + 1))
    else
        echo "  [PASS] $FILE_NAME -> $FILE_SIZE bytes"
    fi
done < <(find "${PACKAGE_DIR}" -type f -name "*.pdf")

echo "--------------------------------------------------------"
echo "Audit Summary: ${TOTAL_FILE_COUNT} files total | ${ZERO_BYTE_COUNT} zero-byte warnings"
echo "--------------------------------------------------------"

if [ "$ZERO_BYTE_COUNT" -gt 0 ]; then
    echo "WARNING: ${ZERO_BYTE_COUNT} empty placeholders remain in the package."
fi

# 3. Create Master ZIP Archive
echo "3. Packaging Master ZIP Archive..."
cd "${PROJECT_ROOT}/treasury/loan_packets" || exit 1
zip -r -q "$(basename "$ZIP_OUTPUT")" "PeopleFund_TSBCI_Microloan_Package"

if [ -f "$ZIP_OUTPUT" ]; then
    ZIP_SIZE=$(wc -c < "$ZIP_OUTPUT" | tr -d ' ')
    echo "========================================================"
    echo "SUCCESS: Master Archive Created!"
    echo "Path: ${ZIP_OUTPUT}"
    echo "Size: ${ZIP_SIZE} bytes"
    echo "========================================================"
else
    echo "ERROR: Failed to create master ZIP archive."
    exit 1
fi
