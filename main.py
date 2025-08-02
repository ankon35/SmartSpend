# Import necessary libraries
import os
import json
import csv
from typing import Dict, Any, List
from dotenv import load_dotenv
from collections import defaultdict

# Import the correct LangChain components for Google's Gemini model
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate

# Load environment variables from the .env file
load_dotenv()

# Access the Google API key from environment
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Check if the API key is loaded correctly.
if not GOOGLE_API_KEY:
    raise ValueError(
        "Google API key is missing. Please set GOOGLE_API_KEY in the .env file."
    )

# Define the name of the CSV file for storing financial data
DATA_FILE = 'financial_data.csv'

def save_data_to_csv(entry_type: str, category: str, amount: float):
    """
    Saves a single financial entry (expense or deposit) to a CSV file.
    """
    # Check if the file exists to determine if we need to write the header
    file_exists = os.path.isfile(DATA_FILE)
    
    with open(DATA_FILE, 'a', newline='') as file:
        writer = csv.writer(file)
        if not file_exists:
            writer.writerow(['type', 'category', 'amount'])
        writer.writerow([entry_type, category, amount])
    print(f"Entry saved to {DATA_FILE}")

def load_data_from_csv() -> Dict[str, Any]:
    """
    Loads all financial data from the CSV file and returns it in a dictionary.
    """
    user_data = {
        'expenses': defaultdict(float),
        'deposits': []
    }
    
    if not os.path.isfile(DATA_FILE):
        return user_data
    
    with open(DATA_FILE, 'r') as file:
        reader = csv.DictReader(file)
        for row in reader:
            entry_type = row['type']
            category = row['category']
            try:
                amount = float(row['amount'])
                if entry_type == 'expense':
                    user_data['expenses'][category] += amount
                elif entry_type == 'deposit':
                    user_data['deposits'].append(amount)
            except (ValueError, KeyError):
                print(f"Skipping invalid row: {row}")
    
    # Convert defaultdict to a regular dict for cleaner output
    user_data['expenses'] = dict(user_data['expenses'])
    return user_data

# Simple function to simulate expense tracking and handling
def analyze_expenses(data: Dict[str, Any]) -> tuple[float, float]:
    """
    Calculates the total expenses and current balance from the provided data.
    """
    total_expense = sum(data['expenses'].values())
    total_deposit = sum(data['deposits'])
    balance = total_deposit - total_expense
    return total_expense, balance

# LangChain Template setup
# We use a ChatPromptTemplate to provide a system message and a user message.
# It's important to include the user's financial data in the prompt so the LLM
# has the necessary context to answer.
prompt_template = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful financial assistant. Analyze the user's financial data provided below and answer their question. The data is in JSON format. Do not make up any numbers. If you cannot answer a question based on the provided data, state that."),
    ("human", "My financial data is: ```json\n{financial_data}\n```\n\nMy question is: {user_query}"),
])

# Set up the LLM model using ChatGoogleGenerativeAI
# We pass the API key directly to the constructor for clarity and robustness.
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0, google_api_key=GOOGLE_API_KEY)

def get_financial_advice(query: str, data: Dict[str, Any]) -> str:
    """
    Function to get financial advice from the Gemini LLM based on a user query.
    """
    try:
        # Create a dictionary to hold the prompt inputs
        # We serialize the user_data to a JSON string to pass it to the LLM.
        prompt_inputs = {
            "financial_data": json.dumps(data, indent=2),
            "user_query": query
        }
        
        # Invoke the LLM chain with the constructed prompt
        response = llm.invoke(prompt_template.format_messages(**prompt_inputs))
        
        # The response object from ChatGoogleGenerativeAI has a 'content' attribute
        return response.content
    except Exception as e:
        return f"An error occurred: {str(e)}"

# A main entry point for running the script from the console
if __name__ == "__main__":
    print("Welcome to the Gemini Financial Assistant!")
    print("This version stores your data in 'financial_data.csv'.")
    
    while True:
        print("\n--- Menu ---")
        print("1. Add a new financial entry")
        print("2. Ask a question about your finances")
        print("3. Exit")
        
        choice = input("Enter your choice (1-3): ")
        
        if choice == '1':
            entry_type = input("Is this an 'expense' or a 'deposit'? ").lower()
            if entry_type not in ['expense', 'deposit']:
                print("Invalid entry type. Please enter 'expense' or 'deposit'.")
                continue

            category = input("Enter a category (e.g., 'groceries', 'salary'): ")
            
            try:
                amount = float(input("Enter the amount: "))
                save_data_to_csv(entry_type, category, amount)
            except ValueError:
                print("Invalid amount. Please enter a number.")
        
        elif choice == '2':
            # Load the latest data before asking the LLM
            current_data = load_data_from_csv()
            user_query = input("\nYour question: ")
            
            # Get the LLM response based on the user's input and current data
            response = get_financial_advice(user_query, current_data)
            
            print("\nAssistant's response:")
            print(response)
        
        elif choice == '3':
            print("Goodbye!")
            break
        
        else:
            print("Invalid choice. Please enter a number between 1 and 3.")
