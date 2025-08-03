import { db } from '../database/sqlite';
import { logInfo, logError } from '../utils/logger';
import { EventEmitter } from 'events';
import cron from 'node-cron';

export interface ScheduledTask {
  id?: number;
  guild_id: string;
  name: string;
  description?: string;
  task_type: 'message' | 'announcement' | 'role_assignment' | 'channel_action' | 'moderation' | 'custom';
  trigger_type: 'cron' | 'interval' | 'once' | 'event';
  cron_expression?: string;
  interval_seconds?: number;
  scheduled_time?: Date;
  event_trigger?: string;
  target_channel_id?: string;
  target_role_ids?: string[];
  message_template?: string;
  embed_config?: any;
  components_config?: any;
  is_active: boolean;
  max_executions?: number;
  execution_count: number;
  last_execution?: Date;
  next_execution?: Date;
  timezone: string;
  conditions?: any[];
  error_count: number;
  last_error?: string;
  created_by: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface AutomationRule {
  id?: number;
  guild_id: string;
  name: string;
  description?: string;
  trigger_event: 'member_join' | 'member_leave' | 'message_sent' | 'reaction_added' | 'role_assigned' | 'voice_join' | 'voice_leave' | 'custom';
  trigger_conditions?: any[];
  actions: any[];
  cooldown_seconds: number;
  max_triggers_per_user?: number;
  is_active: boolean;
  priority: number;
  execution_count: number;
  last_execution?: Date;
  success_count: number;
  error_count: number;
  last_error?: string;
  created_by: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface TaskExecutionHistory {
  id?: number;
  task_id?: number;
  rule_id?: number;
  guild_id: string;
  execution_type: 'scheduled_task' | 'automation_rule';
  trigger_source?: string;
  trigger_user_id?: string;
  start_time: Date;
  end_time?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  result_data?: any;
  error_message?: string;
  execution_duration?: number;
  actions_performed?: any[];
  metadata?: any;
}

export class ScheduledTaskService extends EventEmitter {
  private activeTasks = new Map<number, any>();
  private activeRules = new Map<number, AutomationRule>();

  constructor() {
    super();
    this.initializeScheduler();
  }

  // ==========================================
  // SCHEDULED TASK MANAGEMENT
  // ==========================================

  async createScheduledTask(task: Omit<ScheduledTask, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    try {
      const stmt = db.prepare(`
        INSERT INTO scheduled_tasks (
          guild_id, name, description, task_type, trigger_type, cron_expression,
          interval_seconds, scheduled_time, event_trigger, target_channel_id,
          target_role_ids, message_template, embed_config, components_config,
          is_active, max_executions, execution_count, next_execution, timezone,
          conditions, error_count, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Calculate next execution time
      const nextExecution = this.calculateNextExecution(task);

      const result = stmt.run(
        task.guild_id,
        task.name,
        task.description || null,
        task.task_type,
        task.trigger_type,
        task.cron_expression || null,
        task.interval_seconds || null,
        task.scheduled_time ? task.scheduled_time.toISOString() : null,
        task.event_trigger || null,
        task.target_channel_id || null,
        task.target_role_ids ? JSON.stringify(task.target_role_ids) : null,
        task.message_template || null,
        task.embed_config ? JSON.stringify(task.embed_config) : null,
        task.components_config ? JSON.stringify(task.components_config) : null,
        task.is_active ? 1 : 0,
        task.max_executions || null,
        task.execution_count,
        nextExecution ? nextExecution.toISOString() : null,
        task.timezone,
        task.conditions ? JSON.stringify(task.conditions) : null,
        task.error_count,
        task.created_by
      );

      const taskId = result.lastInsertRowid as number;

      // Schedule the task if it's active
      if (task.is_active) {
        await this.scheduleTask(taskId);
      }

      logInfo('ScheduledTaskService', `Created scheduled task ${task.name} for guild ${task.guild_id}`);
      this.emit('taskCreated', { taskId, task });
      
      return taskId;
    } catch (error) {
      logError('ScheduledTaskService', `Error creating scheduled task: ${error}`);
      throw error;
    }
  }

  async getScheduledTask(taskId: number): Promise<ScheduledTask | null> {
    try {
      const stmt = db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?');
      const row = stmt.get(taskId) as any;
      
      if (!row) return null;
      
      return this.parseTaskRow(row);
    } catch (error) {
      logError('ScheduledTaskService', `Error getting scheduled task: ${error}`);
      throw error;
    }
  }

  async getGuildScheduledTasks(guildId: string): Promise<ScheduledTask[]> {
    try {
      const stmt = db.prepare('SELECT * FROM scheduled_tasks WHERE guild_id = ? ORDER BY created_at DESC');
      const rows = stmt.all(guildId) as any[];
      
      return rows.map(row => this.parseTaskRow(row));
    } catch (error) {
      logError('ScheduledTaskService', `Error getting guild scheduled tasks: ${error}`);
      throw error;
    }
  }

  async updateScheduledTask(taskId: number, updates: Partial<ScheduledTask>): Promise<void> {
    try {
      const updateFields: string[] = [];
      const values: any[] = [];

      Object.entries(updates).forEach(([key, value]) => {
        if (key === 'id' || key === 'created_at') return;
        
        updateFields.push(`${key} = ?`);
        
        if (typeof value === 'object' && value !== null) {
          if (value instanceof Date) {
            values.push(value.toISOString());
          } else {
            values.push(JSON.stringify(value));
          }
        } else if (typeof value === 'boolean') {
          values.push(value ? 1 : 0);
        } else {
          values.push(value);
        }
      });

      if (updateFields.length === 0) return;

      // Recalculate next execution if timing fields changed
      if (updates.cron_expression || updates.interval_seconds || updates.scheduled_time) {
        const task = await this.getScheduledTask(taskId);
        if (task) {
          const updatedTask = { ...task, ...updates };
          const nextExecution = this.calculateNextExecution(updatedTask);
          updateFields.push('next_execution = ?');
          values.push(nextExecution ? nextExecution.toISOString() : null);
        }
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(taskId);

      const stmt = db.prepare(`UPDATE scheduled_tasks SET ${updateFields.join(', ')} WHERE id = ?`);
      stmt.run(...values);

      // Reschedule if active
      if (updates.is_active !== false) {
        await this.rescheduleTask(taskId);
      } else {
        this.unscheduleTask(taskId);
      }

      logInfo('ScheduledTaskService', `Updated scheduled task ${taskId}`);
      this.emit('taskUpdated', { taskId, updates });
    } catch (error) {
      logError('ScheduledTaskService', `Error updating scheduled task: ${error}`);
      throw error;
    }
  }

  async deleteScheduledTask(taskId: number): Promise<void> {
    try {
      this.unscheduleTask(taskId);
      
      const stmt = db.prepare('DELETE FROM scheduled_tasks WHERE id = ?');
      stmt.run(taskId);

      logInfo('ScheduledTaskService', `Deleted scheduled task ${taskId}`);
      this.emit('taskDeleted', { taskId });
    } catch (error) {
      logError('ScheduledTaskService', `Error deleting scheduled task: ${error}`);
      throw error;
    }
  }

  // ==========================================
  // AUTOMATION RULE MANAGEMENT
  // ==========================================

  async createAutomationRule(rule: Omit<AutomationRule, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    try {
      const stmt = db.prepare(`
        INSERT INTO automation_rules (
          guild_id, name, description, trigger_event, trigger_conditions, actions,
          cooldown_seconds, max_triggers_per_user, is_active, priority,
          execution_count, success_count, error_count, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        rule.guild_id,
        rule.name,
        rule.description || null,
        rule.trigger_event,
        rule.trigger_conditions ? JSON.stringify(rule.trigger_conditions) : null,
        JSON.stringify(rule.actions),
        rule.cooldown_seconds,
        rule.max_triggers_per_user || null,
        rule.is_active ? 1 : 0,
        rule.priority,
        rule.execution_count,
        rule.success_count,
        rule.error_count,
        rule.created_by
      );

      const ruleId = result.lastInsertRowid as number;

      // Add to active rules if enabled
      if (rule.is_active) {
        this.activeRules.set(ruleId, { ...rule, id: ruleId });
      }

      logInfo('ScheduledTaskService', `Created automation rule ${rule.name} for guild ${rule.guild_id}`);
      this.emit('ruleCreated', { ruleId, rule });
      
      return ruleId;
    } catch (error) {
      logError('ScheduledTaskService', `Error creating automation rule: ${error}`);
      throw error;
    }
  }

  async getAutomationRule(ruleId: number): Promise<AutomationRule | null> {
    try {
      const stmt = db.prepare('SELECT * FROM automation_rules WHERE id = ?');
      const row = stmt.get(ruleId) as any;
      
      if (!row) return null;
      
      return this.parseRuleRow(row);
    } catch (error) {
      logError('ScheduledTaskService', `Error getting automation rule: ${error}`);
      throw error;
    }
  }

  async getGuildAutomationRules(guildId: string): Promise<AutomationRule[]> {
    try {
      const stmt = db.prepare('SELECT * FROM automation_rules WHERE guild_id = ? ORDER BY priority DESC, created_at DESC');
      const rows = stmt.all(guildId) as any[];
      
      return rows.map(row => this.parseRuleRow(row));
    } catch (error) {
      logError('ScheduledTaskService', `Error getting guild automation rules: ${error}`);
      throw error;
    }
  }

  // ==========================================
  // EXECUTION HISTORY
  // ==========================================

  async logExecution(execution: Omit<TaskExecutionHistory, 'id'>): Promise<number> {
    try {
      const stmt = db.prepare(`
        INSERT INTO task_execution_history (
          task_id, rule_id, guild_id, execution_type, trigger_source,
          trigger_user_id, start_time, end_time, status, result_data,
          error_message, execution_duration, actions_performed, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        execution.task_id || null,
        execution.rule_id || null,
        execution.guild_id,
        execution.execution_type,
        execution.trigger_source || null,
        execution.trigger_user_id || null,
        execution.start_time.toISOString(),
        execution.end_time ? execution.end_time.toISOString() : null,
        execution.status,
        execution.result_data ? JSON.stringify(execution.result_data) : null,
        execution.error_message || null,
        execution.execution_duration || null,
        execution.actions_performed ? JSON.stringify(execution.actions_performed) : null,
        execution.metadata ? JSON.stringify(execution.metadata) : null
      );

      this.emit('executionLogged', { executionId: result.lastInsertRowid, execution });
      
      return result.lastInsertRowid as number;
    } catch (error) {
      logError('ScheduledTaskService', `Error logging execution: ${error}`);
      throw error;
    }
  }

  // ==========================================
  // SCHEDULER METHODS
  // ==========================================

  private async initializeScheduler(): Promise<void> {
    try {
      // Load and schedule all active tasks
      const stmt = db.prepare('SELECT * FROM scheduled_tasks WHERE is_active = 1');
      const tasks = stmt.all() as any[];

      for (const taskRow of tasks) {
        const task = this.parseTaskRow(taskRow);
        if (task.id) {
          await this.scheduleTask(task.id);
        }
      }

      // Load active automation rules
      const rulesStmt = db.prepare('SELECT * FROM automation_rules WHERE is_active = 1');
      const rules = rulesStmt.all() as any[];

      for (const ruleRow of rules) {
        const rule = this.parseRuleRow(ruleRow);
        if (rule.id) {
          this.activeRules.set(rule.id, rule);
        }
      }

      logInfo('ScheduledTaskService', `Initialized scheduler with ${tasks.length} tasks and ${rules.length} rules`);
    } catch (error) {
      logError('ScheduledTaskService', `Error initializing scheduler: ${error}`);
    }
  }

  private async scheduleTask(taskId: number): Promise<void> {
    try {
      const task = await this.getScheduledTask(taskId);
      if (!task || !task.is_active) return;

      // Remove existing schedule
      this.unscheduleTask(taskId);

      if (task.trigger_type === 'cron' && task.cron_expression) {
        if (cron.validate(task.cron_expression)) {
          const cronTask = cron.schedule(task.cron_expression, async () => {
            await this.executeTask(taskId);
          }, {
            timezone: task.timezone
          });
          
          this.activeTasks.set(taskId, cronTask);
          cronTask.start();
        }
      } else if (task.trigger_type === 'interval' && task.interval_seconds) {
        const intervalId = setInterval(async () => {
          await this.executeTask(taskId);
        }, task.interval_seconds * 1000);
        
        this.activeTasks.set(taskId, intervalId);
      } else if (task.trigger_type === 'once' && task.scheduled_time) {
        const delay = task.scheduled_time.getTime() - Date.now();
        if (delay > 0) {
          const timeoutId = setTimeout(async () => {
            await this.executeTask(taskId);
          }, delay);
          
          this.activeTasks.set(taskId, timeoutId);
        }
      }

      logInfo('ScheduledTaskService', `Scheduled task ${taskId} (${task.name})`);
    } catch (error) {
      logError('ScheduledTaskService', `Error scheduling task ${taskId}: ${error}`);
    }
  }

  private unscheduleTask(taskId: number): void {
    const activeTask = this.activeTasks.get(taskId);
    if (activeTask) {
      if (typeof activeTask.destroy === 'function') {
        activeTask.destroy(); // cron task
      } else {
        clearInterval(activeTask); // interval or timeout
        clearTimeout(activeTask);
      }
      this.activeTasks.delete(taskId);
    }
  }

  private async rescheduleTask(taskId: number): Promise<void> {
    this.unscheduleTask(taskId);
    await this.scheduleTask(taskId);
  }

  private async executeTask(taskId: number): Promise<void> {
    const startTime = new Date();
    let status: 'running' | 'completed' | 'failed' | 'cancelled' = 'running';
    let errorMessage: string | undefined;
    let actionsPerformed: any[] = [];

    try {
      const task = await this.getScheduledTask(taskId);
      if (!task || !task.is_active) {
        status = 'cancelled';
        return;
      }

      // Check max executions
      if (task.max_executions && task.execution_count >= task.max_executions) {
        await this.updateScheduledTask(taskId, { is_active: false });
        status = 'cancelled';
        return;
      }

      logInfo('ScheduledTaskService', `Executing task ${taskId} (${task.name})`);

      // Execute based on task type
      switch (task.task_type) {
        case 'message':
        case 'announcement':
          actionsPerformed = await this.executeMessageTask(task);
          break;
        case 'role_assignment':
          actionsPerformed = await this.executeRoleTask(task);
          break;
        case 'channel_action':
          actionsPerformed = await this.executeChannelTask(task);
          break;
        case 'moderation':
          actionsPerformed = await this.executeModerationTask(task);
          break;
        case 'custom':
          actionsPerformed = await this.executeCustomTask(task);
          break;
      }

      status = 'completed';

      // Update task execution stats
      await this.updateScheduledTask(taskId, {
        execution_count: task.execution_count + 1,
        last_execution: new Date(),
        next_execution: this.calculateNextExecution(task) || undefined
      });

    } catch (error) {
      status = 'failed';
      errorMessage = error instanceof Error ? error.message : String(error);
      logError('ScheduledTaskService', `Error executing task ${taskId}: ${error}`);

      // Update error count
      const task = await this.getScheduledTask(taskId);
      if (task) {
        await this.updateScheduledTask(taskId, {
          error_count: task.error_count + 1,
          last_error: errorMessage
        });
      }
    } finally {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Log execution
      await this.logExecution({
        task_id: taskId,
        guild_id: (await this.getScheduledTask(taskId))?.guild_id || '',
        execution_type: 'scheduled_task',
        trigger_source: 'scheduler',
        start_time: startTime,
        end_time: endTime,
        status,
        error_message: errorMessage,
        execution_duration: duration,
        actions_performed: actionsPerformed
      });

      this.emit('taskExecuted', { taskId, status, duration, actionsPerformed });
    }
  }

  private async executeMessageTask(task: ScheduledTask): Promise<any[]> {
    // Implementation for message/announcement tasks
    // This would integrate with Discord.js to send messages
    return [{ action: 'message_sent', target: task.target_channel_id }];
  }

  private async executeRoleTask(task: ScheduledTask): Promise<any[]> {
    // Implementation for role assignment tasks
    return [{ action: 'role_assigned', roles: task.target_role_ids }];
  }

  private async executeChannelTask(task: ScheduledTask): Promise<any[]> {
    // Implementation for channel actions
    return [{ action: 'channel_action', target: task.target_channel_id }];
  }

  private async executeModerationTask(task: ScheduledTask): Promise<any[]> {
    // Implementation for moderation tasks
    return [{ action: 'moderation_action' }];
  }

  private async executeCustomTask(task: ScheduledTask): Promise<any[]> {
    // Implementation for custom tasks
    return [{ action: 'custom_action' }];
  }

  private calculateNextExecution(task: Partial<ScheduledTask>): Date | null {
    const now = new Date();

    if (task.trigger_type === 'cron' && task.cron_expression) {
      // Use a cron parser library to calculate next execution
      // This is a simplified version
      return new Date(now.getTime() + 60000); // Next minute for demo
    } else if (task.trigger_type === 'interval' && task.interval_seconds) {
      return new Date(now.getTime() + (task.interval_seconds * 1000));
    } else if (task.trigger_type === 'once' && task.scheduled_time) {
      return task.scheduled_time > now ? task.scheduled_time : null;
    }

    return null;
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private parseTaskRow(row: any): ScheduledTask {
    return {
      ...row,
      target_role_ids: row.target_role_ids ? JSON.parse(row.target_role_ids) : [],
      embed_config: row.embed_config ? JSON.parse(row.embed_config) : null,
      components_config: row.components_config ? JSON.parse(row.components_config) : null,
      is_active: Boolean(row.is_active),
      conditions: row.conditions ? JSON.parse(row.conditions) : [],
      scheduled_time: row.scheduled_time ? new Date(row.scheduled_time) : null,
      last_execution: row.last_execution ? new Date(row.last_execution) : null,
      next_execution: row.next_execution ? new Date(row.next_execution) : null,
      created_at: new Date(row.created_at),
      updated_at: row.updated_at ? new Date(row.updated_at) : null
    };
  }

  private parseRuleRow(row: any): AutomationRule {
    return {
      ...row,
      trigger_conditions: row.trigger_conditions ? JSON.parse(row.trigger_conditions) : [],
      actions: JSON.parse(row.actions),
      is_active: Boolean(row.is_active),
      last_execution: row.last_execution ? new Date(row.last_execution) : null,
      created_at: new Date(row.created_at),
      updated_at: row.updated_at ? new Date(row.updated_at) : null
    };
  }
}

export const scheduledTaskService = new ScheduledTaskService();