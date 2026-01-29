# Fullstack Template

A modern fullstack application template built with Vue 3, NestJS, and TypeScript.

## Features

- 🚀 **Modern Tech Stack**: Vue 3 + TypeScript + NestJS
- 📦 **Monorepo**: Managed with pnpm workspaces
- 🎨 **Minimalist Design**: Clean black, white, and gray aesthetic
- 🌍 **Internationalization**: Vue I18n support for English and Chinese
- 🔧 **Developer Tools**: ESLint, Git hooks, and pre-commit checks
- ⚡ **Hot Reload**: Fast development experience

## Quick Start

### Prerequisites

- Node.js 24+
- pnpm 10+

### Create a New Project

Using [giget](https://github.com/unjs/giget) (Recommended):

```bash
# Create a new project from this template
pnpx giget gh:shenqingchuan/fullstack-template my-project

# Navigate to the project
cd my-project

# Install dependencies
pnpm install
```

Or clone the repository directly:

```bash
git clone https://github.com/admin/fullstack-template.git my-project
cd my-project

# Remove the original git history and start fresh
rm -rf .git
git init

# Install dependencies
pnpm install
```

### Running the Application

```bash
# Start both frontend and backend in parallel
pnpm dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:7070

### Building

```bash
# Build all packages
pnpm build
```

## Project Structure

```
fullstack-template/
├── apps/
│   ├── web/          # Vue 3 frontend application
│   └── server/       # NestJS backend application
├── packages/
│   ├── types/        # Shared TypeScript definitions
│   └── utils/        # Shared utility functions
├── pnpm-workspace.yaml  # Workspace configuration
└── package.json        # Root package configuration
```

## Development Guide

### Frontend Development

The frontend is built with Vue 3 using the Composition API:

```bash
# Navigate to web app
cd apps/web

# Start development server
pnpm dev
```

Key technologies:
- **Vue Router** for routing
- **Pinia** for state management
- **UnoCSS** for utility-first styling
- **Vue I18n** for internationalization

### Backend Development

The backend uses NestJS framework:

```bash
# Navigate to server app
cd apps/server

# Start development server
pnpm dev
```

### Adding Dependencies

Dependencies are managed through pnpm catalog:

```bash
# Add to root catalog
pnpm add <package> --workspace-root

# Add to specific app
pnpm --filter @fullstack-template/web add <package>
```

### Code Quality

The project includes automated code quality checks:

```bash
# Run linting
pnpm lint

# Run type checking
pnpm typecheck

# Run tests
pnpm test
```

## Scripts

- `pnpm dev` - Start all applications in development mode
- `pnpm build` - Build all applications for production
- `pnpm lint` - Run ESLint on all packages
- `pnpm typecheck` - Type check all TypeScript code
- `pnpm test` - Run test suite

## Deployment

### Production Build

```bash
# Build all applications
pnpm build

# Start production server
cd apps/server
pnpm start
```

The frontend build will be in `apps/web/dist` and the backend build in `apps/server/dist`.

## License

MIT
