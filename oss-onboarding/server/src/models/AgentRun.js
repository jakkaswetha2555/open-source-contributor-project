import mongoose from 'mongoose';
import { TOOL_STATUS, AGENT_RUN_STATUS } from '../constants.js';

const toolCallSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    args: { type: mongoose.Schema.Types.Mixed },
    status: { type: String, enum: TOOL_STATUS, required: true },
    resultSummary: String,
    startedAt: { type: Date, default: Date.now },
    durationMs: Number,
  },
  { _id: false },
);

// Log of every agent execution: proof of tool status and that the agent is read-only.
const agentRunSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    goal: { type: String, required: true, maxlength: 500 },
    toolCalls: { type: [toolCallSchema], default: [] },
    recommendation: { type: mongoose.Schema.Types.Mixed },
    status: { type: String, enum: AGENT_RUN_STATUS, default: 'running' },
  },
  { timestamps: true },
);

export const AgentRun = mongoose.models.AgentRun || mongoose.model('AgentRun', agentRunSchema);
