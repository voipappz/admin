import { useState } from 'react';
import recordingAnalysisService from '../../../services/recordingAnalysis';

const useRecordingHandlers = () => {
  // State for recording dialog
  const [recordingDialogOpen, setRecordingDialogOpen] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);

  const handleOpenRecording = async (recordingUrl, callId, caller, callee, createdAt) => {
    setSelectedRecording({
      url: recordingUrl,
      callId: callId,
      caller: caller,
      callee: callee,
      createdAt: createdAt
    });
    setRecordingDialogOpen(true);
    setAnalysisResult(null);
    setAnalysisError(null);

    // Check for cached analysis first
    const cached = recordingAnalysisService.getCachedAnalysis(callId);
    if (cached) {
      setAnalysisResult(cached);
    }
  };

  // Handle closing recording dialog
  const handleCloseRecording = () => {
    setRecordingDialogOpen(false);
    setSelectedRecording(null);
    setAnalysisResult(null);
    setAnalysisError(null);
    setAnalysisLoading(false);
  };

  // Handle analyze recording
  const handleAnalyzeRecording = async () => {
    if (!selectedRecording?.url) return;
    
    setAnalysisLoading(true);
    setAnalysisError(null);
    
    try {
      const result = await recordingAnalysisService.analyzeRecording(
        selectedRecording.url, 
        selectedRecording.callId
      );
      setAnalysisResult(result);
    } catch (error) {
      console.error('Analysis failed:', error);
      setAnalysisError(error.message);
    } finally {
      setAnalysisLoading(false);
    }
  };

  return {
    recordingDialogOpen,
    selectedRecording,
    analysisLoading,
    analysisResult,
    analysisError,
    handleOpenRecording,
    handleCloseRecording,
    handleAnalyzeRecording
  };
};

export default useRecordingHandlers;
