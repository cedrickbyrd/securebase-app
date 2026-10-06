#!/bin/bash
# SecureBase Antigravity Harness - Initialization Script
# Architecture: Python (Antigravity SDK) + Node.js (securebase-mcp)

set -euo pipefail

# Define colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Initializing SecureBase Antigravity Harness...${NC}\n"

# 1. Directory Scaffolding
echo -e "${YELLOW}Creating harness directory structure...${NC}"
mkdir -p harness/{trajectories,artifacts,hooks}
mkdir -p harness/skills/{securebase-sovereign-bank,securebase-sovereign-hipaa}
touch harness/skills/securebase-sovereign-bank/SKILL.md
touch harness/skills/securebase-sovereign-hipaa/SKILL.md
echo "Directories created."

# 2. Python Virtual Environment & SDK Installation
echo -e "\n${YELLOW}Setting up isolated Python environment...${NC}"
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
    echo "Virtual environment '.venv' created."
else
    echo "Virtual environment '.venv' already exists."
fi

echo "Activating .venv and installing Python dependencies..."
# Sourcing within the script to install dependencies to the venv
source .venv/bin/activate
pip install --upgrade pip

# Pinning mcp<2 to prevent the ModuleNotFoundError with mcp.server.fastmcp
pip install google-antigravity "mcp<2" 

# 3. Node.js MCP Server Build
echo -e "\n${YELLOW}Building TypeScript securebase-mcp server...${NC}"
# Assuming securebase-mcp is a directory within cedrickbyrd/securebase-app
if [ -d "securebase-mcp" ]; then
    cd securebase-mcp
    echo "Installing NPM dependencies..."
    npm install
    echo "Compiling TypeScript payload..."
    npm run build
    cd ..
else
    echo -e "${YELLOW}Warning: 'securebase-mcp' directory not found in current path. Skipping Node.js build.${NC}"
fi

# 4. Environment Configuration
echo -e "\n${YELLOW}Scaffolding local .env...${NC}"
if [ ! -f "harness/.env" ]; then
    cat <<EOF > harness/.env
# SecureBase Antigravity Runtime Configuration
GEMINI_API_KEY="your_gemini_api_key_here"
HARNESS_PAT="your_harness_personal_access_token_here"

# Domain Isolation Hook Guardrails
TARGET_DOMAIN="demo.securebase.tximhotep.com"
ALLOWED_GCS_STATE_BUCKET="securebase-tf-state-securebase-gcp-dev"

# TX-RAMP / SOC 2 Compliance Configuration
AUDIT_MODE="strict"
EOF
    echo "harness/.env template generated."
else
    echo "harness/.env already exists. Skipping."
fi

# 5. Bootstrap File
echo -e "\n${YELLOW}Generating main Antigravity entry point...${NC}"
if [ ! -f "harness/main.py" ]; then
    cat <<EOF > harness/main.py
import asyncio
from google.antigravity import Agent, LocalAgentConfig

async def main():
    print("SecureBase Antigravity Harness initialized. Awaiting hook implementations.")

if __name__ == "__main__":
    asyncio.run(main())
EOF
fi

echo -e "\n${GREEN}✅ SecureBase Harness Setup Complete!${NC}"
echo -e "To activate the environment and start development, run:"
echo -e "  ${BLUE}source .venv/bin/activate${NC}"
echo -e "  ${BLUE}cd harness${NC}"
