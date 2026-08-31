"""
Aral.ai — Unified Development Server Launcher
Launches FastAPI backend (port 8000) and Next.js frontend (port 3000) concurrently.
"""
import subprocess
import sys
import os
import time

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")

    # Determine Python executable in venv
    venv_python = os.path.join(backend_dir, "venv", "Scripts", "python.exe")
    if not os.path.exists(venv_python):
        venv_python = os.path.join(backend_dir, "venv", "bin", "python")
    if not os.path.exists(venv_python):
        venv_python = sys.executable

    print("==================================================================")
    print(" 🚀 Starting Aral.ai Full-Stack Development Environment")
    print("==================================================================")
    print(f" • Backend:  http://localhost:8000 (Docs: http://localhost:8000/docs)")
    print(f" • Frontend: http://localhost:3000")
    print("==================================================================")

    # 1. Start FastAPI Backend
    backend_cmd = [venv_python, "-m", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]
    backend_proc = subprocess.Popen(backend_cmd, cwd=backend_dir)

    # 2. Start Next.js Frontend
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    frontend_proc = subprocess.Popen([npm_cmd, "run", "dev"], cwd=frontend_dir)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping Aral.ai servers...")
        backend_proc.terminate()
        frontend_proc.terminate()
        print("Done.")

if __name__ == "__main__":
    main()
