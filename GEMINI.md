# Project Overview

This is a full-stack water utility management system. The backend is a Node.js/Express application, and the frontend is a React application. The project uses a PostgreSQL database in production and SQLite for development. It also integrates with Redis for caching, Socket.io for real-time updates, and various other services for notifications and IoT data processing.

# Building and Running

## Using Docker (Recommended)

1.  **Start the services:**
    ```bash
    docker-compose up -d
    ```

2.  **Access the application:**
    *   Frontend: `http://localhost:3000`
    *   API Documentation: `http://localhost:5000/api-docs`
    *   Backend API: `http://localhost:5000`

## Local Development

1.  **Install dependencies:**
    ```bash
    # Backend
    cd backend
    npm install

    # Frontend
    cd ../frontend
    npm install
    ```

2.  **Start services:**
    ```bash
    # Terminal 1: Backend
    cd backend
    npm run dev

    # Terminal 2: Frontend
    cd frontend
    npm start

    # Terminal 3: PostgreSQL & Redis (via Docker)
    docker-compose up postgres redis -d
    ```

# Development Conventions

*   **Backend:**
    *   The backend is written in Node.js with Express.
    *   Tests are written with Jest and Supertest. Run tests with `npm test`.
    *   The backend follows the MVC pattern.
    *   The database is PostgreSQL in production and SQLite in development.
*   **Frontend:**
    *   The frontend is a React application.
    *   Tests are written with React Testing Library. Run tests with `npm test`.
    *   The frontend uses `socket.io-client` to connect to the backend for real-time updates.
*   **Git:**
    *   The project uses a feature branch workflow.
    *   Commit messages should be clear and concise.
    *   Pull requests should be used to merge changes into the main branch.
