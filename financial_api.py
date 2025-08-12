from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, HTMLResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import os
import json
import csv
import re
from typing import Dict, Any, Tuple
from dotenv import load_dotenv
from collections import defaultdict
from datetime import datetime
from pydantic import BaseModel
import uvicorn
from fastapi.staticfiles import StaticFiles

# Load environment variables
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("Google API key missing. Set GOOGLE_API_KEY in .env")

# Create user_data directory if it doesn't exist
USER_DATA_DIR = 'user_data'
os.makedirs(USER_DATA_DIR, exist_ok=True)

# Jinja2 template setup for HTML rendering
templates = Jinja2Templates(directory="templates")

# Shared functions
def get_user_data_file(user_id: str) -> str:
    """Get the CSV file path for a specific user"""
    return os.path.join(USER_DATA_DIR, f"{user_id}_financial_data.csv")

def save_data_to_csv(user_id: str, entry_type: str, category: str, amount: float):
    """Save transaction with original text as category, along with timestamp"""
    data_file = get_user_data_file(user_id)
    file_exists = os.path.isfile(data_file)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    with open(data_file, 'a', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        if not file_exists:
            writer.writerow(['timestamp', 'type', 'category', 'amount'])
        writer.writerow([timestamp, entry_type, category.strip(), amount])

def load_data_from_csv(user_id: str) -> Dict[str, Any]:
    """Load data preserving original categories for a specific user"""
    data = {'expenses': defaultdict(float), 'deposits': []}
    data_file = get_user_data_file(user_id)
    
    if not os.path.isfile(data_file):
        return data
        
    with open(data_file, 'r', encoding='utf-8') as file:
        reader = csv.reader(file)
        header = next(reader, None)
        for row in reader:
            if len(row) != 4:
                continue
            timestamp, entry_type, category, amount = row
            try:
                if entry_type == 'expense':
                    data['expenses'][category] += float(amount)
                elif entry_type == 'deposit':
                    data['deposits'].append((category, float(amount)))
            except ValueError:
                continue
    return data

def parse_transaction(text: str) -> Tuple[str, str, float]:
    """Parse natural language transaction with robust fallback"""
    amount_match = re.search(r'(\d+\.?\d*)\s*(taka|dollars?|USD|€|£)?', text, re.IGNORECASE)
    amount = float(amount_match.group(1)) if amount_match else None
    
    expense_words = {'bought', 'paid', 'spent', 'purchased'}
    deposit_words = {'received', 'got', 'deposit', 'gifted'}
    words = set(text.lower().split())
    
    if expense_words & words:
        trans_type = 'expense'
    elif deposit_words & words:
        trans_type = 'deposit'
    else:
        trans_type = None
    
    return (trans_type or 'expense', text, amount or 0.0)

# Pydantic models for FastAPI
class Transaction(BaseModel):
    text: str
    amount: float = None
    user_id: str

class Question(BaseModel):
    query: str
    user_id: str

class UserData(BaseModel):
    user_id: str

# FastAPI Implementation
app = FastAPI(title="SmartSpend Financial Assistant API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files and UI directories with cache control
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import pathlib

# Custom static files handler with cache control
class NoCacheStaticFiles(StaticFiles):
    def is_not_modified(self, response_headers, request_headers) -> bool:
        return False 

app.mount("/static", StaticFiles(directory="static"), name="static")
# app.mount("/static", NoCacheStaticFiles(directory="static"), name="static")
app.mount("/UI", StaticFiles(directory="UI"), name="ui")

# FastAPI Routes

# Landing page is login
@app.get("/", response_class=HTMLResponse)
async def login_landing(request: Request):
    """Serve the login page as the landing page"""
    return templates.TemplateResponse("login.html", {"request": request})

# Dashboard is index.html
@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    """Serve the dashboard page (main app)"""
    import time
    return templates.TemplateResponse("index.html", {"request": request, "timestamp": int(time.time())})


@app.post("/add-transaction")
async def add_transaction(transaction: Transaction):
    """Add a new transaction for a specific user"""
    trans_type, category, amount = parse_transaction(transaction.text)
    
    if transaction.amount is not None:
        amount = transaction.amount
    
    if amount == 0:
        raise HTTPException(status_code=400, detail="Amount is required")
    
    save_data_to_csv(transaction.user_id, trans_type, category, amount)
    return {"message": "Transaction saved", "type": trans_type, "category": category, "amount": amount}

@app.get("/get-transactions/{user_id}")
async def get_transactions(user_id: str):
    """Get all transactions for a specific user"""
    data = load_data_from_csv(user_id)
    return data

@app.post("/analyze")
async def analyze(question: Question):
    """Analyze financial data for a specific user"""
    data = load_data_from_csv(question.user_id)
    
    try:
        total_expenses = sum(data['expenses'].values())
        total_deposits = sum(amt for _, amt in data['deposits'])
        
        formatted_data = {
            "expenses": [{"description": k, "amount": v} for k,v in data['expenses'].items()],
            "deposits": [{"description": k, "amount": v} for k,v in data['deposits']],
            "totals": {
                "expenses": total_expenses,
                "deposits": total_deposits,
                "balance": total_deposits - total_expenses
            }
        }
        
        # Using the same LLM setup as in your original code
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain.prompts import ChatPromptTemplate
        
        llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash-lite", temperature=0.2, google_api_key=GOOGLE_API_KEY)
        analysis_prompt = ChatPromptTemplate.from_messages([
            ("system", """You're a financial assistant. Analyze this data:
{data}
Provide specific insights using the exact category names from the data."""), 
            ("human", "{query}")
        ])
        
        response = llm.invoke(analysis_prompt.format_messages(
            data=json.dumps(formatted_data, indent=2),
            query=question.query
        ))
        
        return {"response": response.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/user-stats/{user_id}")
async def get_user_stats(user_id: str):
    """Get user statistics and summary"""
    data = load_data_from_csv(user_id)
    
    total_expenses = sum(data['expenses'].values())
    total_deposits = sum(amt for _, amt in data['deposits'])
    balance = total_deposits - total_expenses
    
    # Get top expenses
    top_expenses = sorted(data['expenses'].items(), key=lambda x: x[1], reverse=True)[:5]
    
    # Get recent transactions
    data_file = get_user_data_file(user_id)
    recent_transactions = []
    if os.path.isfile(data_file):
        with open(data_file, 'r', encoding='utf-8') as file:
            reader = csv.reader(file)
            header = next(reader, None)
            rows = list(reader)
            # Get last 10 transactions
            recent_transactions = rows[-10:] if len(rows) > 10 else rows
    
    return {
        "balance": balance,
        "total_expenses": total_expenses,
        "total_deposits": total_deposits,
        "top_expenses": [{"category": k, "amount": v} for k, v in top_expenses],
        "recent_transactions": recent_transactions,
        "transaction_count": len(data['expenses']) + len(data['deposits'])
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "SmartSpend API is running"}



if __name__ == "__main__":
    print("Starting SmartSpend Financial Assistant API...")
    print("API running on http://localhost:8000")
    print("Homepage: http://localhost:8000/")
    print("Login: http://localhost:8000/login")
    print("Dashboard: http://localhost:8000/dashboard")
    
    uvicorn.run(app, host="127.0.0.1", port=8000)