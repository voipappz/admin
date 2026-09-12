# Agent Usage Instructions

## Overview
This document provides comprehensive instructions for using specialized agents throughout the VoIP Admin Migration Project. Each phase has dedicated agent configurations that ensure consistent development patterns and quality standards.

## Agent Configuration Files

### Available Agents
- **`react-frontend-dev`** - Frontend development with React, Material-UI, and modern patterns
- **`general-purpose`** - General research, planning, and multi-step tasks

### Agent Configuration Locations
```
.project/agents/
├── phase2-admin-screens-agent.md    # Admin screens migration agent
├── phase3-pbx-builder-agent.md      # PBX flow builder agent
└── phase4-integration-agent.md      # Integration and polish agent
```

## Using Agents with Git

### Saving Agent Configurations
Agent configurations are stored in git to ensure:
- Consistent development patterns across team members
- Version-controlled agent instructions
- Repeatable development workflows
- Knowledge preservation for future development

### Agent Configuration Structure
Each agent configuration file contains:
- **Context**: Phase overview and objectives
- **Patterns**: Established coding patterns to follow
- **Tasks**: Specific implementation requirements
- **Standards**: Quality and testing requirements
- **Examples**: Code patterns and structure examples

## Phase-Specific Agent Usage

### Phase 2: Admin Screens Migration
**Agent**: `react-frontend-dev`  
**Configuration**: `.project/agents/phase2-admin-screens-agent.md`

#### Setup Instructions
```bash
# Switch to appropriate branch
git checkout feature/phase2-users-management

# Review agent configuration
cat .project/agents/phase2-admin-screens-agent.md

# Use Claude Code with react-frontend-dev agent
# Reference the configuration file for:
# - Component architecture patterns
# - Material-UI usage guidelines
# - State management approaches
# - Testing requirements
```

#### Key Patterns from Agent
- **Component Structure**: Component-hook separation pattern
- **Styling**: Material-UI v7 components exclusively
- **State Management**: Context for global state, hooks for component state
- **API Integration**: Established apiService patterns
- **Multi-tenant**: CustomerEnvironmentContext integration

#### Example Usage
```bash
# Start development session
git checkout feature/phase2-users-management

# Agent will guide you to create:
# - UserManagementContext
# - UsersList component with DataGrid
# - UserForm component
# - Role-based permissions
# Following the patterns specified in the agent configuration
```

### Phase 3: PBX Flow Builder
**Agent**: `react-frontend-dev`  
**Configuration**: `.project/agents/phase3-pbx-builder-agent.md`

#### Setup Instructions
```bash
# Switch to appropriate branch
git checkout feature/phase3-react-flow-setup

# Review agent configuration
cat .project/agents/phase3-pbx-builder-agent.md

# Agent provides specific guidance for:
# - React Flow integration
# - Node component architecture
# - FLOIP specification compliance
# - Flow validation patterns
```

#### Key Patterns from Agent
- **React Flow**: Primary library for node-based interfaces
- **Node Types**: Standardized PBX node implementations
- **FLOIP Compliance**: Flow Interoperability Project standards
- **Validation**: Comprehensive flow validation framework
- **Performance**: Optimization for large flows

### Phase 4: Integration & Polish
**Agent**: `react-frontend-dev`  
**Configuration**: `.project/agents/phase4-integration-agent.md`

#### Setup Instructions
```bash
# Switch to appropriate branch
git checkout feature/phase4-api-integration

# Review agent configuration
cat .project/agents/phase4-integration-agent.md

# Agent focuses on:
# - Cross-component integration
# - Performance optimization
# - Security implementation
# - Production readiness
```

## Development Workflow with Agents

### 1. Branch Preparation
```bash
# Create task branch following naming convention
git checkout -b feature/phase2-users-management

# Ensure you have latest agent configurations
git pull origin main -- .project/agents/
```

### 2. Agent Configuration Review
```bash
# Read the relevant agent configuration
cat .project/agents/phase2-admin-screens-agent.md

# Key sections to review:
# - Context and objectives
# - Patterns to follow
# - Task-specific requirements
# - Success criteria
```

### 3. Development Session Setup
```bash
# Start development with appropriate context
# Reference agent configuration throughout development

# Agent will guide you through:
# - File structure creation
# - Component implementation
# - Testing requirements
# - Code quality standards
```

### 4. Quality Validation
```bash
# Agent ensures compliance with:
# - ESLint configuration
# - Testing coverage requirements
# - Performance benchmarks
# - Security standards
# - Documentation requirements
```

## Agent Configuration Management

### Updating Agent Configurations
```bash
# Make changes to agent configuration
vim .project/agents/phase2-admin-screens-agent.md

# Commit changes to preserve version history
git add .project/agents/phase2-admin-screens-agent.md
git commit -m "update: enhance phase 2 agent configuration with new testing patterns"
git push origin main
```

### Version Control Benefits
- **Historical Record**: Track evolution of development patterns
- **Team Consistency**: All team members use same agent instructions
- **Knowledge Preservation**: Critical patterns preserved in git history
- **Collaborative Updates**: Agent configurations can be improved collaboratively

### Branch-Specific Agents
```bash
# Different branches can use different agent configurations
git checkout feature/phase2-advanced-features

# Update agent configuration for specific branch needs
cp .project/agents/phase2-admin-screens-agent.md .project/agents/phase2-advanced-agent.md

# Modify for specific requirements
vim .project/agents/phase2-advanced-agent.md

# Use the specialized configuration
cat .project/agents/phase2-advanced-agent.md
```

## Agent Best Practices

### Configuration Maintenance
- **Regular Updates**: Update agent configurations based on lessons learned
- **Specific Instructions**: Include concrete examples and patterns
- **Quality Standards**: Maintain high standards for code quality and testing
- **Performance Guidelines**: Include performance requirements and benchmarks

### Development Consistency
- **Pattern Adherence**: Always follow established patterns from agent configurations
- **Code Review**: Use agent configurations as code review guidelines
- **Testing Standards**: Maintain testing requirements specified by agents
- **Documentation**: Keep documentation updated as specified by agents

### Collaboration
- **Shared Configurations**: Ensure all team members use same agent configurations
- **Feedback Loop**: Update agent configurations based on development experience
- **Knowledge Sharing**: Use agent configurations to onboard new team members
- **Best Practices**: Capture best practices in agent configurations

## Troubleshooting

### Common Issues
1. **Agent Configuration Out of Date**
   ```bash
   git pull origin main -- .project/agents/
   ```

2. **Branch-Specific Requirements**
   ```bash
   # Create branch-specific agent configuration if needed
   cp .project/agents/base-agent.md .project/agents/branch-specific-agent.md
   ```

3. **Conflicting Patterns**
   ```bash
   # Refer to the most recent agent configuration
   git log --oneline .project/agents/phase2-admin-screens-agent.md
   ```

### Getting Help
- **Configuration Questions**: Review agent configuration files
- **Pattern Clarification**: Check examples in agent configurations  
- **Quality Standards**: Reference testing and quality sections
- **Performance Issues**: Review performance guidelines in configurations

## Agent Configuration Template

When creating new agent configurations, use this template:

```markdown
# Phase X: [Phase Name] Agent Configuration

## Agent Type: `agent-type-name`

## Phase Overview
[Brief description of phase objectives]

## Agent Instructions

### Context
[Detailed context and background]

### Key Patterns to Follow
[Specific patterns and approaches]

### Tasks for Phase X
[Detailed task breakdown]

### Development Standards
[Code quality and testing standards]

### File Structure
[Expected file organization]

### Testing Requirements
[Testing approach and coverage requirements]

### Performance Considerations
[Performance requirements and optimization guidelines]

### Success Criteria
[Specific success metrics]

### Branch Strategy
[Git workflow for this phase]
```

## Integration with Development Tools

### ESLint Integration
Agent configurations specify ESLint rules and standards to maintain code quality consistency.

### Testing Integration
Agents provide testing patterns and coverage requirements for consistent quality across all phases.

### Build Integration
Performance requirements and build optimization guidelines ensure production readiness.

### Documentation Integration
Agents specify documentation requirements to maintain comprehensive project documentation.

This agent system ensures consistent, high-quality development across all phases of the VoIP Admin Migration Project while preserving knowledge and patterns in version-controlled configurations.