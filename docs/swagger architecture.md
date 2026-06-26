# Automation Anywhere Control Room API Architecture for LLM Agents

Source Control Room: `https://aa-se-latam-2.my.automationanywhere.digital/swagger/`

Generated: 2026-06-05

## 1. Scope

This document describes how an LLM-facing agent should use Automation Anywhere Control Room APIs for bot discovery, bot construction support, package intelligence, deployment, and execution monitoring.

Important distinction:

- **Swagger API groups** are the Swagger documents exposed by Control Room.
- **Operation endpoints** are concrete REST operations inside those Swagger documents.

The tenant Swagger index exposes **29 Swagger API groups** across `v1`, `v2`, `v3`, and `v4`. A mirrored exported Swagger manifest also reports **29 specs** and raw YAML paths. A generated operation inventory is available for the core bot-building surfaces: authentication, repository, deploy, activity, and packages.

This file is written for LLM/tool-agent design. It favors deterministic routing, safe operation selection, and explicit endpoint ownership.

## 2. Core Agent Design

### 2.1 Components

```text
User prompt
  -> Intent classifier
  -> Control Room auth client
  -> Endpoint router
  -> Repository/package/activity/deploy clients
  -> Deterministic bot JSON builder
  -> Validator / preview layer
  -> Optional write / deploy operation
```

### 2.2 Non-negotiable rule

Do not ask the LLM to invent raw Automation Anywhere bot JSON directly.

Correct flow:

```text
natural language request
  -> structured workflow plan
  -> package and command grounding
  -> deterministic JSON assembly
  -> validation
  -> preview
  -> write to Control Room only after explicit approval
```

### 2.3 Authentication model

Use one of these headers per request:

```http
X-Authorization: <control-room-auth-token>
```

or

```http
Authorization: Bearer <oauth-token>
```

Do not send both headers in the same call.

## 3. All Swagger API Groups Exposed by Control Room

Use these Swagger documents as top-level capability groups.

| Version | API group | Raw spec path | Primary LLM use |
|---|---|---|---|
| v1 | Authentication API | `/swagger/api/v1/auth-api-supported.yaml` | Legacy authentication. Prefer v2 unless tenant requires v1. |
| v1 | Audit API | `/swagger/api/v1/audit-api-supported.yaml` | Audit event search and export. Useful for governance explanations. |
| v1 | Device API | `/swagger/api/v1/device-api-supported.yaml` | Legacy Bot Runner / device state lookup. |
| v1 | Automations API | `/swagger/api/v1/automations-api-supported.yaml` | Legacy automation management. Prefer v2/v3/v4 where possible. |
| v1 | Trigger API | `/swagger/api/v1/trigger-api-supported.yaml` | Legacy trigger operations. |
| v1 | API Task Execution | `/swagger/api/v1/api-task-execution-details.yaml` | API task execution details. |
| v1 | Code Analysis API | `/swagger/api/v1/policy-management-api.yaml` | Code-analysis policy management. |
| v1 | AI Agent Studio API | `/swagger/api/v1/ai-agent-studio-api.yaml` | AI Agent Studio integration. |
| v1 | ACC Automations dashboard API | `/swagger/api/v1/acc-automations-api-supported.yaml` | Dashboard metrics and automation reporting. |
| v2 | Authentication API | `/swagger/api/v2/auth-api-supported.yaml` | Primary token acquisition. |
| v2 | User Management API | `/swagger/api/v2/um-api-supported.yaml` | Users, roles, teams, permissions. |
| v2 | Credential Vault API | `/swagger/api/v2/cv-api-supported.yaml` | Credential vault object lookup/management. |
| v2 | Bot Execution Orchestrator API | `/swagger/api/v2/bot-execution-orchestrator-api-supported.yaml` | Legacy execution orchestration. Prefer v3 for activity/execution details. |
| v2 | Repository Management API | `/swagger/api/v2/repository-management-api.yaml` | Main bot/file/folder repository interface. Critical for bot-building agents. |
| v2 | BotInsight API | `/swagger/api/v2/botinsight-api.yaml` | BotInsight analytics. |
| v2 | BLM API | `/swagger/api/v2/blm-api.yaml` | Bot Lifecycle Management import/export. |
| v2 | Device Pool API | `/swagger/api/v2/device-pools-api-supported.yaml` | Device pool lookup and management. |
| v2 | License API | `/swagger/api/v2/license-api.yaml` | License capacity and license state. |
| v2 | Process Composer | `/swagger/api/v2/aari-process.yaml` | Process automation metadata. |
| v2 | Automations API | `/swagger/api/v2/automations-api-supported.yaml` | Automation management. |
| v2 | Code Analysis API | `/swagger/api/v2/policy-management-api.yaml` | Code-analysis policy management. |
| v2 | Team Management API | `/swagger/api/v2/aari-team-management.yaml` | AARI/team management. |
| v2 | Packages Usage API | `/swagger/api/v2/packages-api-supported.yaml` | Package usage and package-version impact analysis. |
| v3 | Bot deploy API | `/swagger/api/v3/deploy-api-supported.yaml` | Deploy/run automations. |
| v3 | Workload Management API | `/swagger/api/v3/wlm-api-supported.yaml` | Queues, work items, WLM automations. |
| v3 | Bot Execution Orchestrator API | `/swagger/api/v3/bot-execution-orchestrator-api-supported.yaml` | Activity listing, execution details, manage executions, metrics. |
| v4 | Bot Deployment API | `/swagger/api/v4/deploy-api-supported.yaml` | Newer deployment surface. Use when tenant supports v4 deployment behavior. |
| v4 | Workload Management API | `/swagger/api/v4/wlm-api-supported.yaml` | Newer WLM surface. |
| v4 | Migration API | `/swagger/api/v4/migration-api-supported.yaml` | Migration-related operations. |

## 4. Concrete Core Operation Endpoints

These are concrete endpoint operations extracted from the generated Swagger inventory for bot-building surfaces.

### 4.1 Authentication

Base server: `/v2`

| Method | Path | Purpose | LLM agent use |
|---|---|---|---|
| POST | `/v2/authentication` | Authenticate and issue Control Room token. | First call for username/password auth mode. Store token outside prompt context. |
| POST | `/v2/authentication/token` | Token-based authentication / refresh surface. | Use when token auth mode is configured. |

### 4.2 Repository Management

Base server: `/v2/repository`

| Method | Path | Purpose | LLM agent use |
|---|---|---|---|
| POST | `/v2/repository/file/list` | List bots, folders, and files in repository with filters. | Main discovery endpoint. Use to find bot IDs, folder IDs, file types, workspace locations. |
| PUT | `/v2/repository/folders/{folderid}` | Edit folder metadata. | Folder rename/move/update. Require explicit user approval. |
| POST | `/v2/repository/folders/{folderid}` | Create folder under parent folder. | Create workspace structure before bot creation or asset import. |
| DELETE | `/v2/repository/folders/{folderid}` | Delete folder. | Destructive. Require exact folder ID confirmation. |
| POST | `/v2/repository/folders/{folderid}/list` | List direct child folders and files under folder. | Safer scoped browsing than global file search. |
| POST | `/v2/repository/workspaces/{workspaceType}/files/list` | List files in a workspace. | Browse `PRIVATE` or `PUBLIC` workspace. Useful for LLM grounding. |
| DELETE | `/v2/repository/files/{id}` | Delete repository file. | Destructive. Require exact file ID and path confirmation. |
| PUT | `/v2/repository/role/{roleid}/permissions` | Add/update repository role permissions. | Admin-only. Use only in permission-management workflows. |
| GET | `/v2/repository/role/{roleid}/folder/{folderid}/permissions` | View role permissions for folder. | Diagnose access issues before modifying content. |
| GET | `/v2/repository/files/{fileid}/content` | Download file content. | Key endpoint for reading a single bot/form/file from Control Room. Use instead of BLM zip export when single-file content is needed. |
| GET | `/v2/repository/files/{fileid}/parents` | Get immediate parent folders. | Resolve path/tree context for a file ID. |
| GET | `/v2/repository/files/{fileid}/dependencies` | Get file dependencies. | Required before editing/deploying bots. Use to identify package/files needed. |
| PUT | `/v2/repository/files/{fileid}/dependencies/{workspaceId}` | Update manual dependencies. | Use only after dependency diff and preview. |
| POST | `/v2/repository/files/packagesVersionUpdate` | Execute package version update. | Bulk package remediation workflow. Require preview first. |
| POST | `/v2/repository/recover` | Recover bots/files from repository. | Recovery workflow. Requires exact IDs and reason. |
| POST | `/v2/repository/files/version/assignLabel` | Assign production label to bot version. | Release-management operation. Require explicit target version. |

### 4.3 Deployment

Base server: `/v3`

| Method | Path | Purpose | LLM agent use |
|---|---|---|---|
| POST | `/v3/automations/deploy` | Deploy/run automation. | Use only after repository ID, runner/device pool, inputs, and dependencies are known. |

### 4.4 Activity and Execution Monitoring

Base server: `/v3`

| Method | Path | Purpose | LLM agent use |
|---|---|---|---|
| POST | `/v3/activity/list` | List recent/current bot activity. | Monitor deployment status, build dashboards, find execution IDs. |
| GET | `/v3/activity/execution/{id}` | Get execution details by ID. | Explain run result, errors, durations, outputs. |
| POST | `/v3/activity/manage` | Manage execution activity. | Stop/pause/resume/manage activity if supported. Require confirmation. |
| POST | `/v3/activity/metrics` | Return activity metrics. | Summarize operational health and execution KPIs. |

### 4.5 Packages Usage

Base server: `/v2`

| Method | Path | Purpose | LLM agent use |
|---|---|---|---|
| POST | `/v2/packages/{name}/versions/usage` | Get package-version usage impact. | Analyze package upgrade risk and identify bots using package versions. Can return `403` depending on tenant role. |

## 5. Endpoint Selection Matrix

| User intent | First endpoint(s) | Follow-up endpoint(s) | Notes |
|---|---|---|---|
| Login | `POST /v2/authentication` | none | Store token securely. Do not expose token to model text. |
| Find bot by name | `POST /v2/repository/file/list` | `GET /v2/repository/files/{fileid}/parents` | Use filters. Return exact ID/path/type. |
| Browse folder | `POST /v2/repository/folders/{folderid}/list` | `POST /v2/repository/workspaces/{workspaceType}/files/list` | Prefer scoped list for fewer false matches. |
| Download single bot/file | `GET /v2/repository/files/{fileid}/content` | `GET /v2/repository/files/{fileid}/dependencies` | This is the single-file content path, not BLM zip export. |
| Inspect dependencies | `GET /v2/repository/files/{fileid}/dependencies` | `PUT /v2/repository/files/{fileid}/dependencies/{workspaceId}` | Put only after preview. |
| Deploy bot | `POST /v3/automations/deploy` | `POST /v3/activity/list` | Validate inputs before deploy. |
| Check run result | `POST /v3/activity/list` | `GET /v3/activity/execution/{id}` | Use activity list to discover execution ID. |
| Stop/manage run | `POST /v3/activity/manage` | `GET /v3/activity/execution/{id}` | Confirm action before manage. |
| Package impact scan | `POST /v2/packages/{name}/versions/usage` | `POST /v2/repository/files/packagesVersionUpdate` | Role may block package usage lookup. |
| Assign release label | `POST /v2/repository/files/version/assignLabel` | `POST /v2/repository/file/list` | Confirm version and target bot. |

## 6. Recommended LLM Tool Surface

Expose high-value tools, not every raw API, to reduce hallucination and accidental destructive calls.

### 6.1 Read-only tools

```text
a360_list_repository_items(filters)
a360_list_folder_items(folderId)
a360_get_file_content(fileId)
a360_get_file_parents(fileId)
a360_get_file_dependencies(fileId)
a360_list_activity(filters)
a360_get_execution_details(executionId)
a360_get_package_usage(packageName, versionFilter)
```

### 6.2 Write tools

```text
a360_create_folder(parentFolderId, name, description)
a360_update_folder(folderId, patch)
a360_update_file_dependencies(fileId, workspaceId, dependencies)
a360_assign_bot_version_label(fileId, versionId, label)
a360_deploy_automation(fileId, runnerSpec, botInput)
a360_manage_activity(activityId, action)
```

All write tools need:

- dry-run mode
- preview payload
- exact target IDs
- explicit user approval
- idempotency strategy where possible

### 6.3 Bot-building tools

```text
a360_plan_bot_from_prompt(prompt)
a360_resolve_packages(plan)
a360_build_bot_json(plan, packageMetadata)
a360_validate_bot_json(botJson)
a360_preview_bot_json(botJson)
a360_write_bot_json(fileId, botJson)
```

Treat `a360_write_bot_json` as implementation-specific unless an update-content endpoint is verified in the active tenant Swagger or internal client implementation.

## 7. Bot-Building Architecture

### 7.1 Planning

The LLM can do:

- infer user intent
- split process into actions
- identify likely packages
- ask for missing business inputs
- generate readable plan

The LLM must not do:

- invent package command schemas
- invent action IDs
- directly mutate production bot JSON without validation
- deploy without exact runner/device/credential context

### 7.2 Grounding

Before building bot JSON, resolve:

- repository folder ID
- target workspace
- package names and versions
- command schemas
- variables and types
- credential vault dependencies
- file dependencies

### 7.3 Validation

Minimum checks before saving or deploying:

- JSON parse success
- root schema shape valid
- package names exist
- package versions exist or are resolvable
- command names exist in package metadata
- variable references resolve
- credential references are not hardcoded
- dependency list matches referenced files/packages

### 7.4 Deployment

Deploy only after:

- target automation ID is known
- runner or device pool is known
- bot input schema is known
- dependencies are resolved
- user approved execution

Then call:

```text
POST /v3/automations/deploy
POST /v3/activity/list
GET /v3/activity/execution/{id}
```

## 8. Safety Rules for LLM Agents

Destructive endpoints:

```text
DELETE /v2/repository/folders/{folderid}
DELETE /v2/repository/files/{id}
POST /v3/activity/manage
PUT /v2/repository/role/{roleid}/permissions
POST /v2/repository/files/packagesVersionUpdate
```

Required safeguards:

- show target ID, path, workspace, and operation
- show request payload preview
- require user approval
- log request and response metadata
- never expose credentials or tokens in normal chat text

## 9. Implementation Notes

### 9.1 HTTP client behavior

- Base URL: `https://aa-se-latam-2.my.automationanywhere.digital`
- Add API path exactly as documented.
- Use JSON request bodies unless endpoint expects binary or vendor media type.
- Normalize errors into `{ status, code, message, endpoint, requestId }`.
- Retry only safe idempotent reads by default.
- Never retry destructive writes automatically.

### 9.2 Filtering repository searches

Prefer filtered `POST /v2/repository/file/list` calls over full repository scans.

Example filter intent:

```json
{
  "filter": {
    "operator": "eq",
    "field": "name",
    "value": "MyBot"
  },
  "page": { "offset": 0, "length": 50 }
}
```

Exact request schema must be taken from active tenant Swagger before use.

### 9.3 Single-file download

For one bot/file from Control Room:

```text
GET /v2/repository/files/{fileid}/content
```

This is different from Bot Lifecycle Management export, which is meant for package-style movement/export and commonly produces archive artifacts.

## 10. Priority Endpoints for Bot-Building LLM

Highest value:

1. `POST /v2/authentication`
2. `POST /v2/repository/file/list`
3. `POST /v2/repository/folders/{folderid}/list`
4. `GET /v2/repository/files/{fileid}/content`
5. `GET /v2/repository/files/{fileid}/dependencies`
6. `PUT /v2/repository/files/{fileid}/dependencies/{workspaceId}`
7. `POST /v3/automations/deploy`
8. `POST /v3/activity/list`
9. `GET /v3/activity/execution/{id}`
10. `POST /v2/packages/{name}/versions/usage`

## 11. Gaps to Verify in Active Tenant

The exported inventory covers concrete operations for core bot-building surfaces, but an LLM production architecture should still verify these against the active tenant before enabling write tools:

- exact schema for repository filter requests
- content write/update endpoint availability
- bot creation endpoint availability
- v4 deploy behavior compared with v3 deploy
- package metadata/list endpoints if needed beyond package usage
- role permissions needed for package usage lookup
- media types for bot/form/headlessbot content download

## 12. Minimal Tool-Routing Prompt for LLM

```text
You are an Automation Anywhere Control Room API router.
Never invent endpoints, schema fields, package commands, file IDs, folder IDs, runner IDs, or credential IDs.
For discovery, use repository list endpoints first.
For single-file download, use GET /v2/repository/files/{fileid}/content.
For deployment, require exact automation ID, runner/device-pool target, bot inputs, and explicit approval.
For destructive actions, always preview target and request payload before execution.
For bot generation, produce a structured plan first, ground package commands from metadata, build JSON deterministically, validate, preview, then write only after approval.
```
