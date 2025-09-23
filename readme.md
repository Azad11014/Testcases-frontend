# Project Management Dashboard - Frontend README

This is the frontend component of the Project Management Dashboard, a web-based interface built to interact with the FastAPI-based backend for managing projects, documents (BRD and FRD), and test cases. The dashboard provides a user-friendly interface for project creation, document uploads, document viewing, and test case management with real-time AI-powered features.

## Table of Contents
1. [Overview](#overview)
2. [Features](#features)
3. [File Structure](#file-structure)
4. [Dependencies](#dependencies)
5. [Setup and Installation](#setup-and-installation)
   - [Prerequisites](#prerequisites)
   - [Installation Steps](#installation-steps)
6. [Usage](#usage)
7. [Key Components](#key-components)
   - [HTML Structure](#html-structure)
   - [CSS](#css)
   - [JavaScript](#javascript)
8. [API Integration](#api-integration)
9. [Development Guidelines](#development-guidelines)
10. [Contributing](#contributing)

## Overview
The Project Management Dashboard is a single-page application (SPA) that allows users to:
- Create and manage projects.
- Upload BRD and FRD documents.
- View and analyze document content.
- Convert BRDs to FRDs, analyze FRDs, and generate test cases.
- Refine test cases interactively via a chat interface.
- Manage test case versions and download responses.

The frontend communicates with a FastAPI backend via RESTful APIs and uses Server-Sent Events (SSE) for real-time streaming of AI-generated content.

## Features
- **Multi-step navigation**: Project selection, project details, and document/test case viewing.
- **Real-time streaming**: Displays AI processing results as they are generated.
- **Modal-based interactions**: For creating projects and uploading documents.
- **Version control**: Supports navigation and saving of chat response versions.
- **Responsive design**: Basic styling for different screen sizes.
- **Error handling**: Displays user-friendly error messages.

## File Structure
```
project_dashboard/
├── index.html              # Main HTML file with UI structure
├── style/
│   ├── styles.css         # General styles for the dashboard
│   └── enhanced-brd.css   # Enhanced styles for BRD-specific features
├── scripts/
│   ├── api.js            # API configuration and service classes
│   ├── streaming.js      # Streaming service for real-time updates
│   ├── brd_streaming.js  # BRD-specific streaming logic
│   ├── text_formatter.js # Text formatting utilities
│   ├── main.js          # Main application logic (ProjectManager class)
│   ├── frd_functionality.js # FRD-specific functionality
│   └── brd_functionality.js # BRD-specific functionality
```

## Dependencies
- **HTML5**: For structure and semantic markup.
- **CSS3**: For styling (custom stylesheets in `style/`).
- **JavaScript (ES6+)**: For interactivity and logic (no external libraries required).
- **Fetch API**: For HTTP requests to the backend.
- **EventSource API**: For SSE streaming.

## Setup and Installation

### Prerequisites
- **Web Browser**: Modern browser (Chrome, Firefox, Edge, etc.) with JavaScript enabled.
- **Node.js (optional)**: For local development and testing (if using a build tool in the future).
- **Backend Server**: The FastAPI backend must be running at `http://localhost:8000` (configurable via `API_BASE` in `api.js`).

### Installation Steps
1. **Clone the Repository**:
   ```bash
   git clone <repository_url>
   cd project_dashboard
   ```

2. **Open the Project**:
   - Simply open `index.html` in a web browser for a basic setup.
   - Alternatively, serve the files using a local web server (e.g., `python -m http.server 8001` or Node.js with `http-server`) to avoid CORS issues.

3. **Configure the Backend**:
   - Ensure the FastAPI backend is running at the default `http://localhost:8000` or update `API_BASE` in `scripts/api.js` to match your backend URL.

4. **Test the Application**:
   - Navigate to `http://localhost:8000` (or your server port) in a browser to verify the dashboard loads and connects to the backend.

## Usage
1. **Select or Create a Project**:
   - On the initial screen, select an existing project or click "Create New Project" to add one.
2. **Upload Documents**:
   - From the project details view, use the "Upload Document" button to add BRD or FRD files.
3. **View and Manage Documents**:
   - Click a document to view its content and perform actions like conversion (BRD), analysis, or test case generation.
4. **Manage Test Cases**:
   - View existing test cases, open a specific test case, and refine it via the chat interface.
5. **Download Responses**:
   - Save chat responses as text files using the "Save" button.

## Key Components

### HTML Structure
- **Container**: Main wrapper with a header and step-based sections (Project Selection, Project Details, Document Viewer).
- **Modals**: Used for creating projects and uploading documents.
- **Dynamic Sections**: `documentsList`, `documentContent`, and `flow-container` elements are populated via JavaScript.

### CSS
- **styles.css**: Defines general layout, buttons, modals, and responsive design.
- **enhanced-brd.css**: Adds specific styles for BRD workflow steps and chat interface.

### JavaScript
- **api.js**: Configures API endpoints and provides service classes (`API`, `ProjectAPI`, `TestCaseAPI`, `FRDAPI`, `BRDAPI`).
- **streaming.js**: Handles SSE streaming with `StreamingService` (currently a placeholder; see `brd_streaming.js` for BRD-specific implementation).
- **brd_streaming.js**: Implements `BRDStreamingService` for BRD-related streaming (conversion, analysis, test generation).
- **text_formatter.js**: Provides text formatting utilities (placeholder; implemented in `BRDFunctionality` and `FRDFunctionality`).
- **main.js**: Contains the `ProjectManager` class for navigation and core functionality.
- **frd_functionality.js**: Manages FRD-specific actions (analysis, test generation, chat).
- **brd_functionality.js**: Manages BRD-specific workflows (conversion, analysis, test generation, chat).

## API Integration
The frontend integrates with the following backend endpoints (configured in `api.js`):
- **Projects**: `/api/v1/project/projects`, `/api/v1/project/create`, `/api/v1/project/{project_id}/upload`.
- **Documents**: `/api/v1/project/{project_id}/documents/{document_id}/extract`.
- **Test Cases**: `/api/v1/project/{project_id}/document/{document_id}/testcases`, `/api/v1/testcases/{testcase_id}/preview`, `/api/v1/testcases/{testcase_id}/chat`.
- **FRD Actions**: `/api/v1/project/{project_id}/document/{document_id}/analyze`, `/api/v1/project/{project_id}/documents/{document_id}/testcases/generate`, `/api/v1/project/{project_id}/documents/{document_id}/testcases/chat`.
- **BRD Actions**: `/api/v1/project/{project_id}/document/{document_id}/convert`, `/api/v1/project/{project_id}/document/{document_id}/bfrd/analyze`, `/api/v1/project/{project_id}/document/{document_id}/testcases/generate`, `/api/v1/project/{project_id}/document/{document_id}/testcases/update`.
- **Streaming**: Various `/stream` endpoints for real-time updates.

## Development Guidelines
- **Coding Standards**: Use consistent ES6+ syntax, add comments for complex logic, and follow the existing class-based structure.
- **Error Handling**: Implement try-catch blocks and user-friendly error messages.
- **Styling**: Extend `styles.css` and `enhanced-brd.css` for new features, ensuring responsiveness.
- **Testing**: Test with the backend running locally; simulate network delays for streaming.
- **Version Control**: Use Git for tracking changes; commit frequently with descriptive messages.

## Contributing
1. Fork the repository.
2. Create a new branch (`git checkout -b feature-branch`).
3. Make changes and commit (`git commit -m "Add new feature"`).
4. Push to the branch (`git push origin feature-branch`).
5. Open a pull request with a clear description of changes.

For questions or issues, contact the development team or raise an issue on the repository.

---

**Last Updated**: 12:24 PM IST, Tuesday, September 23, 2025