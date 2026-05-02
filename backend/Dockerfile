FROM python:3.12-slim

WORKDIR /app

# System deps for httpx etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

# Railway sets $PORT; default to 8000 for local
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
