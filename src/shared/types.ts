// types.ts — Shared TypeScript types for AVAR

// ─── Assessment Session ───────────────────────────────────────────────────────

export interface AssessmentSession {
  id: string;
  title: string;
  createdAt: string;       // ISO date
  status: SessionStatus;
  documentText: string;
  language: 'he' | 'en' | 'ar';
  agentIds: string[];
  report?: Report;
}

export type SessionStatus =
  | 'pending'
  | 'analyzing'
  | 'dispatching'
  | 'researching'
  | 'synthesizing'
  | 'complete'
  | 'error';

// ─── Analysis Results ─────────────────────────────────────────────────────────

export interface Claim {
  id: string;
  text: string;
  confidence: 'high' | 'medium' | 'low';
  sourceCount: number;
}

export interface Assumption {
  id: string;
  text: string;
  type: 'explicit' | 'implicit';
  riskIfWrong: 'high' | 'medium' | 'low';
}

export interface CognitiveBias {
  type: 'confirmation_bias' | 'anchoring' | 'mirror_imaging' | 'groupthink' | 'other';
  evidence: string;
}

export interface AnalysisResult {
  keyClaims: Claim[];
  assumptions: Assumption[];
  informationGaps: string[];
  singleSourceDependencies: string[];   // claim IDs
  possibleBiases: CognitiveBias[];
  suggestedAgents: string[];
}

// ─── Evidence ─────────────────────────────────────────────────────────────────

export interface EvidenceCard {
  id: string;
  claimId: string;
  title: string;
  url: string;
  snippet: string;
  date: string;
  sourceTier: 1 | 2 | 3;
  type: 'supporting' | 'contradicting';
}

// ─── Alternatives ─────────────────────────────────────────────────────────────

export type Rating = 1 | 2 | 3 | 4 | 5;

export interface Alternative {
  id: string;
  claimId: string;
  description: string;
  severity: Rating;         // 1 = low, 5 = critical
  likelihood: Rating;       // 1 = unlikely, 5 = highly likely
  supportingEvidence: EvidenceCard[];
  counterEvidence: EvidenceCard[];
  analystDecision?: 'accepted' | 'rejected';
  analystNote?: string;
}

// ─── Agent & Skill ────────────────────────────────────────────────────────────

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  version: string;
  skills: string[];
  autoActivateOn: string[];
  priority: number;
  isCustom: boolean;
}

export interface SkillDefinition {
  id: string;
  name: string;
  nameEn: string;
  version: string;
  tags: string[];
  autoTriggerKeywords: string[];
  isCustom: boolean;
}

// ─── Report ───────────────────────────────────────────────────────────────────

export interface Report {
  sessionId: string;
  generatedAt: string;
  executiveSummary: string;
  keyClaims: Claim[];
  alternatives: Alternative[];
  evidence: EvidenceCard[];
  recommendations: string[];
  transparencyLog: TransparencyLog;
}

export interface TransparencyLog {
  agentsActivated: string[];
  skillsActivated: string[];
  searchQueriesCount: number;
  analysisStartedAt: string;
  analysisCompletedAt: string;
}
