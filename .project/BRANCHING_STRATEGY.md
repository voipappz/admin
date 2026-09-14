# Git Branching Strategy

## Overview
This document outlines the git branching strategy for the VoIP Admin Migration Project. The strategy is designed to support parallel development across multiple phases while maintaining code quality and project organization.

## Branch Types

### Main Branches
- **`main`** - Production-ready code, always deployable
- **`develop`** - Integration branch for completed features

### Phase Branches
- **`feature/phase1-foundation`** ✅ COMPLETED
- **`feature/phase2-admin-screens-migration`** - Admin screens migration work
- **`feature/phase3-pbx-visual-builder`** - PBX flow builder development  
- **`feature/phase4-integration-polish`** - Final integration and optimization

### Task Branches
- **`feature/phase[X]-[task-name]`** - Individual feature development
- **`hotfix/[issue-description]`** - Critical production fixes
- **`chore/[maintenance-task]`** - Maintenance and tooling updates

## Naming Conventions

### Feature Branches
```bash
feature/phase1-customer-environment-selector ✅
feature/phase2-users-management
feature/phase2-environments-management
feature/phase2-dids-management
feature/phase2-services-management
feature/phase2-tariffs-management
feature/phase3-react-flow-setup
feature/phase3-pbx-nodes
feature/phase3-flow-logic
feature/phase3-property-panels
feature/phase4-api-integration
feature/phase4-performance
feature/phase4-security
```

### Hotfix and Chore Branches
```bash
hotfix/authentication-token-refresh
hotfix/customer-selection-bug
chore/update-dependencies
chore/improve-build-performance
```

## Workflow

### Starting a New Phase
```bash
# Create phase branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/phase2-admin-screens-migration

# Push phase branch
git push -u origin feature/phase2-admin-screens-migration
```

### Working on a Task
```bash
# Create task branch from phase branch
git checkout feature/phase2-admin-screens-migration
git pull origin feature/phase2-admin-screens-migration
git checkout -b feature/phase2-users-management

# Develop feature with regular commits
git add .
git commit -m "Add user management context and API service"
git push -u origin feature/phase2-users-management
```

### Using Agents for Development
```bash
# Switch to appropriate branch
git checkout feature/phase2-users-management

# Use the designated agent for the phase
# Reference: .project/agents/phase2-admin-screens-agent.md
```

### Completing a Task
```bash
# Ensure all changes are committed
git add .
git commit -m "Complete users management implementation

- Add UserManagementContext for CRUD operations
- Implement UsersList with Material-UI DataGrid
- Create UserForm for create/edit operations  
- Add role-based permissions system
- Include comprehensive error handling

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push final changes
git push origin feature/phase2-users-management

# Create PR to phase branch (not directly to develop)
gh pr create \
  --base feature/phase2-admin-screens-migration \
  --title "feat: implement users management system" \
  --body "$(cat <<'EOF'
## Summary
- Implements complete users management system
- CRUD operations with Material-UI components  
- Role-based permissions integration
- Multi-tenant customer/environment context

## Test Plan
- [ ] User creation with validation
- [ ] User editing with real-time updates
- [ ] User deletion with confirmation
- [ ] Role assignment and verification
- [ ] Customer/environment context integration

🤖 Generated with [Claude Code](https://claude.ai/code)
EOF
)"
```

### Completing a Phase
```bash
# Merge all task branches to phase branch
git checkout feature/phase2-admin-screens-migration
git merge feature/phase2-users-management
git merge feature/phase2-environments-management
# ... merge other completed tasks

# Create PR to develop
gh pr create \
  --base develop \
  --title "feat: complete Phase 2 - Admin Screens Migration" \
  --body "$(cat <<'EOF'
## Summary
- Complete migration of all admin screens from AngularJS to React
- Users, Environments, DIDs, Services, and Tariffs management
- Material-UI components with consistent styling
- Multi-tenant architecture integration

## Test Plan
- [ ] All admin screens functional
- [ ] CRUD operations working
- [ ] Customer/environment context working
- [ ] ESLint passing
- [ ] Build successful

🤖 Generated with [Claude Code](https://claude.ai/code)
EOF
)"
```

## Branch Protection Rules

### Main Branch (`main`)
- Require PR reviews (2 reviewers)
- Require status checks to pass
- Require branches to be up to date
- Restrict pushes to admins only
- Require signed commits

### Develop Branch (`develop`)
- Require PR reviews (1 reviewer)  
- Require status checks to pass
- Allow merge commits, squash merging
- Delete head branches automatically

### Phase Branches
- Require PR reviews for task merges
- Allow direct pushes for phase leads
- Require CI checks to pass
- Auto-delete completed task branches

## CI/CD Integration

### Branch Triggers
The real triggers live in `.github/workflows/ci.yml` (GitHub Actions): every
push and pull request runs the gate, and pushes to `main` also publish the
Docker Hub image.

## Agent Integration

### Phase-Specific Development
Each phase has a dedicated agent configuration in `.project/agents/` directory:
- `phase2-admin-screens-agent.md`
- `phase3-pbx-builder-agent.md` 
- `phase4-integration-agent.md`

### Using Agents with Git
```bash
# Before starting development
git checkout feature/phase2-users-management

# Reference the agent configuration
cat .project/agents/phase2-admin-screens-agent.md

# Follow agent instructions for:
# - Component architecture patterns
# - Testing requirements  
# - Performance considerations
# - Code quality standards
```

## Quality Gates

### Pre-merge Requirements
- [ ] ESLint passing with 0 errors
- [ ] All tests passing (unit + integration)
- [ ] Build successful without warnings
- [ ] Code coverage > 80%
- [ ] Agent instructions followed
- [ ] Documentation updated

### Phase Completion Requirements
- [ ] All phase tasks completed
- [ ] Integration testing passed
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] User acceptance testing passed

## Emergency Procedures

### Hotfix Process
```bash
# Create hotfix from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-auth-bug

# Fix the issue
# ... make changes ...

# Commit and push
git commit -m "hotfix: resolve authentication token refresh issue"
git push -u origin hotfix/critical-auth-bug

# Create PR to main
gh pr create --base main --title "hotfix: critical authentication fix"

# After merge, backport to develop
git checkout develop
git cherry-pick <commit-hash>
git push origin develop
```

### Rollback Procedures
```bash
# Revert specific commit
git revert <commit-hash>

# Reset to previous stable state
git reset --hard <stable-commit-hash>
git push --force-with-lease origin main
```

## Best Practices

### Commit Messages
- Use conventional commits format
- Include issue references where applicable
- Add Claude Code attribution for AI-generated code
- Keep commits atomic and focused

### PR Guidelines
- Use descriptive titles and detailed descriptions
- Include test plan and verification steps
- Reference related issues and documentation
- Add screenshots for UI changes
- Ensure CI checks pass before requesting review

### Code Reviews
- Focus on architecture and design patterns
- Verify agent instructions compliance
- Check for security vulnerabilities
- Validate test coverage and quality
- Ensure documentation accuracy

## Metrics and Monitoring

### Branch Metrics
- Average PR size and review time
- Branch lifetime and merge frequency
- CI success rates by branch type
- Code quality trends over time

### Quality Tracking
- ESLint error trends
- Test coverage by phase
- Build performance metrics
- Security scan results