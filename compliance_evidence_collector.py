#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║          ENTERPRISE COMPLIANCE EVIDENCE COLLECTOR v2.0                       ║
║          Frameworks: SOC2 | SOX | HIPAA | FedRAMP                            ║
║          Author  : Enterprise Security Team                                  ║
║          License : MIT                                                       ║
║          TxImhotep LLC
╚══════════════════════════════════════════════════════════════════════════════╝

USAGE
-----
  python compliance_evidence_collector.py [OPTIONS]

  --frameworks  soc2 sox hipaa fedramp   (default: all)
  --output-dir  /path/to/evidence        (default: ./evidence_<timestamp>)
  --format      json csv html            (default: json)
  --cloud       aws azure gcp            (auto-detected if not specified)
  --verbose                              Enable debug logging
  --dry-run                              Enumerate checks without executing

REQUIREMENTS
------------
  pip install boto3 azure-identity azure-mgmt-compute google-cloud-asset
              paramiko psutil requests cryptography rich tabulate jinja2

  * AWS  : IAM role or environment credentials (read-only policy recommended)
  * Azure: Service principal with Reader role
  * GCP  : Service account with Security Reviewer role
"""

from __future__ import annotations

import argparse
import csv
import datetime
import hashlib
import json
import logging
import os
import platform
import re
import shutil
import socket
import subprocess
import sys
import textwrap
import time
import traceback
import uuid
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

# ──────────────────────────────────────────────────────────────────────────────
# OPTIONAL RICH CONSOLE  (gracefully degrades if not installed)
# ──────────────────────────────────────────────────────────────────────────────
try:
    from rich.console import Console
    from rich.table import Table
    from rich.progress import Progress, SpinnerColumn, TextColumn
    from rich.panel import Panel
    from rich import print as rprint
    RICH = True
except ImportError:
    RICH = False
    Console = None  # type: ignore

# ──────────────────────────────────────────────────────────────────────────────
# CONSTANTS & ENUMERATIONS
# ──────────────────────────────────────────────────────────────────────────────
VERSION = "2.0.0"
TOOL_NAME = "ComplianceEvidenceCollector"

class Framework(str, Enum):
    SOC2    = "soc2"
    SOX     = "sox"
    HIPAA   = "hipaa"
    FEDRAMP = "fedramp"

class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH     = "HIGH"
    MEDIUM   = "MEDIUM"
    LOW      = "LOW"
    INFO     = "INFO"

class Status(str, Enum):
    PASS    = "PASS"
    FAIL    = "FAIL"
    WARN    = "WARN"
    ERROR   = "ERROR"
    SKIP    = "SKIP"

# ──────────────────────────────────────────────────────────────────────────────
# DATA MODELS
# ──────────────────────────────────────────────────────────────────────────────
@dataclass
class EvidenceItem:
    check_id:      str
    title:         str
    framework:     str
    control_ref:   str          # e.g. "CC6.1", "164.312(a)(1)", "AC-2"
    category:      str
    severity:      str
    status:        str
    details:       str
    remediation:   str
    raw_evidence:  Any          = field(default=None, repr=False)
    timestamp:     str          = field(default_factory=lambda: datetime.datetime.utcnow().isoformat() + "Z")
    collector:     str          = TOOL_NAME
    version:       str          = VERSION
    run_id:        str          = ""
    host:          str          = field(default_factory=socket.gethostname)
    tags:          List[str]    = field(default_factory=list)

    def to_dict(self) -> Dict:
        d = asdict(self)
        # Serialize raw_evidence safely
        try:
            json.dumps(d["raw_evidence"])
        except (TypeError, ValueError):
            d["raw_evidence"] = str(d["raw_evidence"])
        return d


@dataclass
class CollectionSummary:
    run_id:         str
    started_at:     str
    finished_at:    str
    duration_sec:   float
    frameworks:     List[str]
    total_checks:   int
    passed:         int
    failed:         int
    warned:         int
    errored:        int
    skipped:        int
    score_pct:      float
    host:           str
    os_info:        str
    python_version: str
    output_dir:     str


# ──────────────────────────────────────────────────────────────────────────────
# LOGGING
# ──────────────────────────────────────────────────────────────────────────────
def setup_logging(verbose: bool = False, log_file: Optional[Path] = None) -> logging.Logger:
    level = logging.DEBUG if verbose else logging.INFO
    handlers: List[logging.Handler] = [logging.StreamHandler(sys.stdout)]
    if log_file:
        handlers.append(logging.FileHandler(log_file))
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%SZ",
        handlers=handlers,
    )
    return logging.getLogger(TOOL_NAME)


# ──────────────────────────────────────────────────────────────────────────────
# BASE COLLECTOR
# ──────────────────────────────────────────────────────────────────────────────
class BaseCollector:
    """Abstract base for all framework-specific collectors."""

    framework: str = "base"

    def __init__(self, run_id: str, logger: logging.Logger, dry_run: bool = False):
        self.run_id   = run_id
        self.logger   = logger
        self.dry_run  = dry_run
        self.evidence: List[EvidenceItem] = []

    # ── helpers ────────────────────────────────────────────────────────────────
    def _add(
        self,
        check_id:    str,
        title:       str,
        control_ref: str,
        category:    str,
        severity:    str,
        status:      str,
        details:     str,
        remediation: str,
        raw:         Any   = None,
        tags:        list  = None,
    ) -> EvidenceItem:
        item = EvidenceItem(
            check_id=check_id,
            title=title,
            framework=self.framework,
            control_ref=control_ref,
            category=category,
            severity=severity,
            status=status,
            details=details,
            remediation=remediation,
            raw_evidence=raw,
            run_id=self.run_id,
            tags=tags or [],
        )
        self.evidence.append(item)
        icon = {"PASS": "✅", "FAIL": "❌", "WARN": "⚠️", "ERROR": "💥", "SKIP": "⏭️"}.get(status, "")
        self.logger.info(f"  [{self.framework.upper()}] {icon} {check_id}: {title} → {status}")
        return item

    def _safe_run(self, fn: Callable, *args, **kwargs) -> Any:
        """Execute a callable; return None on any exception."""
        try:
            return fn(*args, **kwargs)
        except Exception as exc:
            self.logger.debug(f"Safe run failed: {fn.__name__}: {exc}")
            return None

    def _run_cmd(self, cmd: str, timeout: int = 15) -> Tuple[int, str]:
        """Run a shell command; returns (returncode, combined output)."""
        try:
            result = subprocess.run(
                cmd, shell=True, capture_output=True, text=True, timeout=timeout
            )
            return result.returncode, (result.stdout + result.stderr).strip()
        except subprocess.TimeoutExpired:
            return -1, "Command timed out"
        except Exception as exc:
            return -1, str(exc)

    def collect(self) -> List[EvidenceItem]:
        raise NotImplementedError


# ──────────────────────────────────────────────────────────────────────────────
# SOC 2 COLLECTOR  (Trust Services Criteria)
# ──────────────────────────────────────────────────────────────────────────────
class SOC2Collector(BaseCollector):
    """
    Controls mapped to AICPA Trust Services Criteria 2017
    CC1–CC9 (Common Criteria), A1 (Availability), C1 (Confidentiality),
    PI1 (Processing Integrity), P1–P8 (Privacy)
    """

    framework = Framework.SOC2.value

    def collect(self) -> List[EvidenceItem]:
        self.logger.info("=== SOC 2 Collection Started ===")
        self._cc1_organization_and_management()
        self._cc2_communication_and_information()
        self._cc3_risk_assessment()
        self._cc4_monitoring_activities()
        self._cc5_control_activities()
        self._cc6_logical_access()
        self._cc7_system_operations()
        self._cc8_change_management()
        self._cc9_risk_mitigation()
        self._a1_availability()
        self._c1_confidentiality()
        return self.evidence

    # ── CC1: Organization & Management ────────────────────────────────────────
    def _cc1_organization_and_management(self):
        # Check for security policy files
        policy_locations = [
            "/etc/security/policy.txt", "/etc/security/information_security_policy.md",
            Path.home() / "security_policy.txt",
        ]
        found_policy = any(Path(p).exists() for p in policy_locations)
        self._add(
            check_id="SOC2-CC1.1",
            title="Information Security Policy Exists",
            control_ref="CC1.1",
            category="Organization & Management",
            severity=Severity.HIGH.value,
            status=Status.PASS.value if found_policy else Status.WARN.value,
            details="Policy file found on host." if found_policy
                    else "No policy document found in standard locations. Verify policy is documented.",
            remediation="Maintain a documented Information Security Policy (ISP) and store it in a central location.",
            tags=["policy", "governance"],
        )

        # Check if auditd / syslog is running (control environment awareness)
        rc, out = self._run_cmd("systemctl is-active auditd 2>/dev/null || service auditd status 2>/dev/null || echo inactive")
        audit_active = "active" in out.lower()
        self._add(
            check_id="SOC2-CC1.2",
            title="Audit Daemon Active (Control Environment)",
            control_ref="CC1.2",
            category="Organization & Management",
            severity=Severity.HIGH.value,
            status=Status.PASS.value if audit_active else Status.FAIL.value,
            details=f"auditd status: {out[:200]}",
            remediation="Enable and configure auditd to capture security-relevant events per CISA guidance.",
            raw=out,
            tags=["audit", "logging"],
        )

    # ── CC2: Communication & Information ─────────────────────────────────────
    def _cc2_communication_and_information(self):
        # Syslog / rsyslog / journald
        for svc in ("rsyslog", "syslog", "systemd-journald"):
            rc, out = self._run_cmd(f"systemctl is-active {svc} 2>/dev/null")
            if "active" in out:
                self._add(
                    check_id="SOC2-CC2.1",
                    title=f"System Logging Service Active ({svc})",
                    control_ref="CC2.1",
                    category="Communication & Information",
                    severity=Severity.MEDIUM.value,
                    status=Status.PASS.value,
                    details=f"{svc} is active.",
                    remediation="N/A",
                    tags=["logging"],
                )
                break
        else:
            self._add(
                check_id="SOC2-CC2.1",
                title="System Logging Service Active",
                control_ref="CC2.1",
                category="Communication & Information",
                severity=Severity.MEDIUM.value,
                status=Status.FAIL.value,
                details="No recognized syslog service detected as active.",
                remediation="Install and enable rsyslog or journald for centralized log management.",
                tags=["logging"],
            )

    # ── CC3: Risk Assessment ──────────────────────────────────────────────────
    def _cc3_risk_assessment(self):
        # Check vulnerability scanner presence
        scanners = ["openvas", "nessus", "trivy", "grype", "lynis"]
        found = [s for s in scanners if shutil.which(s)]
        self._add(
            check_id="SOC2-CC3.1",
            title="Vulnerability Scanner Present",
            control_ref="CC3.1",
            category="Risk Assessment",
            severity=Severity.HIGH.value,
            status=Status.PASS.value if found else Status.WARN.value,
            details=f"Found scanners: {found}" if found else "No common vulnerability scanner found in PATH.",
            remediation="Deploy a vulnerability scanner (e.g., Trivy, Lynis, Nessus) and schedule periodic scans.",
            tags=["vulnerability-management"],
        )

        # Check for patch management indicators (unattended-upgrades)
        rc, out = self._run_cmd("dpkg -l unattended-upgrades 2>/dev/null || rpm -q dnf-automatic 2>/dev/null || echo notfound")
        patch_present = "notfound" not in out and rc == 0
        self._add(
            check_id="SOC2-CC3.2",
            title="Automated Patch Management Configured",
            control_ref="CC3.2",
            category="Risk Assessment",
            severity=Severity.HIGH.value,
            status=Status.PASS.value if patch_present else Status.WARN.value,
            details=out[:300],
            remediation="Enable unattended-upgrades (Debian/Ubuntu) or dnf-automatic (RHEL) for automatic security patches.",
            raw=out,
            tags=["patch-management"],
        )

    # ── CC4: Monitoring Activities ────────────────────────────────────────────
    def _cc4_monitoring_activities(self):
        # Check SIEM / log forwarding agents
        agents = ["filebeat", "fluentd", "logstash", "splunkd", "td-agent", "vector"]
        found = [a for a in agents if shutil.which(a) or self._svc_active(a)]
        self._add(
            check_id="SOC2-CC4.1",
            title="Log Forwarding / SIEM Agent Present",
            control_ref="CC4.1",
            category="Monitoring Activities",
            severity=Severity.HIGH.value,
            status=Status.PASS.value if found else Status.WARN.value,
            details=f"Found agents: {found}" if found else "No log forwarding agent detected.",
            remediation="Deploy a log forwarding agent (Filebeat, Fluentd, Splunk UF) to send logs to a SIEM.",
            tags=["siem", "monitoring"],
        )

        # Uptime / availability metrics
        try:
            import psutil  # type: ignore
            boot_time = datetime.datetime.fromtimestamp(psutil.boot_time())
            uptime_days = (datetime.datetime.now() - boot_time).days
            self._add(
                check_id="SOC2-CC4.2",
                title="System Uptime Metrics Captured",
                control_ref="CC4.2",
                category="Monitoring Activities",
                severity=Severity.LOW.value,
                status=Status.PASS.value,
                details=f"System uptime: {uptime_days} days (boot: {boot_time.isoformat()}).",
                remediation="N/A",
                raw={"uptime_days": uptime_days, "boot_time": boot_time.isoformat()},
                tags=["availability"],
            )
        except ImportError:
            self._add(
                check_id="SOC2-CC4.2",
                title="System Uptime Metrics Captured",
                control_ref="CC4.2",
                category="Monitoring Activities",
                severity=Severity.LOW.value,
                status=Status.SKIP.value,
                details="psutil not installed; uptime check skipped.",
                remediation="pip install psutil",
                tags=["availability"],
            )

    # ── CC5: Control Activities ───────────────────────────────────────────────
    def _cc5_control_activities(self):
        # Firewall / iptables
        for fw in ("ufw", "firewalld", "iptables"):
            rc, out = self._run_cmd(f"systemctl is-active {fw} 2>/dev/null")
            if "active" in out.lower():
                self._add(
                    check_id="SOC2-CC5.1",
                    title=f"Host Firewall Active ({fw})",
                    control_ref="CC5.1",
                    category="Control Activities",
                    severity=Severity.HIGH.value,
                    status=Status.PASS.value,
                    details=f"{fw} is active.",
                    remediation="N/A",
                    tags=["firewall", "network"],
                )
                break
        else:
            self._add(
                check_id="SOC2-CC5.1",
                title="Host Firewall Active",
                control_ref="CC5.1",
                category="Control Activities",
                severity=Severity.HIGH.value,
                status=Status.FAIL.value,
                details="No active firewall service detected.",
                remediation="Enable ufw or firewalld and define ingress/egress rules.",
                tags=["firewall", "network"],
            )

    # ── CC6: Logical and Physical Access ─────────────────────────────────────
    def _cc6_logical_access(self):
        # Password policy - /etc/login.defs
        login_defs = Path("/etc/login.defs")
        if login_defs.exists():
            content = login_defs.read_text()
            max_days = re.search(r"^\s*PASS_MAX_DAYS\s+(\d+)", content, re.M)
            min_len  = re.search(r"^\s*PASS_MIN_LEN\s+(\d+)",  content, re.M)
            days_val = int(max_days.group(1)) if max_days else 9999
            len_val  = int(min_len.group(1))  if min_len  else 0

            self._add(
                check_id="SOC2-CC6.1",
                title="Password Maximum Age ≤ 90 days",
                control_ref="CC6.1",
                category="Logical Access",
                severity=Severity.HIGH.value,
                status=Status.PASS.value if days_val <= 90 else Status.FAIL.value,
                details=f"PASS_MAX_DAYS = {days_val}",
                remediation="Set PASS_MAX_DAYS to 90 or fewer in /etc/login.defs.",
                raw={"PASS_MAX_DAYS": days_val},
                tags=["passwords", "iam"],
            )
            self._add(
                check_id="SOC2-CC6.2",
                title="Password Minimum Length ≥ 12 characters",
                control_ref="CC6.2",
                category="Logical Access",
                severity=Severity.HIGH.value,
                status=Status.PASS.value if len_val >= 12 else Status.FAIL.value,
                details=f"PASS_MIN_LEN = {len_val}",
                remediation="Set PASS_MIN_LEN to 12+ in /etc/login.defs or configure pam_pwquality.",
                raw={"PASS_MIN_LEN": len_val},
                tags=["passwords", "iam"],
            )
        else:
            self._add(
                check_id="SOC2-CC6.1",
                title="Password Policy (login.defs)",
                control_ref="CC6.1",
                category="Logical Access",
                severity=Severity.HIGH.value,
                status=Status.SKIP.value,
                details="/etc/login.defs not found (non-Linux or container environment).",
                remediation="Ensure OS-level password policies are enforced.",
                tags=["passwords", "iam"],
            )

        # SSH Root Login
        sshd_config = Path("/etc/ssh/sshd_config")
        if sshd_config.exists():
            ssh_content = sshd_config.read_text()
            root_login  = re.search(r"^\s*PermitRootLogin\s+(\S+)", ssh_content, re.M | re.I)
            root_val    = root_login.group(1).lower() if root_login else "yes"
            self._add(
                check_id="SOC2-CC6.3",
                title="SSH Root Login Disabled",
                control_ref="CC6.3",
                category="Logical Access",
                severity=Severity.CRITICAL.value,
                status=Status.PASS.value if root_val in ("no", "prohibit-password", "forced-commands-only")
                       else Status.FAIL.value,
                details=f"PermitRootLogin = {root_val}",
                remediation="Set PermitRootLogin no in /etc/ssh/sshd_config and reload sshd.",
                raw={"PermitRootLogin": root_val},
                tags=["ssh", "iam"],
            )

            # SSH Protocol version
            proto = re.search(r"^\s*Protocol\s+(\S+)", ssh_content, re.M | re.I)
            proto_val = proto.group(1) if proto else "2"
            self._add(
                check_id="SOC2-CC6.4",
                title="SSH Protocol Version 2 Only",
                control_ref="CC6.4",
                category="Logical Access",
                severity=Severity.HIGH.value,
                status=Status.PASS.value if proto_val == "2" else Status.FAIL.value,
                details=f"Protocol = {proto_val}",
                remediation="Set Protocol 2 in /etc/ssh/sshd_config.",
                tags=["ssh", "iam"],
            )

        # World-writable files check (sample of /tmp)
        rc, out = self._run_cmd("find /tmp -maxdepth 2 -perm -0002 -type f 2>/dev/null | head -20")
        ww_files = [l for l in out.splitlines() if l.strip()]
        self._add(
            check_id="SOC2-CC6.5",
            title="World-Writable Files in /tmp",
            control_ref="CC6.5",
            category="Logical Access",
            severity=Severity.MEDIUM.value,
            status=Status.WARN.value if ww_files else Status.PASS.value,
            details=f"Found {len(ww_files)} world-writable files in /tmp." if ww_files
                    else "No world-writable files found in /tmp.",
            remediation="Review and remediate world-writable files. Use sticky bit on shared directories.",
            raw=ww_files,
            tags=["file-permissions"],
        )

    # ── CC7: System Operations ────────────────────────────────────────────────
    def _cc7_system_operations(self):
        # Check for failed login attempts in auth log
        for log_path in ("/var/log/auth.log", "/var/log/secure"):
            p = Path(log_path)
            if p.exists():
                rc, out = self._run_cmd(f"grep -c 'Failed password' {log_path} 2>/dev/null || echo 0")
                fail_count = int(out.strip()) if out.strip().isdigit() else 0
                self._add(
                    check_id="SOC2-CC7.1",
                    title="Failed SSH Login Attempts (Last Log)",
                    control_ref="CC7.1",
                    category="System Operations",
                    severity=Severity.HIGH.value if fail_count > 100 else Severity.LOW.value,
                    status=Status.WARN.value if fail_count > 100 else Status.PASS.value,
                    details=f"Failed password attempts in {log_path}: {fail_count}",
                    remediation="Investigate brute-force attempts. Implement fail2ban or similar intrusion prevention.",
                    raw={"failed_logins": fail_count, "log": log_path},
                    tags=["intrusion-detection", "authentication"],
                )
                break

        # Listening ports
        rc, out = self._run_cmd("ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null")
        self._add(
            check_id="SOC2-CC7.2",
            title="Listening Network Services Inventory",
            control_ref="CC7.2",
            category="System Operations",
            severity=Severity.INFO.value,
            status=Status.PASS.value,
            details="Network listening services captured for review.",
            remediation="Disable unnecessary services and ports per principle of least functionality.",
            raw=out[:2000],
            tags=["network", "inventory"],
        )

    # ── CC8: Change Management ────────────────────────────────────────────────
    def _cc8_change_management(self):
        # Git present & repo integrity
        git_present = shutil.which("git") is not None
        self._add(
            check_id="SOC2-CC8.1",
            title="Version Control System (git) Available",
            control_ref="CC8.1",
            category="Change Management",
            severity=Severity.MEDIUM.value,
            status=Status.PASS.value if git_present else Status.WARN.value,
            details="git found in PATH." if git_present else "git not found; version control may not be enforced.",
            remediation="Ensure all infrastructure and application changes are tracked in a version control system.",
            tags=["change-management", "scm"],
        )

        # Package manager history (apt / yum / dnf)
        for cmd, log in [
            ("grep 'install\|upgrade\|remove' /var/log/dpkg.log 2>/dev/null | tail -20", "/var/log/dpkg.log"),
            ("grep 'Installed\|Upgraded\|Erased' /var/log/yum.log 2>/dev/null | tail -20", "/var/log/yum.log"),
            ("grep 'Installed\|Upgraded\|Erased' /var/log/dnf.log 2>/dev/null | tail -20", "/var/log/dnf.log"),
        ]:
            rc, out = self._run_cmd(cmd)
            if out.strip():
                self._add(
                    check_id="SOC2-CC8.2",
                    title="Package Change History Available",
                    control_ref="CC8.2",
                    category="Change Management",
                    severity=Severity.LOW.value,
                    status=Status.PASS.value,
                    details=f"Recent package changes from {log}.",
                    remediation="N/A",
                    raw=out[:2000],
                    tags=["change-management", "packages"],
                )
                break

    # ── CC9: Risk Mitigation ──────────────────────────────────────────────────
    def _cc9_risk_mitigation(self):
        # Backup tools
        backup_tools = ["rsync", "duplicati", "bacula", "restic", "borg", "aws", "gsutil", "azcopy"]
        found = [t for t in backup_tools if shutil.which(t)]
        self._add(
            check_id="SOC2-CC9.1",
            title="Backup Tooling Present",
            control_ref="CC9.1",
            category="Risk Mitigation",
            severity=Severity.HIGH.value,
            status=Status.PASS.value if found else Status.WARN.value,
            details=f"Backup tools found: {found}" if found else "No backup tooling detected in PATH.",
            remediation="Implement automated, tested backups and verify restore procedures quarterly.",
            tags=["backup", "bcp"],
        )

    # ── A1: Availability ──────────────────────────────────────────────────────
    def _a1_availability(self):
        try:
            import psutil  # type: ignore
            disk = psutil.disk_usage("/")
            cpu  = psutil.cpu_percent(interval=1)
            mem  = psutil.virtual_memory()

            for metric, value, threshold, check_id, title in [
                ("disk_pct", disk.percent, 85, "SOC2-A1.1", "Disk Usage < 85%"),
                ("cpu_pct",  cpu,          90, "SOC2-A1.2", "CPU Usage < 90%"),
                ("mem_pct",  mem.percent,  90, "SOC2-A1.3", "Memory Usage < 90%"),
            ]:
                self._add(
                    check_id=check_id,
                    title=title,
                    control_ref="A1.1",
                    category="Availability",
                    severity=Severity.HIGH.value if value >= threshold else Severity.LOW.value,
                    status=Status.PASS.value if value < threshold else Status.WARN.value,
                    details=f"{metric} = {value:.1f}%",
                    remediation=f"Investigate high {metric}. Scale resources or archive data.",
                    raw={metric: value},
                    tags=["availability", "capacity"],
                )
        except ImportError:
            self._add(
                check_id="SOC2-A1.1",
                title="System Resource Availability",
                control_ref="A1.1",
                category="Availability",
                severity=Severity.MEDIUM.value,
                status=Status.SKIP.value,
                details="psutil not installed.",
                remediation="pip install psutil",
                tags=["availability"],
            )

    # ── C1: Confidentiality ───────────────────────────────────────────────────
    def _c1_confidentiality(self):
        # TLS/SSL tooling
        openssl_present = shutil.which("openssl") is not None
        self._add(
            check_id="SOC2-C1.1",
            title="OpenSSL / TLS Tooling Present",
            control_ref="C1.1",
            category="Confidentiality",
            severity=Severity.MEDIUM.value,
            status=Status.PASS.value if openssl_present else Status.WARN.value,
            details="openssl found in PATH." if openssl_present else "openssl not found.",
            remediation="Install openssl and enforce TLS ≥ 1.2 for all data-in-transit.",
            tags=["encryption", "tls"],
        )

        # LUKS / disk encryption
        rc, out = self._run_cmd("lsblk -o NAME,TYPE,FSTYPE 2>/dev/null | grep -i crypt")
        encrypted = bool(out.strip())
        self._add(
            check_id="SOC2-C1.2",
            title="Disk Encryption Detected (LUKS/dm-crypt)",
            control_ref="C1.2",
            category="Confidentiality",
            severity=Severity.HIGH.value,
            status=Status.PASS.value if encrypted else Status.WARN.value,
            details="Encrypted block device found." if encrypted
                    else "No LUKS-encrypted volumes detected. Verify encryption at-rest.",
            remediation="Enable LUKS encryption on all volumes containing sensitive data.",
            tags=["encryption", "data-at-rest"],
        )

    # ── Helper ────────────────────────────────────────────────────────────────
    def _svc_active(self, name: str) -> bool:
        rc, out = self._run_cmd(f"systemctl is-active {name} 2>/dev/null")
        return "active" in out.lower()


# ──────────────────────────────────────────────────────────────────────────────
# SOX COLLECTOR  (IT General Controls)
# ──────────────────────────────────────────────────────────────────────────────
class SOXCollector(BaseCollector):
    """
    IT General Controls (ITGC) aligned with COSO / COBIT frameworks
    supporting Sarbanes-Oxley Section 302 & 404.
    """

    framework = Framework.SOX.value

    def collect(self) -> List[EvidenceItem]:
        self.logger.info("=== SOX Collection Started ===")
        self._access_controls()
        self._change_management()
        self._computer_operations()
        self._segregation_of_duties()
        self._data_backup_recovery()
        return self.evidence

    def _access_controls(self):
        # Privileged accounts
        rc, out = self._run_cmd("awk -F: '($3 == 0) {print $1}' /etc/passwd 2>/dev/null")
        root_accounts = [l.strip() for l in out.splitlines() if l.strip()]
        self._add(
            check_id="SOX-AC.1",
            title="Privileged Accounts Inventory (UID=0)",
            control_ref="COBIT DS5.4",
            category="Access Controls",
            severity=Severity.CRITICAL.value,
            status=Status.PASS.value if root_accounts == ["root"] else Status.FAIL.value,
            details=f"UID-0 accounts: {root_accounts}",
            remediation="Remove or disable unauthorized UID-0 accounts immediately.",
            raw=root_accounts,
            tags=["iam", "privileged-access"],
        )

        # Sudo access
        rc, out = self._run_cmd("cat /etc/sudoers 2>/dev/null | grep -v '^#' | grep -v '^$' | head -40")
        all_users_sudo = "ALL=(ALL" in out and "NOPASSWD" in out
        self._add(
            check_id="SOX-AC.2",
            title="Sudo Configuration – No Unrestricted NOPASSWD",
            control_ref="COBIT DS5.3",
            category="Access Controls",
            severity=Severity.HIGH.value,
            status=Status.FAIL.value if all_users_sudo else Status.PASS.value,
            details=f"NOPASSWD ALL detected in sudoers." if all_users_sudo
                    else "Sudo configuration appears restricted.",
            remediation="Remove NOPASSWD:ALL grants. Use per-command sudo rules.",
            raw=out[:1000],
            tags=["iam", "sudo"],
        )

        # Account lockout (pam_tally2 / pam_faillock)
        rc, out = self._run_cmd("grep -r 'pam_faillock\|pam_tally2' /etc/pam.d/ 2>/dev/null | head -10")
        lockout = bool(out.strip())
        self._add(
            check_id="SOX-AC.3",
            title="Account Lockout Policy Configured",
            control_ref="COBIT DS5.3",
            category="Access Controls",
            severity=Severity.HIGH.value,
            status=Status.PASS.value if lockout else Status.FAIL.value,
            details=out[:300] if lockout else "pam_faillock/pam_tally2 not found in /etc/pam.d/.",
            remediation="Configure pam_faillock with deny=5 unlock_time=900 in PAM stack.",
            tags=["iam", "authentication"],
        )

    def _change_management(self):
        # Verify cron integrity - unexpected root cron jobs
        rc, out = self._run_cmd("crontab -l 2>/dev/null; ls /etc/cron.d/ 2>/dev/null; cat /etc/crontab 2>/dev/null")
        self._add(
            check_id="SOX-CM.1",
            title="Scheduled Tasks Inventory",
            control_ref="COBIT AI6.1",
            category="Change Management",
            severity=Severity.MEDIUM.value,
            status=Status.PASS.value,
            details="Cron/scheduled task inventory captured for change review.",
            remediation="Ensure all scheduled tasks are documented and approved via change management process.",
            raw=out[:2000],
            tags=["change-management", "cron"],
        )

        # Installed packages inventory
        for cmd in ("dpkg -l 2>/dev/null | awk 'NR>5{print $2,$3}'",
                    "rpm -qa --queryformat '%{NAME} %{VERSION}\n' 2>/dev/null"):
            rc, out = self._run_cmd(cmd)
            if out.strip():
                self._add(
                    check_id="SOX-CM.2",
                    title="Installed Software Inventory",
                    control_ref="COBIT AI6.2",
                    category="Change Management",
                    severity=Severity.INFO.value,
                    status=Status.PASS.value,
                    details=f"Captured {len(out.splitlines())} installed packages.",
                    remediation="Maintain a software asset inventory and restrict unauthorized installations.",
                    raw=out[:5000],
                    tags=["inventory", "change-management"],
                )
                break

    def _computer_operations(self):
        # System time synchronization (NTP)
        for cmd in ("timedatectl show 2>/dev/null", "ntpq -p 2>/dev/null", "chronyc tracking 2>/dev/null"):
            rc, out = self._run_cmd(cmd)
            if out.strip() and rc == 0:
                ntp_sync = any(k in out for k in ("synchronized=yes", "reference time", "NTP synchronized: yes"))
                self._add(
                    check_id="SOX-CO.1",
                    title="NTP Time Synchronization Active",
                    control_ref="COBIT DS9.2",
                    category="Computer Operations",
                    severity=Severity.HIGH.value,
                    status=Status.PASS.value if ntp_sync else Status.WARN.value,
                    details=out[:300],
                    remediation="Configure chrony or ntpd and verify synchronization to authoritative time source.",
                    raw=out[:500],
                    tags=["ntp", "time-sync"],
                )
                break

        # Kernel version (check for EOL)
        rc, out = self._run_cmd("uname -r 2>/dev/null")
        self._add(
            check_id="SOX-CO.2",
            title="Kernel Version Captured",
            control_ref="COBIT DS9.3",
            category="Computer Operations",
            severity=Severity.INFO.value,
            status=Status.PASS.value,
            details=f"Kernel: {out.strip()}",
            remediation="Ensure kernel is maintained on a supported release with latest security patches.",
            raw={"kernel": out.strip()},
            tags=["patch-management"],
        )

    def _segregation_of_duties(self):
        # Check number of users with shell access
        rc, out = self._run_cmd("grep -v '/sbin/nologin\|/bin/false\|/usr/sbin/nologin' /etc/passwd 2>/dev/null | awk -F: '{print $1}' | head -50")
        shell_users = [l.strip() for l in out.splitlines() if l.strip()]
        count = len(shell_users)
        self._add(
            check_id="SOX-SOD.1",
            title="Shell-Access Users Inventory",
            control_ref="COBIT DS5.4",
            category="Segregation of Duties",
            severity=Severity.HIGH.value if count > 20 else Severity.MEDIUM.value,
            status=Status.WARN.value if count > 20 else Status.PASS.value,
            details=f"{count} users have interactive shell access: {shell_users[:20]}",
            remediation="Review and disable shell access for service accounts and inactive users.",
            raw=shell_users,
            tags=["iam", "least-privilege"],
        )

    def _data_backup_recovery(self):
        # Check for recent backup indicators
        backup_indicators = ["/var/log/backup.log", "/var/log/duplicati/duplicati.log",
                             "/var/log/backuppc/LOG"]
        found = [str(p) for p in backup_indicators if Path(p).exists()]
        self._add(
            check_id="SOX-BCR.1",
            title="Backup Log Files Present",
            control_ref="COBIT DS4.5",
            category="Business Continuity",
            severity=Severity.HIGH.value,
            status=Status.PASS.value if found else Status.WARN.value,
            details=f"Backup logs found: {found}" if found
                    else "No backup log files found in standard locations.",
            remediation="Implement automated backup with logging. Verify recovery procedures quarterly.",
            tags=["backup", "bcp", "disaster-recovery"],
        )


# ──────────────────────────────────────────────────────────────────────────────
# HIPAA COLLECTOR  (Security Rule + Privacy Rule)
# ──────────────────────────────────────────────────────────────────────────────
class HIPAACollector(BaseCollector):
    """
    HIPAA Security Rule (45 CFR Part 164) – Administrative, Physical,
    and Technical Safeguards.
    """

    framework = Framework.HIPAA.value

    def collect(self) -> List[EvidenceItem]:
        self.logger.info("=== HIPAA Collection Started ===")
        self._administrative_safeguards()
        self._physical_safeguards()
        self._technical_safeguards()
        self._audit_controls()
        self._transmission_security()
        return self.evidence

    def _administrative_safeguards(self):
        # Workforce training indicators
        training_paths = ["/etc/hipaa/training.log", "/var/log/hipaa_training.log"]
        found = any(Path(p).exists() for p in training_paths)
        self._add(
            check_id="HIPAA-AS.1",
            title="Workforce Training Documentation",
            control_ref="164.308(a)(5)",
            category="Administrative Safeguards",
            severity=Severity.HIGH.value,
            status=Status.PASS.value if found else Status.WARN.value,
            details="Training log found." if found
                    else "No training log found. Ensure workforce HIPAA training is documented.",
            remediation="Maintain records of annual HIPAA security awareness training for all workforce members.",
            tags=["training", "administrative"],
        )

        # Risk analysis documentation
        risk_docs = ["/etc/hipaa/risk_analysis.pdf", "/etc/hipaa/risk_analysis.docx",
                     "/var/hipaa/risk_analysis.txt"]
        found_risk = any(Path(p).exists() for p in risk_docs)
        self._add(
            check_id="HIPAA-AS.2",
            title="Risk Analysis Documentation Present",
            control_ref="164.308(a)(1)(ii)(A)",
            category="Administrative Safeguards",
            severity=Severity.CRITICAL.value,
            status=Status.PASS.value if found_risk else Status.WARN.value,
            details="Risk analysis document found." if found_risk
                    else "No risk analysis document found in standard paths.",
            remediation="Conduct and document a comprehensive HIPAA risk analysis at least annually.",
            tags=["risk-analysis", "administrative"],
        )

    def _physical_safeguards(self):
        # Screen lock / session timeout
        rc, out = self._run_cmd("grep -r 'TMOUT' /etc/profile.d/ /etc/profile /etc/bash.bashrc 2>/dev/null | head -5")
        tmout_set = bool(out.strip())
        tmout_val = re.search(r"TMOUT=(\d+)", out)
        tmout_secs = int(tmout_val.group(1)) if tmout_val else 0

        self._add(
            check_id="HIPAA-PS.1",
            title="Terminal Session Timeout Configured",
            control_ref="164.310(b)",
            category="Physical Safeguards",
            severity=Severity.HIGH.value,
            status=Status.PASS.value if (tmout_set and 0 < tmout_secs <= 900)
                   else Status.FAIL.value,
            details=f"TMOUT={tmout_secs}s" if tmout_set else "TMOUT not configured.",
            remediation="Set TMOUT=900 (15 min) in /etc/profile.d/timeout.sh for all interactive sessions.",
            raw={"TMOUT": tmout_secs},
            tags=["session", "physical"],
        )

    def _technical_safeguards(self):
        # Check for PHI directory permissions
        phi_dirs = ["/var/hipaa", "/data/phi", "/opt/ehr", "/etc/phi"]
        for phi_dir in phi_dirs:
            p = Path(phi_dir)
            if p.exists():
                mode = oct(p.stat().st_mode)[-3:]
                world_readable = int(mode[-1]) >= 4
                self._add(
                    check_id="HIPAA-TS.1",
                    title=f"PHI Directory Permissions ({phi_dir})",
                    control_ref="164.312(a)(1)",
                    category="Technical Safeguards",
                    severity=Severity.CRITICAL.value,
                    status=Status.FAIL.value if world_readable else Status.PASS.value,
                    details=f"{phi_dir} permissions: {mode} (world-readable={world_readable})",
                    remediation=f"Set permissions to 750 or 700 on {phi_dir}. Ensure only authorized users can access.",
                    raw={"path": phi_dir, "mode": mode},
                    tags=["phi", "file-permissions"],
                )

        # Encryption at rest
        rc, out = self._run_cmd("lsblk -o NAME,TYPE,FSTYPE 2>/dev/null | grep -i crypt")
        encrypted = bool(out.strip())
        self._add(
            check_id="HIPAA-TS.2",
            title="Encryption at Rest for PHI Volumes",
            control_ref="164.312(a)(2)(iv)",
            category="Technical Safeguards",
            severity=Severity.CRITICAL.value,
            status=Status.PASS.value if encrypted else Status.FAIL.value,
            details="Encrypted volume detected." if encrypted
                    else "No encrypted volumes detected; PHI data may be at risk.",
            remediation="Encrypt all volumes containing PHI using LUKS, BitLocker, or cloud-native encryption.",
            tags=["encryption", "phi"],
        )

        # Check for MySQL / PostgreSQL with strong auth
        for db_cmd, db_name in [("mysql --version 2>/dev/null", "MySQL"), ("psql --version 2>/dev/null", "PostgreSQL")]:
            rc, out = self._run_cmd(db_cmd)
            if rc == 0 and out.strip():
                self._add(
                    check_id=f"HIPAA-TS.3-{db_name}",
                    title=f"{db_name} Database Detected (Verify PHI Access Controls)",
                    control_ref="164.312(a)(1)",
                    category="Technical Safeguards",
                    severity=Severity.HIGH.value,
                    status=Status.WARN.value,
                    details=f"{db_name} {out.strip()} detected. Manually verify role-based access, auditing, and TLS.",
                    remediation=f"Ensure {db_name} has: TLS enabled, role-based access, audit logging, and strong passwords.",
                    tags=["database", "phi"],
                )

    def _audit_controls(self):
        # Audit framework
        rc, out = self._run_cmd("systemctl is-active auditd 2>/dev/null")
        auditd_active = "active" in out.lower()
        self._add(
            check_id="HIPAA-AU.1",
            title="Audit Daemon Active for PHI Access Logging",
            control_ref="164.312(b)",
            category="Audit Controls",
            severity=Severity.CRITICAL.value,
            status=Status.PASS.value if auditd_active else Status.FAIL.value,
            details=f"auditd: {out.strip()}",
            remediation="Enable auditd and add watch rules for PHI directories: -w /var/hipaa -p rwxa",
            tags=["audit", "phi"],
        )

        # Audit rules for PHI directories
        rc, out = self._run_cmd("auditctl -l 2>/dev/null | grep -i 'hipaa\|phi\|ehr' || echo none")
        phi_rules = "none" not in out and bool(out.strip())
        self._add(
            check_id="HIPAA-AU.2",
            title="Audit Rules Target PHI Directories",
            control_ref="164.312(b)",
            category="Audit Controls",
            severity=Severity.HIGH.value,
            status=Status.PASS.value if phi_rules else Status.WARN.value,
            details=out[:300] if phi_rules else "No audit rules targeting PHI directories found.",
            remediation="Add auditd watch rules: -w /var/hipaa -p rwxa -k phi_access",
            tags=["audit", "phi"],
        )

    def _transmission_security(self):
        # TLS protocols available
        rc, out = self._run_cmd("openssl ciphers 'TLSv1.2:TLSv1.3' 2>/dev/null | head -5")
        tls_ok = rc == 0 and bool(out.strip())
        self._add(
            check_id="HIPAA-TX.1",
            title="TLS 1.2+ Available for Data Transmission",
            control_ref="164.312(e)(1)",
            category="Transmission Security",
            severity=Severity.CRITICAL.value,
            status=Status.PASS.value if tls_ok else Status.FAIL.value,
            details="TLS 1.2/1.3 ciphers available." if tls_ok
                    else "openssl TLS 1.2/1.3 cipher check failed.",
            remediation="Ensure all PHI transmitted over networks uses TLS 1.2 or higher. Disable TLS 1.0/1.1.",
            tags=["tls", "transmission", "phi"],
        )

        # SFTP / SCP available (secure file transfer)
        sftp_present = shutil.which("sftp") is not None
        self._add(
            check_id="HIPAA-TX.2",
            title="Secure File Transfer (SFTP) Available",
            control_ref="164.312(e)(2)(ii)",
            category="Transmission Security",
            severity=Severity.MEDIUM.value,
            status=Status.PASS.value if sftp_present else Status.INFO.value,
            details="SFTP found in PATH." if sftp_present else "SFTP not found.",
            remediation="Use SFTP/SCP/HTTPS for all PHI file transfers. Prohibit FTP/Telnet.",
            tags=["sftp", "transmission"],
        )


# ──────────────────────────────────────────────────────────────────────────────
# FEDRAMP COLLECTOR  (NIST SP 800-53 Rev 5 Moderate Baseline)
# ──────────────────────────────────────────────────────────────────────────────
class FedRAMPCollector(BaseCollector):
    """
    FedRAMP Moderate Baseline mapped to NIST SP 800-53 Rev 5 control families:
    AC, AU, CM, IA, IR, MA, MP, PE, PL, PM, RA, SA, SC, SI, SR.
    """

    framework = Framework.FEDRAMP.value

    def collect(self) -> List[EvidenceItem]:
        self.logger.info("=== FedRAMP Collection Started ===")
        self._ac_access_control()
        self._au_audit_accountability()
        self._cm_configuration_management()
        self._ia_identification_authentication()
        self._sc_system_communications()
        self._si_system_integrity()
        self._ir_incident_response()
        self._ra_risk_assessment()
        return self.evidence

    def _ac_access_control(self):
        # AC-2: Account Management
        rc, out = self._run_cmd("lastlog 2>/dev/null | awk 'NR>1 && /Never logged/{print $1}' | head -20")
        never_logged = [l.strip() for l in out.splitlines() if l.strip()]
        self._add(
            check_id="FEDRAMP-AC-2",
            title="AC-2: Accounts That Have Never Logged In",
            control_ref="AC-2",
            category="Access Control",
            severity=Severity.MEDIUM.value,
            status=Status.WARN.value if len(never_logged) > 5 else Status.PASS.value,
            details=f"{len(never_logged)} accounts have never logged in: {never_logged[:10]}",
            remediation="Disable or remove accounts that have never been used per AC-2 account management policy.",
            raw=never_logged,
            tags=["iam", "ac-2"],
        )

        # AC-3: Access Enforcement (umask)
        rc, out = self._run_cmd("grep -r 'umask' /etc/profile /etc/bashrc /etc/profile.d/ 2>/dev/null | head -5")
        umask_match = re.search(r"umask\s+(\d+)", out)
        umask_val = umask_match.group(1) if umask_match else "022"
        # 027 or more restrictive is preferred for FedRAMP
        umask_ok = int(umask_val, 8) >= int("027", 8)
        self._add(
            check_id="FEDRAMP-AC-3",
            title="AC-3: Default umask ≥ 027",
            control_ref="AC-3",
            category="Access Control",
            severity=Severity.MEDIUM.value,
            status=Status.PASS.value if umask_ok else Status.WARN.value,
            details=f"Default umask: {umask_val}",
            remediation="Set umask 027 in /etc/profile.d/umask.sh to restrict default file permissions.",
            raw={"umask": umask_val},
            tags=["file-permissions", "ac-3"],
        )

        # AC-17: Remote Access (SSH hardening)
        sshd = Path("/etc/ssh/sshd_config")
        if sshd.exists():
            cfg = sshd.read_text()
            checks = {
                "MaxAuthTries": (r"MaxAuthTries\s+(\d+)", 4, "≤", int),
                "ClientAliveInterval": (r"ClientAliveInterval\s+(\d+)", 300, "≤", int),
                "X11Forwarding": (r"X11Forwarding\s+(\S+)", "no", "==", str),
                "AllowTcpForwarding": (r"AllowTcpForwarding\s+(\S+)", "no", "==", str),
            }
            for setting, (pattern, threshold, op, cast) in checks.items():
                m = re.search(pattern, cfg, re.I | re.M)
                val = cast(m.group(1)) if m else None
                if val is None:
                    status = Status.WARN.value
                    detail = f"{setting} not explicitly configured."
                elif op == "≤":
                    status = Status.PASS.value if val <= threshold else Status.FAIL.value
                    detail = f"{setting} = {val} (threshold: {op} {threshold})"
                else:
                    status = Status.PASS.value if val.lower() == threshold else Status.FAIL.value
                    detail = f"{setting} = {val} (expected: {threshold})"
                self._add(
                    check_id=f"FEDRAMP-AC-17-{setting}",
                    title=f"AC-17: SSH {setting} Hardening",
                    control_ref="AC-17",
                    category="Access Control",
                    severity=Severity.HIGH.value,
                    status=status,
                    details=detail,
                    remediation=f"Set {setting} to {threshold} in /etc/ssh/sshd_config.",
                    tags=["ssh", "ac-17"],
                )

    def _au_audit_accountability(self):
        # AU-2: Audit Events
        rc, out = self._run_cmd("auditctl -l 2>/dev/null | head -30")
        rule_count = len([l for l in out.splitlines() if l.strip() and not l.startswith("#")])
        self._add(
            check_id="FEDRAMP-AU-2",
            title="AU-2: Audit Rules Configured",
            control_ref="AU-2",
            category="Audit & Accountability",
            severity=Severity.HIGH.value,
            status=Status.PASS.value if rule_count >= 5 else Status.FAIL.value,
            details=f"{rule_count} audit rules active.",
            remediation="Configure audit rules per STIG/CIS: login events, file access, privilege use, network.",
            raw=out[:1000],
            tags=["audit", "au-2"],
        )

        # AU-9: Audit Log Protection
        log_dir = Path("/var/log/audit")
        if log_dir.exists():
            mode = oct(log_dir.stat().st_mode)[-3:]
            world_access = int(mode[-1]) > 0
            self._add(
                check_id="FEDRAMP-AU-9",
                title="AU-9: Audit Log Directory Permissions",
                control_ref="AU-9",
                category="Audit & Accountability",
                severity=Severity.HIGH.value,
                status=Status.FAIL.value if world_access else Status.PASS.value,
                details=f"/var/log/audit permissions: {mode}",
                remediation="Set /var/log/audit to permissions 750 (chmod 750 /var/log/audit).",
                raw={"mode": mode},
                tags=["audit", "au-9"],
            )

        # AU-11: Audit Record Retention
        rc, out = self._run_cmd("grep -E 'max_log_file|num_logs|max_log_file_action' /etc/audit/auditd.conf 2>/dev/null")
        self._add(
            check_id="FEDRAMP-AU-11",
            title="AU-11: Audit Log Retention Configuration",
            control_ref="AU-11",
            category="Audit & Accountability",
            severity=Severity.MEDIUM.value,
            status=Status.PASS.value if out.strip() else Status.WARN.value,
            details=out[:300] if out.strip() else "auditd.conf retention settings not found.",
            remediation="Configure max_log_file_action=ROTATE and num_logs=5+ in /etc/audit/auditd.conf. "
                        "FedRAMP requires 90-day retention minimum.",
            raw=out,
            tags=["audit", "au-11"],
        )

    def _cm_configuration_management(self):
        # CM-6: Configuration Settings (CIS-style baseline checks)
        core_dumps = Path("/etc/security/limits.conf")
        if core_dumps.exists():
            content = core_dumps.read_text()
            core_disabled = "* hard core 0" in content or "hard core 0" in content
            self._add(
                check_id="FEDRAMP-CM-6.1",
                title="CM-6: Core Dumps Disabled",
                control_ref="CM-6",
                category="Configuration Management",
                severity=Severity.MEDIUM.value,
                status=Status.PASS.value if core_disabled else Status.WARN.value,
                details="Core dumps disabled in limits.conf." if core_disabled
                        else "Core dumps not explicitly disabled.",
                remediation="Add '* hard core 0' to /etc/security/limits.conf to prevent core dumps.",
                tags=["hardening", "cm-6"],
            )

        # CM-7: Least Functionality – disable unnecessary services
        unnecessary_svcs = ["telnet", "rsh", "rlogin", "tftp", "talk", "ntalk",
                            "chargen", "daytime", "echo", "discard"]
        found_risky = []
        for svc in unnecessary_svcs:
            rc, out = self._run_cmd(f"systemctl is-active {svc} 2>/dev/null")
            if "active" in out.lower():
                found_risky.append(svc)
        self._add(
            check_id="FEDRAMP-CM-7",
            title="CM-7: Unnecessary/Insecure Services Disabled",
            control_ref="CM-7",
            category="Configuration Management",
            severity=Severity.HIGH.value if found_risky else Severity.LOW.value,
            status=Status.FAIL.value if found_risky else Status.PASS.value,
            details=f"Risky services active: {found_risky}" if found_risky
                    else "No insecure legacy services detected.",
            remediation="Disable and mask all unnecessary services: systemctl disable --now <service>",
            raw=found_risky,
            tags=["hardening", "cm-7"],
        )

    def _ia_identification_authentication(self):
        # IA-5: Authenticator Management (PAM password complexity)
        rc, out = self._run_cmd("cat /etc/security/pwquality.conf 2>/dev/null || "
                                "grep pam_pwquality /etc/pam.d/common-password 2>/dev/null | head -5")
        has_complexity = bool(out.strip()) and ("minlen" in out or "retry" in out or "pam_pwquality" in out)
        self._add(
            check_id="FEDRAMP-IA-5",
            title="IA-5: Password Complexity (pam_pwquality)",
            control_ref="IA-5",
            category="Identification & Authentication",
            severity=Severity.HIGH.value,
            status=Status.PASS.value if has_complexity else Status.FAIL.value,
            details=out[:300] if has_complexity
                    else "pam_pwquality not configured. Password complexity not enforced.",
            remediation="Configure /etc/security/pwquality.conf: minlen=14, dcredit=-1, ucredit=-1, lcredit=-1, ocredit=-1.",
            raw=out,
            tags=["passwords", "ia-5"],
        )

        # IA-8: Identification & Authentication – Non-Organizational Users (banner)
        for banner_file in ("/etc/issue.net", "/etc/issue", "/etc/motd"):
            p = Path(banner_file)
            if p.exists():
                content = p.read_text().strip()
                has_banner = len(content) > 20 and any(
                    kw in content.lower() for kw in ("authorized", "monitored", "consent", "warning", "government")
                )
                self._add(
                    check_id=f"FEDRAMP-IA-8-{Path(banner_file).name}",
                    title=f"IA-8: Legal Banner in {banner_file}",
                    control_ref="IA-8",
                    category="Identification & Authentication",
                    severity=Severity.MEDIUM.value,
                    status=Status.PASS.value if has_banner else Status.FAIL.value,
                    details=f"Banner content: {content[:200]}" if content
                            else f"{banner_file} is empty.",
                    remediation="Add DoD/FedRAMP-compliant warning banner to login files per AC-8.",
                    raw={"file": banner_file, "content": content[:500]},
                    tags=["banners", "ia-8"],
                )

    def _sc_system_communications(self):
        # SC-28: Protection of Information at Rest
        rc, out = self._run_cmd("cat /proc/sys/kernel/randomize_va_space 2>/dev/null")
        aslr_val = out.strip()
        self._add(
            check_id="FEDRAMP-SC-39",
            title="SC-39: ASLR (Address Space Layout Randomization) Enabled",
            control_ref="SC-39",
            category="System & Communications Protection",
            severity=Severity.HIGH.value,
            status=Status.PASS.value if aslr_val == "2" else Status.FAIL.value,
            details=f"kernel.randomize_va_space = {aslr_val} (2=full ASLR)",
            remediation="Set kernel.randomize_va_space = 2 in /etc/sysctl.conf and apply with sysctl -p.",
            raw={"aslr": aslr_val},
            tags=["hardening", "sc-39"],
        )

        # SC-8: Transmission Confidentiality (SSL/TLS config)
        rc, out = self._run_cmd("openssl version 2>/dev/null")
        self._add(
            check_id="FEDRAMP-SC-8",
            title="SC-8: OpenSSL Version Captured",
            control_ref="SC-8",
            category="System & Communications Protection",
            severity=Severity.INFO.value,
            status=Status.PASS.value if rc == 0 else Status.WARN.value,
            details=out.strip() or "openssl not found.",
            remediation="Ensure OpenSSL is updated to latest supported version. Disable SSLv2/SSLv3/TLS1.0.",
            raw={"openssl": out.strip()},
            tags=["tls", "sc-8"],
        )

        # SC-5: Denial of Service Protection (SYN cookies)
        rc, out = self._run_cmd("cat /proc/sys/net/ipv4/tcp_syncookies 2>/dev/null")
        syn_cookies = out.strip() == "1"
        self._add(
            check_id="FEDRAMP-SC-5",
            title="SC-5: TCP SYN Cookies Enabled (DoS Protection)",
            control_ref="SC-5",
            category="System & Communications Protection",
            severity=Severity.MEDIUM.value,
            status=Status.PASS.value if syn_cookies else Status.FAIL.value,
            details=f"net.ipv4.tcp_syncookies = {out.strip()}",
            remediation="Set net.ipv4.tcp_syncookies = 1 in /etc/sysctl.conf",
            tags=["network", "sc-5"],
        )

    def _si_system_integrity(self):
        # SI-2: Flaw Remediation (pending updates)
        for cmd, desc in [
            ("apt list --upgradable 2>/dev/null | grep -c upgradable", "apt"),
            ("yum check-update --quiet 2>/dev/null | wc -l", "yum/dnf"),
        ]:
            rc, out = self._run_cmd(cmd)
            if rc in (0, 100) and out.strip().isdigit():
                pending = int(out.strip())
                self._add(
                    check_id="FEDRAMP-SI-2",
                    title=f"SI-2: Pending Security Updates ({desc})",
                    control_ref="SI-2",
                    category="System & Information Integrity",
                    severity=Severity.HIGH.value if pending > 0 else Severity.LOW.value,
                    status=Status.WARN.value if pending > 0 else Status.PASS.value,
                    details=f"{pending} packages pending update via {desc}.",
                    remediation="Apply pending updates immediately. Critical patches within 30 days per FedRAMP SLA.",
                    raw={"pending_updates": pending, "pkg_manager": desc},
                    tags=["patch-management", "si-2"],
                )
                break

        # SI-3: Malicious Code Protection (AV)
        av_tools = ["clamav", "clamscan", "freshclam", "rkhunter", "chkrootkit", "aide"]
        found = [a for a in av_tools if shutil.which(a)]
        self._add(
            check_id="FEDRAMP-SI-3",
            title="SI-3: Anti-Malware / File Integrity Tool Present",
            control_ref="SI-3",
            category="System & Information Integrity",
            severity=Severity.HIGH.value,
            status=Status.PASS.value if found else Status.FAIL.value,
            details=f"Found tools: {found}" if found
                    else "No anti-malware or file integrity tool found.",
            remediation="Deploy ClamAV + AIDE or equivalent. Configure scheduled scans and alerting.",
            tags=["malware", "si-3"],
        )

        # AIDE integrity database
        aide_db = any(Path(p).exists() for p in ["/var/lib/aide/aide.db.gz", "/var/lib/aide/aide.db"])
        self._add(
            check_id="FEDRAMP-SI-7",
            title="SI-7: AIDE File Integrity Database Present",
            control_ref="SI-7",
            category="System & Information Integrity",
            severity=Severity.HIGH.value,
            status=Status.PASS.value if aide_db else Status.WARN.value,
            details="AIDE database found." if aide_db
                    else "AIDE database not found. File integrity monitoring may not be configured.",
            remediation="Install AIDE, initialize database with aide --init, schedule weekly checks.",
            tags=["file-integrity", "si-7"],
        )

    def _ir_incident_response(self):
        # Check for IR runbook
        ir_paths = ["/etc/security/incident_response.pdf", "/etc/ir_plan.md", "/var/security/ir_runbook.txt"]
        found = any(Path(p).exists() for p in ir_paths)
        self._add(
            check_id="FEDRAMP-IR-8",
            title="IR-8: Incident Response Plan Documentation",
            control_ref="IR-8",
            category="Incident Response",
            severity=Severity.HIGH.value,
            status=Status.PASS.value if found else Status.WARN.value,
            details="IR plan document found." if found
                    else "No incident response plan found in standard locations.",
            remediation="Document and test an Incident Response Plan. Update annually. Notify US-CERT within 1 hour for FedRAMP.",
            tags=["incident-response", "ir-8"],
        )

    def _ra_risk_assessment(self):
        # Check for OpenSCAP / scap-workbench
        scap_tools = ["oscap", "scap-workbench"]
        found = [t for t in scap_tools if shutil.which(t)]
        self._add(
            check_id="FEDRAMP-RA-5",
            title="RA-5: SCAP/OpenSCAP Scanning Tool Present",
            control_ref="RA-5",
            category="Risk Assessment",
            severity=Severity.HIGH.value,
            status=Status.PASS.value if found else Status.WARN.value,
            details=f"SCAP tools found: {found}" if found
                    else "OpenSCAP not found. Automated SCAP scanning may not be configured.",
            remediation="Install openscap-scanner and run quarterly DISA STIG or USGCB scans.",
            tags=["vulnerability-scanning", "ra-5"],
        )


# ──────────────────────────────────────────────────────────────────────────────
# SYSTEM METADATA COLLECTOR  (cross-framework)
# ──────────────────────────────────────────────────────────────────────────────
class SystemMetaCollector:
    """Collects host/environment metadata included in every run."""

    def __init__(self, run_id: str):
        self.run_id = run_id

    def collect(self) -> Dict:
        meta: Dict[str, Any] = {
            "run_id":         self.run_id,
            "collected_at":   datetime.datetime.utcnow().isoformat() + "Z",
            "hostname":       socket.gethostname(),
            "fqdn":           socket.getfqdn(),
            "ip_addresses":   self._get_ips(),
            "platform":       platform.platform(),
            "os":             f"{platform.system()} {platform.release()}",
            "architecture":   platform.machine(),
            "python_version": sys.version,
            "cpu_count":      os.cpu_count(),
            "tool_version":   VERSION,
        }
        try:
            import psutil  # type: ignore
            meta["total_memory_gb"] = round(psutil.virtual_memory().total / (1024 ** 3), 2)
            meta["disk_total_gb"]   = round(psutil.disk_usage("/").total / (1024 ** 3), 2)
        except ImportError:
            pass
        return meta

    def _get_ips(self) -> List[str]:
        try:
            ips = []
            for info in socket.getaddrinfo(socket.gethostname(), None):
                ip = info[4][0]
                if ip not in ips and not ip.startswith("::"):
                    ips.append(ip)
            return ips
        except Exception:
            return []


# ──────────────────────────────────────────────────────────────────────────────
# OUTPUT WRITERS
# ──────────────────────────────────────────────────────────────────────────────
class OutputWriter:

    def __init__(self, output_dir: Path, run_id: str):
        self.output_dir = output_dir
        self.run_id     = run_id
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def write_json(self, evidence: List[EvidenceItem], meta: Dict, summary: CollectionSummary) -> Path:
        payload = {
            "summary":  asdict(summary),
            "metadata": meta,
            "evidence": [e.to_dict() for e in evidence],
        }
        out_path = self.output_dir / f"compliance_evidence_{self.run_id}.json"
        out_path.write_text(json.dumps(payload, indent=2, default=str))
        return out_path

    def write_csv(self, evidence: List[EvidenceItem]) -> Path:
        out_path = self.output_dir / f"compliance_evidence_{self.run_id}.csv"
        if not evidence:
            return out_path
        fieldnames = [f for f in evidence[0].to_dict().keys() if f != "raw_evidence"]
        with open(out_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for item in evidence:
                row = item.to_dict()
                row.pop("raw_evidence", None)
                writer.writerow(row)
        return out_path

    def write_html(self, evidence: List[EvidenceItem], summary: CollectionSummary, meta: Dict) -> Path:
        out_path = self.output_dir / f"compliance_evidence_{self.run_id}.html"
        status_color = {
            "PASS": "#22c55e", "FAIL": "#ef4444",
            "WARN": "#f59e0b", "ERROR": "#8b5cf6",
            "SKIP": "#6b7280", "INFO": "#3b82f6",
        }
        severity_color = {
            "CRITICAL": "#991b1b", "HIGH": "#ef4444",
            "MEDIUM": "#f59e0b",   "LOW": "#6b7280", "INFO": "#3b82f6",
        }
        rows = ""
        for e in evidence:
            sc = status_color.get(e.status, "#333")
            sv = severity_color.get(e.severity, "#333")
            rows += f"""
            <tr>
              <td><code>{e.check_id}</code></td>
              <td><strong>{e.title}</strong><br/><small>{e.details[:120]}</small></td>
              <td><span style="color:{sv};font-weight:bold">{e.severity}</span></td>
              <td style="color:{sc};font-weight:bold">{e.status}</td>
              <td>{e.framework.upper()}</td>
              <td><code>{e.control_ref}</code></td>
              <td><small>{e.remediation[:120]}</small></td>
              <td><small>{e.timestamp[:19]}</small></td>
            </tr>"""

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Compliance Evidence Report – {self.run_id}</title>
<style>
  body{{font-family:system-ui,sans-serif;background:#f8fafc;color:#1e293b;margin:0;padding:20px}}
  h1{{color:#1e293b}} h2{{color:#475569}}
  .banner{{background:linear-gradient(135deg,#1e3a5f,#2563eb);color:#fff;padding:24px;border-radius:12px;margin-bottom:24px}}
  .banner h1{{margin:0 0 4px;font-size:1.8rem}} .banner p{{margin:0;opacity:.85}}
  .summary-grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px}}
  .card{{background:#fff;border-radius:8px;padding:16px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.08)}}
  .card .val{{font-size:2rem;font-weight:700}} .card .lbl{{font-size:.8rem;color:#64748b;text-transform:uppercase}}
  .pass{{color:#22c55e}} .fail{{color:#ef4444}} .warn{{color:#f59e0b}} .skip{{color:#6b7280}}
  table{{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)}}
  th{{background:#1e3a5f;color:#fff;padding:10px 12px;text-align:left;font-size:.85rem}}
  td{{padding:9px 12px;border-bottom:1px solid #e2e8f0;font-size:.85rem;vertical-align:top}}
  tr:hover{{background:#f1f5f9}} code{{background:#e2e8f0;padding:2px 5px;border-radius:4px;font-size:.8rem}}
  .meta-box{{background:#fff;border-radius:8px;padding:16px;margin-bottom:24px;box-shadow:0 1px 4px rgba(0,0,0,.08);font-size:.85rem}}
  .meta-box pre{{margin:0;white-space:pre-wrap;color:#475569}}
  footer{{text-align:center;color:#94a3b8;font-size:.8rem;margin-top:24px}}
  input#search{{width:100%;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:.9rem;margin-bottom:12px;box-sizing:border-box}}
</style>
</head>
<body>
<div class="banner">
  <h1>🛡️ Compliance Evidence Report</h1>
  <p>Run ID: <code style="background:rgba(255,255,255,.15);padding:2px 6px;border-radius:4px">{self.run_id}</code> &nbsp;·&nbsp; Host: {meta.get('hostname','n/a')} &nbsp;·&nbsp; {summary.started_at[:19]} UTC</p>
</div>

<div class="summary-grid">
  <div class="card"><div class="val">{summary.total_checks}</div><div class="lbl">Total Checks</div></div>
  <div class="card"><div class="val pass">{summary.passed}</div><div class="lbl">Passed</div></div>
  <div class="card"><div class="val fail">{summary.failed}</div><div class="lbl">Failed</div></div>
  <div class="card"><div class="val warn">{summary.warned}</div><div class="lbl">Warnings</div></div>
  <div class="card"><div class="val skip">{summary.skipped}</div><div class="lbl">Skipped</div></div>
  <div class="card"><div class="val">{summary.score_pct:.1f}%</div><div class="lbl">Pass Rate</div></div>
  <div class="card"><div class="val">{summary.duration_sec:.1f}s</div><div class="lbl">Duration</div></div>
</div>

<div class="meta-box">
  <strong>Environment:</strong>
  <pre>{json.dumps({k:v for k,v in meta.items() if k not in ('python_version',)}, indent=2)}</pre>
</div>

<h2>Evidence Items</h2>
<input id="search" placeholder="🔍 Filter by check ID, title, status, framework…" onkeyup="filterTable()" />
<table id="evtable">
  <thead>
    <tr>
      <th>Check ID</th><th>Title / Details</th><th>Severity</th><th>Status</th>
      <th>Framework</th><th>Control</th><th>Remediation</th><th>Timestamp</th>
    </tr>
  </thead>
  <tbody>{rows}</tbody>
</table>

<footer>Generated by {TOOL_NAME} v{VERSION} &mdash; FOR INTERNAL USE ONLY &mdash; HANDLE PER DATA CLASSIFICATION POLICY</footer>

<script>
function filterTable(){{
  var q=document.getElementById('search').value.toLowerCase();
  document.querySelectorAll('#evtable tbody tr').forEach(function(r){{
    r.style.display=r.textContent.toLowerCase().includes(q)?'':'none';
  }});
}}
</script>
</body>
</html>"""
        out_path.write_text(html)
        return out_path

    def write_summary_txt(self, summary: CollectionSummary, meta: Dict) -> Path:
        out_path = self.output_dir / f"SUMMARY_{self.run_id}.txt"
        lines = [
            "=" * 72,
            f"  {TOOL_NAME} v{VERSION}  –  Compliance Evidence Collection Summary",
            "=" * 72,
            f"  Run ID       : {summary.run_id}",
            f"  Host         : {summary.host}",
            f"  OS           : {summary.os_info}",
            f"  Started      : {summary.started_at}",
            f"  Finished     : {summary.finished_at}",
            f"  Duration     : {summary.duration_sec:.2f}s",
            f"  Frameworks   : {', '.join(summary.frameworks)}",
            "-" * 72,
            f"  Total Checks : {summary.total_checks}",
            f"  PASS         : {summary.passed}",
            f"  FAIL         : {summary.failed}",
            f"  WARN         : {summary.warned}",
            f"  ERROR        : {summary.errored}",
            f"  SKIP         : {summary.skipped}",
            f"  Pass Rate    : {summary.score_pct:.1f}%",
            "-" * 72,
            f"  Output Dir   : {summary.output_dir}",
            "=" * 72,
        ]
        out_path.write_text("\n".join(lines) + "\n")
        return out_path


# ──────────────────────────────────────────────────────────────────────────────
# HASH / INTEGRITY
# ──────────────────────────────────────────────────────────────────────────────
def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def write_integrity_manifest(output_dir: Path, run_id: str) -> Path:
    manifest: Dict[str, str] = {}
    for f in output_dir.iterdir():
        if f.is_file() and f.suffix not in (".manifest",):
            manifest[f.name] = sha256_file(f)
    manifest_path = output_dir / f"MANIFEST_{run_id}.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))
    return manifest_path

# ... [Keep the previous imports and Collector classes] ...

import boto3
from botocore.exceptions import ClientError

# ──────────────────────────────────────────────────────────────────────────────
# SECUREBASE ENTERPRISE EXTENSION
# ──────────────────────────────────────────────────────────────────────────────
class SecureBaseVault:
    """
    Handles the 'Chain of Custody' by vaulting evidence into S3 with 
    Object Lock and signing the manifest via AWS KMS.
    """
    def __init__(self, bucket_name: str, region: str = "us-east-1"):
        self.bucket = bucket_name
        self.s3 = boto3.client('s3', region_name=region)
        self.kms = boto3.client('kms', region_name=region)

    def vault_run(self, output_dir: Path, run_id: str, kms_key_id: str = None):
        """Uploads all evidence and signs the manifest."""
        print(f"🔒 Vaulting Evidence to S3: {self.bucket}")
        
        # 1. Sign the Manifest if a Key is provided (FedRAMP requirement)
        manifest_path = output_dir / f"MANIFEST_{run_id}.json"
        if kms_key_id and manifest_path.exists():
            self._sign_manifest(manifest_path, kms_key_id)

        # 2. Upload files
        for file_path in output_dir.iterdir():
            if file_path.is_file():
                s_key = f"evidence/{run_id}/{file_path.name}"
                self.s3.upload_file(
                    str(file_path), self.bucket, s_key,
                    ExtraArgs={'Tagging': 'Project=SecureBase&Status=Final'}
                )

    def _sign_manifest(self, path: Path, key_id: str):
        """Creates a detached signature for the manifest using KMS."""
        content = path.read_bytes()
        response = self.kms.sign(
            KeyId=key_id,
            Message=content,
            MessageType='RAW',
            SigningAlgorithm='RSASSA_PSS_SHA_256'
        )
        sig_path = path.with_suffix(".sig")
        sig_path.write_bytes(response['Signature'])
        print(f"✍️  Manifest digitally signed via KMS.")

# ──────────────────────────────────────────────────────────────────────────────
# REVISED MAIN ORCHESTRATOR
# ──────────────────────────────────────────────────────────────────────────────
# Update your ComplianceOrchestrator.run() to include:
# 
# if not self.dry_run:
#     vault = SecureBaseVault(bucket_name="your-s3-bucket-name")
#     vault.vault_run(self.output_dir, self.run_id)
# ──────────────────────────────────────────────────────────────────────────────
# MAIN ORCHESTRATOR
# ──────────────────────────────────────────────────────────────────────────────
class ComplianceOrchestrator:

    COLLECTOR_MAP = {
        Framework.SOC2.value:    SOC2Collector,
        Framework.SOX.value:     SOXCollector,
        Framework.HIPAA.value:   HIPAACollector,
        Framework.FEDRAMP.value: FedRAMPCollector,
    }

    def __init__(
        self,
        frameworks:  List[str],
        output_dir:  Path,
        formats:     List[str],
        verbose:     bool = False,
        dry_run:     bool = False,
    ):
        self.run_id     = str(uuid.uuid4())[:8].upper()
        self.output_dir = output_dir / f"evidence_{self.run_id}"
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.logger  = setup_logging(verbose, self.output_dir / "collector.log")
        self.frameworks = frameworks
        self.formats    = formats
        self.dry_run    = dry_run
        self.console    = Console() if RICH else None

    def run(self) -> CollectionSummary:
        started_at = datetime.datetime.utcnow().isoformat() + "Z"
        t0 = time.time()

        self._banner()
        meta = SystemMetaCollector(self.run_id).collect()

        all_evidence: List[EvidenceItem] = []

        for fw in self.frameworks:
            cls = self.COLLECTOR_MAP.get(fw)
            if not cls:
                self.logger.warning(f"Unknown framework: {fw} – skipping.")
                continue
            collector = cls(run_id=self.run_id, logger=self.logger, dry_run=self.dry_run)
            try:
                evidence = collector.collect()
                all_evidence.extend(evidence)
            except Exception as exc:
                self.logger.error(f"Collection failed for {fw}: {exc}")
                self.logger.debug(traceback.format_exc())

        finished_at  = datetime.datetime.utcnow().isoformat() + "Z"
        duration_sec = round(time.time() - t0, 2)

        counts = {s.value: 0 for s in Status}
        for e in all_evidence:
            counts[e.status] = counts.get(e.status, 0) + 1

        total = len(all_evidence)
        passed = counts.get("PASS", 0)
        score  = (passed / total * 100) if total else 0.0

        summary = CollectionSummary(
            run_id=self.run_id,
            started_at=started_at,
            finished_at=finished_at,
            duration_sec=duration_sec,
            frameworks=self.frameworks,
            total_checks=total,
            passed=passed,
            failed=counts.get("FAIL", 0),
            warned=counts.get("WARN", 0),
            errored=counts.get("ERROR", 0),
            skipped=counts.get("SKIP", 0),
            score_pct=round(score, 2),
            host=socket.gethostname(),
            os_info=platform.platform(),
            python_version=sys.version.split()[0],
            output_dir=str(self.output_dir),
        )

        writer = OutputWriter(self.output_dir, self.run_id)
        generated: List[Path] = []

        if "json" in self.formats:
            p = writer.write_json(all_evidence, meta, summary)
            generated.append(p)
            self.logger.info(f"JSON evidence written: {p}")

        if "csv" in self.formats:
            p = writer.write_csv(all_evidence)
            generated.append(p)
            self.logger.info(f"CSV evidence written: {p}")

        if "html" in self.formats:
            p = writer.write_html(all_evidence, summary, meta)
            generated.append(p)
            self.logger.info(f"HTML report written: {p}")

        summary_file = writer.write_summary_txt(summary, meta)
        manifest = write_integrity_manifest(self.output_dir, self.run_id)
# Existing logic ends...
        summary_file = writer.write_summary_txt(summary, meta)
        manifest = write_integrity_manifest(self.output_dir, self.run_id)

        # ──────────────────────────────────────────────────────────────────────
        # NEW: SECUREBASE VAULTING STEP
        # ──────────────────────────────────────────────────────────────────────
        if not self.dry_run:
            # Replace with your actual Bucket Name and KMS Key ID
            vault = SecureBaseVault(
                bucket_name="securebase-evidence-tx-imhotep",
                region="us-east-1" 
            )
            vault.vault_run(
                output_dir=self.output_dir, 
                run_id=self.run_id, 
                kms_key_id="alias/securebase-evidence-key"
            )
          
        self._print_summary(summary, all_evidence)
        self.logger.info(f"Integrity manifest: {manifest}")
        self.logger.info(f"Evidence directory: {self.output_dir}")

        return summary

    # ── Display Helpers ───────────────────────────────────────────────────────
    def _banner(self):
        msg = f"""
╔══════════════════════════════════════════════════════╗
║  {TOOL_NAME} v{VERSION}           ║
║  Frameworks: {', '.join(f.upper() for f in self.frameworks):<38}║
║  Run ID: {self.run_id:<44}║
╚══════════════════════════════════════════════════════╝"""
        print(msg)

    def _print_summary(self, summary: CollectionSummary, evidence: List[EvidenceItem]):
        print("\n" + "=" * 60)
        print(f"  COLLECTION COMPLETE  |  Run ID: {summary.run_id}")
        print("=" * 60)
        print(f"  Total Checks : {summary.total_checks}")
        print(f"  PASS         : {summary.passed}")
        print(f"  FAIL         : {summary.failed}")
        print(f"  WARN         : {summary.warned}")
        print(f"  SKIP         : {summary.skipped}")
        print(f"  Pass Rate    : {summary.score_pct:.1f}%")
        print(f"  Duration     : {summary.duration_sec:.2f}s")
        print(f"  Output Dir   : {summary.output_dir}")
        print("=" * 60)

        # Print critical/high failures
        failures = [e for e in evidence if e.status == "FAIL" and e.severity in ("CRITICAL", "HIGH")]
        if failures:
            print(f"\n  ⚠️  {len(failures)} CRITICAL/HIGH FAILURES requiring immediate attention:")
            for f in failures[:15]:
                print(f"     ❌ [{f.framework.upper()}] {f.check_id}: {f.title}")
            if len(failures) > 15:
                print(f"     ... and {len(failures) - 15} more. See full report.")
        print()


# ──────────────────────────────────────────────────────────────────────────────
# CLI ENTRY POINT
# ──────────────────────────────────────────────────────────────────────────────
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="compliance_evidence_collector",
        description=textwrap.dedent("""\
            Enterprise Compliance Evidence Collector
            Supported frameworks: SOC2, SOX, HIPAA, FedRAMP
        """),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--frameworks", nargs="+",
        choices=[f.value for f in Framework], default=[f.value for f in Framework],
        metavar="FRAMEWORK",
        help="Frameworks to collect (default: all). Choices: soc2 sox hipaa fedramp",
    )
    parser.add_argument(
        "--output-dir", type=Path, default=Path("."),
        help="Base directory for evidence output (default: current directory)",
    )
    parser.add_argument(
        "--format", dest="formats", nargs="+",
        choices=["json", "csv", "html"], default=["json", "csv", "html"],
        metavar="FORMAT",
        help="Output format(s): json csv html (default: all)",
    )
    parser.add_argument("--verbose", action="store_true", help="Enable debug logging")
    parser.add_argument("--dry-run", action="store_true",
                        help="List checks without executing (not yet implemented – placeholder)")
    return parser.parse_args()


def main():
    args = parse_args()

    orchestrator = ComplianceOrchestrator(
        frameworks=args.frameworks,
        output_dir=args.output_dir,
        formats=args.formats,
        verbose=args.verbose,
        dry_run=args.dry_run,
    )

    try:
        summary = orchestrator.run()
        # Exit code: 0 = clean, 1 = failures present, 2 = errors
        if summary.errored > 0:
            sys.exit(2)
        if summary.failed > 0:
            sys.exit(1)
        sys.exit(0)
    except KeyboardInterrupt:
        print("\n[Interrupted]")
        sys.exit(130)


if __name__ == "__main__":
    main()
