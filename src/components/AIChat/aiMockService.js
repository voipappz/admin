/**
 * AI Mock Service
 * Provides mock responses for common questions when backend is not available
 */

// Pattern matchers for common questions
const QUESTION_PATTERNS = [
  {
    patterns: [/how many calls/i, /call count/i, /calls today/i, /total calls/i],
    type: 'call_count',
  },
  {
    patterns: [/who has (the )?most calls/i, /agent.*(most|highest) calls/i, /top agent/i, /best performer/i],
    type: 'top_agent',
  },
  {
    patterns: [/agent status/i, /how many agents/i, /agents (online|available)/i, /who is available/i],
    type: 'agent_status',
  },
  {
    patterns: [/average (handle|call) time/i, /aht/i, /call duration/i],
    type: 'average_handle_time',
  },
  {
    patterns: [/missed calls/i, /unanswered/i, /abandoned/i],
    type: 'missed_calls',
  },
  {
    patterns: [/wait(ing)? time/i, /queue time/i, /hold time/i],
    type: 'wait_time',
  },
  {
    patterns: [/service level/i, /sla/i, /performance/i],
    type: 'service_level',
  },
  {
    patterns: [/help/i, /what can you/i, /commands/i, /questions/i],
    type: 'help',
  },
];

/**
 * Detect question type from user message
 */
const detectQuestionType = (message) => {
  for (const pattern of QUESTION_PATTERNS) {
    for (const regex of pattern.patterns) {
      if (regex.test(message)) {
        return pattern.type;
      }
    }
  }
  return 'unknown';
};

/**
 * Generate mock data based on question type
 */
const generateMockData = (type) => {
  const now = new Date();
  const hour = now.getHours();

  // Generate realistic-ish random data
  const baseCallCount = Math.floor(Math.random() * 50) + 100;
  const answeredRate = 0.85 + Math.random() * 0.1;

  switch (type) {
    case 'call_count': {
      const total = baseCallCount;
      const answered = Math.floor(total * answeredRate);
      const missed = total - answered;
      return {
        response: `Today you have **${total} calls** so far.\n\n` +
          `- **${answered}** answered (${Math.round(answeredRate * 100)}%)\n` +
          `- **${missed}** missed\n\n` +
          `Peak hour was around ${hour > 12 ? hour - 2 : 10}:00 with ${Math.floor(total / 8)} calls.`,
        data: { total, answered, missed, rate: answeredRate }
      };
    }

    case 'top_agent': {
      const agents = [
        { name: 'Sarah Johnson', calls: Math.floor(Math.random() * 20) + 25 },
        { name: 'Mike Chen', calls: Math.floor(Math.random() * 15) + 20 },
        { name: 'Emily Davis', calls: Math.floor(Math.random() * 15) + 18 },
        { name: 'James Wilson', calls: Math.floor(Math.random() * 10) + 15 },
      ].sort((a, b) => b.calls - a.calls);

      return {
        response: `**Top Performers Today:**\n\n` +
          agents.map((a, i) => `${i + 1}. **${a.name}** - ${a.calls} calls`).join('\n') +
          `\n\n${agents[0].name} is leading with ${agents[0].calls} calls handled!`,
        data: { agents }
      };
    }

    case 'agent_status': {
      const available = Math.floor(Math.random() * 5) + 3;
      const onCall = Math.floor(Math.random() * 4) + 2;
      const onBreak = Math.floor(Math.random() * 2) + 1;
      const offline = Math.floor(Math.random() * 2);
      const total = available + onCall + onBreak + offline;

      return {
        response: `**Current Agent Status:**\n\n` +
          `- **${available}** Available (ready for calls)\n` +
          `- **${onCall}** On Call\n` +
          `- **${onBreak}** On Break\n` +
          `- **${offline}** Offline\n\n` +
          `Total: ${total} agents | Utilization: ${Math.round((onCall / (available + onCall)) * 100)}%`,
        data: { available, onCall, onBreak, offline, total }
      };
    }

    case 'average_handle_time': {
      const aht = Math.floor(Math.random() * 120) + 180; // 3-5 minutes
      const minutes = Math.floor(aht / 60);
      const seconds = aht % 60;

      return {
        response: `**Average Handle Time Today:** ${minutes}:${seconds.toString().padStart(2, '0')}\n\n` +
          `- Talk Time: ~${Math.floor(aht * 0.7 / 60)}:${Math.floor((aht * 0.7) % 60).toString().padStart(2, '0')}\n` +
          `- After-Call Work: ~${Math.floor(aht * 0.3 / 60)}:${Math.floor((aht * 0.3) % 60).toString().padStart(2, '0')}\n\n` +
          `This is ${aht < 240 ? 'below' : 'above'} the target of 4:00.`,
        data: { aht, minutes, seconds }
      };
    }

    case 'missed_calls': {
      const missed = Math.floor(Math.random() * 15) + 5;
      const total = baseCallCount;
      const rate = (missed / total * 100).toFixed(1);

      return {
        response: `**Missed Calls Today:** ${missed} (${rate}%)\n\n` +
          `- Most missed during: ${hour > 14 ? '14:00-15:00' : '10:00-11:00'} (peak hours)\n` +
          `- Average wait before abandon: ~45 seconds\n\n` +
          `${rate < 10 ? 'Good job! Miss rate is within target.' : 'Consider adding agents during peak hours.'}`,
        data: { missed, total, rate }
      };
    }

    case 'wait_time': {
      const avgWait = Math.floor(Math.random() * 30) + 15;
      const maxWait = avgWait * 3;

      return {
        response: `**Queue Statistics:**\n\n` +
          `- Average Wait Time: **${avgWait} seconds**\n` +
          `- Longest Wait: ${maxWait} seconds\n` +
          `- Current Queue: ${Math.floor(Math.random() * 3)} callers\n\n` +
          `${avgWait < 30 ? 'Excellent! Wait times are low.' : 'Consider optimizing staffing.'}`,
        data: { avgWait, maxWait }
      };
    }

    case 'service_level': {
      const sl = 75 + Math.floor(Math.random() * 20);
      const target = 80;

      return {
        response: `**Service Level:** ${sl}%\n\n` +
          `Target: ${target}% of calls answered within 20 seconds\n\n` +
          `${sl >= target ? '**Target Met!** Great performance today.' : `**${target - sl}% below target.** Room for improvement.`}\n\n` +
          `Breakdown:\n` +
          `- Answered < 10s: ${Math.floor(sl * 0.6)}%\n` +
          `- Answered 10-20s: ${Math.floor(sl * 0.4)}%\n` +
          `- Answered > 20s: ${100 - sl}%`,
        data: { sl, target }
      };
    }

    case 'help':
      return {
        response: `**I can help you with:**\n\n` +
          `**Call Metrics:**\n` +
          `- "How many calls today?"\n` +
          `- "What's the average handle time?"\n` +
          `- "How many missed calls?"\n\n` +
          `**Agent Info:**\n` +
          `- "Who has the most calls?"\n` +
          `- "Agent status" or "Who is available?"\n\n` +
          `**Performance:**\n` +
          `- "What's the service level?"\n` +
          `- "Average wait time?"\n\n` +
          `Just ask in natural language!`,
        data: {}
      };

    default:
      return {
        response: `I'm not sure how to answer that. Try asking:\n\n` +
          `- "How many calls today?"\n` +
          `- "Who has the most calls?"\n` +
          `- "What's the agent status?"\n` +
          `- "Average handle time?"\n\n` +
          `Or type "help" for more options.`,
        data: {}
      };
  }
};

/**
 * Generate streaming response events
 */
export const generateMockStreamResponse = async function* (message) {
  const sessionId = `mock-session-${Date.now()}`;

  // Emit RunStarted
  yield {
    event: 'RunStarted',
    session_id: sessionId,
    created_at: Math.floor(Date.now() / 1000),
  };

  // Small delay to simulate thinking
  await new Promise(resolve => setTimeout(resolve, 300));

  // Detect question type and generate response
  const questionType = detectQuestionType(message);
  const { response } = generateMockData(questionType);

  // Stream content in chunks
  const words = response.split(' ');

  for (let i = 0; i < words.length; i++) {

    yield {
      event: 'RunContent',
      content: words[i] + (i < words.length - 1 ? ' ' : ''),
      session_id: sessionId,
    };

    // Small delay between words for realistic streaming
    await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 30));
  }

  // Emit RunCompleted
  yield {
    event: 'RunCompleted',
    content: response,
    session_id: sessionId,
    tools: [],
  };
};

/**
 * Check if mock mode should be used
 */
export const shouldUseMock = () => {
  // Use mock if explicitly enabled or if API returns errors
  return localStorage.getItem('aiMockMode') === 'true';
};

/**
 * Enable/disable mock mode
 */
export const setMockMode = (enabled) => {
  if (enabled) {
    localStorage.setItem('aiMockMode', 'true');
  } else {
    localStorage.removeItem('aiMockMode');
  }
};

/**
 * Get mock agents list
 */
export const getMockAgents = () => [
  { id: 'assistant', agent_id: 'assistant', name: 'AI Assistant' },
  { id: 'analytics', agent_id: 'analytics', name: 'Analytics Helper' },
];

/**
 * Get mock sessions
 */
export const getMockSessions = () => [
  {
    session_id: 'mock-session-1',
    session_name: 'Call Analytics',
    created_at: Math.floor(Date.now() / 1000) - 3600,
  },
  {
    session_id: 'mock-session-2',
    session_name: 'Agent Performance',
    created_at: Math.floor(Date.now() / 1000) - 7200,
  },
];

/**
 * Quick prompt suggestions
 */
export const QUICK_PROMPTS = [
  { label: 'Calls today', prompt: 'How many calls do we have today?' },
  { label: 'Top agent', prompt: 'Who has the most calls today?' },
  { label: 'Agent status', prompt: 'What is the current agent status?' },
  { label: 'Handle time', prompt: 'What is the average handle time?' },
  { label: 'Missed calls', prompt: 'How many missed calls today?' },
  { label: 'Service level', prompt: 'What is our service level?' },
];

export default {
  generateMockStreamResponse,
  shouldUseMock,
  setMockMode,
  getMockAgents,
  getMockSessions,
  QUICK_PROMPTS,
  detectQuestionType,
  generateMockData,
};
