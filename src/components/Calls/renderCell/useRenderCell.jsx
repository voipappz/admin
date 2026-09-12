import moment from 'moment';
import PublicIcon from '@mui/icons-material/Public';
import CallMadeIcon from '@mui/icons-material/CallMade';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import StarRating from '../StarRating/StarRating';
import React from 'react';

const useRenderCell = (handleOpenRecording) => {
  return (params) => {
    const { field, row } = params;
    switch (field) {
      case 'created_at': {
        const createdAt = row.created_at;
        if (!createdAt) return 'N/A';
        return moment(createdAt).format('DD/MM/YY HH:mm:ss');
      }
      case 'caller':
        return row.profile?.caller || 'N/A';
      case 'callee':
        return row.profile?.callee || 'N/A';
      case 'country':
        return (
          <span className="render-cell-country">
            <PublicIcon fontSize="small" style={{ verticalAlign: 'middle' }} />
            {row.profile?.country || 'N/A'}
          </span>
        );
      case 'direction':
        return row.profile?.direction === 'in' ? <CallReceivedIcon fontSize="small" color="primary" /> : <CallMadeIcon fontSize="small" color="secondary" />;
      case 'environment':
        return row.profile?.environment || 'N/A';
      case 'talk_duration':
        return row.profile?.talk_duration || 'N/A';
      case 'cause':
        return row.profile?.cause || 'N/A';
      case 'cid':
        return row.profile?.cid || 'N/A';
      case 'recording':
        return row.profile?.recordingUrl ? (
          <span style={{ cursor: 'pointer', color: '#1976d2' }} onClick={() => handleOpenRecording(
            row.profile?.recordingUrl,
            row.id,
            row.profile?.caller,
            row.profile?.callee,
            row.created_at
          )}>
            <AccessTimeIcon fontSize="small" />
            Play
          </span>
        ) : 'N/A';
      case 'rating':
        return <StarRating rating={row.profile?.rating || 0} />;
      default:
        return 'N/A';
    }
  };
};

export default useRenderCell;
