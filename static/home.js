// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyApaox9bfZWul8SfkMltCQnps_xBHMImsE",
    authDomain: "smart-spend-83959.firebaseapp.com",
    projectId: "smart-spend-83959",
    storageBucket: "smart-spend-83959.firebasestorage.app",
    messagingSenderId: "1090756846106",
    appId: "1:1090756846106:web:5524053541e033276f67a3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Configuration
const API_BASE_URL = 'http://localhost:8000'; // FastAPI default

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
let currentUser = null;
let currentUserId = null;
const today = new Date();
const currentMonth = today.getMonth() + 1;
const currentYear = today.getFullYear();

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication status first
    checkAuthenticationStatus();
    setupEventListeners();
    setupMobileSidebar();
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
                    const initialBotMsg = document.querySelector('.message.bot-message');
                    if (initialBotMsg) initialBotMsg.style.display = 'none';
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

    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                console.log('Successfully signed out');
                window.location.href = '/login';
            } catch (error) {
                console.error('Sign out error:', error);
                alert('Failed to sign out. Please try again.');
            }
        });
    }
}

function setupMobileSidebar() {
    // Create mobile sidebar if it doesn't exist
    if (!document.getElementById('sidebar')) {
        const sidebar = document.createElement('div');
        sidebar.id = 'sidebar';
        sidebar.className = 'mobile-sidebar';
        sidebar.innerHTML = `
            <div class="sidebar-header">
                <h3>SmartSpend</h3>
                <button id="closeSidebar" class="close-sidebar">×</button>
            </div>
            <div class="sidebar-content">
                <div class="user-info">
                    <div class="user-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="user-details">
                        <span id="sidebarUserName">User</span>
                        <span id="sidebarUserEmail">user@example.com</span>
                    </div>
                </div>
                <div class="sidebar-stats">
                    <div class="stat-item">
                        <span class="stat-label">Balance</span>
                        <span id="sidebarBalance" class="stat-value">$0.00</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Total Transactions</span>
                        <span id="sidebarTransactionCount" class="stat-value">0</span>
                    </div>
                </div>
                <div class="sidebar-actions">
                    <button class="sidebar-btn" onclick="window.location.href='/'">
                        <i class="fas fa-home"></i> Dashboard
                    </button>
                    <button class="sidebar-btn" onclick="window.location.href='/login'">
                        <i class="fas fa-sign-out-alt"></i> Logout
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(sidebar);

        // Add overlay
        const overlay = document.createElement('div');
        overlay.id = 'sidebarOverlay';
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);

        // Close sidebar button
        const closeBtn = document.getElementById('closeSidebar');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
            });
        }
    }
}

function updateBotMessage(text) {
    const botMessageDiv = document.querySelector('.message.bot-message');
    botMessageDiv.textContent = text;
    botMessageDiv.style.display = 'block'; // Ensure it's visible if we were hiding it
}

async function processMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    if (!currentUserId) {
        addBotMessage('Please log in to use this feature.');
        return;
    }
    
    // Add user message to chat
    addUserMessage(message);
    chatInput.value = '';
    
    if (!currentMode) {
        addBotMessage('Please select an option first (Add Transaction, Financial Analysis, or Expense Breakdown)');
        return;
    }
    
    // Show the spinner once Send button is clicked
    const spinner = document.getElementById('chatSpinner');
    if (spinner) spinner.style.display = 'inline-block'; // Show the spinner

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
        if (spinner) spinner.style.display = 'none'; // Hide the spinner when response is received
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
                text: message,
                user_id: currentUserId
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
        loadUserStats();
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
            body: JSON.stringify({ 
                query: message,
                user_id: currentUserId
            }),  // Send the message in the request body
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
        const response = await fetch(`${API_BASE_URL}/get-transactions/${currentUserId}`);
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
        if (!currentUserId) return;
        
        const response = await fetch(`${API_BASE_URL}/get-transactions/${currentUserId}`);
        if (!response.ok) throw new Error('Failed to load balance data');
        
        const data = await response.json();
        updateBalance(data);
    } catch (error) {
        console.error('Error loading balance:', error);
    }
}

async function loadUserStats() {
    try {
        if (!currentUserId) return;
        
        const response = await fetch(`${API_BASE_URL}/user-stats/${currentUserId}`);
        if (!response.ok) throw new Error('Failed to load user stats');
        
        const stats = await response.json();
        updateSidebarStats(stats);
    } catch (error) {
        console.error('Error loading user stats:', error);
    }
}

function updateSidebarStats(stats) {
    const sidebarBalance = document.getElementById('sidebarBalance');
    const sidebarTransactionCount = document.getElementById('sidebarTransactionCount');
    
    if (sidebarBalance) {
        sidebarBalance.textContent = formatCurrency(stats.balance);
    }
    
    if (sidebarTransactionCount) {
        sidebarTransactionCount.textContent = stats.transaction_count;
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

// Authentication Functions
function checkAuthenticationStatus() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log('User authenticated:', user.email);
            currentUser = user;
            currentUserId = user.uid;
            showUserWelcomeMessage(user.email);
            loadBalance();
            loadUserStats();
            updateSidebarUserInfo(user);
        } else {
            console.log('User not authenticated, redirecting to login');
            currentUser = null;
            currentUserId = null;
            // Only redirect if not already on login page
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
    });
}

function updateSidebarUserInfo(user) {
    const sidebarUserName = document.getElementById('sidebarUserName');
    const sidebarUserEmail = document.getElementById('sidebarUserEmail');
    
    if (sidebarUserName) {
        sidebarUserName.textContent = user.displayName || user.email.split('@')[0];
    }
    
    if (sidebarUserEmail) {
        sidebarUserEmail.textContent = user.email;
    }
}

// function showUserWelcomeMessage(email) {
//     // Remove any existing messages
//     hideUserWelcomeMessage();
    
//     // Create welcome message
//     const welcomeDiv = document.createElement('div');
//     welcomeDiv.id = 'userWelcome';
//     welcomeDiv.style.cssText = `
//         position: fixed;
//         top: 20px;
//         left: 50%;
//         transform: translateX(-50%);
//         background: linear-gradient(45deg, #ff6b6b, #ee5a52);
//         color: white;
//         padding: 15px 25px;
//         border-radius: 10px;
//         box-shadow: 0 4px 15px rgba(0,0,0,0.2);
//         z-index: 1000;
//         font-family: 'Montserrat', sans-serif;
//         text-align: center;
//         min-width: 300px;
//     `;
    
//     welcomeDiv.innerHTML = `
//         <div style="margin-bottom: 10px;">
//             <i class="fas fa-user-check" style="margin-right: 8px;"></i>
//             Welcome back: <strong>${email}</strong>
//         </div>
//         <div style="display: flex; gap: 10px; justify-content: center;">
//             <button id="continueBtn" style="
//                 background: rgba(255,255,255,0.2);
//                 border: 1px solid rgba(255,255,255,0.3);
//                 color: white;
//                 padding: 8px 16px;
//                 border-radius: 5px;
//                 cursor: pointer;
//                 font-size: 14px;
//             ">Continue to Dashboard</button>
//             <button id="logoutBtn" style="
//                 background: rgba(255,255,255,0.2);
//                 border: 1px solid rgba(255,255,255,0.3);
//                 color: white;
//                 padding: 8px 16px;
//                 border-radius: 5px;
//                 cursor: pointer;
//                 font-size: 14px;
//             ">Sign Out</button>
//         </div>
//     `;
    
//     document.body.appendChild(welcomeDiv);
    
//     // Add event listeners
//     document.getElementById('continueBtn').addEventListener('click', () => {
//         hideUserWelcomeMessage();
//     });
    
//     document.getElementById('logoutBtn').addEventListener('click', async () => {
//         try {
//             await signOut(auth);
//             hideUserWelcomeMessage();
//             console.log('Successfully signed out');
//             // Redirect to login page after sign out
//             window.location.href = '/login';
//         } catch (error) {
//             console.error('Sign out error:', error);
//             alert('Failed to sign out. Please try again.');
//         }
//     });
// }

// function hideUserWelcomeMessage() {
//     const existingMessage = document.getElementById('userWelcome');
//     if (existingMessage) {
//         existingMessage.remove();
//     }
// }