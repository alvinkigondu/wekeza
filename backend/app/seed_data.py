"""
Seed Data Script - Populate database with sample data for testing
Run with: python -m app.seed_data
"""
from datetime import datetime, timedelta
import random

from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.user import User
from app.models.agent import Agent, AgentStatus, AgentStrategy
from app.models.portfolio import Portfolio, Holding
from app.models.trade import Trade, TradeAction, TradeStatus
from app.models.system_log import SystemLog, LogLevel, LogCategory


def seed_database():
    """Create sample data for testing"""
    print("🌱 Starting database seeding...")
    
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # Check if data already exists
        existing_user = db.query(User).first()
        if existing_user:
            print("⚠️  Database already has data. Skipping seed.")
            return
        
        # ========== CREATE USERS ==========
        print("👤 Creating demo users...")
        
        demo_user = User(
            full_name="Demo Trader",
            email="demo@wekeza.com",
            hashed_password=get_password_hash("demo123"),
            risk_settings={
                "max_position_size": 15,
                "stop_loss_default": 5,
                "daily_loss_limit": 10,
                "leverage_limit": 3
            },
            notification_prefs={
                "trade_alerts": True,
                "performance_reports": True,
                "risk_warnings": True,
                "market_updates": True
            }
        )
        db.add(demo_user)
        
        test_user = User(
            full_name="Test User",
            email="test@wekeza.com",
            hashed_password=get_password_hash("test123"),
        )
        db.add(test_user)
        db.commit()
        db.refresh(demo_user)
        db.refresh(test_user)
        print(f"   ✓ Created users: demo@wekeza.com (pass: demo123), test@wekeza.com (pass: test123)")
        
        # ========== CREATE AGENTS ==========
        print("🤖 Creating AI trading agents...")
        
        agents_data = [
            {
                "agent_id": "AGT-001",
                "name": "Momentum Trader",
                "strategy": AgentStrategy.MOMENTUM,
                "status": AgentStatus.RUNNING,
                "config": {"risk_level": "medium", "max_trades_per_day": 10, "target_assets": ["BTC", "ETH"]},
                "total_pnl": 12450.50,
                "win_rate": 68.5,
                "total_trades": 156,
                "owner_id": demo_user.id
            },
            {
                "agent_id": "AGT-002",
                "name": "Mean Reversion Bot",
                "strategy": AgentStrategy.MEAN_REVERSION,
                "status": AgentStatus.RUNNING,
                "config": {"risk_level": "low", "max_trades_per_day": 5, "target_assets": ["TSLA", "AAPL", "MSFT"]},
                "total_pnl": 8320.75,
                "win_rate": 72.3,
                "total_trades": 98,
                "owner_id": demo_user.id
            },
            {
                "agent_id": "AGT-003",
                "name": "Arbitrage Hunter",
                "strategy": AgentStrategy.ARBITRAGE,
                "status": AgentStatus.IDLE,
                "config": {"risk_level": "high", "max_trades_per_day": 50, "target_assets": ["BTC", "ETH", "SOL"]},
                "total_pnl": 5680.25,
                "win_rate": 85.2,
                "total_trades": 312,
                "owner_id": demo_user.id
            },
            {
                "agent_id": "AGT-004",
                "name": "Trend Follower",
                "strategy": AgentStrategy.TREND_FOLLOWING,
                "status": AgentStatus.PAUSED,
                "config": {"risk_level": "medium", "max_trades_per_day": 8, "target_assets": ["EUR/USD", "GBP/USD"]},
                "total_pnl": -1250.00,
                "win_rate": 45.8,
                "total_trades": 67,
                "owner_id": demo_user.id
            }
        ]
        
        created_agents = []
        for agent_data in agents_data:
            agent = Agent(**agent_data, last_active=datetime.utcnow() - timedelta(hours=random.randint(0, 48)))
            db.add(agent)
            created_agents.append(agent)
        db.commit()
        print(f"   ✓ Created {len(agents_data)} agents")
        
        # ========== CREATE PORTFOLIO ==========
        print("💼 Creating portfolio with holdings...")
        
        portfolio = Portfolio(
            user_id=demo_user.id,
            total_value=125680.50,
            allocation={
                "crypto": 45,
                "stocks": 35,
                "forex": 10,
                "commodities": 5,
                "cash": 5
            }
        )
        db.add(portfolio)
        db.commit()
        db.refresh(portfolio)
        
        holdings_data = [
            {"asset": "Bitcoin (BTC)", "asset_type": "Crypto", "symbol": "BTC", "quantity": 1.25, "avg_price": 42500.00, "current_price": 43250.00},
            {"asset": "Ethereum (ETH)", "asset_type": "Crypto", "symbol": "ETH", "quantity": 8.5, "avg_price": 2280.00, "current_price": 2350.00},
            {"asset": "Solana (SOL)", "asset_type": "Crypto", "symbol": "SOL", "quantity": 45.0, "avg_price": 95.50, "current_price": 102.75},
            {"asset": "Tesla Inc", "asset_type": "Stock", "symbol": "TSLA", "quantity": 25.0, "avg_price": 245.00, "current_price": 258.50},
            {"asset": "Apple Inc", "asset_type": "Stock", "symbol": "AAPL", "quantity": 50.0, "avg_price": 178.25, "current_price": 185.00},
            {"asset": "Microsoft Corp", "asset_type": "Stock", "symbol": "MSFT", "quantity": 20.0, "avg_price": 375.00, "current_price": 390.25},
            {"asset": "EUR/USD", "asset_type": "Forex", "symbol": "EUR/USD", "quantity": 10000.0, "avg_price": 1.0850, "current_price": 1.0920},
            {"asset": "Gold", "asset_type": "Commodity", "symbol": "XAU", "quantity": 2.5, "avg_price": 1985.00, "current_price": 2025.50},
        ]
        
        for holding_data in holdings_data:
            holding = Holding(portfolio_id=portfolio.id, **holding_data)
            db.add(holding)
        db.commit()
        print(f"   ✓ Created portfolio with {len(holdings_data)} holdings")
        
        # ========== CREATE TRADES ==========
        print("📈 Creating trade history...")
        
        trade_assets = [
            ("Bitcoin (BTC)", "BTC"), ("Ethereum (ETH)", "ETH"), ("Tesla Inc", "TSLA"),
            ("Apple Inc", "AAPL"), ("Microsoft Corp", "MSFT"), ("Solana (SOL)", "SOL")
        ]
        
        trades_created = 0
        for i in range(50):
            asset, symbol = random.choice(trade_assets)
            action = random.choice([TradeAction.BUY, TradeAction.SELL])
            quantity = round(random.uniform(0.1, 10.0), 2)
            price = round(random.uniform(50, 50000), 2)
            
            trade = Trade(
                action=action,
                asset=asset,
                symbol=symbol,
                quantity=quantity,
                price=price,
                total_value=round(quantity * price, 2),
                status=TradeStatus.EXECUTED,
                user_id=demo_user.id,
                agent_id=random.choice(created_agents).id,
                executed_at=datetime.utcnow() - timedelta(hours=random.randint(1, 720))
            )
            db.add(trade)
            trades_created += 1
        db.commit()
        print(f"   ✓ Created {trades_created} trade records")
        
        # ========== CREATE SYSTEM LOGS ==========
        print("📋 Creating system logs...")
        
        log_messages = [
            (LogLevel.SUCCESS, LogCategory.AUTH, "User logged in successfully"),
            (LogLevel.INFO, LogCategory.AGENT, "Agent AGT-001 started trading session"),
            (LogLevel.SUCCESS, LogCategory.TRADE, "Trade executed: BUY 0.5 BTC @ $43,250"),
            (LogLevel.WARNING, LogCategory.RISK, "Daily loss limit 80% reached"),
            (LogLevel.INFO, LogCategory.AGENT, "Agent AGT-002 analyzing market conditions"),
            (LogLevel.SUCCESS, LogCategory.TRADE, "Trade executed: SELL 10 TSLA @ $258.50"),
            (LogLevel.ERROR, LogCategory.SYSTEM, "API rate limit exceeded - retrying in 60s"),
            (LogLevel.INFO, LogCategory.AGENT, "Agent AGT-003 paused by user"),
            (LogLevel.SUCCESS, LogCategory.AUTH, "Password updated successfully"),
            (LogLevel.WARNING, LogCategory.RISK, "Unusual volatility detected in BTC"),
            (LogLevel.INFO, LogCategory.SYSTEM, "Database backup completed"),
            (LogLevel.SUCCESS, LogCategory.TRADE, "Trade executed: BUY 5 ETH @ $2,350"),
        ]
        
        logs_created = 0
        for level, category, message in log_messages:
            log = SystemLog(
                level=level,
                category=category,
                message=message,
                user_id=demo_user.id if category != LogCategory.SYSTEM else None,
                created_at=datetime.utcnow() - timedelta(hours=random.randint(0, 168))
            )
            db.add(log)
            logs_created += 1
        db.commit()
        print(f"   ✓ Created {logs_created} system log entries")
        
        print("\n✅ Database seeding completed successfully!")
        print("\n📝 Demo Credentials:")
        print("   Email: demo@wekeza.com")
        print("   Password: demo123")
        
    except Exception as e:
        print(f"❌ Error seeding database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def clear_database():
    """Remove all data from the database (use with caution!)"""
    print("🗑️  Clearing all database data...")
    db = SessionLocal()
    try:
        db.query(SystemLog).delete()
        db.query(Trade).delete()
        db.query(Holding).delete()
        db.query(Portfolio).delete()
        db.query(Agent).delete()
        db.query(User).delete()
        db.commit()
        print("✅ Database cleared successfully!")
    except Exception as e:
        print(f"❌ Error clearing database: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--clear":
        clear_database()
    else:
        seed_database()
