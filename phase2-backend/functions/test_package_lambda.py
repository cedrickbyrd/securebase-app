import os
import shutil
import subprocess
import tempfile
import textwrap
import unittest
import zipfile
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("package-lambda.sh")
FUNCTION_NAMES = ("auth_v2", "report_engine", "demo_auth", "session_management")


def _read_zip_entries(zip_path: Path) -> set[str]:
    with zipfile.ZipFile(zip_path) as archive:
        return set(archive.namelist())


class PackageLambdaScriptTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.root = Path(self.temp_dir.name)
        self.functions_dir = self.root / "phase2-backend" / "functions"
        self.deploy_dir = self.root / "phase2-backend" / "deploy"
        self.bin_dir = self.root / "bin"
        self.functions_dir.mkdir(parents=True)
        self.deploy_dir.mkdir(parents=True)
        self.bin_dir.mkdir()

        shutil.copy2(SCRIPT_PATH, self.functions_dir / "package-lambda.sh")

        for name in FUNCTION_NAMES:
            (self.functions_dir / f"{name}.py").write_text(f'print("{name}")\n', encoding="utf-8")

    def _write_fake_docker(self):
        docker_script = self.bin_dir / "docker"
        docker_script.write_text(
            textwrap.dedent(
                """\
                #!/bin/bash
                set -e
                if [ "$1" = "info" ]; then
                  exit 0
                fi

                echo "$*" >> "${FAKE_INSTALL_LOG}"

                target=""
                requirements=""
                command_line="$*"
                while [ $# -gt 0 ]; do
                  case "$1" in
                    -e)
                      requirements="${2#LAMBDA_REQUIREMENTS=}"
                      shift 2
                      ;;
                    -v)
                      target="${2%%:*}"
                      shift 2
                      ;;
                    -lc|-c)
                      command_line="$2"
                      shift 2
                      ;;
                    *)
                      shift
                      ;;
                  esac
                done

                command_line="${command_line} ${requirements}"
                mkdir -p "${target}"
                case "${command_line}" in
                  *PyJWT*) echo "# jwt" > "${target}/jwt.py" ;;
                esac
                case "${command_line}" in
                  *bcrypt*)
                    mkdir -p "${target}/bcrypt"
                    echo "# bcrypt" > "${target}/bcrypt/__init__.py"
                    ;;
                esac
                case "${command_line}" in
                  *boto3*)
                    mkdir -p "${target}/boto3"
                    echo "# boto3" > "${target}/boto3/__init__.py"
                    ;;
                esac
                """
            ),
            encoding="utf-8",
        )
        docker_script.chmod(0o755)

    def _write_fake_python(self):
        python_script = self.bin_dir / "python3"
        python_script.write_text(
            textwrap.dedent(
                """\
                #!/bin/bash
                set -e
                echo "$*" >> "${FAKE_INSTALL_LOG}"

                target=""
                args="$*"
                while [ $# -gt 0 ]; do
                  case "$1" in
                    --target|-t)
                      target="$2"
                      shift 2
                      ;;
                    *)
                      shift
                      ;;
                  esac
                done

                mkdir -p "${target}"
                case "${args}" in
                  *PyJWT*) echo "# jwt" > "${target}/jwt.py" ;;
                esac
                case "${args}" in
                  *bcrypt*)
                    mkdir -p "${target}/bcrypt"
                    echo "# bcrypt" > "${target}/bcrypt/__init__.py"
                    ;;
                esac
                case "${args}" in
                  *boto3*)
                    mkdir -p "${target}/boto3"
                    echo "# boto3" > "${target}/boto3/__init__.py"
                    ;;
                esac
                """
            ),
            encoding="utf-8",
        )
        python_script.chmod(0o755)

    def _write_unavailable_docker(self):
        docker_script = self.bin_dir / "docker"
        docker_script.write_text("#!/bin/bash\nexit 1\n", encoding="utf-8")
        docker_script.chmod(0o755)

    def _run_script(self):
        env = os.environ.copy()
        env["PATH"] = f"{self.bin_dir}:{env['PATH']}"
        env["FAKE_INSTALL_LOG"] = str(self.root / "install.log")

        try:
            subprocess.run(
                ["bash", str(self.functions_dir / "package-lambda.sh")],
                cwd=self.functions_dir,
                env=env,
                check=True,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError as exc:
            raise AssertionError(
                f"package-lambda.sh failed\nSTDOUT:\n{exc.stdout}\nSTDERR:\n{exc.stderr}"
            ) from exc

        return (self.root / "install.log").read_text(encoding="utf-8")

    def test_packages_all_functions_with_docker_when_available(self):
        self._write_fake_docker()

        install_log = self._run_script()

        for name in FUNCTION_NAMES:
            self.assertTrue((self.deploy_dir / f"{name}.zip").exists())

        auth_entries = _read_zip_entries(self.deploy_dir / "auth_v2.zip")
        self.assertIn("auth_v2.py", auth_entries)
        self.assertIn("jwt.py", auth_entries)
        self.assertIn("bcrypt/__init__.py", auth_entries)
        self.assertIn("boto3/__init__.py", auth_entries)

        session_entries = _read_zip_entries(self.deploy_dir / "session_management.zip")
        self.assertIn("session_management.py", session_entries)
        self.assertIn("jwt.py", session_entries)
        self.assertIn("boto3/__init__.py", session_entries)
        self.assertNotIn("bcrypt/__init__.py", session_entries)

        report_entries = _read_zip_entries(self.deploy_dir / "report_engine.zip")
        self.assertIn("report_engine.py", report_entries)
        self.assertIn("boto3/__init__.py", report_entries)
        self.assertNotIn("jwt.py", report_entries)

        self.assertIn("--entrypoint /bin/bash", install_log)
        self.assertIn("public.ecr.aws/lambda/python:3.11", install_log)

    def test_falls_back_to_platform_specific_pip_install(self):
        self._write_unavailable_docker()
        self._write_fake_python()

        install_log = self._run_script()

        self.assertIn("--platform manylinux2014_x86_64", install_log)
        self.assertIn("--only-binary=:all:", install_log)

        auth_entries = _read_zip_entries(self.deploy_dir / "auth_v2.zip")
        self.assertIn("auth_v2.py", auth_entries)
        self.assertIn("jwt.py", auth_entries)
        self.assertIn("bcrypt/__init__.py", auth_entries)
        self.assertIn("boto3/__init__.py", auth_entries)


if __name__ == "__main__":
    unittest.main()
