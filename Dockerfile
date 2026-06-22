FROM python:3.11-slim

WORKDIR /app
COPY relay/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY relay ./relay
COPY mobile ./mobile

WORKDIR /app/relay
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
