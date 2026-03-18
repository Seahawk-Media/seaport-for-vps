import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../db/index';
import { agents, agentMessages, agentConversations, orgAiConfig, agentIdentity, agentMemories } from '../db/schema/agents';
import { eq, and, desc } from 'drizzle-orm';
import { decrypt } from '../lib/crypto';
import { getAgentContext } from './context';
import { broadcast } from '../ws/realtime';

// ─── Types ──────────────────────────────────────────────────────────

interface MessageForLLM {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ─── Agent Runtime ──────────────────────────────────────────────────

export class AgentRuntime {
  private activeAgents = new Map<string, { name: string; status: string }>();

  async loadAgents(orgId: string) {
    const orgAgents = await db
      .select()
      .from(agents)
      .where(eq(agents.organizationId, orgId));

    for (const agent of orgAgents) {
      if (agent.alwaysOn && agent.status === 'active') {
        this.activeAgents.set(agent.id, { name: agent.name, status: 'running' });
      }
    }
  }

  getStatus(agentId: string) {
    return this.activeAgents.get(agentId) ?? null;
  }

  /**
   * Process a user message: assemble context → call LLM → persist + broadcast response.
   * This is the OpenClaw-style agent loop adapted for multi-tenant orgs.
   */
  async processMessage(
    agentId: string,
    conversationId: string,
    userMessage: string,
  ): Promise<string> {
    // 1. Load agent config
    const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
    if (!agent || !agent.organizationId) {
      return 'Agent not found.';
    }

    // 2. Get the org's API key for this agent's provider
    const provider = agent.aiProvider || 'anthropic';
    const model = agent.aiModel || 'claude-sonnet-4-5';

    const [config] = await db
      .select()
      .from(orgAiConfig)
      .where(
        and(
          eq(orgAiConfig.organizationId, agent.organizationId),
          eq(orgAiConfig.provider, provider),
        ),
      )
      .limit(1);

    if (!config?.apiKeyEncrypted) {
      const errorMsg = `No API key configured for provider "${provider}". Go to Admin → AI Models to add one.`;
      await this.persistAndBroadcast(conversationId, errorMsg);
      return errorMsg;
    }

    let apiKey: string;
    try {
      apiKey = decrypt(config.apiKeyEncrypted);
    } catch {
      const errorMsg = 'Failed to decrypt API key. The key may be corrupted — try re-entering it in Admin → AI Models.';
      await this.persistAndBroadcast(conversationId, errorMsg);
      return errorMsg;
    }

    // 3. Assemble context (OpenClaw-style: SOUL + org context + conversation history)
    const systemPrompt = await this.assembleSystemPrompt(agent);
    const history = await this.getConversationHistory(conversationId, 50);

    // 4. Call the appropriate LLM provider
    try {
      let response: string;

      if (provider === 'anthropic') {
        response = await this.callAnthropic(apiKey, model, systemPrompt, history, userMessage);
      } else if (provider === 'openai') {
        response = await this.callOpenAI(apiKey, model, systemPrompt, history, userMessage);
      } else if (provider === 'google') {
        response = await this.callGoogle(apiKey, model, systemPrompt, history, userMessage);
      } else {
        response = `Unsupported provider: ${provider}`;
      }

      // 5. Persist assistant message and broadcast via WebSocket
      await this.persistAndBroadcast(conversationId, response);
      return response;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error from AI provider';
      const errorResponse = `Error: ${errMsg}`;
      await this.persistAndBroadcast(conversationId, errorResponse);
      return errorResponse;
    }
  }

  // ─── Context Assembly (SOUL.md equivalent) ──────────────────────

  private async assembleSystemPrompt(agent: any): Promise<string> {
    const parts: string[] = [];

    // ── Layer 1: SOUL.md — Agent Identity ──────────────────────
    parts.push('# Agent Identity');
    parts.push(`Name: ${agent.name}`);
    if (agent.description) parts.push(`Role: ${agent.description}`);
    parts.push(`Tier: ${agent.tier || 'general'}`);
    parts.push('');

    // Fetch SOUL.md-style identity if exists
    try {
      const [identity] = await db
        .select()
        .from(agentIdentity)
        .where(eq(agentIdentity.agentId, agent.id))
        .limit(1);

      if (identity) {
        if (identity.personality) {
          parts.push('## Personality');
          parts.push(identity.personality);
          parts.push('');
        }
        if (identity.communicationStyle) {
          parts.push('## Communication Style');
          parts.push(identity.communicationStyle);
          parts.push('');
        }
        if (identity.values) {
          parts.push('## Values');
          parts.push(identity.values);
          parts.push('');
        }
        if (identity.guardrails) {
          parts.push('## Guardrails');
          parts.push(identity.guardrails);
          parts.push('');
        }
      }
    } catch {
      // Identity fetch failed — continue
    }

    // ── Layer 2: Instructions (System Prompt) ──────────────────
    if (agent.systemPrompt) {
      parts.push('# Instructions');
      parts.push(agent.systemPrompt);
      parts.push('');
    }

    // ── Layer 3: Organization Context ──────────────────────────
    try {
      const context = await getAgentContext(agent.id);
      if (context) {
        parts.push('# Organization Context');
        parts.push(`Scope: ${context.scope}`);

        if ('departments' in context && context.departments?.length) {
          parts.push(`\nDepartments: ${context.departments.map((d: any) => d.name).join(', ')}`);
        }
        if ('teams' in context && context.teams?.length) {
          parts.push(`Teams/Functions: ${context.teams.map((t: any) => t.name).join(', ')}`);
        }
        if ('employees' in context && context.employees?.length) {
          parts.push(`Team members: ${context.employees.length} people`);
        }
        if ('department' in context && context.department) {
          parts.push(`Department: ${(context.department as any).name}`);
        }
        if ('team' in context && context.team) {
          parts.push(`Team: ${(context.team as any).name}`);
        }
        if ('measurables' in context && context.measurables?.length) {
          parts.push(`\nKey Metrics/KPIs:`);
          for (const m of context.measurables.slice(0, 10)) {
            parts.push(`- ${(m as any).name}: target ${(m as any).target ?? 'N/A'}`);
          }
        }
        parts.push('');
      }
    } catch {
      // Context fetch failed — continue
    }

    // ── Layer 4: Memory (MEMORY.md equivalent) ─────────────────
    try {
      const memories = await db
        .select()
        .from(agentMemories)
        .where(eq(agentMemories.agentId, agent.id))
        .orderBy(desc(agentMemories.createdAt))
        .limit(20);

      if (memories.length > 0) {
        parts.push('# Agent Memory');
        parts.push('The following are facts and context you have learned:');
        for (const mem of memories) {
          parts.push(`- [${mem.category}] ${mem.content}`);
        }
        parts.push('');
      }
    } catch {
      // Memory fetch failed — continue
    }

    // ── Layer 5: Behavioral Guidelines ─────────────────────────
    parts.push('# Guidelines');
    parts.push('- You are an AI agent within the Seaport organization platform.');
    parts.push('- Be helpful, concise, and professional.');
    parts.push('- You have access to organizational context above — use it to give relevant answers.');
    parts.push('- If you don\'t know something specific, say so rather than guessing.');

    return parts.join('\n');
  }

  // ─── Conversation History ───────────────────────────────────────

  private async getConversationHistory(conversationId: string, limit: number): Promise<MessageForLLM[]> {
    const messages = await db
      .select()
      .from(agentMessages)
      .where(eq(agentMessages.conversationId, conversationId))
      .orderBy(desc(agentMessages.createdAt))
      .limit(limit);

    return messages
      .reverse()
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content || '',
      }));
  }

  // ─── Persist + Broadcast ────────────────────────────────────────

  private async persistAndBroadcast(conversationId: string, content: string) {
    const [msg] = await db
      .insert(agentMessages)
      .values({
        conversationId,
        role: 'assistant',
        content,
      })
      .returning();

    // Broadcast via WebSocket to subscribed clients
    broadcast(`agent:${conversationId}`, {
      type: 'message',
      id: msg.id,
      role: 'assistant',
      content,
      created_at: msg.createdAt?.toISOString() ?? new Date().toISOString(),
    });
  }

  // ─── Provider Implementations ───────────────────────────────────

  private async callAnthropic(
    apiKey: string,
    model: string,
    systemPrompt: string,
    history: MessageForLLM[],
    userMessage: string,
  ): Promise<string> {
    const client = new Anthropic({ apiKey });

    // Map model names to Anthropic API model IDs
    const modelMap: Record<string, string> = {
      'claude-opus-4-5': 'claude-opus-4-5-20250514',
      'claude-sonnet-4-5': 'claude-sonnet-4-5-20250514',
      'claude-haiku-3-5': 'claude-3-5-haiku-20241022',
    };

    const messages = [
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: userMessage },
    ];

    const response = await client.messages.create({
      model: modelMap[model] || model,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    });

    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
  }

  private async callOpenAI(
    apiKey: string,
    model: string,
    systemPrompt: string,
    history: MessageForLLM[],
    userMessage: string,
  ): Promise<string> {
    const client = new OpenAI({ apiKey });

    const modelMap: Record<string, string> = {
      'gpt-5': 'gpt-4o',
      'gpt-5-mini': 'gpt-4o-mini',
      'gpt-5-nano': 'gpt-4o-mini',
    };

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ];

    const response = await client.chat.completions.create({
      model: modelMap[model] || model,
      max_tokens: 4096,
      messages,
    });

    return response.choices[0]?.message?.content || '';
  }

  private async callGoogle(
    apiKey: string,
    model: string,
    systemPrompt: string,
    history: MessageForLLM[],
    userMessage: string,
  ): Promise<string> {
    const genAI = new GoogleGenerativeAI(apiKey);

    const modelMap: Record<string, string> = {
      'gemini-2.5-pro': 'gemini-2.0-pro',
      'gemini-2.5-flash': 'gemini-2.0-flash',
      'gemini-2.5-flash-lite': 'gemini-2.0-flash-lite',
    };

    const genModel = genAI.getGenerativeModel({
      model: modelMap[model] || model,
      systemInstruction: systemPrompt,
    });

    const chat = genModel.startChat({
      history: history.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    });

    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  }
}

export const agentRuntime = new AgentRuntime();
