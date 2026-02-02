## Communication
- Use Chinese (中文) for all communications and discussions

## Project Background
- This is a fullstack project template with modern tooling
- Monorepo structure using pnpm workspaces
- Server: NestJS with NodeNext module resolution
- Web: Vue 3 + Vite frontend

## Code Standards
- All comments and documentation must be in English
- Follow existing code patterns and conventions

## Adding Dependencies Process
1. Check latest version: `pnpm view <package-name> version`
2. Add to appropriate catalog in `pnpm-workspace.yaml` (create new catalog section if needed)
3. Run installation command
4. Never install dependencies directly without using catalogs

## Code Quality Checks
After any code modifications:
1. Run from root directory: `pnpm typecheck`
2. Run from root directory: `pnpm eslint . --fix`
3. Address all errors before proceeding with further changes

## Import Rules

- Use `pnpm view ...` to check depedencies version before installing
- Must use "pnpm catalog" to manage installing new dependencies
- Catalogs must be put in specific category, DO NOT use `catalog:` directly.

- For `apps/server` (NestJS): All import paths must end with `.js` extension due to NodeNext module resolution
- For `apps/server`: Use explicit dependency injection with `@Inject(...)` in constructor parameters to avoid type-only import warnings

## Current Module Resolution
- `apps/server`: Uses `moduleResolution: NodeNext` and `target: NodeNext`
- All import paths must include file extensions

## Examples

### Import and DI pattern
```typescript
// Correct import in server
import { ConfigService } from './config/config.service.js'

@Injectable()
class MyService {
  // Correct dependency injection
  // Avoid being resolved as type import
  constructor(@Inject(ConfigService) private config: ConfigService) {}
}
```
