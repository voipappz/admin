# Phase 3: Visual PBX Flow Builder Agent Configuration

## Agent Type: `react-frontend-dev`

## Phase Overview
Build a visual PBX flow designer using React Flow library. This phase creates an intuitive drag-and-drop interface for designing call flows, IVR systems, and routing logic following FLOIP specification guidelines.

## Agent Instructions

### Context
You are working on Phase 3 of the VoIP Admin Migration Project. Your role is to implement a comprehensive visual PBX flow builder that allows users to design call flows through a node-based interface.

### Core Technology
- **React Flow**: Primary library for node-based flow building
- **Material-UI**: For property panels, toolbars, and UI components
- **FLOIP Specification**: Follow Flow Interoperability Project standards
- **Multi-tenant**: Integrate with CustomerEnvironmentContext

### Tasks for Phase 3

#### 1. React Flow Setup (`feature/phase3-react-flow-setup`)
- Install and configure React Flow library
- Create basic canvas with zoom, pan, and selection
- Implement flow persistence and loading
- Set up custom node and edge rendering
- Create flow validation framework

#### 2. PBX Node Components (`feature/phase3-pbx-nodes`)
- **DID Nodes**: Entry points for incoming calls
- **IVR Nodes**: Interactive voice response menus
- **Queue Nodes**: Call queue management with agents
- **Extension Nodes**: Direct extension routing
- **Condition Nodes**: Branching logic (time, caller ID, etc.)
- **Voicemail Nodes**: Voicemail and message handling
- **Conference Nodes**: Conference room management
- **API Nodes**: External API integrations
- **Announcement Nodes**: Audio playback nodes

#### 3. Flow Logic Engine (`feature/phase3-flow-logic`)
- Flow validation rules and constraints
- Connection type validation
- Circular dependency detection
- Flow execution simulation
- Error highlighting and debugging

#### 4. Property Panels (`feature/phase3-property-panels`)
- Dynamic property forms for each node type
- Real-time validation and feedback
- Audio file upload and management
- Integration with customer/environment context

### Component Architecture

#### Main Flow Builder Structure
```jsx
const PBXFlowBuilder = () => {
  const { selectedCustomer, selectedEnvironment } = useCustomerEnvironment();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);

  return (
    <Box className="pbx-flow-builder">
      <FlowToolbar onAddNode={handleAddNode} />
      <Box className="flow-workspace">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
        <PropertyPanel 
          selectedNode={selectedNode}
          onUpdate={handleNodeUpdate}
        />
      </Box>
    </Box>
  );
};
```

#### Node Types Implementation
```jsx
// Example: IVR Node
const IVRNode = ({ data, selected }) => {
  return (
    <Box className={`node-ivr ${selected ? 'selected' : ''}`}>
      <NodeHeader 
        icon={<PhoneIcon />}
        title="IVR Menu"
        subtitle={data.name || 'Unnamed IVR'}
      />
      <NodePorts>
        <InputPort />
        <OutputPort label="Option 1" />
        <OutputPort label="Option 2" />
        <OutputPort label="Timeout" />
        <OutputPort label="Invalid" />
      </NodePorts>
    </Box>
  );
};
```

### FLOIP Compliance

#### Flow Structure
- Follow FLOIP flow format for export/import
- Implement standard block types where applicable
- Support flow versioning and migration
- Include flow metadata (name, description, version)

#### Block Types Mapping
```javascript
const FLOIPMapping = {
  'send_msg': 'AnnouncementNode',
  'wait_for_response': 'IVRNode',
  'run_flow': 'SubFlowNode',
  'set_contact_field': 'SetVariableNode',
  'call_webhook': 'APINode',
  'split_random': 'RandomSplitNode',
  'wait_for_time': 'TimeConditionNode'
};
```

### Node Types Specifications

#### 1. DID Node (Entry Point)
- **Properties**: DID number, description, business hours
- **Outputs**: Single output to next node
- **Validation**: Must be flow entry point

#### 2. IVR Node
- **Properties**: Welcome message, menu options, timeout settings
- **Outputs**: Multiple outputs for each menu option + timeout/invalid
- **Features**: Audio upload, TTS configuration, retry logic

#### 3. Queue Node  
- **Properties**: Queue name, agents, music on hold, timeout
- **Outputs**: Connected, timeout, no agents available
- **Features**: Agent selection, overflow handling

#### 4. Extension Node
- **Properties**: Extension number, ring time, voicemail
- **Outputs**: Answered, busy, no answer
- **Features**: Find me/follow me settings

#### 5. Condition Node
- **Properties**: Condition type, parameters, comparison values
- **Outputs**: True/False branches
- **Types**: Time-based, caller ID, variable comparison

### File Structure
```
src/
  components/
    PBXFlowBuilder/
      PBXFlowBuilder.jsx
      PBXFlowBuilder.js
      PBXFlowBuilder.css
      components/
        FlowCanvas/
        FlowToolbar/
        PropertyPanel/
        NodeLibrary/
      nodes/
        DIDNode/
        IVRNode/
        QueueNode/
        ExtensionNode/
        ConditionNode/
        VoicemailNode/
      edges/
        CallEdge/
        ConditionalEdge/
    FlowTemplates/
      TemplateGallery.jsx
      TemplatePreview.jsx
  services/
    flowService.js
    audioService.js
    floipService.js
  utils/
    flowValidation.js
    floipExporter.js
    flowSimulator.js
```

### State Management
```jsx
// Flow Context
const FlowContext = createContext();

export const FlowProvider = ({ children }) => {
  const [currentFlow, setCurrentFlow] = useState(null);
  const [flows, setFlows] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  
  const saveFlow = async (flow) => { /* implementation */ };
  const loadFlow = async (flowId) => { /* implementation */ };
  const validateFlow = (flow) => { /* implementation */ };
  const exportFlow = (format) => { /* implementation */ };
  
  return (
    <FlowContext.Provider value={{
      currentFlow, setCurrentFlow,
      flows, saveFlow, loadFlow,
      validationErrors, validateFlow,
      exportFlow
    }}>
      {children}
    </FlowContext.Provider>
  );
};
```

### Validation Rules
1. **Flow Structure**:
   - Must have at least one DID entry point
   - No unreachable nodes
   - No circular dependencies
   - All paths must end at terminal nodes

2. **Node Connections**:
   - Compatible input/output types
   - Required connections present
   - Maximum connection limits respected

3. **Configuration**:
   - Required properties filled
   - Valid audio files uploaded
   - Extension numbers exist
   - Queue agents assigned

### Testing Strategy
- **Unit Tests**: Individual node components
- **Integration Tests**: Flow validation and execution
- **Visual Tests**: Node rendering and interactions
- **E2E Tests**: Complete flow creation workflows

### Performance Optimization
- Lazy loading for large flows
- Virtualization for node library
- Debounced auto-save
- Optimized re-rendering with React.memo
- Canvas viewport management

### Templates and Examples
```javascript
// Basic IVR Template
const basicIVRTemplate = {
  name: "Basic Customer Service",
  description: "Simple customer service flow with options",
  nodes: [
    { id: 'did-1', type: 'did', position: { x: 100, y: 100 } },
    { id: 'ivr-1', type: 'ivr', position: { x: 300, y: 100 } },
    { id: 'queue-sales', type: 'queue', position: { x: 500, y: 50 } },
    { id: 'queue-support', type: 'queue', position: { x: 500, y: 150 } }
  ],
  edges: [
    { id: 'e1', source: 'did-1', target: 'ivr-1' },
    { id: 'e2', source: 'ivr-1', target: 'queue-sales', sourceHandle: 'option-1' },
    { id: 'e3', source: 'ivr-1', target: 'queue-support', sourceHandle: 'option-2' }
  ]
};
```

### Success Criteria
- [ ] React Flow integrated and functional
- [ ] All PBX node types implemented
- [ ] Flow validation working correctly
- [ ] Property panels fully functional
- [ ] FLOIP export/import working
- [ ] Templates system implemented
- [ ] Performance optimized for large flows
- [ ] Comprehensive testing coverage

### Branch Strategy
1. Start with React Flow setup branch
2. Implement node types in parallel branches
3. Add validation and property panels
4. Integrate with templates and examples
5. Merge to phase branch when complete

### Migration Notes
- Review existing PBX configurations in va-voipbox-admin
- Import existing call flows where possible
- Provide migration tools for legacy configurations
- Maintain backward compatibility during transition