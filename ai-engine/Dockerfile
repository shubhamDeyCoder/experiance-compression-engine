FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /srv/ai-engine
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY ai_engine ./ai_engine

EXPOSE 8000
CMD ["uvicorn", "ai_engine.service:app", "--host", "0.0.0.0", "--port", "8000"]
