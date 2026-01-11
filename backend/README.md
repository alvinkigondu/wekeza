# Wekeza Backend API

FastAPI + PostgreSQL backend for the Wekeza Quantitative Investment Platform.

## Setup

1. Create virtual environment:
```bash
python -m venv venv
venv\Scripts\activate  # Windows
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
copy .env.example .env
# Edit .env with your database credentials
```

4. Run database migrations:
```bash
alembic upgrade head
```

5. (Optional) Seed the database with sample data:
```bash
python -m app.seed_data
```
Demo credentials: `demo@wekeza.com` / `demo123`

6. Start the server:
```bash
uvicorn app.main:app --reload
```

## API Docs
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## ML Model Integration
The ML model abstraction layer is in `app/services/ml_model/`. 
To integrate a new model, implement the `ModelInterface` class.
