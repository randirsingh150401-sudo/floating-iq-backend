# Floating IQ Backend API

Backend API server for the Floating IQ Electron app. This server handles OpenAI chat completions and MongoDB data storage.

## Features

- OpenAI Chat Completions API integration
- MongoDB for session and history storage
- RESTful API endpoints
- CORS enabled for Electron app communication

## Prerequisites

- Node.js (v14 or higher)
- MongoDB database (local or cloud)
- OpenAI API key

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the root directory:

```env
MONGODB_URI=your_mongodb_connection_string
OPENAI_API_KEY=your_openai_api_key
PORT=3000
```

## Running Locally

```bash
npm start
```

The server will start on `http://localhost:3000`

## API Endpoints

### GET /
Health check endpoint

### POST /api/chat
Send messages to OpenAI and get responses

**Request Body:**
```json
{
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "model": "gpt-3.5-turbo"
}
```

### POST /api/save-history
Save chat history to database

**Request Body:**
```json
{
  "sessionId": "session_id_here",
  "role": "user",
  "content": "message content"
}
```

### GET /api/history/:sessionId
Get chat history for a session

### POST /api/sessions
Create a new chat session

**Request Body:**
```json
{
  "userId": "user_id_here",
  "title": "Chat Title"
}
```

### GET /api/sessions/:userId
Get all sessions for a user

## Deployment

This server is designed to be deployed on platforms like:
- Render
- Railway
- Heroku
- AWS/GCP/Azure

Make sure to set environment variables in your deployment platform.

## License

ISC
