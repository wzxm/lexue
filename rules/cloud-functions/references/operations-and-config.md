# Cloud Functions Operations and Config Reference

Use this reference for logs, gateway exposure, environment-variable updates, triggers, and legacy tool-name translation.

## Logs

### Preferred path

- `queryFunctions(action="listFunctionLogs")` for the log list.
- `queryFunctions(action="getFunctionLogDetail")` for a specific request log.

### Plan B: `callCloudApi`

Only use raw cloud API calls after reading the official docs or knowledge-base entry for the action and parameter contract. Do not guess the action name or payload shape from memory.

#### Log list

```javascript
callCloudApi({
  service: "tcb",
  action: "GetFunctionLogs",
  params: {
    EnvId: "{envId}",
    FunctionName: "functionName",
    Offset: 0,
    Limit: 10,
    StartTime: "2024-01-01 00:00:00",
    EndTime: "2024-01-01 23:59:59"
  }
});
```

#### Log detail

```javascript
callCloudApi({
  service: "tcb",
  action: "GetFunctionLogDetail",
  params: {
    StartTime: "2024-01-01 00:00:00",
    EndTime: "2024-01-01 23:59:59",
    LogRequestId: "request-id-from-log-list"
  }
});
```

### Log query limits

- `Offset + Limit` cannot exceed `10000`.
- `StartTime` to `EndTime` cannot span more than one day.
- For large ranges, page through day-sized windows.

## Environment variable updates

Do not overwrite function environment variables blindly.

### Safe pattern

1. Read current config with `queryFunctions(action="getFunctionDetail")`.
2. Merge existing variables with the new variables.
3. Update with `manageFunctions(action="updateFunctionConfig")`.

```javascript
const current = await queryFunctions({
  action: "getFunctionDetail",
  functionName: "functionName"
});

const mergedEnvVariables = {
  ...current.EnvVariables,
  ...newEnvVariables
};

await manageFunctions({
  action: "updateFunctionConfig",
  functionName: "functionName",
  envVariables: mergedEnvVariables
});
```

## Timer configuration

### Timer triggers

Configure timer triggers through `func.triggers`.

- Type: `timer`
- Cron format: 7 fields -> second minute hour day month week year

Examples:

- `0 0 2 1 * * *` -> 2:00 AM on the first day of every month
- `0 30 9 * * * *` -> 9:30 AM every day

## Layers (SCF Layer)

SCF LayerName is an **account-scoped shared namespace** (not per CloudBase env). Different envs that create the same layer name share one version sequence; deleting a version can break every function in every env that binds that version.

This section mirrors the MCP `queryFunctions` / `manageFunctions` **层（Layer）说明** so skill guidance and tool descriptions stay aligned.

### Naming contract (new layers)

- Fixed format: `{layerName}_{当前envId}`
- Example: `common_cloud1-d9ghadgak3edf6b36`
- Pass the full string as `layerName`. MCP / Manager SDK pass the name through as-is — they do **not** auto-append `envId`.
- Do not reuse a bare name (e.g. `common`) in another env.
- Before create: `queryFunctions(action="listLayers")` (optionally with `searchKey`) to check for collisions.

### Preferred tools

| Goal | Tool |
| --- | --- |
| List layers / versions / detail (account-level view) | `queryFunctions(action="listLayers"\|"listLayerVersions"\|"getLayerVersionDetail")` |
| List layers bound to a function | `queryFunctions(action="listFunctionLayers")` |
| Create a layer version | `manageFunctions(action="createLayerVersion")` |
| Delete a layer version | `manageFunctions(action="deleteLayerVersion")` |
| Bind / unbind / replace function layers | `manageFunctions(action="attachLayer"\|"detachLayer"\|"updateFunctionLayers")` |

```javascript
// Create — name already includes current envId
manageFunctions({
  action: "createLayerVersion",
  layerName: "common_cloud1-d9ghadgak3edf6b36",
  runtimes: ["Nodejs18.15"],
  contentPath: "/abs/path/to/layer-content"
});
```

### Soft `warnings` (non-blocking)

Layer actions may return envelope `warnings: string[]` while `success` remains `true`. Surface them to the user; do not treat them as hard failures and do not invent a different tool path because of them.

Typical advisories (wording may vary slightly):

- create without `envId` in the name → suggest `{layerName}_{envId}` because the name may share a version sequence with other envs
- list layers / versions / detail → account-level view may include layers from other envs
- delete version → account-shared; affects all envs bound to that version
- attach / detach / updateFunctionLayers → account-shared bind/unbind impact

### Do not

- Auto-rewrite or suffix existing bare layer names in tooling (breaks callers that still use the bare name).
- Tell the user to switch to `tcb` CLI solely to avoid layer conflicts — stay on MCP when tools are available.
- Assume `listLayers` is filtered to the current env only.
