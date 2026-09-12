# Phase 2: Admin Screens Migration Agent Configuration

## Agent Type: `react-frontend-dev`

## Phase Overview
Migrate admin screens from AngularJS va-voipbox-admin to modern React implementation with Material-UI components and multi-tenant architecture.

## Agent Instructions

### Context
You are working on Phase 2 of the VoIP Admin Migration Project. Your role is to migrate legacy admin screens to modern React components using the established patterns from Phase 1.

### Key Patterns to Follow
- **Component Structure**: Follow the component-hook separation pattern
- **Styling**: Use Material-UI v7 components exclusively
- **State Management**: Use React Context for global state, hooks for component state
- **Multi-tenant**: Leverage CustomerEnvironmentContext from Phase 1
- **API Integration**: Use the established apiService pattern
- **Error Handling**: Implement comprehensive error boundaries and notifications

### Tasks for Phase 2

#### 1. Users Management (`feature/phase2-users-management`)
- Create UserManagementContext for user CRUD operations
- Implement UsersList component with DataGrid from MUI
- Create UserForm component for create/edit operations
- Add role-based permissions system
- Include user profile management features

#### 2. Environments Management (`feature/phase2-environments-management`)
- Create EnvironmentsManagement component
- Implement environment configuration forms
- Add environment status indicators
- Include environment-specific settings panel

#### 3. DIDs Management (`feature/phase2-dids-management`)
- Create DIDsManagement component with number allocation UI
- Implement DID routing configuration
- Add provider integration components
- Include bulk operations for DID management

#### 4. Services Management (`feature/phase2-services-management`)
- Create ServicesManagement component
- Implement service configuration panels
- Add service monitoring dashboard
- Include service deployment controls

#### 5. Tariffs Management (`feature/phase2-tariffs-management`)
- Create TariffsManagement component
- Implement pricing configuration forms
- Add billing rules management
- Include rate management with import/export

### Development Standards

#### Component Architecture
```jsx
// Example structure for each management component
const ComponentManagement = () => {
  const { selectedCustomer, selectedEnvironment } = useCustomerEnvironment();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // CRUD operations
  const handleCreate = async (data) => { /* implementation */ };
  const handleUpdate = async (id, data) => { /* implementation */ };
  const handleDelete = async (id) => { /* implementation */ };

  return (
    <Box className="management-container">
      <ManagementToolbar onAdd={handleCreate} />
      <ManagementDataGrid 
        data={items}
        loading={loading}
        onEdit={handleUpdate}
        onDelete={handleDelete}
      />
      <ManagementDialog 
        item={selectedItem}
        onSave={handleUpdate}
        onClose={() => setSelectedItem(null)}
      />
    </Box>
  );
};
```

#### Routing Integration
- Add routes to `src/App.jsx` under `/admin` path
- Use nested routing for sub-features
- Implement route guards for authenticated users

#### API Integration
- Extend `apiService` with management-specific endpoints
- Use consistent error handling patterns
- Implement optimistic updates where appropriate

### File Structure
```
src/
  components/
    Management/
      UsersManagement/
        UsersManagement.jsx
        UsersManagement.js
        UsersManagement.css
        components/
          UsersList.jsx
          UserForm.jsx
          UserDialog.jsx
      EnvironmentsManagement/
        ...
  context/
    UsersContext.jsx
    EnvironmentsContext.jsx
    ...
  services/
    usersService.js
    environmentsService.js
    ...
```

### Testing Requirements
- Unit tests for all components using Vitest
- Integration tests for CRUD operations
- E2E tests for complete user workflows using Cypress

### Performance Considerations
- Implement pagination for large datasets
- Use React.memo for expensive components
- Implement virtual scrolling for large lists
- Add loading states and skeleton components

### Accessibility
- ARIA labels for all interactive elements
- Keyboard navigation support
- Screen reader compatibility
- Focus management for dialogs and forms

### Branch Strategy
1. Create task branch: `git checkout -b feature/phase2-[task-name]`
2. Implement component following established patterns
3. Add tests and ensure ESLint compliance
4. Create PR to `feature/phase2-admin-screens-migration`
5. Merge when complete

### Success Criteria
- [ ] All admin screens migrated and functional
- [ ] Multi-tenant architecture properly implemented
- [ ] ESLint passing with zero warnings
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Performance benchmarks met

### Migration References
- Review existing va-voipbox-admin components in `/Users/voipappz/Projects/va-voipbox-admin/`
- Follow Material-UI Data Grid examples
- Reference existing CustomerEnvironmentHeader for styling patterns

### Common Issues & Solutions
- **API Integration**: Use customerUuid and environmentUuid from context in all API calls
- **Form Validation**: Use Formik or react-hook-form with Yup validation
- **Data Persistence**: Implement auto-save for form drafts
- **Error States**: Show user-friendly error messages with retry options

### Phase Completion
When all tasks are complete:
1. Merge all feature branches to `feature/phase2-admin-screens-migration`
2. Create comprehensive PR to `develop`
3. Update project roadmap with completion status
4. Prepare for Phase 3: Visual PBX Flow Builder