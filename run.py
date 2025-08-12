#!/usr/bin/env python3
"""
SmartSpend Startup Script
This script provides an easy way to start the SmartSpend application
"""

import os
import sys
import subprocess
from pathlib import Path

def check_dependencies():
    """Check if required dependencies are installed"""
    try:
        import fastapi
        import uvicorn
        import jinja2
        import dotenv
        print("✓ All required dependencies are installed")
        return True
    except ImportError as e:
        print(f"✗ Missing dependency: {e}")
        print("Please run: pip install -r requirements.txt")
        return False

def check_env_file():
    """Check if .env file exists and has required variables"""
    env_file = Path(".env")
    if not env_file.exists():
        print("⚠ Warning: .env file not found")
        print("Please create a .env file with your GOOGLE_API_KEY")
        print("Example:")
        print("GOOGLE_API_KEY=your_api_key_here")
        return False
    
    # Check if GOOGLE_API_KEY is set
    from dotenv import load_dotenv
    load_dotenv()
    
    if not os.getenv("GOOGLE_API_KEY"):
        print("⚠ Warning: GOOGLE_API_KEY not found in .env file")
        return False
    
    print("✓ Environment variables configured")
    return True

def start_application():
    """Start the SmartSpend application"""
    print("🚀 Starting SmartSpend...")
    
    # Check if we're in the right directory
    if not Path("financial_api.py").exists():
        print("✗ Error: financial_api.py not found")
        print("Please run this script from the SmartSpend directory")
        return False
    
    try:
        # Start the FastAPI application
        print("📡 Starting FastAPI server on http://localhost:8000")
        print("🌐 Homepage: http://localhost:8000/")
        print("🔐 Login: http://localhost:8000/login")
        print("📊 Dashboard: http://localhost:8000/dashboard")
        print("📚 API Docs: http://localhost:8000/docs")
        print("\nPress Ctrl+C to stop the server")
        print("-" * 50)
        
        # Run the FastAPI application
        subprocess.run([sys.executable, "financial_api.py"])
        
    except KeyboardInterrupt:
        print("\n\n🛑 Server stopped by user")
        return True
    except Exception as e:
        print(f"✗ Error starting application: {e}")
        return False

def main():
    """Main function"""
    print("=" * 50)
    print("🎯 SmartSpend - Personal Finance Management")
    print("=" * 50)
    
    # Check dependencies
    if not check_dependencies():
        return False
    
    # Check environment
    check_env_file()
    
    # Start application
    return start_application()

if __name__ == "__main__":
    success = main()
    if not success:
        sys.exit(1)
