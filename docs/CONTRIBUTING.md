# Contributing

## Development Setup

1. Fork and clone the repository
2. Install dependencies:
   ```bash
   cd frontend && npm install
   cd ../backend && npm install
   ```
3. Start development servers:
   ```bash
   # Terminal 1: Backend
   cd backend && npm run dev

   # Terminal 2: Frontend
   cd frontend && npm run dev
   ```

## Code Style

### Leo (Smart Contract)
- Use snake_case for function names and variables
- Use PascalCase for record and struct types
- Add comments for non-obvious logic
- Use u128 intermediates for overflow-prone math

### TypeScript (Frontend & Backend)
- Use camelCase for variables and functions
- Use PascalCase for components and types
- Prefer named exports for components
- Use barrel exports (index.ts) for component folders

### CSS (Tailwind)
- Follow the design system in tailwind.config.js
- Use custom classes from globals.css (glass-card, btn-primary, etc.)
- No purple, no gradient buttons
- Only teal (#00D4B8) as accent color

## Git Workflow

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Test locally (contract: `leo build`, frontend: `npm run dev`)
4. Commit with descriptive messages
5. Push and create a pull request

## Testing

### Smart Contract
```bash
cd contract/veil_strike_v6
leo build
leo run <transition_name> <inputs...>
```

### Frontend
```bash
cd frontend
npm run dev
# Manual testing in browser
```

### Backend
```bash
cd backend
npm run dev
curl http://localhost:3001/api/health
```

## Areas for Contribution

- Additional market types (multi-outcome, scalar)
- Enhanced oracle with multiple data sources
- On-chain dispute resolution improvements
- Mobile-responsive UI improvements
- Integration tests
- Performance optimization for FPMM calculations
