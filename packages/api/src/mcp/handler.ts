import { Server } from "@modelcontextprotocol/sdk/server";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types";
import { z, ZodError } from "zod";
import type { Request, Response } from "express";
import { TaskService } from "@/task/task.service";
import { resolveBearer } from "./auth";

const taskService = new TaskService();

// DNS-rebinding protection: only allow requests with these Host values.
const ALLOWED_HOSTS = new Set(["api.tidaltask.app", "localhost"]);

// --- Zod schemas (additionalProperties: false via .strict()) ---

const IdTitleSchema = z.object({
    id: z.string().min(1).max(200),
    title: z.string().min(1).max(500),
}).strict();

const IdSchema = z.object({
    id: z.string().min(1).max(200),
}).strict();

const ListTasksSchema = z.object({
    filter: z.enum(["all", "incomplete", "today", "overdue", "week"]).optional(),
    tags: z.string().max(500).optional(),
}).strict();

const REPEATER = z.enum(["", "daily", "weekly", "bi-weekly", "monthly", "6-monthly", "yearly"]);

const CreateTaskSchema = z.object({
    title: z.string().min(1).max(500),
    description: z.string().max(5000).optional(),
    date: z.string().max(100).optional(),
    priority: z.number().int().min(0).max(3).optional(),
    group: z.string().max(200).optional(),
    tags: z.array(z.string().max(100)).max(50).optional(),
    repeater: REPEATER.optional(),
}).strict();

const UpdateTaskSchema = z.object({
    id: z.string().min(1).max(200),
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(5000).optional(),
    date: z.string().max(100).optional(),
    priority: z.number().int().min(0).max(3).optional(),
    group: z.string().max(200).optional(),
    tags: z.array(z.string().max(100)).max(50).optional(),
    repeater: REPEATER.optional(),
    done: z.union([z.boolean(), z.array(z.string().max(100)).max(3650)]).optional(),
}).strict();

// --- Response helpers ---

function ok(data: unknown) {
    return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    };
}

function err(message: string) {
    return {
        content: [{ type: "text" as const, text: message }],
        isError: true as const,
    };
}

// --- MCP Server factory — new instance per request for stateless operation ---

function buildServer(userId: string): Server {
    const server = new Server(
        { name: "tidaltask", version: "1.0.0" },
        { capabilities: { tools: {} } },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [
            {
                name: "list_incomplete_tasks",
                description:
                    "Returns all incomplete tasks for the authenticated user: tasks pending today, overdue, or due within the next 90 days. Good starting point for a work-session overview.",
                inputSchema: { type: "object" as const, properties: {}, additionalProperties: false },
            },
            {
                name: "list_tasks",
                description:
                    "Returns tasks filtered by status. filter='all' returns every task, 'today' pending tasks for today, 'overdue' missed tasks, 'week' the next 7 days, 'incomplete' all open work. Optionally narrow by comma-separated tag names.",
                inputSchema: {
                    type: "object" as const,
                    properties: {
                        filter: {
                            type: "string",
                            enum: ["all", "incomplete", "today", "overdue", "week"],
                            description: "Which subset of tasks to return.",
                        },
                        tags: {
                            type: "string",
                            description: "Comma-separated tag names to filter by, e.g. 'work,urgent'.",
                            maxLength: 500,
                        },
                    },
                    additionalProperties: false,
                },
            },
            {
                name: "get_task",
                description: "Fetches a single task by ID. Use this to read the current state before updating or completing.",
                inputSchema: {
                    type: "object" as const,
                    required: ["id"],
                    properties: {
                        id: { type: "string", minLength: 1, maxLength: 200, description: "The task ID." },
                    },
                    additionalProperties: false,
                },
            },
            {
                name: "create_task",
                description:
                    "Creates a new task for the user. Requires at minimum a title. Optionally set date (ISO 8601), priority (0=none 1=low 2=medium 3=high), group, tags, and repeater cadence.",
                inputSchema: {
                    type: "object" as const,
                    required: ["title"],
                    properties: {
                        title: { type: "string", minLength: 1, maxLength: 500 },
                        description: { type: "string", maxLength: 5000 },
                        date: { type: "string", description: "ISO 8601 due date.", maxLength: 100 },
                        priority: { type: "integer", minimum: 0, maximum: 3 },
                        group: { type: "string", maxLength: 200 },
                        tags: { type: "array", items: { type: "string", maxLength: 100 }, maxItems: 50 },
                        repeater: {
                            type: "string",
                            enum: ["", "daily", "weekly", "bi-weekly", "monthly", "6-monthly", "yearly"],
                        },
                    },
                    additionalProperties: false,
                },
            },
            {
                name: "update_task",
                description:
                    "Updates one or more fields on an existing task. Only fields you provide are changed. To toggle completion use complete_task instead.",
                inputSchema: {
                    type: "object" as const,
                    required: ["id"],
                    properties: {
                        id: { type: "string", minLength: 1, maxLength: 200 },
                        title: { type: "string", minLength: 1, maxLength: 500 },
                        description: { type: "string", maxLength: 5000 },
                        date: { type: "string", maxLength: 100 },
                        priority: { type: "integer", minimum: 0, maximum: 3 },
                        group: { type: "string", maxLength: 200 },
                        tags: { type: "array", items: { type: "string", maxLength: 100 }, maxItems: 50 },
                        repeater: {
                            type: "string",
                            enum: ["", "daily", "weekly", "bi-weekly", "monthly", "6-monthly", "yearly"],
                        },
                        done: {
                            description: "true/false for one-time tasks; array of ISO date strings for repeating tasks.",
                        },
                    },
                    additionalProperties: false,
                },
            },
            {
                name: "complete_task",
                description:
                    "Marks a task done as of today. For repeating tasks, marks only today's occurrence complete without affecting other occurrences. Include the task's current title so the action is auditable.",
                inputSchema: {
                    type: "object" as const,
                    required: ["id", "title"],
                    properties: {
                        id: { type: "string", minLength: 1, maxLength: 200, description: "The task ID." },
                        title: { type: "string", minLength: 1, maxLength: 500, description: "The task's current title." },
                    },
                    additionalProperties: false,
                },
            },
            {
                name: "delete_task",
                description:
                    "Permanently deletes a task. This cannot be undone. Confirm the task ID and title match before calling.",
                inputSchema: {
                    type: "object" as const,
                    required: ["id", "title"],
                    properties: {
                        id: { type: "string", minLength: 1, maxLength: 200, description: "The task ID." },
                        title: { type: "string", minLength: 1, maxLength: 500, description: "The task's current title." },
                    },
                    additionalProperties: false,
                },
            },
        ],
    }));

    server.setRequestHandler(CallToolRequestSchema, async (req) => {
        const { name, arguments: args = {} } = req.params;

        try {
            switch (name) {
                case "list_incomplete_tasks": {
                    const tasks = await taskService.getTasksIncomplete(userId);
                    return ok(tasks);
                }

                case "list_tasks": {
                    const { filter, tags } = ListTasksSchema.parse(args);
                    const tagList = tags
                        ? tags.split(",").map((t) => t.trim()).filter(Boolean)
                        : [];

                    let tasks;
                    if (filter === "today") tasks = await taskService.getTasksToday(userId);
                    else if (filter === "overdue") tasks = await taskService.getTasksOverdue(userId);
                    else if (filter === "week") tasks = await taskService.getTasksWeek(userId);
                    else if (filter === "incomplete") tasks = await taskService.getTasksIncomplete(userId);
                    else tasks = await taskService.getTasksByUserId(userId, tagList);
                    return ok(tasks);
                }

                case "get_task": {
                    const { id } = IdSchema.parse(args);
                    const task = await taskService.getTaskByIdForUser(id, userId);
                    if (!task) return err("Task not found or does not belong to you.");
                    return ok(task);
                }

                case "create_task": {
                    const input = CreateTaskSchema.parse(args);
                    const task = await taskService.addTask({ ...input, users: [userId] });
                    return ok(task);
                }

                case "update_task": {
                    const { id, ...updates } = UpdateTaskSchema.parse(args);
                    const owned = await taskService.getTaskByIdForUser(id, userId);
                    if (!owned) return err("Task not found or does not belong to you.");
                    const task = await taskService.updateTask(id, updates);
                    return ok(task);
                }

                case "complete_task": {
                    const { id } = IdTitleSchema.parse(args);
                    const task = await taskService.getTaskByIdForUser(id, userId);
                    if (!task) return err("Task not found or does not belong to you.");

                    let done: boolean | string[];
                    if (task.repeater && task.repeater.length > 0) {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const existing: string[] = Array.isArray(task.done) ? (task.done as string[]) : [];
                        const alreadyDone = existing.some((d) => {
                            const a = new Date(d);
                            a.setHours(0, 0, 0, 0);
                            return a.getTime() === today.getTime();
                        });
                        done = alreadyDone ? existing : [...existing, today.toISOString()];
                    } else {
                        done = true;
                    }

                    const updated = await taskService.updateTask(id, { done });
                    return ok(updated);
                }

                case "delete_task": {
                    const { id } = IdTitleSchema.parse(args);
                    const owned = await taskService.getTaskByIdForUser(id, userId);
                    if (!owned) return err("Task not found or does not belong to you.");
                    const deleted = await taskService.deleteTask(id);
                    return ok(deleted);
                }

                default:
                    return err(`Unknown tool: ${name}`);
            }
        } catch (e) {
            if (e instanceof ZodError) {
                return err(`Invalid input: ${e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
            }
            return err("An error occurred. Please try again.");
        }
    });

    return server;
}

export async function mcpHandler(req: Request, res: Response): Promise<void> {
    // DNS-rebinding protection: only allow known Host header values.
    const hostname = (req.headers.host ?? "").split(":")[0].toLowerCase();
    if (!ALLOWED_HOSTS.has(hostname)) {
        res.status(403).json({ error: "Forbidden" });
        return;
    }

    // Authenticate via Bearer token (same logic as session middleware).
    const auth = await resolveBearer(req.headers.authorization);
    if (!auth) {
        res.status(401).json({
            jsonrpc: "2.0",
            error: {
                code: -32001,
                message:
                    "Authentication required. Add your TidalTask API token as a Bearer token in your MCP client connector settings.",
            },
            id: null,
        });
        return;
    }

    const server = buildServer(auth.userId);
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless — no session ID generated or validated
        enableJsonResponse: true,      // return single JSON response instead of SSE stream
    });

    try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    } finally {
        await transport.close();
        await server.close();
    }
}
