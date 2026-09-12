import React from 'react';
import {
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  IconButton
} from '@mui/material';
import {
  DragIndicator as DragIndicatorIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ResourceEditor } from './ResourceEditor.jsx';

/**
 * Sortable Resource Item Component
 * Individual resource item with drag-drop capability
 */
const SortableResourceItem = ({
  resource,
  index,
  onRemove,
  onUpdate,
  bridgeTypes,
  bridgeResources,
  onFetchBridgeResources,
  environmentUuid,
  disabled,
  zLayer
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: resource.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Accordion
        defaultExpanded={index === 0}
        sx={{
          mb: 1,
          '&:before': { display: 'none' },
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: isDragging ? 4 : 1
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          component="div"
          sx={{
            '& .MuiAccordionSummary-content': {
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }
          }}
        >
          {/* Drag Handle */}
          <Box
            {...attributes}
            {...listeners}
            sx={{
              cursor: disabled ? 'default' : 'grab',
              display: 'flex',
              alignItems: 'center',
              color: 'action.active',
              '&:active': {
                cursor: disabled ? 'default' : 'grabbing'
              }
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <DragIndicatorIcon />
          </Box>

          {/* Resource Name/Title */}
          <Typography sx={{ flexGrow: 1 }}>
            {resource.name || `Resource ${index + 1}`}
          </Typography>

          {/* Priority Badge */}
          <Box
            sx={{
              px: 1,
              py: 0.5,
              borderRadius: 1,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              fontSize: '0.75rem',
              fontWeight: 'medium'
            }}
          >
            Priority #{index + 1}
          </Box>

          {/* Delete Button */}
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            color="error"
            size="small"
            disabled={disabled}
          >
            <DeleteIcon />
          </IconButton>
        </AccordionSummary>

        <AccordionDetails>
          <ResourceEditor
            resource={resource}
            onChange={onUpdate}
            bridgeTypes={bridgeTypes}
            bridgeResources={bridgeResources}
            onFetchBridgeResources={onFetchBridgeResources}
            environmentUuid={environmentUuid}
            disabled={disabled}
            zLayer={zLayer}
          />
        </AccordionDetails>
      </Accordion>
    </div>
  );
};

/**
 * ResourceList Component
 * Drag-drop sortable list of routing resources
 *
 * Based on legacy AngularJS patterns from:
 * - /opt/src/va-voipbox-admin/src/views/call_conditions/edit.html (dnd-list directive)
 *
 * Features:
 * - Drag-drop reordering (priority-based)
 * - Add/remove resources
 * - Expandable resource editors
 * - Keyboard accessibility
 */
export const ResourceList = ({
  resources,
  onReorder,
  onRemove,
  onUpdate,
  bridgeTypes,
  bridgeResources,
  onFetchBridgeResources,
  environmentUuid,
  disabled = false,
  zLayer = null
}) => {
  // Set up sensors for drag-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8 // Require 8px movement before drag starts (prevents accidental drags)
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // Handle drag end
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active && over && active.id !== over.id) {
      const oldIndex = resources.findIndex(r => r.id === active.id);
      const newIndex = resources.findIndex(r => r.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(resources, oldIndex, newIndex);
        onReorder(reordered);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={resources.map(r => r.id)}
        strategy={verticalListSortingStrategy}
      >
        <Box>
          {resources.length > 0 ? (
            resources.map((resource, index) => (
              <SortableResourceItem
                key={resource.id}
                resource={resource}
                index={index}
                onRemove={() => onRemove(index)}
                onUpdate={(updated) => onUpdate(index, updated)}
                bridgeTypes={bridgeTypes}
                bridgeResources={bridgeResources}
                onFetchBridgeResources={onFetchBridgeResources}
                environmentUuid={environmentUuid}
                disabled={disabled}
                zLayer={zLayer}
              />
            ))
          ) : (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                fontStyle: 'italic',
                p: 4,
                textAlign: 'center',
                bgcolor: 'background.default',
                borderRadius: 1,
                border: '1px dashed',
                borderColor: 'divider'
              }}
            >
              No routing resources added. Click "Add Resource" to create time-based routing rules.
            </Typography>
          )}
        </Box>
      </SortableContext>
    </DndContext>
  );
};

export default ResourceList;
