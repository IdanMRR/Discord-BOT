# Sample Data Structures for Scheduled Content & Integration Hub

This document provides sample data structures showing how the new database tables work together to support advanced scheduling and integration features.

## Scheduled Content System Examples

### 1. Daily Welcome Message Task

```json
{
  "scheduled_tasks": {
    "id": 1,
    "guild_id": "123456789012345678",
    "name": "Daily Welcome Digest",
    "description": "Send a daily summary of new members who joined",
    "task_type": "message",
    "trigger_type": "cron",
    "cron_expression": "0 9 * * *", // Daily at 9 AM
    "target_channel_id": "987654321098765432",
    "message_template": "🌟 **Daily Welcome Summary** 🌟\n\nWe welcomed {member_count} new members yesterday!\n{member_list}",
    "embed_config": {
      "title": "Welcome Summary",
      "color": 3447003,
      "fields": [
        {
          "name": "New Members",
          "value": "{member_list}",
          "inline": false
        }
      ],
      "footer": {
        "text": "Welcome to our community!"
      }
    },
    "is_active": 1,
    "timezone": "America/New_York",
    "created_by": "111111111111111111"
  }
}
```

### 2. Auto-Role Assignment Automation Rule

```json
{
  "automation_rules": {
    "id": 1,
    "guild_id": "123456789012345678",
    "name": "New Member Auto-Role",
    "description": "Automatically assign member role to new users after verification",
    "trigger_event": "member_join",
    "trigger_conditions": [
      {
        "type": "account_age",
        "operator": ">=",
        "value": 7,
        "unit": "days"
      }
    ],
    "actions": [
      {
        "type": "assign_role",
        "config": {
          "roleIds": ["555555555555555555"],
          "delay": 300 // 5 minutes delay
        }
      },
      {
        "type": "send_message",
        "config": {
          "channelId": "777777777777777777",
          "message": "Welcome {user.mention}! You've been assigned the Member role."
        }
      }
    ],
    "cooldown_seconds": 0,
    "is_active": 1,
    "priority": 1,
    "created_by": "111111111111111111"
  }
}
```

### 3. Weekly Event Reminder with Recurring Schedule

```json
{
  "scheduled_tasks": {
    "id": 2,
    "guild_id": "123456789012345678",
    "name": "Weekly Game Night Reminder",
    "task_type": "announcement",
    "trigger_type": "cron",
    "cron_expression": "0 18 * * 5", // Friday at 6 PM
    "target_channel_id": "888888888888888888",
    "target_role_ids": ["666666666666666666"], // Gaming role
    "message_template": "🎮 **Game Night Reminder** 🎮\n\n{role.mention} Don't forget about tonight's game night at 8 PM!\n\nTonight's featured games:\n{featured_games}",
    "embed_config": {
      "title": "🎮 Weekly Game Night",
      "description": "Join us for fun and games!",
      "color": 15158332,
      "fields": [
        {
          "name": "When",
          "value": "Tonight at 8:00 PM EST",
          "inline": true
        },
        {
          "name": "Where",
          "value": "Gaming Voice Channels",
          "inline": true
        }
      ]
    },
    "is_active": 1,
    "timezone": "America/New_York"
  },
  "recurring_schedules": {
    "id": 1,
    "task_id": 2,
    "pattern_type": "weekly",
    "pattern_config": {
      "repeat_every": 1,
      "end_condition": "never"
    },
    "days_of_week": [5], // Friday
    "time_slots": ["18:00"],
    "exceptions": ["2024-12-25", "2024-01-01"], // Skip holidays
    "timezone": "America/New_York",
    "is_active": 1
  }
}
```

## Integration Hub Examples

### 1. GitHub Repository Integration

```json
{
  "integrations": {
    "id": 1,
    "guild_id": "123456789012345678",
    "name": "Main Repository Updates",
    "integration_type": "github",
    "provider": "github",
    "config": {
      "repoUrl": "https://github.com/username/repo",
      "events": ["push", "pull_request", "issues", "releases"],
      "branches": ["main", "develop"],
      "includeCommitMessages": true,
      "maxCommitsToShow": 5
    },
    "credentials_encrypted": "encrypted_access_token_here",
    "target_channel_id": "999999999999999999",
    "message_template": "📋 **{event_type}** in {repo_name}\n\n{summary}",
    "embed_template": {
      "title": "{event_title}",
      "description": "{event_description}",
      "color": 2303786,
      "author": {
        "name": "{author_name}",
        "icon_url": "{author_avatar}"
      },
      "fields": [
        {
          "name": "Repository",
          "value": "{repo_name}",
          "inline": true
        },
        {
          "name": "Branch",
          "value": "{branch_name}",
          "inline": true
        }
      ],
      "footer": {
        "text": "GitHub Integration"
      }
    },
    "is_active": 1,
    "sync_frequency": 300, // Check every 5 minutes
    "rate_limit_config": {
      "requests_per_hour": 60,
      "burst_limit": 10
    },
    "created_by": "111111111111111111"
  }
}
```

### 2. Minecraft Server Status Webhook

```json
{
  "integrations": {
    "id": 2,
    "guild_id": "123456789012345678",
    "name": "MC Server Status",
    "integration_type": "minecraft",
    "provider": "minecraft",
    "config": {
      "serverAddress": "mc.example.com",
      "serverPort": 25565,
      "checkInterval": 5, // minutes
      "showPlayerCount": true,
      "showOnlineStatus": true,
      "showPlayerList": false,
      "alertOnStatusChange": true
    },
    "target_channel_id": "101010101010101010",
    "message_template": "🎮 **Minecraft Server Status**\n\nServer: {server_address}\nStatus: {status}\nPlayers: {player_count}/{max_players}",
    "is_active": 1,
    "sync_frequency": 300,
    "created_by": "111111111111111111"
  },
  "webhooks": {
    "id": 1,
    "guild_id": "123456789012345678",
    "integration_id": 2,
    "name": "MC Server Status Hook",
    "webhook_url": "https://discord.com/api/webhooks/...",
    "events": ["server_status_change", "player_join", "player_leave"],
    "is_active": 1,
    "rate_limit_per_minute": 30,
    "max_payload_size": 2048,
    "timeout_seconds": 10,
    "retry_attempts": 2,
    "created_by": "111111111111111111"
  }
}
```

### 3. RSS Feed Integration

```json
{
  "integrations": {
    "id": 3,
    "guild_id": "123456789012345678",
    "name": "Tech News Feed",
    "integration_type": "rss",
    "provider": "rss",
    "config": {
      "feedUrl": "https://techcrunch.com/feed/",
      "checkInterval": 30, // minutes
      "maxItems": 3,
      "filterKeywords": ["discord", "gaming", "technology"],
      "excludeKeywords": ["sponsored", "advertisement"]
    },
    "target_channel_id": "121212121212121212",
    "message_template": "📰 **Tech News Update**\n\n{title}\n{description}\n\n[Read more]({link})",
    "embed_template": {
      "title": "{title}",
      "description": "{description}",
      "url": "{link}",
      "color": 16753920,
      "thumbnail": {
        "url": "{image_url}"
      },
      "footer": {
        "text": "Tech News • {published_date}"
      }
    },
    "is_active": 1,
    "sync_frequency": 1800, // 30 minutes
    "filter_config": {
      "duplicateDetection": true,
      "contentMinLength": 50,
      "excludeOlderThan": 24 // hours
    },
    "created_by": "111111111111111111"
  }
}
```

## Task Execution History Example

```json
{
  "task_execution_history": {
    "id": 1,
    "task_id": 1,
    "guild_id": "123456789012345678",
    "execution_type": "scheduled_task",
    "trigger_source": "cron_scheduler",
    "start_time": "2024-01-15T09:00:00Z",
    "end_time": "2024-01-15T09:00:02Z",
    "status": "completed",
    "result_data": {
      "message_id": "131313131313131313",
      "channel_id": "987654321098765432",
      "member_count": 5,
      "members_processed": [
        "user1",
        "user2",
        "user3",
        "user4",
        "user5"
      ]
    },
    "execution_duration": 2150, // milliseconds
    "actions_performed": [
      {
        "action": "fetch_new_members",
        "success": true,
        "duration": 450
      },
      {
        "action": "generate_message",
        "success": true,
        "duration": 200
      },
      {
        "action": "send_message",
        "success": true,
        "duration": 1500
      }
    ],
    "metadata": {
      "template_variables": {
        "member_count": 5,
        "member_list": "• User1\n• User2\n• User3\n• User4\n• User5"
      }
    }
  }
}
```

## Webhook Delivery Tracking Example

```json
{
  "webhook_deliveries": {
    "id": 1,
    "webhook_id": 1,
    "guild_id": "123456789012345678",
    "delivery_id": "550e8400-e29b-41d4-a716-446655440000",
    "event_type": "server_status_change",
    "payload": {
      "event": "server_status_change",
      "server": "mc.example.com:25565",
      "status": "online",
      "player_count": 12,
      "max_players": 20,
      "timestamp": "2024-01-15T14:30:00Z"
    },
    "target_url": "https://discord.com/api/webhooks/...",
    "http_method": "POST",
    "headers": {
      "Content-Type": "application/json",
      "User-Agent": "DiscordBot-Integration/1.0"
    },
    "attempt_number": 1,
    "max_attempts": 3,
    "status": "delivered",
    "response_status": 200,
    "response_body": "OK",
    "response_time": 1250,
    "scheduled_at": "2024-01-15T14:30:05Z",
    "delivered_at": "2024-01-15T14:30:06Z",
    "user_data": {
      "triggered_by": "system",
      "source_integration": "minecraft_status"
    }
  }
}
```

## Database Relationships Overview

### Key Relationships:

1. **scheduled_tasks** ←→ **recurring_schedules** (1:many)
   - A task can have multiple recurring patterns

2. **scheduled_tasks** ←→ **task_execution_history** (1:many)
   - Track all executions of a task

3. **automation_rules** ←→ **task_execution_history** (1:many)
   - Track all executions of automation rules

4. **integrations** ←→ **webhooks** (1:many)
   - An integration can have multiple webhook endpoints

5. **integrations** ←→ **integration_logs** (1:many)
   - Log all integration activities

6. **webhooks** ←→ **webhook_deliveries** (1:many)
   - Track all webhook delivery attempts

7. **webhooks** ←→ **integration_logs** (1:many)
   - Log webhook-specific activities

### Indexes for Performance:

All tables include strategic indexes for:
- Guild-based queries (most common)
- Status-based filtering
- Time-based queries (scheduling, logging)
- Foreign key relationships
- Frequently queried combinations

### Security Considerations:

1. **Encrypted Credentials**: Integration credentials are stored encrypted
2. **Rate Limiting**: Built-in rate limiting for all external integrations
3. **Input Validation**: All JSON fields should be validated
4. **Access Control**: Created_by fields track ownership
5. **Audit Trail**: Comprehensive logging for all operations

This structure provides a robust foundation for advanced Discord bot automation and integration features while maintaining performance and security.