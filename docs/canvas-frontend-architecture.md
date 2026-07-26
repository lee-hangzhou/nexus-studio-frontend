# 画布前端架构方案

> 对齐 [canvas-agent-architecture.md](./canvas-agent-architecture.md)（后端）与 storyflow-web `workflowCanvas` 成熟实践。  
> **不以** dream-drama 现有 `useCanvasState` mock 为依据；现有壳仅作路由占位。

**版本**：v1 · 2026-06

---

## 目录

1. [目标与原则](#1-目标与原则)
2. [技术栈](#2-技术栈)
3. [与 storyflow-web 的对照](#3-与-storyflow-web-的对照)
4. [目录与模块](#4-目录与模块)
5. [数据模型与权威来源](#5-数据模型与权威来源)
6. [状态架构](#6-状态架构)
7. [API 与 SSE](#7-api-与-sse)
8. [画布主区域（React Flow）](#8-画布主区域react-flow)
9. [用户编辑 vs Agent 增量](#9-用户编辑-vs-agent-增量)
10. [Agent 侧栏](#10-agent-侧栏)
11. [生成任务与节点态（定稿）](#11-生成任务与节点态定稿)
12. [Manual 模式 UI](#12-manual-模式-ui)
13. [画布视觉与主题（浅色）](#13-画布视觉与主题浅色)
14. [明确不做](#14-明确不做)
15. [分阶段落地](#15-分阶段落地)

---

## 1. 目标与原则

| 原则 | 说明 |
|------|------|
| **服务端权威** | `revision`、节点 `id`、图数据以 API 为准；浏览器是副本 + 乐观 UI |
| **行级合并** | Agent 改动画布只应用 SSE `canvas_patch` **delta**，不整图替换 |
| **与 Chat 同构 SSE** | 复用 `web/src/api/chat.ts` 的 `StreamFrame` 解析模式，扩展画布帧 |
| **生成统一 Agent 发起** | 节点「生成」不直调 `submitGenerate`；`task_id` / `status` 只由 SSE 回写（§11） |
| **浅色品牌 UI** | 白卡片 + 淡阴影 + 层次留白，与创作页 / 对话页一致（§13） |
| **参考 storyflow 交互** | `@xyflow/react` v12、自定义 node/edge、历史/剪贴板/连线等 UX |
| **不复用 storyflow 存盘** | 不用「整段 canvas JSON 防抖 POST」；改 `PATCH` + `expected_revision` |

---

## 2. 技术栈

与仓库现状一致，与 storyflow-web `apps/frontend` 同族：

| 层 | 选型 |
|----|------|
| 框架 | React 18 + Vite + TypeScript |
| 画布 | **@xyflow/react ^12.10.2**（`ReactFlow`、`ReactFlowProvider`、`Background`、`Controls`） |
| UI | antd 5（侧栏、确认框、消息） |
| 路由 | react-router-dom（`/projects/:id/canvas` 等） |
| 流式 | fetch + SSE（同 Chat，非 EventSource 若需 POST body） |

**暂不引入**（storyflow 有、画布 v1 可后置）：Tiptap 节点内 @ 提及 → 侧栏 Composer 先用 textarea + 后续再对齐 `PromptWithMentions` 能力。

---

## 3. 与 storyflow-web 的对照

路径：`storyflow-web/apps/frontend/src/components/workflowCanvas/`

| storyflow 能力 | dream-drama 建议 |
|----------------|------------------|
| `WorkflowCanvasFlow` + `ReactFlowProvider` | **采纳** 页面结构 |
| `canvasSchema`（`toFlowNodes` / `fromFlowState`） | **采纳** 模式；输入改为 **API Snapshot**，非 episode JSON 字符串 |
| `useWorkflowCanvasGraph` | **采纳** nodes/edges/onChanges/连接校验 |
| `useCanvasHistory` undo/redo | **采纳**（仅本地编辑栈；Agent delta **不入** undo 栈或单独策略） |
| `useCanvasSaveJson` 防抖写整图 | **不采纳** → `useCanvasPatch` 行级/批量 patch + revision |
| `useCanvasEpisodeLoad` | **改为** `useCanvasSnapshot(projectId)` |
| `useCanvasNodeTasks` + 直调 generate | **不采纳直调**；仅借鉴「节点任务 overlay」UI；生成走 Agent + SSE（§11） |
| `CanvasTaskContext` / 节点 overlay | **采纳**；status 权威来自 `generation_progress` / `canvas_patch` SSE（不轮询写库） |
| `CanvasPromptEditor`（Tiptap） | **Phase 2+**；v1 节点属性表单 + 侧栏 Composer |
| 节点类型 text/image/video/audio | **对齐** 后端 `canvas_nodes.kind` |

---

## 4. 目录与模块

在 `web/src/features/canvas/` 重构（保留路由入口 `CanvasPage.tsx`）：

```
features/canvas/
  pages/
    CanvasPage.tsx                 # ReactFlowProvider + 布局
  api/
    canvas.ts                      # snapshot / patch / messages / turn / resume / cancel
    canvasTypes.ts                 # 与后端契约一致的 TS 类型
  schema/
    canvasSchema.ts                # API Snapshot ↔ React Flow Node/Edge
    nodeDefaults.ts
  flow/
    WorkflowCanvasFlow.tsx         # 主画布（参考 storyflow 同名文件）
    nodeTypes.tsx
    edgeTypes.tsx
    constants.ts
  hooks/
    useCanvasSnapshot.ts           # GET 加载 + revision
    useCanvasGraph.ts              # RF 状态 + 连接规则
    useCanvasPatch.ts              # 用户编辑 → PATCH（debounce 位置等）
    useCanvasAgentTurn.ts          # POST turn + SSE 消费
    useCanvasMessages.ts           # Feed 列表 / 分页
    useCanvasRevisionConflict.ts   # 409 统一处理
    useCanvasGenerationSync.ts     # 消费 canvas_patch / generation_progress，更新节点展示
    useCanvasHistory.ts            # 本地 undo（可选）
    useCanvasKeyboard.ts
    ...
  components/
    CanvasTopbar.tsx
    CanvasLeftTools.tsx
    CanvasAgentPanel.tsx           # 替代 CanvasRightPanel mock
    CanvasComposer.tsx
    CanvasToolConfirmCard.tsx      # manual tool_pending
    ToolRunTimeline.tsx            # 复用 chat 组件或薄封装
    nodes/                         # Text / Image / Video / Audio
    menus/                         # 添加节点、连线落点菜单
  context/
    CanvasProjectContext.tsx       # projectId, revision, setRevision
    CanvasActionsContext.tsx
    CanvasTaskContext.tsx
```

共享层：

- `web/src/api/request.ts` — 统一鉴权与错误
- `web/src/api/chat.ts` — 抽出 `parseSSEStream` / `StreamFrame` 基类型到 `web/src/api/stream.ts`（可选），画布与 Chat 共用

---

## 5. 数据模型与权威来源

### 5.1 API 契约（前端 TypeScript，与后端一致）

```typescript
/** GET /canvas/{project_id} */
export interface CanvasSnapshot {
  revision: number;
  nodes: CanvasNodeRecord[];
  edges: CanvasEdgeRecord[];
}

export interface CanvasNodeRecord {
  id: string;              // UUID，服务端分配
  kind: 'text' | 'image' | 'video' | 'audio';
  position: { x: number; y: number };
  title: string;
  summary: string;
  prompt: string;
  status: 'idle' | 'running' | 'success' | 'failed';
  model_id?: string;
  ratio?: string;
  duration_sec?: number;
  resolution?: string;
  task_id?: number;
  asset_keys?: string[];
}

export interface CanvasEdgeRecord {
  id: string;
  source: string;
  target: string;
}

/** PATCH body：用户手动画布或批量提交 */
export interface CanvasPatchRequest {
  expected_revision: number;
  ops: CanvasPatchOp[];
}

/** SSE canvas_patch */
export interface CanvasPatchEvent {
  revision: number;
  op_id?: string;
  nodes?: CanvasNodeRecord[];
  edges?: CanvasEdgeRecord[];
  deleted_node_ids?: string[];
  deleted_edge_ids?: string[];
}
```

### 5.2 React Flow 映射（`canvasSchema.ts`）

- `toFlowNodes(snapshot.nodes)` / `toFlowEdges(snapshot.edges)` — 加载时一次
- `fromFlowPosition(node)` — 用户拖拽结束时生成 `update_node` op
- **禁止** `createNodeId('n-image-101')` 本地自增；新建节点必须来自：
  - 用户菜单「添加节点」→ `PATCH` `create_node` → 响应/SSE 带回 **服务端 id** 再 `setNodes`
  - 或 Agent `canvas_patch` delta 含新节点

### 5.3 三类状态（不要混在一个 hook 里）

| 状态 | 来源 | 存放 |
|------|------|------|
| **图 + revision** | GET snapshot、PATCH、SSE `canvas_patch` | `CanvasProjectContext` + `useNodesState`/`useEdgesState` |
| **Agent Feed** | `GET messages`、`canvas turn` SSE | `useCanvasMessages` / 面板本地列表 |
| **生成任务展示** | 仅 SSE `canvas_patch` / `generation_progress`（§11） | `CanvasTaskContext` + 节点 `task_id` / `status` / 缩略图 |

---

## 6. 状态架构

```
┌─────────────────────────────────────────────────────────────┐
│ CanvasPage                                                   │
│  CanvasProjectProvider(revision, projectId)                  │
│    ├─ CanvasAgentPanel  ←── useCanvasMessages + useCanvasTurn│
│    └─ WorkflowCanvasFlow ←── useCanvasSnapshot + useCanvasGraph│
│         CanvasTaskProvider ←── useCanvasGenerationSync       │
└─────────────────────────────────────────────────────────────┘
```

**revision 规则：**

- 任何成功 PATCH 或 `canvas_patch` → `setRevision(newRevision)`
- 所有写请求带 `expected_revision: revisionRef.current`
- 409 / `revision_conflict` → `useCanvasRevisionConflict`：提示 + `refetchSnapshot()`（**不**用本地旧图硬写）

**加载：**

```
mount → GET snapshot → setNodes/setEdges + setRevision
       → listMessages → Feed 初始历史
```

---

## 7. API 与 SSE

新建 `web/src/features/canvas/api/canvas.ts`（路径与后端 §11 对齐）：

| 方法 | 函数 |
|------|------|
| GET snapshot | `getCanvasSnapshot(projectId)` |
| PATCH | `patchCanvas(projectId, body)` |
| 消息列表 | `listCanvasMessages(projectId, cursor?)` |
| 发起 turn | `streamCanvasTurn(projectId, body, handlers)` |
| resume | `resumeCanvasTurn(projectId, body)` |
| cancel | `cancelCanvasTurn(projectId)` |

### 7.1 SSE 帧处理（扩展 `StreamFrame`）

在 `web/src/api/canvas.ts` 或共享 `stream.ts` 扩展：

```typescript
export type CanvasStreamFrameType =
  | StreamFrameType
  | 'canvas_patch'
  | 'tool_pending'
  | 'generation_progress';

export interface CanvasStreamFrame extends StreamFrame {
  type: CanvasStreamFrameType;
  revision?: number;
  nodes?: CanvasNodeRecord[];
  edges?: CanvasEdgeRecord[];
  deleted_node_ids?: string[];
  deleted_edge_ids?: string[];
  summary?: string;           // tool_pending
  node_id?: string;
  task_id?: number;
  status?: string;
}
```

**`streamCanvasTurn` 实现**：复制 `streamMessage` 的 SSE 解析循环，换 URL 与 body（`project_id`、`mode`、`client_turn_id`）。

**handler 分发：**

| type | 前端动作 |
|------|----------|
| `token` | 追加 assistant 流式文本（仅 `channel=answer`） |
| `tool_start` / `tool_end` | 更新 Feed 内 `ToolRunTimeline`（复用 Chat 组件） |
| `canvas_patch` | `applyCanvasPatchDelta(frame)` → 更新 nodes/edges + revision |
| `tool_pending` | 展示 `CanvasToolConfirmCard`；用户点确认/拒绝 → `resumeCanvasTurn` |
| `generation_progress` | 更新对应节点 `status` / `task_id` |
| `error` / `cancelled` / `done` | 同 Chat；`done` 时 `message_ids` 可用来对齐持久化 id |

**CoT**：默认不展示 `channel=think`（与后端一致）。

### 7.2 幂等（turn 级）

每次用户发送侧栏消息：

```typescript
const client_turn_id = crypto.randomUUID();
```

- POST body 必带；重复提交同一 `client_turn_id` 时后端返回已有结果或 409 → 前端不重复插 user 气泡、不启第二个 SSE。

---

## 8. 画布主区域（React Flow）

参考 `WorkflowCanvasFlow.tsx` 配置；样式按 **§13 浅色主题** 实现（`studio-canvas-v2-*` 类名可保留，色值对齐创作页 / Chat）：

| 能力 | 实现要点 |
|------|----------|
| 自定义节点 | `nodeTypes`: text / image / video / audio；`NodeChrome` 显示 status、任务 overlay |
| 自定义边 | `edgeTypes` + hover 删除（`useCanvasEdgeHover`） |
| 连线 | `isValidConnection` + `onConnect` → 生成 `connect` op → PATCH |
| 拖拽 | `onNodeDragStop` → `update_node` position op（debounce 300ms，合并连续拖拽） |
| 删除 | Delete 键 → `delete_node` + 关联边（或后端级联） |
| 添加节点 | 左侧工具栏 / 画布右键 → **先 PATCH create** 再落节点（不用纯本地 append） |
| 视口 | `fitView`、`MiniMap`、`Controls` |
| 空状态 | 无节点时引导添加（参考 `CanvasEmptyStateHost`） |

**本地 undo（`useCanvasHistory`）：**

- 仅记录 **用户发起** 的 PATCH 前快照；Agent `canvas_patch` **不进入** undo 栈，避免与服务端权威冲突。
- undo 执行：用栈顶快照调 PATCH（或 refetch + 提示「无法撤销 Agent 操作」— 产品二选一，v1 推荐 **仅撤销用户操作**）。

---

## 9. 用户编辑 vs Agent 增量

### 9.1 用户手动画布（PATCH）

```
onNodeDragStop / onConnect / 属性表单 blur
  → build ops[] + expected_revision
  → patchCanvas()
  → 200: 应用返回 delta（若有）并 revision++
  → 409: revisionConflictHandler()
```

**不要** storyflow 式 `JSON.stringify(wholeGraph)` 防抖上传。

### 9.2 Agent 改画布（SSE delta）

```typescript
function applyCanvasPatchDelta(
  nodes: Node[],
  edges: Edge[],
  event: CanvasPatchEvent,
  setNodes,
  setEdges,
) {
  // upsert nodes by id
  // upsert edges by id
  // remove deleted_*_ids
  setRevision(event.revision);
}
```

- 只改 event 中出现的 id；其它节点保持
- 若 patch 含新节点且当前 selection 需要跟进，可选聚焦第一个新节点

### 9.3 并发 UX

| 场景 | UI |
|------|-----|
| Agent turn 进行中 | 侧栏 Composer 禁用；顶栏「停止」→ `cancelCanvasTurn`；画布可只读或允许 PATCH（与后端「边聊边改」一致则允许，冲突靠 revision） |
| 409 冲突 | Modal：「画布已被更新」→ 刷新 snapshot |
| `CANVAS_EPISODE_BUSY` | Toast：「Agent 正在执行」 |

---

## 10. Agent 侧栏

替代 `CanvasRightPanel` mock + `sendCanvasMessage` 假回复。

### 10.1 布局

```
CanvasAgentPanel
  ├─ header（项目名、mode 切换 auto/manual）
  ├─ feed（useCanvasMessages + 流式 assistant）
  │     ├─ user bubble
  │     ├─ assistant bubble（markdown）
  │     └─ ToolRunTimeline（tool_start/end）
  └─ CanvasComposer（发送 → useCanvasAgentTurn）
```

### 10.2 与 Chat 复用

| 复用 | 方式 |
|------|------|
| `streamMessage` 解析逻辑 | 抽公共 `consumeSSE` 或复制后改 URL |
| `ToolRunTimeline` | `features/chat/components/ToolRunTimeline.tsx` 直接 import |
| 流式 assistant 占位 | 同 `ChatPage`：`metadata.streaming` + temp id |
| 取消 | `cancelCanvasTurn` 类比 `cancelTurn` |

### 10.3 消息数据

- 首屏：`listCanvasMessages(projectId)`
- 流式：临时 id；`done` 后用 `message_ids` 替换或 refetch 最近一页
- **不**把 ToolMessage 全文塞进 Feed；只展示 `tool_end.preview`（与后端 canvas_messages 摘要一致）

---

## 11. 生成任务与节点态（定稿）

### 11.1 原则：统一由 Agent 发起，单一回写来源

**定稿**：画布上任意「生成」动作（节点工具栏按钮、侧栏针对某节点的指令等）**不得**在前端直接调用 `submitGenerate`（`web/src/api/generate.ts`），**不得**由前端 `PATCH` 写入 `task_id` / `status`。

| 层级 | 规则 |
|------|------|
| **服务端写入** | 仅 Agent 工具 `submit_node_generation`（内部再调 `GenerateService` / `generate_task`）更新 `canvas_nodes` |
| **前端更新图** | **唯一**消费 SSE：`canvas_patch`（含节点 delta）、`generation_progress`（按 `node_id` 推送状态）；本地 React Flow 只做 merge，不自行改权威字段 |
| **禁止** | 前端直调 `submitGenerate` + 再 PATCH 回写；与 Agent 双写会导致 `status` / `task_id` 打架 |

节点 UI（running / success / failed、缩略图、进度）只绑定上述 SSE 合并后的节点数据；与创作页**状态色语义**一致，**数据来源**不同（创作页列表直读 `generate_task` API，画布读 SSE）。

### 11.2 用户点节点「生成」按钮（推荐交互）

不打开侧栏打字时，仍走 Agent 链路，二选一（后端实现择一，前端统一视为「发起一次 generation turn」）：

**方案 A — 轻量快捷接口（推荐）**

```
POST /api/v1/canvas/{project_id}/nodes/{node_id}/generate
  body: { model_key?, client_turn_id }   // 参数以节点当前 prompt/config 为准，可由后端读行
  → 响应：SSE 流（与 POST .../turn 相同帧类型）
  → 后端单轮内只执行 submit_node_generation（不跑闲聊）
```

**方案 B — 专用 turn 文案**

```
POST /api/v1/canvas/{project_id}/turn
  body: {
    content: "[系统] 对节点 {node_id} 执行生成",  // 或由后端忽略自然语言，只认 node_id 字段
    node_id,
    action: "run_node_generation",
    client_turn_id,
    mode: "auto"
  }
```

前端按钮逻辑：

```typescript
async function onNodeGenerateClick(nodeId: string) {
  setNodeUiPending(nodeId, true);  // 仅本地 loading 态，不写 task_id
  await streamCanvasGeneration({ projectId, nodeId, client_turn_id });
  // 在 stream handler 里 merge canvas_patch / generation_progress
}
```

- 按钮样式：主操作可用品牌渐变（§13），与侧栏「发送」同级。
- `manual` 模式下若该工具在 `CANVAS_MANUAL_CONFIRM_TOOLS` 内，先走 `tool_pending` 再执行，仍无前端直调 generate。

### 11.3 SSE 驱动的节点态同步

`useCanvasGenerationSync`（或合入 `useCanvasAgentTurn`）：

| SSE | 前端动作 |
|-----|----------|
| `canvas_patch` | 若 `nodes[]` 含 `task_id` / `status` / `asset_keys` → `applyCanvasPatchDelta` |
| `generation_progress` | 按 `node_id` 更新对应节点 `status`（及可选进度字段） |
| `done` / `error` | 清除按钮 loading；失败展示节点内错误文案 |

**可选（只读、非回写）**：SSE 已给 `task_id` 但尚无预览图时，可 **只读** 调 `getTaskStatus(task_id)` 拉 `result_keys` 用于缩略图展示，**禁止**用轮询结果去 PATCH 节点或覆盖 SSE 已给的 `status`。若后端保证 `generation_progress` / `canvas_patch` 已带齐展示字段，则不必轮询。

### 11.4 侧栏自然语言生成

用户在 Agent Composer 输入「把节点 X 生成视频」→ 普通 `POST .../turn`；模型自行调 `submit_node_generation`。节点按钮与侧栏 **共用同一套** SSE 回写逻辑（§11.3），无第二套状态机。

### 11.5 与创作页的关系

| | 创作页 Generate | 画布节点 |
|--|-----------------|----------|
| 发起 | 用户表单 → `submitGenerate` | **仅 Agent** `submit_node_generation` |
| 任务表 | 前端直读 `generate_task` | 不直读列表驱动节点权威态；可选只读查预览 |
| 视觉 | 状态色、占位、缩略图 | **复用同一套 CSS 变量 / 状态 class**（§13） |

---

## 12. Manual 模式 UI

`mode=manual` 时 SSE 出现 `tool_pending`：

```
CanvasToolConfirmCard
  - 展示 summary（不写死参数明文）
  - [确认] → resumeCanvasTurn({ action: 'confirm', tool_call_id })
  - [拒绝] → resumeCanvasTurn({ action: 'reject', tool_call_id })
```

- 卡片挂在 Feed 底部或固定条；**不**在 React Flow 画布上阻塞平移
- confirm 之前画布节点不变（后端 interrupt 未执行写工具）

---

## 13. 画布视觉与主题（浅色）

画布页采用 **浅色主题**，与 Nexus Studio 整体及 **创作页 / 对话页** 一致。核心原则与创作页相同：**靠层次和留白区分区域，不靠灰色块铺底**。

具体色值实现时可微调；下列为基调与 token 约定。

### 13.1 画布主区

| 元素 | 规范 |
|------|------|
| 背景 | 近白浅色 `#FBFCFE` 或 `#F9FAFD` |
| 对齐网格 | 可选极淡点阵 `#E8EAEF`、低透明度；**足够淡**，不抢节点 |
| React Flow 视口 | 与背景同色；`Background` 组件若用则点色同上 |

### 13.2 节点卡片（text / image / video / audio）

| 元素 | 规范 |
|------|------|
| 卡片底 | 白 `#FFFFFF` |
| 边框 | 1px `#E8EAEF` |
| 阴影 | `0 1px 3px rgba(0,0,0,0.04)`，轻微浮起 |
| 禁止 | 灰底卡片、按 kind 整卡换底色 |
| 类型区分 | 统一结构；**小** kind 图标/标签 + 品牌色点（如 6px 圆点），四种节点布局一致 |

| 状态 | 规范 |
|------|------|
| 默认 | 白卡 + 淡边 + 淡阴影 |
| hover / 选中 | 品牌蓝描边 `#3B82F6`，或淡蓝底 `#EBF2FC`；**不用**灰色高亮 |
| `status=idle` | 中性浅灰文字（次要色） |
| `status=running` | 品牌蓝 + loading（与创作页一致） |
| `status=success` | 成功绿（与创作页一致） |
| `status=failed` | 错误红（与创作页一致） |

### 13.3 媒体预览（image / video 节点）

- 缩略图区域：**真实彩色内容** 填充（成功态）。
- 加载中：浅灰 **骨架屏**（shimmer），与创作页占位一致；**不要**实心灰块占位。

### 13.4 连线（Edge）

| 状态 | 颜色 |
|------|------|
| 默认 | 浅灰 `#C7CBD1`，线宽偏细，不抢内容 |
| hover / 选中 | 品牌蓝（同 `#3B82F6` 或主色 token） |

### 13.5 顶栏 / 左侧工具栏

- 背景浅色，与画布同调或略区分（白 + 底部分割线 `#E8EAEF`）。
- 图标默认次要灰 `#8A8F9C`；激活/hover → 品牌蓝。

### 13.6 右侧 Agent 面板

- 浅色底，与画布主区 **1px** 分割 `#E8EAEF`。
- Feed 气泡、Composer、Manual 工具确认卡片：**沿用 Chat 已有浅色组件样式**，不另起一套配色。
- 主按钮「发送」、节点「生成」：品牌渐变 `linear-gradient(90deg, #0693F9, #744DF4)`。

### 13.7 强调色使用约束

| 可用 | 不可用 |
|------|--------|
| 主按钮（发送、生成）、激活态、关键高亮、选中描边 | 大面积铺渐变或纯蓝底 |

建议 CSS：在 `web/src/styles/global.css` 或 `features/canvas/canvas-theme.css` 集中定义 `--canvas-*` token，与创作页 `--studio-*` 对齐或复用同名语义变量。

---

## 14. 明确不做

| 项 | 原因 |
|----|------|
| `useCanvasState` + mock fixtures 作为权威 | 与后端方案冲突 |
| 本地自增节点 id | 无法与行级表 / patch 对齐 |
| 整图 JSON 防抖保存 | 对标后端禁止 graph_json RMW |
| 侧栏假 Agent 回复 | 必须 SSE + messages API |
| **前端直调 `submitGenerate` 写节点** | 与 §11 定稿冲突；`status` 单一回写来源 |
| **前端 PATCH 写 `task_id` / `status`** | 同上；仅 Agent 工具写服务端 |
| 在前端维护 turn 状态机 | 无 `canvas_turns`；busy 看 409 + Redis 锁错误码 |
| 双轨 checkpoint 对账 UI | 无用户可见「sync_seq」 |
| 画布深色主题 / 灰底节点卡 | 与产品浅色品牌不一致 |
| 首版引入 Tiptap 画布内编辑器 | 可后置；减少 v1 面 |

---

## 15. 分阶段落地

### F0 — 权威画布（无 Agent）

- [ ] `canvasTypes` + `canvasSchema` + `getCanvasSnapshot` / `patchCanvas`
- [ ] 重构 `WorkflowCanvasFlow`：加载 snapshot、拖拽/连线 PATCH、409 刷新
- [ ] **§13 浅色主题**（画布底、白节点卡、边、顶栏/侧栏分割）
- [ ] 删除 mock `sendCanvasMessage` / fixtures 作初始数据
- [ ] 验收：刷新后与服务端一致；单节点拖动仅发 position op

### F1 — Agent 侧栏

- [ ] `canvas.ts`：`streamCanvasTurn`、`listCanvasMessages`
- [ ] `CanvasAgentPanel` + `applyCanvasPatchDelta`
- [ ] `client_turn_id` 幂等、busy / error 处理
- [ ] 复用 `ToolRunTimeline`

### F2 — 生成闭环（Agent 唯一发起）

- [ ] 节点「生成」→ `streamCanvasGeneration` / 专用 turn（§11.2），**不**接 `submitGenerate`
- [ ] `useCanvasGenerationSync`：`canvas_patch` + `generation_progress`
- [ ] 节点 status / 缩略图 UI（状态色 §13，与创作页一致）
- [ ] 验收：全程无前端 PATCH `task_id`；busy 时按钮 loading，终态仅由 SSE 更新

### F3 — Manual + 体验

- [ ] `tool_pending` + `resumeCanvasTurn` + `CanvasToolConfirmCard`
- [ ] mode 切换、cancel turn
- [ ] （可选）节点内 Tiptap / @ 引用

### F4 — 大规模画布读优化（按需）

- [ ] 首屏 snapshot 分页或视口 bbox 查询（**后端需配套 API**）
- [ ] 虚拟化仅渲染视口内节点（RF 性能调优）

---

## 附录：与后端文档章节映射

| 后端 § | 前端 |
|--------|------|
| 行级表 + revision | §5、§9 PATCH + SSE delta |
| §8.4 Redis 锁 | §9.3 `CANVAS_EPISODE_BUSY` |
| §10 manual interrupt | §12 |
| §11 协议 | §7 |
| query_canvas_nodes | v1 仅 Agent；前端用户用可视化画布，不需此工具 |
| submit_node_generation | §11（前端不直调 generate API 写节点） |
| 画布浅色主题 | §13 |

---

*实现时后端 API 路径/字段以后端 OpenAPI 或实际路由为准；本文与 [canvas-agent-architecture.md](./canvas-agent-architecture.md) 同步演进。*
