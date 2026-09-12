import { Box } from '@mui/material';

import WorkflowManage from './WorkflowManage';
import './Workflows.css';

const Workflows = () => (
  <Box className="workflows-container">
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <WorkflowManage />
    </Box>
  </Box>
);

export default Workflows;
