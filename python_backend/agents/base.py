"""
Simplified Agent Base
Works without CrewAI when not available
"""

import os
from typing import Optional

# Try to import crewai, fall back if not available
try:
    from crewai import Agent, Task
    CREWAI_AVAILABLE = True
except ImportError:
    CREWAI_AVAILABLE = False
    Agent = None
    Task = None

# Try to import langchain-groq
try:
    from langchain_groq import ChatGroq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False
    ChatGroq = None


def get_llm(groq_api_key: str = None):
    """Get Groq LLM if available"""
    if not GROQ_AVAILABLE:
        return None
    
    api_key = groq_api_key or os.getenv('GROQ_API_KEY')
    if not api_key or api_key == 'your_groq_api_key_here':
        return None
    
    try:
        return ChatGroq(
            groq_api_key=api_key,
            model_name="llama-3.1-70b-versatile",
            temperature=0.1
        )
    except Exception as e:
        print(f"Could not initialize Groq LLM: {e}")
        return None


def create_agent(role: str, goal: str, backstory: str, llm=None):
    """Create a CrewAI agent if available, else return None"""
    if not CREWAI_AVAILABLE or Agent is None:
        return None
    
    return Agent(
        role=role,
        goal=goal,
        backstory=backstory,
        verbose=True,
        allow_delegation=False,
        llm=llm
    )


def create_task(description: str, agent, expected_output: str):
    """Create a CrewAI task if available"""
    if not CREWAI_AVAILABLE or Task is None or agent is None:
        return None
    
    return Task(
        description=description,
        agent=agent,
        expected_output=expected_output
    )
