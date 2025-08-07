// Configuration
const API_BASE_URL = 'http://localhost:8000'; // FastAPI default

// const API_BASE_URL = 'https://smartspend-rhgs.onrender.com'; //Live Host api

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
    
    // Show the spinner once Send button is clicked
    const spinner = document.querySelector('.spinner');
    spinner.style.display = 'inline-block'; // Show the spinner

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
        spinner.style.display = 'none'; // Hide the spinner when response is received
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
        // alert(`Transaction successfully added: ${data.category} `);

        document.querySelector('.subtitle').textContent = 'Transaction successfully added!';

        loadBalance();
    } catch (error) {
        throw new Error(`Error adding transaction: ${error.message}`);
    }
}

async function processFinancialQuestion(message) {
    try {
        // Sending the user's message to the API for analysis
        const response = await fetch(`${API_BASE_URL}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',  // Specify the content type as JSON
            },
            body: JSON.stringify({ query: message }),  // Send the message in the request body
        });

        // Check if the response is not OK, throw an error
        if (!response.ok) {
            throw new Error('Failed to analyze data');
        }

        // Parse the response data from the API
        const data = await response.json();
        console.log(data);

        // Clean up the response text by removing unwanted characters (like asterisks, markdown, etc.)
        let cleanResponse = data.response.replace(/\*/g, '');  // Remove asterisks
        cleanResponse = cleanResponse.replace(/(?:\n\n)+/g, '\n\n');  // Remove excessive newlines

        // Now let's split and format the response by sections and points
        const sections = cleanResponse.split('\n\n**');  // Split by section headers

        // Clean up section titles and remove leading/trailing spaces
        const formattedResponse = sections.map((section, index) => {
            if (index === 0) return section.trim();  // Keep the first section title as it is (e.g., introduction)

            const [sectionTitle, ...points] = section.split('\n*').map(point => point.trim());
            const formattedPoints = points.join('.\n').replace(/\.$/, '');  // Join points back with proper punctuation

            return `**${sectionTitle.trim()}**:\n\n${formattedPoints}.`;  // Add back the section header with cleaned points
        }).join('\n\n');

        console.log(formattedResponse)
        // Display the formatted response (assumed function to handle UI update)
        addBotMessage(formattedResponse);
    } catch (error) {
        // If any error occurs during the fetch or data processing
        throw new Error(`Error analyzing data: ${error.message}`);
    }
}

async function loadExpenseBreakdown() {
    try {
        const response = await fetch(`${API_BASE_URL}/get-transactions`);
        if (!response.ok) throw new Error('Failed to load expense data');
        
        const data = await response.json();

        console.log(data)
        const expenses = data.expenses;
        
        if (Object.keys(expenses).length === 0) {
            addBotMessage('No expense data available for this month.');
            return;
        }

        // Get the current date in a readable format
        const currentDate = new Date().toLocaleDateString('en-US', {
            weekday: 'long', // Full name of the weekday
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Start the breakdown message with the date
        let breakdown = `Expense Breakdown Till ${currentDate}:\n\n\n`;
        let count = 1;
        for (const [category, amount] of Object.entries(expenses)) {
            breakdown += `\n\n${count}. ${category}: ${formatCurrency(amount)}\n\n`;
            count++;
        }
        
        const total = Object.values(expenses).reduce((sum, amount) => sum + amount, 0);
        breakdown += `\n\nTotal Expenses: ${formatCurrency(total)}`;
        
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
        // arrowHtml = ' <span style="color: green;">↑</span>';
    } else if (balanceChange < 0) {
        // Show down arrow (red)
        // arrowHtml = ' <span style="color: red;">↓</span>';
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
    
    // Display the user message
    messageDiv.textContent = text;
    
    // Add spinner to indicate loading
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    messageDiv.appendChild(spinner);
    
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

    // Remove the spinner from the previous message
    const userMessageDiv = chatBox.querySelector('.message.user-message');
    if (userMessageDiv) {
        const spinner = userMessageDiv.querySelector('.spinner');
        if (spinner) {
            spinner.remove(); // Remove the spinner after bot response
        }
    }

    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'BDT'
    }).format(amount);
}
