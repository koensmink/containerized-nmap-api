
# Containerized Nmap API

Een compacte containerized API bovenop `nmap`.  
De service biedt een eenvoudige HTTP-endpoint die een `nmap`-scan uitvoert en het resultaat als JSON retourneert.  
De repository bevat tevens een voorbeeld n8n-workflow.

---

## Repositorystructuur

```
.
├─ docker-compose.yml                 # Minimalistische stack: alleen de portscan-service
├─ docker-compose-n8n.yml             # Uitgebreide stack: n8n + Postgres
├─ .env.example.n8n                   # Voorbeeld .env voor de n8n-stack
├─ portscan-service/
│  ├─ Dockerfile                      # Node 18 + nmap + API
│  ├─ index.js                        # Express API + nmap-wrapper
│  └─ package.json                    # Node-afhankelijkheden
└─ n8n/
   └─ dnsscanner.json                 # Voorbeeldworkflow die de API aanroept
```

---

## portscan-service

### Overzicht

- Base image: `node:18-alpine`
- Installeert `nmap` via `apk`
- Exposeert poort `8080` in de container
- Dependencies: `express`, `xml2js`
- De API voert `nmap` uit, parseert XML-output en retourneert open poorten plus ruwe data

### Dockerfile

```dockerfile
FROM node:18-alpine
RUN apk add --no-cache nmap
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY index.js .
EXPOSE 8080
```

---

## Stand-alone deployment

`docker-compose.yml` start alleen de API:

```yaml
services:
  portscan-service:
    build: ./portscan-service
    ports:
      - "${PORTS}:8080"
    cap_add:
      - NET_RAW
    restart: unless-stopped
```

### Vereiste variabelen

Maak een `.env` aan:

```env
PORTS=8080
```

Start:

```bash
docker compose up -d
```

API-endpoints:

- `GET  /v1/health`
- `POST /v1/scan`

---

## API-documentatie

### Health check

```
GET /v1/health
```

Response:

```json
{ "ok": true }
```

---

### Portscan uitvoeren

```
POST /v1/scan
Content-Type: application/json
```

Voorbeeldrequest:

```json
{
  "host": "scanme.nmap.org",
  "ports": "22,80,443",
  "flags": "-T4"
}
```
---

## n8n-integratie

De repository bevat drie elementen:

- `docker-compose-n8n.yml`
- `.env.example.n8n`
- `n8n/dnsscanner.json` (workflow)

### Uitgebreide stack

`docker-compose-n8n.yml` bevat:

- n8n
- PostgreSQL

Starten:

```bash
docker compose -f docker-compose-n8n.yml --env-file .env up -d
```

### Workflow

`n8n/dnsscanner.json` bevat een workflow die:

1. Inputparameters instelt (`host`, `ports`, `flags`)
2. De API aanroept via `POST /v1/scan`
3. De output verwerkt en verder gebruikt binnen n8n
