# Deployment Guide

## Development Setup

### Prerequisites
- Docker & Docker Compose
- Node.js 20+
- Python 3.11+

### Quick Start
```bash
# Clone repository
git clone https://github.com/your-org/fork-tracker.git
cd fork-tracker

# Copy environment
cp .env.example .env

# Set environment variables
# Edit .env with your values

# Start services
docker-compose up -d

# Frontend development
npm run dev

# API available at http://localhost:8000
```

## Production Deployment

### Using Docker Compose
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Environment Variables
| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |
| REDIS_URL | Redis connection string | Yes |
| SECRET_KEY | JWT signing key | Yes |
| OPENAI_API_KEY | AI provider key | No |

### SSL Setup
Use nginx or Traefik for SSL termination.

### Database Migration
```bash
# Apply migrations
alembic upgrade head
```

## Platform-Specific

### AWS
- ECS/Fargate for containers
- RDS for PostgreSQL
- ElastiCache for Redis
- ALB for load balancing

### Azure
- Container Apps for services
- Database for PostgreSQL
- Cache for Redis
- Front Door for CDN

### GCP
- Cloud Run for containers
- Cloud SQL for PostgreSQL
- Memorystore for Redis
- Cloud Load Balancer