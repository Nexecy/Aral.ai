FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    ENVIRONMENT=production \
    PORT=8080 \
    HOST=0.0.0.0

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 --shell /usr/sbin/nologin appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

RUN mkdir -p /app/storage/uploads \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8080

# Cloud Run injects PORT. Keep-alive > 60s matches Cloud Run's HTTP/1 frontend.
# One worker: extra uvicorn workers would double PyMuPDF RAM on the same instance.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --proxy-headers --timeout-keep-alive 75 --workers 1"]
