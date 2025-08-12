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

# Load environment variables
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("Google API key missing. Set GOOGLE_API_KEY in .env")

DATA_FILE = 'financial_data.csv'

# Jinja2 template setup for HTML rendering
templates = Jinja2Templates(directory="templates")

# Shared functions
def save_data_to_csv(entry_type: str, category: str, amount: float):
    """Save transaction with original text as category, along with timestamp"""
    file_exists = os.path.isfile(DATA_FILE)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(DATA_FILE, 'a', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        if not file_exists:
            writer.writerow(['timestamp', 'type', 'category', 'amount'])
        writer.writerow([timestamp, entry_type, category.strip(), amount])

def load_data_from_csv() -> Dict[str, Any]:
    """Load data preserving original categories"""
    data = {'expenses': defaultdict(float), 'deposits': []}
    if not os.path.isfile(DATA_FILE):
        return data
        
    with open(DATA_FILE, 'r', encoding='utf-8') as file:
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

class Question(BaseModel):
    query: str

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

# Mount static files and UI directories
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/SmartSpend/UI", StaticFiles(directory="UI"), name="ui")

# FastAPI Routes
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Serve the homepage"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    """Serve the login page"""
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    """Serve the dashboard page (same as home)"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/add-transaction")
async def add_transaction(transaction: Transaction):
    """Add a new transaction"""
    trans_type, category, amount = parse_transaction(transaction.text)
    
    if transaction.amount is not None:
        amount = transaction.amount
    
    if amount == 0:
        raise HTTPException(status_code=400, detail="Amount is required")
    
    save_data_to_csv(trans_type, category, amount)
    return {"message": "Transaction saved", "type": trans_type, "category": category, "amount": amount}

@app.get("/get-transactions")
async def get_transactions():
    """Get all transactions"""
    data = load_data_from_csv()
    return data

@app.post("/analyze")
async def analyze(question: Question):
    """Analyze financial data"""
    data = load_data_from_csv()
    
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