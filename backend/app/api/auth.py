"""
Authentication API Routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta

from app.core.database import get_db
from app.core.security import (
    get_password_hash, 
    verify_password, 
    create_access_token, 
    get_current_user
)
from app.core.config import settings
from app.models.user import User
from app.models.portfolio import Portfolio
from app.schemas.user import (
    UserCreate, 
    UserResponse, 
    Token, 
    UserUpdate,
    RiskSettings,
    NotificationPrefs,
    UserSettingsUpdate
)

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user account"""
    # Check if user exists
    existing_user = db.query(User).filter(User.email == user_data.email.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists"
        )
    
    # Create new user
    new_user = User(
        full_name=user_data.full_name,
        email=user_data.email.lower(),
        hashed_password=get_password_hash(user_data.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Create empty portfolio for user
    portfolio = Portfolio(user_id=new_user.id)
    db.add(portfolio)
    db.commit()
    
    return new_user


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login and get access token"""
    user = db.query(User).filter(User.email == form_data.username.lower()).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Get current user's profile"""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_profile(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's profile"""
    if user_update.full_name:
        current_user.full_name = user_update.full_name
    if user_update.email:
        # Check if email is taken
        existing = db.query(User).filter(
            User.email == user_update.email.lower(),
            User.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use"
            )
        current_user.email = user_update.email.lower()
    
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/settings/risk", response_model=RiskSettings)
async def get_risk_settings(current_user: User = Depends(get_current_user)):
    """Get user's risk settings"""
    return RiskSettings(**current_user.risk_settings)


@router.put("/settings/risk", response_model=RiskSettings)
async def update_risk_settings(
    risk_settings: RiskSettings,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user's risk settings"""
    current_user.risk_settings = risk_settings.model_dump()
    db.commit()
    db.refresh(current_user)
    return RiskSettings(**current_user.risk_settings)


@router.get("/settings/notifications", response_model=NotificationPrefs)
async def get_notification_prefs(current_user: User = Depends(get_current_user)):
    """Get user's notification preferences"""
    return NotificationPrefs(**current_user.notification_prefs)


@router.put("/settings/notifications", response_model=NotificationPrefs)
async def update_notification_prefs(
    prefs: NotificationPrefs,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user's notification preferences"""
    current_user.notification_prefs = prefs.model_dump()
    db.commit()
    db.refresh(current_user)
    return NotificationPrefs(**current_user.notification_prefs)
