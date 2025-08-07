

import os
import json
import csv
import re
from typing import Dict, Any, Tuple
from dotenv import load_dotenv
from collections import defaultdict
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate
from langchain_core.exceptions import OutputParserException
from datetime import datetime  # Import datetime module

# Load environment variables
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("Google API key missing. Set GOOGLE_API_KEY in .env")

DATA_FILE = 'financial_data.csv'

def save_data_to_csv(entry_type: str, category: str, amount: float):
    """Save transaction with original text as category, along with timestamp"""
    file_exists = os.path.isfile(DATA_FILE)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")  # Get the current date and time
    with open(DATA_FILE, 'a', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        if not file_exists:
            writer.writerow(['timestamp', 'type', 'category', 'amount'])  # Add 'timestamp' column
        writer.writerow([timestamp, entry_type, category.strip(), amount])  # Write the timestamp along with other data

def load_data_from_csv() -> Dict[str, Any]:
    """Load data preserving original categories"""
    data = {'expenses': defaultdict(float), 'deposits': []}
    if not os.path.isfile(DATA_FILE):
        return data
        
    with open(DATA_FILE, 'r', encoding='utf-8') as file:
        reader = csv.reader(file)
        header = next(reader, None)
        for row in reader:
            if len(row) != 4:  # Adjusting to 4 fields now (timestamp, type, category, amount)
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
    # Try to extract amount and determine type
    amount_match = re.search(r'(\d+\.?\d*)\s*(taka|dollars?|USD|€|£)?', text, re.IGNORECASE)
    amount = float(amount_match.group(1)) if amount_match else None
    
    # Determine transaction type
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

# LLM Setup
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash-lite", temperature=0.2, google_api_key=GOOGLE_API_KEY)

analysis_prompt = ChatPromptTemplate.from_messages([
    ("system", """You're a financial assistant. Analyze this data:
{data}
Provide specific insights using the exact category names from the data."""), 
    ("human", "{query}")
])

def analyze_finances(query: str, data: Dict) -> str:
    """Get financial insights using exact categories"""
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
        
        response = llm.invoke(analysis_prompt.format_messages(
            data=json.dumps(formatted_data, indent=2),
            query=query
        ))
        return response.content
    except Exception as e:
        return f"Error: {str(e)}"

def main():
    print("Financial Assistant (Preserves Exact Transaction Text)")

    while True:
        print("\n1. Add Transaction\n2. Ask Question\n3. Exit")
        choice = input("Choose (1-3): ").strip()
        
        if choice == '1':
            text = input("Enter transaction (e.g. 'I bought a cow for 10 taka'): ").strip()
            trans_type, category, amount = parse_transaction(text)
            
            if amount == 0:
                try:
                    amount = float(input(f"Enter amount for '{category}': "))
                except ValueError:
                    print("Invalid amount. Not saved.")
                    continue
            
            print(f"\nSaving as {trans_type}: {category} ({amount:.2f})")
            save_data_to_csv(trans_type, category, amount)
            
        elif choice == '2':
            data = load_data_from_csv()
            if not data['expenses'] and not data['deposits']:
                print("No transactions yet. Add some first.")
                continue
                
            query = input("Your question: ").strip()
            if not query:
                print("Please enter a question.")
                continue
                
            print("\nAnalyzing...\n")
            print(analyze_finances(query, data))
            
        elif choice == '3':
            print("Goodbye!")
            break
            
        else:
            print("Invalid choice. Try again.")

if __name__ == "__main__":
    main()