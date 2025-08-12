# SmartSpend - Personal Finance Management System

SmartSpend is a comprehensive personal finance management application that helps users track expenses, manage deposits, and get AI-powered financial insights.

## Features

- **Transaction Management**: Add and track expenses and deposits with natural language processing
- **Financial Analysis**: AI-powered financial insights using Google's Gemini model
- **Expense Breakdown**: Detailed breakdown of spending patterns
- **User Authentication**: Secure Firebase-based authentication system
- **Real-time Balance**: Live tracking of current financial status
- **Responsive UI**: Modern, mobile-friendly interface

## Tech Stack

- **Backend**: FastAPI (Python)
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Authentication**: Firebase Authentication
- **AI/ML**: Google Gemini AI via LangChain
- **Database**: CSV-based data storage
- **Styling**: Custom CSS with modern design principles

## Prerequisites

- Python 3.8 or higher
- Google API key for Gemini AI
- Firebase project setup

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd SmartSpend
   ```

2. **Create and activate virtual environment**
   ```bash
   python -m venv venv
   # On Windows
   venv\Scripts\activate
   # On macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   GOOGLE_API_KEY=your_google_api_key_here
   ```

5. **Firebase Setup**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Authentication (Email/Password)
   - Update the Firebase configuration in `static/home.js` and `UI/login/login.js`

## Running the Application

1. **Start the FastAPI server**
   ```bash
   python financial_api.py
   ```

2. **Access the application**
   - Homepage: http://localhost:8000/
   - Login: http://localhost:8000/login
   - Dashboard: http://localhost:8000/dashboard
   - API Documentation: http://localhost:8000/docs

## API Endpoints

- `GET /` - Homepage
- `GET /login` - Login page
- `GET /dashboard` - Dashboard page
- `POST /add-transaction` - Add new transaction
- `GET /get-transactions` - Get all transactions
- `POST /analyze` - AI-powered financial analysis
- `GET /health` - Health check

## Project Structure

```
SmartSpend/
├── financial_api.py          # Main FastAPI application
├── main.py                   # CLI version of the application
├── requirements.txt          # Python dependencies
├── README.md                # Project documentation
├── .env                     # Environment variables (create this)
├── financial_data.csv       # Transaction data storage
├── static/                  # Static assets
│   ├── home.css            # Homepage styles
│   ├── home.js             # Homepage functionality
│   └── favicon.ico         # Favicon
├── templates/               # HTML templates
│   ├── index.html          # Homepage template
│   └── login.html          # Login template
└── UI/                      # Additional UI components
    └── login/               # Login-specific assets
        ├── login.css        # Login styles
        └── login.js         # Login functionality
```

## Usage

1. **First Time Setup**
   - Navigate to the login page
   - Create a new account or sign in
   - You'll be redirected to the dashboard

2. **Adding Transactions**
   - Select "Add Transaction" option
   - Describe your transaction in natural language
   - Example: "I spent $50 on groceries" or "I received $200 salary"

3. **Financial Analysis**
   - Select "Financial Analysis" option
   - Ask questions about your finances
   - Get AI-powered insights and recommendations

4. **Expense Breakdown**
   - Select "Expense Breakdown" option
   - View detailed breakdown of your spending patterns

## Configuration

### Google API Key
- Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- Add it to your `.env` file

### Firebase Configuration
Update the Firebase config in both JavaScript files:
```javascript
const firebaseConfig = {
    apiKey: "your_api_key",
    authDomain: "your_project.firebaseapp.com",
    projectId: "your_project_id",
    storageBucket: "your_project.firebasestorage.app",
    messagingSenderId: "your_sender_id",
    appId: "your_app_id"
};
```

## Development

### Running in Development Mode
```bash
uvicorn financial_api:app --reload --host 127.0.0.1 --port 8000
```

### API Documentation
- Interactive API docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Troubleshooting

### Common Issues

1. **Google API Key Error**
   - Ensure your `.env` file contains the correct API key
   - Verify the API key has access to Gemini AI

2. **Firebase Authentication Issues**
   - Check Firebase project configuration
   - Ensure Authentication is enabled in Firebase Console

3. **Port Already in Use**
   - Change the port in `financial_api.py`
   - Kill existing processes using the port

4. **Module Import Errors**
   - Ensure virtual environment is activated
   - Reinstall dependencies: `pip install -r requirements.txt`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Contact the development team

## Changelog

### Version 1.0.0
- Initial release
- Basic transaction management
- AI-powered financial analysis
- User authentication system
- Responsive web interface