"""
Wekeza Backend - Main Application Entry Point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api import auth, agents, portfolio, risk, logs

app = FastAPI(
    title="Wekeza API",
    description="Backend API for Wekeza Quantitative Investment Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Middleware - Allow frontend to make requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(agents.router, prefix="/api/agents", tags=["Agents"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["Portfolio"])
app.include_router(risk.router, prefix="/api/risk", tags=["Risk Management"])
app.include_router(logs.router, prefix="/api/logs", tags=["System Logs"])


@app.get("/", tags=["Health"])
async def root():
    """Health check endpoint"""
    return {"status": "online", "message": "Wekeza API is running"}


@app.get("/api/health", tags=["Health"])
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "ml_model": "mock" if not settings.USE_REAL_MODEL else "production"
    }
