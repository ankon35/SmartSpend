from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from flask import Flask, request, jsonify
import os
import json
import csv
import re
from typing import Dict, Any, Tuple
from dotenv import load_dotenv
from collections import defaultdict
from datetime import datetime
from pydantic import BaseModel
import threading
import uvicorn

# Load environment variables
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("Google API key missing. Set GOOGLE_API_KEY in .env")

DATA_FILE = 'financial_data.csv'


# Jinja2 template setup for HTML rendering
templates = Jinja2Templates(directory="templates")

# Static files setup for serving CSS and JS



# Shared functions (same as in your original code)
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
app_fastapi = FastAPI(title="Financial Assistant API")

# CORS middleware
app_fastapi.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app_fastapi.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")


@app_fastapi.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Render the homepage"""
    return templates.TemplateResponse("index.html", {"request": request})


@app_fastapi.post("/add-transaction")
async def add_transaction(transaction: Transaction):
    """Add a new transaction"""
    trans_type, category, amount = parse_transaction(transaction.text)
    
    if transaction.amount is not None:
        amount = transaction.amount
    
    if amount == 0:
        raise HTTPException(status_code=400, detail="Amount is required")
    
    save_data_to_csv(trans_type, category, amount)
    return {"message": "Transaction saved", "type": trans_type, "category": category, "amount": amount}

@app_fastapi.get("/get-transactions")
async def get_transactions():
    """Get all transactions"""
    data = load_data_from_csv()
    return data

@app_fastapi.post("/analyze")
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

# Flask Implementation
app_flask = Flask(__name__)

@app_flask.route('/add-transaction', methods=['POST'])
def flask_add_transaction():
    """Add transaction (Flask version)"""
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({"error": "Missing transaction text"}), 400
    
    trans_type, category, amount = parse_transaction(data['text'])
    
    if 'amount' in data:
        amount = float(data['amount'])
    
    if amount == 0:
        return jsonify({"error": "Amount is required"}), 400
    
    save_data_to_csv(trans_type, category, amount)
    return jsonify({
        "message": "Transaction saved",
        "type": trans_type,
        "category": category,
        "amount": amount
    })

@app_flask.route('/get-transactions', methods=['GET'])
def flask_get_transactions():
    """Get all transactions (Flask version)"""
    data = load_data_from_csv()
    return jsonify(data)

@app_flask.route('/analyze', methods=['POST'])
def flask_analyze():
    """Analyze financial data (Flask version)"""
    data = request.get_json()
    if not data or 'query' not in data:
        return jsonify({"error": "Missing query"}), 400
    
    financial_data = load_data_from_csv()
    
    try:
        total_expenses = sum(financial_data['expenses'].values())
        total_deposits = sum(amt for _, amt in financial_data['deposits'])
        
        formatted_data = {
            "expenses": [{"description": k, "amount": v} for k,v in financial_data['expenses'].items()],
            "deposits": [{"description": k, "amount": v} for k,v in financial_data['deposits']],
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
            query=data['query']
        ))
        
        return jsonify({"response": response.content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    import uvicorn
    # Run FastAPI on port 8000 and Flask on port 5000
    print("Starting servers...")
    print("FastAPI running on http://localhost:8000")
    print("Flask running on http://localhost:5000")
    
    # In production, you would run these separately
    import threading
    fastapi_thread = threading.Thread(target=uvicorn.run, args=(app_fastapi,), kwargs={"host": "127.0.0.1", "port": 8000})
    flask_thread = threading.Thread(target=app_flask.run, kwargs={"host": "127.0.0.1", "port": 5000})
    
    fastapi_thread.start()
    flask_thread.start()
    
    fastapi_thread.join()
    flask_thread.join()