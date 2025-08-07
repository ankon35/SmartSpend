// Configuration
const API_BASE_URL = 'http://localhost:8000'; // FastAPI default
// const API_BASE_URL = 'http://localhost:5000'; // Flask default

// DOM Elements
const balanceAmount = document.getElementById('balanceAmount');
const totalDeposits = document.getElementById('totalDeposits');
const totalExpenses = document.getElementById('totalExpenses');
const optionBtns = document.querySelectorAll('.option-btn');
const chatBox = document.getElementById('chatBox');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const chatSpinner = document.getElementById('chatSpinner');
const chatError = document.getElementById('chatError');

// State
let currentMode = null;
const today = new Date();
const currentMonth = today.getMonth() + 1;
const currentYear = today.getFullYear();

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    loadBalance();
    setupEventListeners();
});

function setupEventListeners() {
    // Option buttons
    optionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            optionBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.dataset.option;

            // Clear previous messages from the chat box
            chatBox.innerHTML = ''; // This removes all previous chat messages

            // Change the bot's greeting message based on the selected option
            let instruction = '';
            switch(currentMode) {
                case 'add-transaction':
                    instruction = 'Please describe your transaction (e.g. "I spent $50 on groceries" or "I received $200 salary")';
                    break;
                case 'financial-analysis':
                    instruction = 'Ask any question about your financial data (e.g. "Where am I spending the most?" or "What\'s my current balance?")';
                    break;
                case 'expense-breakdown':
                    instruction = 'Showing expense breakdown for the current month...';
                    loadExpenseBreakdown();
                    // Hide the bot message container for expense breakdown
                    document.querySelector('.message.bot-message').style.display = 'none';
                    return;
            }

            // Update the bot message
            updateBotMessage(instruction);
        });
    });

    // Prevent the button from refreshing the page when clicked
    sendBtn.addEventListener('click', (event) => {
        event.preventDefault(); // Prevent default form submission behavior
        processMessage();
    });

    // Prevent Enter key from causing a form submission
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent form submission when Enter key is pressed
            processMessage();
        }
    });
}

function updateBotMessage(text) {
    const botMessageDiv = document.querySelector('.message.bot-message');
    botMessageDiv.textContent = text;
    botMessageDiv.style.display = 'block'; // Ensure it's visible if we were hiding it
}

async function processMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addUserMessage(message);
    chatInput.value = '';
    
    if (!currentMode) {
        addBotMessage('Please select an option first (Add Transaction, Financial Analysis, or Expense Breakdown)');
        return;
    }
    
    chatSpinner.style.display = 'block';
    chatError.style.display = 'none';
    
    try {
        switch(currentMode) {
            case 'add-transaction':
                await processTransaction(message);
                break;
            case 'financial-analysis':
                await processFinancialQuestion(message);
                break;
            case 'expense-breakdown':
                // Already handled by button click
                break;
        }
    } catch (error) {
        chatError.style.display = 'block';
        chatError.textContent = error.message;
    } finally {
        chatSpinner.style.display = 'none';
    }
}

async function processTransaction(message) {
    try {
        const response = await fetch(`${API_BASE_URL}/add-transaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: message
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to add transaction');
        }

        const data = await response.json();
        addBotMessage(`Transaction added: ${data.category} (${formatCurrency(data.amount)})`);
        
        // Change the subtitle text to indicate successful transaction addition
        document.querySelector('.subtitle').textContent = 'Transaction successfully added!';

        loadBalance();
    } catch (error) {
        throw new Error(`Error adding transaction: ${error.message}`);
    }
}

async function processFinancialQuestion(message) {
    try {
        const response = await fetch(`${API_BASE_URL}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: message
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to analyze data');
        }

        const data = await response.json();
        addBotMessage(data.response);
    } catch (error) {
        throw new Error(`Error analyzing data: ${error.message}`);
    }
}

async function loadExpenseBreakdown() {
    try {
        const response = await fetch(`${API_BASE_URL}/get-transactions`);
        if (!response.ok) throw new Error('Failed to load expense data');
        
        const data = await response.json();
        const expenses = data.expenses;
        
        if (Object.keys(expenses).length === 0) {
            addBotMessage('No expense data available for this month.');
            return;
        }
        
        // In a real app, you would filter by current month from the backend
        // For now, we'll show all expenses
        let breakdown = 'Expense Breakdown:\n';
        for (const [category, amount] of Object.entries(expenses)) {
            breakdown += `- ${category}: ${formatCurrency(amount)}\n`;
        }
        
        const total = Object.values(expenses).reduce((sum, amount) => sum + amount, 0);
        breakdown += `\nTotal Expenses: ${formatCurrency(total)}`;
        
        addBotMessage(breakdown);
    } catch (error) {
        addBotMessage(`Error loading expense breakdown: ${error.message}`);
    }
}

async function loadBalance() {
    try {
        const response = await fetch(`${API_BASE_URL}/get-transactions`);
        if (!response.ok) throw new Error('Failed to load balance data');
        
        const data = await response.json();
        updateBalance(data);
    } catch (error) {
        console.error('Error loading balance:', error);
    }
}

let previousBalance = 0; // Track previous balance

function updateBalance(data) {
    const totalExpensesValue = Object.values(data.expenses).reduce((sum, amount) => sum + amount, 0);
    const totalDepositsValue = data.deposits.reduce((sum, deposit) => sum + deposit[1], 0);
    const balance = totalDepositsValue - totalExpensesValue;

    balanceAmount.textContent = formatCurrency(balance); // Update balance text

    // Determine if balance is up or down compared to previous balance
    const balanceChange = balance - previousBalance;

    let arrowHtml = '';
    if (balanceChange > 0) {
        // Show up arrow (green)
        arrowHtml = ' <span style="color: green;">↑</span>';
    } else if (balanceChange < 0) {
        // Show down arrow (red)
        arrowHtml = ' <span style="color: red;">↓</span>';
    }

    balanceAmount.innerHTML += arrowHtml; // Append the arrow to the balance

    // Update the previous balance to the current one
    previousBalance = balance;

    totalExpenses.textContent = formatCurrency(totalExpensesValue);
    totalDeposits.textContent = formatCurrency(totalDepositsValue);
}

function addUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message';
    messageDiv.textContent = text;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function addBotMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message1';
    
    // Preserve line breaks
    const lines = text.split('\n\n');
    lines.forEach((line, index) => {
        if (index > 0) messageDiv.appendChild(document.createElement('br'));
        messageDiv.appendChild(document.createTextNode(line));
    });
    
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}
