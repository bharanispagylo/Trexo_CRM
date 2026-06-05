# Trexo CRM

Trexo CRM is a comprehensive Employee and Task Management Portal featuring role-based access for Administrators and Employees.

## Folder Structure
* **`api/`**: Express.js backend with Prisma ORM connecting to a Supabase PostgreSQL database.
* **`ui/`**: React frontend built with Create React App.

---

## Quick Start

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed.

### 2. Installation
Install root, backend, and frontend dependencies:
```bash
# Install root dev dependencies
npm install

# Install API dependencies
cd api && npm install

# Install UI dependencies
cd ../ui && npm install
```

### 3. Run Locally
Run both the backend and frontend simultaneously from the root directory:
```bash
npm run dev
```
* **Frontend UI**: http://localhost:3000
* **Backend API**: http://localhost:5000

---

## Features

### Role-Based Access Control
* **Admin**: Manage employees, payroll, salaries, attendance records, project boards, and assign/review tasks.
* **Employee**: Log work, submit leave requests, mark daily attendance, and manage assigned tasks.

### Push Notifications
Trexo CRM has built-in support for real-time Firebase Push Notifications (FCM) on task assignment and user mentions.
* For step-by-step setup instructions, please see the [Firebase Notification Setup Guide](file:///d:/Trexo_CRM/SETUP_FIREBASE.md).
