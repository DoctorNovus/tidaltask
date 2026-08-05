import type { Request } from "express";

type AccessLevel = "token" | "developer" | "session";
type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

interface FieldDoc {
    name: string;
    type: string;
    required?: boolean;
    description: string;
}

interface EndpointDoc {
    method: HttpMethod;
    path: string;
    summary: string;
    description: string;
    access: AccessLevel;
    pathParams?: FieldDoc[];
    queryParams?: FieldDoc[];
    bodyFields?: FieldDoc[];
    requestExample?: unknown;
    responseExample?: unknown;
    notes?: string[];
    curlPath?: string;
}

interface SectionDoc {
    id: string;
    title: string;
    description: string;
    endpoints: EndpointDoc[];
}

interface SessionRouteDoc {
    method: HttpMethod;
    path: string;
    summary: string;
}

interface TokenDocsModel {
    title: string;
    baseUrl: string;
    endpointCount: number;
    sections: SectionDoc[];
    auth: {
        tokenTypes: string[];
        header: string;
        contentType: string;
        rateLimit: string;
        errorShape: {
            statusCode: number;
            message: string;
        };
        notes: string[];
    };
    relatedSessionRoutes: SessionRouteDoc[];
}

const sampleIds = {
    user: "67d0f3e8208a3e0f7ab12345",
    task: "67d0f4aa208a3e0f7ab12346",
    taskInvitee: "67d0f51f208a3e0f7ab12347",
    notification: "67d0f62c208a3e0f7ab12348",
    announcement: "67d0f73b208a3e0f7ab12349",
    review: "67d0f84a208a3e0f7ab12350",
};

const sampleUser = {
    id: sampleIds.user,
    first: "Ada",
    last: "Lovelace",
    email: "ada@example.com",
    developer: false,
    synced: false,
    lastLoggedIn: "2026-03-08T15:00:00.000Z",
    createdAt: "2026-02-01T12:00:00.000Z",
    updatedAt: "2026-03-08T15:00:00.000Z",
};

const samplePopulatedTaskUser = {
    id: sampleIds.taskInvitee,
    first: "Grace",
    last: "Hopper",
    email: "grace@example.com",
};

const sampleTask = {
    id: sampleIds.task,
    title: "Finish release notes",
    description: "Write the shipping summary for v3.0.0",
    date: "2026-03-08T14:00:00.000Z",
    done: false,
    repeater: "",
    repeatEnd: "",
    reminder: "15",
    type: "task",
    accordion: false,
    priority: 3,
    group: "Work",
    tags: ["release", "writing"],
    users: [sampleIds.user],
};

const sampleTaskWithUsers = {
    ...sampleTask,
    users: [sampleUser, samplePopulatedTaskUser],
};

const sampleNotificationPreference = {
    id: "67d0f95a208a3e0f7ab12351",
    user: sampleIds.user,
    pushEnabled: true,
    remindersEnabled: true,
    summaryCadence: "daily",
    summaryTime: "08:00",
    weeklyDay: 1,
    utcOffsetMinutes: 300,
    createdAt: "2026-02-01T12:00:00.000Z",
    updatedAt: "2026-03-08T15:00:00.000Z",
};

const samplePendingNotification = {
    id: sampleIds.notification,
    title: "Today in TidalTask",
    body: "2 tasks are due today.",
    ctaAction: "/tasks",
    type: "daily-summary",
    scheduledFor: "2026-03-08T13:00:00.000Z",
};

const sampleAnnouncement = {
    id: sampleIds.announcement,
    title: "Feature update",
    body: "Calendar drag-and-drop is now live.",
    date: "2026-03-08T12:00:00.000Z",
    ctaTitle: "Open calendar",
    ctaAction: "/calendar",
    active: true,
    createdAt: "2026-03-08T12:00:00.000Z",
    updatedAt: "2026-03-08T12:00:00.000Z",
};

const sampleDeveloperAnnouncement = {
    ...sampleAnnouncement,
    viewedBy: [sampleUser],
    clickedBy: [samplePopulatedTaskUser],
};

const sampleReview = {
    id: sampleIds.review,
    rating: 5,
    message: "Exactly the task workflow I needed.",
    user: sampleIds.user,
    userEmail: "ada@example.com",
    createdAt: "2026-03-08T14:15:00.000Z",
    updatedAt: "2026-03-08T14:15:00.000Z",
};

const taskWriteFields: FieldDoc[] = [
    { name: "title", type: "string", required: true, description: "Task title." },
    { name: "description", type: "string", description: "Long-form task description." },
    { name: "date", type: "string", description: "Legacy string date value. ISO 8601 strings work well." },
    { name: "done", type: "boolean | string[]", description: "Completion state. Repeating tasks rely on per-day string markers." },
    { name: "repeater", type: "string", description: "Repeat cadence. Supported values are empty, daily, weekly, bi-weekly, monthly, 6-monthly, and yearly." },
    { name: "repeatEnd", type: "string", description: "Last date (YYYY-MM-DD) the repeater occurs on, inclusive. Empty string means it never ends." },
    { name: "reminder", type: "string", description: "Minutes before due time, stored as a string such as \"15\"." },
    { name: "type", type: "string", description: "Free-form task type label." },
    { name: "accordion", type: "boolean", description: "Legacy UI flag." },
    { name: "priority", type: "number", description: "Priority integer. Higher values sort first in incomplete lists." },
    { name: "group", type: "string", description: "Grouping label." },
    { name: "tags", type: "string[] | { title: string }[]", description: "Tags are normalized to lowercase unique strings." },
];

const notificationPreferenceFields: FieldDoc[] = [
    { name: "pushEnabled", type: "boolean", description: "Master toggle for generated notifications." },
    { name: "remindersEnabled", type: "boolean", description: "Enables reminder notifications based on task reminder lead time." },
    { name: "summaryCadence", type: "\"off\" | \"daily\" | \"weekly\"", description: "Controls daily or weekly summary generation." },
    { name: "summaryTime", type: "string", description: "HH:mm local time string." },
    { name: "weeklyDay", type: "number", description: "0-6, where 0 is Sunday." },
    { name: "utcOffsetMinutes", type: "number", description: "Current local offset in minutes used to schedule summaries." },
];

const announcementWriteFields: FieldDoc[] = [
    { name: "title", type: "string", required: true, description: "Announcement headline." },
    { name: "body", type: "string", required: true, description: "Announcement message body." },
    { name: "date", type: "string", description: "Publish date/time. Defaults to now on create." },
    { name: "ctaTitle", type: "string", description: "CTA button label. Must be paired with ctaAction." },
    { name: "ctaAction", type: "string", description: "https/http URL, relative path, tidaltask:* action, or sequenced:* action." },
    { name: "active", type: "boolean", description: "Whether the announcement is visible to users." },
];

function getSections(): SectionDoc[] {
    return [
        {
            id: "identity",
            title: "Identity and Token Management",
            description: "Everything about the authenticated user, export/delete operations, and token inventory management.",
            endpoints: [
                {
                    method: "GET",
                    path: "/user",
                    summary: "Get the authenticated user.",
                    description: "Returns the current user and updates the last logged-in timestamp.",
                    access: "token",
                    responseExample: sampleUser,
                },
                {
                    method: "PATCH",
                    path: "/user",
                    summary: "Update profile fields.",
                    description: "Updates first name, last name, and/or email for the authenticated user.",
                    access: "token",
                    bodyFields: [
                        { name: "first", type: "string", description: "New first name." },
                        { name: "last", type: "string", description: "New last name." },
                        { name: "email", type: "string", description: "New email address. Must be unique." },
                    ],
                    requestExample: {
                        first: "Ada",
                        last: "Byron",
                        email: "ada@example.com",
                    },
                    responseExample: sampleUser,
                    notes: [
                        "At least one of first, last, or email is required.",
                        "Current implementation returns the pre-update user document.",
                    ],
                },
                {
                    method: "PATCH",
                    path: "/user/password",
                    summary: "Change the current password.",
                    description: "Validates the current password, then writes a new one.",
                    access: "token",
                    bodyFields: [
                        { name: "currentPassword", type: "string", required: true, description: "Existing password." },
                        { name: "newPassword", type: "string", required: true, description: "Replacement password." },
                    ],
                    requestExample: {
                        currentPassword: "old-password",
                        newPassword: "new-password",
                    },
                    responseExample: sampleUser,
                    notes: [
                        "Returns the pre-update user document.",
                    ],
                },
                {
                    method: "GET",
                    path: "/user/export",
                    summary: "Export account data.",
                    description: "Returns a sanitized user payload and all tasks currently associated with the user.",
                    access: "token",
                    responseExample: {
                        user: {
                            first: sampleUser.first,
                            last: sampleUser.last,
                            email: sampleUser.email,
                            createdAt: sampleUser.createdAt,
                            updatedAt: sampleUser.updatedAt,
                        },
                        tasks: [sampleTask],
                    },
                },
                {
                    method: "POST",
                    path: "/user/delete",
                    summary: "Delete the authenticated account.",
                    description: "Removes the user, pulls them out of shared tasks, and deletes tasks left with no users.",
                    access: "token",
                    responseExample: {
                        deletedUser: true,
                        removedFromTasks: 4,
                        deletedTasks: 1,
                    },
                },
                {
                    method: "GET",
                    path: "/user/synced",
                    summary: "Get sync status.",
                    description: "Returns a bare boolean indicating whether the account is marked as synced.",
                    access: "token",
                    responseExample: true,
                },
                {
                    method: "GET",
                    path: "/user/api-keys",
                    summary: "List stored API keys.",
                    description: "Returns the full API key object for the authenticated user.",
                    access: "token",
                    responseExample: {
                        apiKeys: {
                            primary: "tt_live_7c45d8...",
                            automation: "tt_live_3a83f1...",
                        },
                    },
                    notes: [
                        "Values are returned in plaintext. Treat this endpoint as highly sensitive.",
                    ],
                },
                {
                    method: "PATCH",
                    path: "/user/api-keys",
                    summary: "Replace stored API keys.",
                    description: "Overwrites the entire apiKeys object for the authenticated user.",
                    access: "token",
                    bodyFields: [
                        { name: "apiKeys", type: "Record<string, string>", required: true, description: "A full key-name to key-value map." },
                    ],
                    requestExample: {
                        apiKeys: {
                            primary: "tt_live_7c45d8...",
                            automation: "tt_live_3a83f1...",
                        },
                    },
                    responseExample: {
                        apiKeys: {
                            primary: "tt_live_7c45d8...",
                            automation: "tt_live_3a83f1...",
                        },
                    },
                    notes: [
                        "This is a full replacement, not a merge.",
                    ],
                },
                {
                    method: "POST",
                    path: "/user/api-keys/generate",
                    summary: "Generate a new named API key.",
                    description: "Creates a fresh random API key, stores it under the provided name, and returns the plaintext key once.",
                    access: "token",
                    bodyFields: [
                        { name: "name", type: "string", required: true, description: "Human-readable label for the key." },
                    ],
                    requestExample: {
                        name: "automation",
                    },
                    responseExample: {
                        name: "automation",
                        value: "tt_live_49e14f6f7f8b4d3d...",
                    },
                    notes: [
                        "You can call this endpoint with an existing bearer token to mint additional keys.",
                    ],
                },
            ],
        },
        {
            id: "tasks",
            title: "Tasks",
            description: "Task CRUD, date-based task views, and collaborator management.",
            endpoints: [
                {
                    method: "GET",
                    path: "/task",
                    summary: "List all tasks for the authenticated user.",
                    description: "Returns every task that includes the authenticated user, with populated user records.",
                    access: "token",
                    queryParams: [
                        { name: "tags", type: "string | string[]", description: "Comma-separated tags or repeated tags query params. Tags are normalized to lowercase." },
                    ],
                    responseExample: [sampleTaskWithUsers],
                    curlPath: "/task?tags=release,writing",
                },
                {
                    method: "GET",
                    path: "/task/:id/users",
                    summary: "List users assigned to a task.",
                    description: "Returns populated users for the task id.",
                    access: "token",
                    pathParams: [
                        { name: "id", type: "string", required: true, description: "Task id." },
                    ],
                    responseExample: [sampleUser, samplePopulatedTaskUser],
                    curlPath: `/task/${sampleIds.task}/users`,
                },
                {
                    method: "GET",
                    path: "/task/today",
                    summary: "List tasks due today.",
                    description: "Includes non-repeating and repeating tasks that are pending today.",
                    access: "token",
                    responseExample: [sampleTaskWithUsers],
                },
                {
                    method: "GET",
                    path: "/task/tomorrow",
                    summary: "List tasks due tomorrow.",
                    description: "Uses the same pending-task calculation as the app UI.",
                    access: "token",
                    responseExample: [sampleTaskWithUsers],
                },
                {
                    method: "GET",
                    path: "/task/week",
                    summary: "List tasks due within the next 7 days.",
                    description: "Returns tasks with at least one pending occurrence in the next week.",
                    access: "token",
                    responseExample: [sampleTaskWithUsers],
                },
                {
                    method: "GET",
                    path: "/task/overdue",
                    summary: "List overdue tasks.",
                    description: "Returns tasks with at least one pending occurrence before today.",
                    access: "token",
                    responseExample: [sampleTaskWithUsers],
                },
                {
                    method: "GET",
                    path: "/task/incomplete",
                    summary: "List incomplete tasks across current and upcoming work.",
                    description: "Returns tasks pending today, overdue, or due within the next 90 days.",
                    access: "token",
                    responseExample: [sampleTaskWithUsers],
                },
                {
                    method: "POST",
                    path: "/task",
                    summary: "Create a task.",
                    description: "Creates a task and forces users to the authenticated user.",
                    access: "token",
                    bodyFields: taskWriteFields,
                    requestExample: {
                        title: "Finish release notes",
                        description: "Write the shipping summary for v3.0.0",
                        date: "2026-03-08T14:00:00.000Z",
                        reminder: "15",
                        priority: 3,
                        group: "Work",
                        tags: ["Release", "Writing"],
                    },
                    responseExample: sampleTask,
                    notes: [
                        "Any users supplied in the request body are ignored and replaced with the authenticated user.",
                    ],
                },
                {
                    method: "POST",
                    path: "/task/bulk",
                    summary: "Create many tasks at once.",
                    description: "Bulk inserts tasks and forces users to the authenticated user on every item.",
                    access: "token",
                    bodyFields: [
                        { name: "tasks", type: "Array<object>", required: true, description: "Array of task payloads using the same shape as POST /task." },
                    ],
                    requestExample: {
                        tasks: [
                            {
                                title: "Write notes",
                                date: "2026-03-08T14:00:00.000Z",
                                tags: ["Release"],
                            },
                            {
                                title: "Ship announcement",
                                priority: 4,
                                group: "Launch",
                            },
                        ],
                    },
                    responseExample: [
                        sampleTask,
                        {
                            ...sampleTask,
                            id: "67d0fa69208a3e0f7ab12352",
                            title: "Ship announcement",
                            priority: 4,
                            group: "Launch",
                            tags: ["launch"],
                            date: new Date().toString(),
                        },
                    ],
                    notes: [
                        "When a task omits date, the API stores new Date().toString().",
                    ],
                },
                {
                    method: "PATCH",
                    path: "/task",
                    summary: "Update a task.",
                    description: "Updates a task by id using a request-body id field instead of a path parameter.",
                    access: "token",
                    bodyFields: [
                        { name: "id", type: "string", required: true, description: "Task id." },
                        ...taskWriteFields,
                    ],
                    requestExample: {
                        id: sampleIds.task,
                        title: "Finish release notes and changelog",
                        done: true,
                    },
                    responseExample: sampleTask,
                    notes: [
                        "Current implementation returns the pre-update task document.",
                        "Any subtasks payload is explicitly dropped and not persisted.",
                    ],
                },
                {
                    method: "DELETE",
                    path: "/task",
                    summary: "Delete a task.",
                    description: "Deletes by request-body id instead of a path parameter.",
                    access: "token",
                    bodyFields: [
                        { name: "id", type: "string", required: true, description: "Task id." },
                    ],
                    requestExample: {
                        id: sampleIds.task,
                    },
                    responseExample: sampleTask,
                },
                {
                    method: "POST",
                    path: "/task/invite",
                    summary: "Add another user to a task.",
                    description: "Looks up the invited user by email, then pushes them into the task users array.",
                    access: "token",
                    bodyFields: [
                        { name: "email", type: "string", required: true, description: "Invitee email." },
                        { name: "task.id", type: "string", required: true, description: "Task id." },
                    ],
                    requestExample: {
                        email: "grace@example.com",
                        task: {
                            id: sampleIds.task,
                        },
                    },
                    responseExample: {
                        success: true,
                    },
                },
                {
                    method: "DELETE",
                    path: "/task/:id/users/:email/remove",
                    summary: "Remove a collaborator from a task.",
                    description: "Removes the user identified by email from the task users array.",
                    access: "token",
                    pathParams: [
                        { name: "id", type: "string", required: true, description: "Task id." },
                        { name: "email", type: "string", required: true, description: "Collaborator email address." },
                    ],
                    responseExample: {
                        success: true,
                    },
                    curlPath: `/task/${sampleIds.task}/users/grace%40example.com/remove`,
                },
            ],
        },
        {
            id: "notifications",
            title: "Notifications",
            description: "Notification preference management, pending notification retrieval, acknowledgement, and developer broadcasts.",
            endpoints: [
                {
                    method: "GET",
                    path: "/notification/preferences",
                    summary: "Get notification preferences.",
                    description: "Creates default preferences on first access, then returns the stored document.",
                    access: "token",
                    responseExample: sampleNotificationPreference,
                },
                {
                    method: "PATCH",
                    path: "/notification/preferences",
                    summary: "Update notification preferences.",
                    description: "Updates any subset of preference fields with validation.",
                    access: "token",
                    bodyFields: notificationPreferenceFields,
                    requestExample: {
                        pushEnabled: true,
                        remindersEnabled: true,
                        summaryCadence: "weekly",
                        summaryTime: "09:30",
                        weeklyDay: 1,
                        utcOffsetMinutes: 300,
                    },
                    responseExample: {
                        ...sampleNotificationPreference,
                        summaryCadence: "weekly",
                        summaryTime: "09:30",
                    },
                },
                {
                    method: "GET",
                    path: "/notification/pending",
                    summary: "Fetch pending notifications due now.",
                    description: "Generates due reminders and summaries if needed, then returns up to 25 undelivered messages scheduled for now or earlier.",
                    access: "token",
                    responseExample: [samplePendingNotification],
                },
                {
                    method: "GET",
                    path: "/notification/status",
                    summary: "Get notification queue status.",
                    description: "Returns counts for due-now, upcoming, and total undelivered messages.",
                    access: "token",
                    responseExample: {
                        dueNow: 1,
                        upcoming: 2,
                        totalUndelivered: 3,
                        nextScheduledFor: "2026-03-09T13:00:00.000Z",
                    },
                },
                {
                    method: "POST",
                    path: "/notification/ack",
                    summary: "Acknowledge delivered notifications.",
                    description: "Marks listed notifications as delivered.",
                    access: "token",
                    bodyFields: [
                        { name: "ids", type: "string[]", required: true, description: "Notification ids to acknowledge." },
                    ],
                    requestExample: {
                        ids: [sampleIds.notification],
                    },
                    responseExample: {
                        acknowledged: 1,
                    },
                },
                {
                    method: "POST",
                    path: "/notification/developer/send",
                    summary: "Queue a developer broadcast.",
                    description: "Developer-only endpoint for sending one-off notification messages to a single user or every user.",
                    access: "developer",
                    bodyFields: [
                        { name: "to", type: "\"user\" | \"all\"", required: true, description: "Broadcast target scope." },
                        { name: "confirm", type: "boolean", required: true, description: "Must be true." },
                        { name: "title", type: "string", required: true, description: "Notification title." },
                        { name: "body", type: "string", required: true, description: "Notification body." },
                        { name: "ctaAction", type: "string", description: "Optional URL or app action." },
                        { name: "targetUserId", type: "string", description: "Required when to is user." },
                        { name: "scheduledFor", type: "string", description: "Optional ISO 8601 schedule time. Defaults to now." },
                    ],
                    requestExample: {
                        to: "user",
                        confirm: true,
                        title: "Manual reminder",
                        body: "Please review your launch checklist.",
                        targetUserId: sampleIds.user,
                        ctaAction: "/tasks",
                        scheduledFor: "2026-03-08T18:00:00.000Z",
                    },
                    responseExample: {
                        count: 1,
                    },
                    notes: [
                        "Non-developers receive a 401 with \"Developer access required.\"",
                    ],
                },
            ],
        },
        {
            id: "metrics",
            title: "Metrics",
            description: "Task count endpoints used by the app dashboard and automations.",
            endpoints: [
                {
                    method: "GET",
                    path: "/metrics/tasks",
                    summary: "Get total task count.",
                    description: "Counts every task containing the authenticated user.",
                    access: "token",
                    responseExample: { count: 12 },
                },
                {
                    method: "GET",
                    path: "/metrics/tasks/today",
                    summary: "Get due-today task count.",
                    description: "Counts pending tasks due today.",
                    access: "token",
                    responseExample: { count: 2 },
                },
                {
                    method: "GET",
                    path: "/metrics/tasks/tomorrow",
                    summary: "Get due-tomorrow task count.",
                    description: "Counts pending tasks due tomorrow.",
                    access: "token",
                    responseExample: { count: 1 },
                },
                {
                    method: "GET",
                    path: "/metrics/tasks/week",
                    summary: "Get next-7-days task count.",
                    description: "Counts tasks with a pending occurrence within the next week.",
                    access: "token",
                    responseExample: { count: 6 },
                },
                {
                    method: "GET",
                    path: "/metrics/tasks/overdue",
                    summary: "Get overdue task count.",
                    description: "Counts tasks that have a pending occurrence before today.",
                    access: "token",
                    responseExample: { count: 1 },
                },
            ],
        },
        {
            id: "announcements",
            title: "Announcements",
            description: "Unread announcement retrieval for users plus announcement administration for developer tokens.",
            endpoints: [
                {
                    method: "GET",
                    path: "/announcement",
                    summary: "List unread active announcements.",
                    description: "Returns active announcements already published and not yet marked read by the authenticated user.",
                    access: "token",
                    responseExample: [sampleAnnouncement],
                },
                {
                    method: "PATCH",
                    path: "/announcement/read",
                    summary: "Mark announcements as read.",
                    description: "Adds announcement ids to the user's readAnnouncementIds set.",
                    access: "token",
                    bodyFields: [
                        { name: "ids", type: "string[]", required: true, description: "Announcement ids to mark read." },
                    ],
                    requestExample: {
                        ids: [sampleIds.announcement],
                    },
                    responseExample: {
                        readAnnouncementIds: [sampleIds.announcement],
                    },
                },
                {
                    method: "POST",
                    path: "/announcement/:id/view",
                    summary: "Track an announcement view.",
                    description: "Adds the authenticated user to viewedBy for the announcement.",
                    access: "token",
                    pathParams: [
                        { name: "id", type: "string", required: true, description: "Announcement id." },
                    ],
                    responseExample: { success: true },
                    curlPath: `/announcement/${sampleIds.announcement}/view`,
                },
                {
                    method: "POST",
                    path: "/announcement/:id/click",
                    summary: "Track an announcement click.",
                    description: "Adds the authenticated user to clickedBy and viewedBy for the announcement.",
                    access: "token",
                    pathParams: [
                        { name: "id", type: "string", required: true, description: "Announcement id." },
                    ],
                    responseExample: { success: true },
                    curlPath: `/announcement/${sampleIds.announcement}/click`,
                },
                {
                    method: "GET",
                    path: "/announcement/all",
                    summary: "List every announcement with audience stats.",
                    description: "Developer-only endpoint with populated viewedBy and clickedBy arrays.",
                    access: "developer",
                    responseExample: [sampleDeveloperAnnouncement],
                },
                {
                    method: "POST",
                    path: "/announcement",
                    summary: "Create an announcement.",
                    description: "Developer-only announcement creation endpoint.",
                    access: "developer",
                    bodyFields: announcementWriteFields,
                    requestExample: {
                        title: "Feature update",
                        body: "Calendar drag-and-drop is now live.",
                        date: "2026-03-08T12:00:00.000Z",
                        ctaTitle: "Open calendar",
                        ctaAction: "/calendar",
                        active: true,
                    },
                    responseExample: sampleAnnouncement,
                },
                {
                    method: "PATCH",
                    path: "/announcement/:id",
                    summary: "Update an announcement.",
                    description: "Developer-only partial update endpoint.",
                    access: "developer",
                    pathParams: [
                        { name: "id", type: "string", required: true, description: "Announcement id." },
                    ],
                    bodyFields: announcementWriteFields.map((field) => ({ ...field, required: false })),
                    requestExample: {
                        body: "Calendar drag-and-drop and keyboard scheduling are now live.",
                        active: true,
                    },
                    responseExample: sampleAnnouncement,
                    curlPath: `/announcement/${sampleIds.announcement}`,
                    notes: [
                        "CTA title and CTA action must either both be set or both be empty.",
                    ],
                },
                {
                    method: "DELETE",
                    path: "/announcement/:id",
                    summary: "Delete an announcement.",
                    description: "Developer-only removal endpoint.",
                    access: "developer",
                    pathParams: [
                        { name: "id", type: "string", required: true, description: "Announcement id." },
                    ],
                    responseExample: { success: true },
                    curlPath: `/announcement/${sampleIds.announcement}`,
                },
            ],
        },
        {
            id: "reviews",
            title: "Reviews",
            description: "Create reviews and retrieve review history.",
            endpoints: [
                {
                    method: "POST",
                    path: "/review",
                    summary: "Create a review.",
                    description: "Creates a review tied to the authenticated user and forwards it to the internal webhook.",
                    access: "token",
                    bodyFields: [
                        { name: "rating", type: "number", required: true, description: "Integer 1 through 5." },
                        { name: "message", type: "string", description: "Optional free-form review text." },
                    ],
                    requestExample: {
                        rating: 5,
                        message: "Exactly the task workflow I needed.",
                    },
                    responseExample: { success: true },
                },
                {
                    method: "GET",
                    path: "/review",
                    summary: "List reviews.",
                    description: "Returns every stored review in reverse chronological order.",
                    access: "token",
                    responseExample: [sampleReview],
                    notes: [
                        "This endpoint is not developer-only under the current implementation.",
                    ],
                },
            ],
        },
    ];
}

const relatedSessionRoutes: SessionRouteDoc[] = [
    { method: "POST", path: "/auth/login", summary: "Create a browser session from email/password credentials." },
    { method: "POST", path: "/auth/register", summary: "Create a user account and browser session." },
    { method: "POST", path: "/auth/logout", summary: "Destroy the current browser session." },
    { method: "POST", path: "/auth/forgot-password", summary: "Begin password reset email flow." },
    { method: "POST", path: "/auth/reset-password", summary: "Complete password reset with token and new password." },
    { method: "POST", path: "/auth/device-token", summary: "Mint a 90-day device token from an existing browser session." },
];

function getAccessLabel(access: AccessLevel): string {
    switch (access) {
        case "developer":
            return "Developer token";
        case "session":
            return "Session only";
        default:
            return "API key or device token";
    }
}

function getAccessClass(access: AccessLevel): string {
    switch (access) {
        case "developer":
            return "is-developer";
        case "session":
            return "is-session";
        default:
            return "is-token";
    }
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function stringifyJson(value: unknown): string {
    if (value === undefined) return "";
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
}

function renderMethodBadge(method: HttpMethod): string {
    return `<span class="method method-${method.toLowerCase()}">${method}</span>`;
}

function renderFieldList(title: string, fields?: FieldDoc[]): string {
    if (!fields?.length) return "";

    return `
        <div class="detail-group">
            <h4>${escapeHtml(title)}</h4>
            <ul class="field-list">
                ${fields.map((field) => `
                    <li>
                        <code>${escapeHtml(field.name)}</code>
                        <span class="field-type">${escapeHtml(field.type)}</span>
                        ${field.required ? "<span class=\"required\">required</span>" : ""}
                        <p>${escapeHtml(field.description)}</p>
                    </li>
                `).join("")}
            </ul>
        </div>
    `;
}

function renderCodeBlock(title: string, content: string): string {
    if (!content) return "";

    return `
        <div class="detail-group">
            <h4>${escapeHtml(title)}</h4>
            <pre><code>${escapeHtml(content)}</code></pre>
        </div>
    `;
}

function getCurlPath(endpoint: EndpointDoc): string {
    const source = endpoint.curlPath || endpoint.path;
    return source.replace(/:([a-zA-Z_]+)/g, "<$1>");
}

function buildCurlExample(baseUrl: string, endpoint: EndpointDoc): string {
    const lines = [
        `curl -X ${endpoint.method} "${baseUrl}${getCurlPath(endpoint)}"`,
        `  -H "Authorization: Bearer <token>"`,
    ];

    if (endpoint.requestExample !== undefined) {
        lines.push(`  -H "Content-Type: application/json"`);
        lines.push(`  -d '${stringifyJson(endpoint.requestExample)}'`);
    }

    return lines.join(" \\\n");
}

function renderEndpoint(baseUrl: string, endpoint: EndpointDoc): string {
    const requestExample = endpoint.requestExample !== undefined ? stringifyJson(endpoint.requestExample) : "";
    const responseExample = endpoint.responseExample !== undefined ? stringifyJson(endpoint.responseExample) : "";
    const searchText = [
        endpoint.method,
        endpoint.path,
        endpoint.summary,
        endpoint.description,
        getAccessLabel(endpoint.access),
        ...(endpoint.notes ?? []),
    ].join(" ").toLowerCase();

    return `
        <article class="endpoint-card" data-search="${escapeHtml(searchText)}">
            <header class="endpoint-header">
                <div class="endpoint-title">
                    ${renderMethodBadge(endpoint.method)}
                    <code class="endpoint-path">${escapeHtml(endpoint.path)}</code>
                </div>
                <span class="access-badge ${getAccessClass(endpoint.access)}">${escapeHtml(getAccessLabel(endpoint.access))}</span>
            </header>
            <p class="summary">${escapeHtml(endpoint.summary)}</p>
            <p class="description">${escapeHtml(endpoint.description)}</p>
            ${renderFieldList("Path Params", endpoint.pathParams)}
            ${renderFieldList("Query Params", endpoint.queryParams)}
            ${renderFieldList("Body", endpoint.bodyFields)}
            ${endpoint.notes?.length ? `
                <div class="detail-group">
                    <h4>Notes</h4>
                    <ul class="note-list">
                        ${endpoint.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
                    </ul>
                </div>
            ` : ""}
            ${renderCodeBlock("Example Request", buildCurlExample(baseUrl, endpoint))}
            ${requestExample ? renderCodeBlock("Request JSON", requestExample) : ""}
            ${responseExample ? renderCodeBlock("Response JSON", responseExample) : ""}
        </article>
    `;
}

function renderSection(baseUrl: string, section: SectionDoc): string {
    return `
        <section id="${escapeHtml(section.id)}" class="section-block">
            <div class="section-heading">
                <h2>${escapeHtml(section.title)}</h2>
                <p>${escapeHtml(section.description)}</p>
            </div>
            <div class="endpoint-grid">
                ${section.endpoints.map((endpoint) => renderEndpoint(baseUrl, endpoint)).join("")}
            </div>
        </section>
    `;
}

export function getDocsBaseUrl(req: Request): string {
    const forwardedProto = typeof req.headers["x-forwarded-proto"] === "string"
        ? req.headers["x-forwarded-proto"].split(",")[0]?.trim()
        : "";
    const protocol = forwardedProto || req.protocol || "https";
    const host = req.get("host") || "api.tidaltask.app";

    return `${protocol}://${host}`;
}

export function createTokenDocsModel(baseUrl: string): TokenDocsModel {
    const sections = getSections();
    const endpointCount = sections.reduce((total, section) => total + section.endpoints.length, 0);

    return {
        title: "TidalTask Token API",
        baseUrl,
        endpointCount,
        sections,
        auth: {
            tokenTypes: [
                "User API keys stored under /user/api-keys",
                "90-day device tokens minted from POST /auth/device-token",
            ],
            header: "Authorization: Bearer <token>",
            contentType: "Content-Type: application/json",
            rateLimit: "10000 requests per 15 minutes per source",
            errorShape: {
                statusCode: 401,
                message: "Not Logged In",
            },
            notes: [
                "Bearer auth only works on routes protected by the session middleware. Browser auth endpoints under /auth are not bearer-compatible unless noted.",
                "Developer-only routes use the same bearer auth, but the resolved user must have developer=true.",
                "Protected routes also accept the browser session cookie. This page focuses on bearer-token behavior.",
            ],
        },
        relatedSessionRoutes,
    };
}

export function renderTokenDocsHtml(baseUrl: string): string {
    const model = createTokenDocsModel(baseUrl);

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f7f9fb" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0f131e" />
    <title>${escapeHtml(model.title)} Docs</title>
    <style>
        :root {
            color-scheme: light;
            --bg: #fcfdfd;
            --bg-strong: #ffffff;
            --panel: rgba(255, 255, 255, 0.92);
            --panel-strong: rgba(255, 255, 255, 0.97);
            --panel-muted: rgba(255, 255, 255, 0.76);
            --surface-tint: rgba(255, 255, 255, 0.58);
            --toolbar-bg: rgba(255, 255, 255, 0.72);
            --input-bg: rgba(255, 255, 255, 0.84);
            --ink: #0f172a;
            --muted: #475569;
            --line: rgba(48, 122, 207, 0.12);
            --line-strong: rgba(48, 122, 207, 0.24);
            --accent: #307acf;
            --accent-strong: #285180;
            --accent-soft: rgba(48, 122, 207, 0.12);
            --accent-secondary: #e63b7a;
            --accent-secondary-soft: rgba(230, 59, 122, 0.10);
            --token: #307acf;
            --developer: #c02663;
            --session: #285180;
            --get: #307acf;
            --post: #e63b7a;
            --patch: #d97706;
            --delete: #b91c1c;
            --code-bg: #edf5ff;
            --code-text: #15345b;
            --code-border: rgba(48, 122, 207, 0.18);
            --code-bg-soft: rgba(255, 255, 255, 0.48);
            --shadow: 0 18px 44px rgba(15, 23, 42, 0.08);
            --mono: "SFMono-Regular", "Menlo", "Monaco", "Consolas", monospace;
            --sans: "Manrope", "SF Pro Display", "Segoe UI", system-ui, -apple-system, sans-serif;
        }

        @media (prefers-color-scheme: dark) {
            :root {
                color-scheme: dark;
                --bg: #0f131e;
                --bg-strong: #121720;
                --panel: rgba(18, 23, 32, 0.92);
                --panel-strong: rgba(20, 26, 38, 0.98);
                --panel-muted: rgba(18, 23, 32, 0.82);
                --surface-tint: rgba(20, 26, 38, 0.68);
                --toolbar-bg: rgba(18, 23, 32, 0.84);
                --input-bg: rgba(15, 23, 42, 0.72);
                --ink: #e7ebf3;
                --muted: #c7d0dc;
                --line: rgba(96, 113, 133, 0.28);
                --line-strong: rgba(96, 113, 133, 0.44);
                --accent: #4ca5e5;
                --accent-strong: #9dd7f3;
                --accent-soft: rgba(48, 122, 207, 0.18);
                --accent-secondary: #f175a6;
                --accent-secondary-soft: rgba(241, 117, 166, 0.14);
                --token: #6ec0ec;
                --developer: #f175a6;
                --session: #9dd7f3;
                --get: #4ca5e5;
                --post: #f175a6;
                --patch: #f59e0b;
                --delete: #f87171;
                --code-bg: rgba(15, 23, 42, 0.78);
                --code-text: #eff6ff;
                --code-border: rgba(110, 192, 236, 0.18);
                --code-bg-soft: rgba(17, 24, 39, 0.14);
                --shadow: 0 18px 44px rgba(0, 0, 0, 0.22);
            }
        }

        * { box-sizing: border-box; }

        html, body {
            min-height: 100%;
        }

        body {
            margin: 0;
            color: var(--ink);
            font-family: var(--sans);
            background:
                radial-gradient(circle at top left, var(--accent-soft), transparent 26rem),
                radial-gradient(circle at top right, var(--accent-secondary-soft), transparent 24rem),
                linear-gradient(180deg, var(--bg-strong) 0%, var(--bg) 100%);
        }

        body::before {
            content: "";
            position: fixed;
            inset: 0;
            background-image:
                linear-gradient(rgba(48, 122, 207, 0.04) 1px, transparent 1px),
                linear-gradient(90deg, rgba(48, 122, 207, 0.04) 1px, transparent 1px);
            background-size: 22px 22px;
            pointer-events: none;
            mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.55), transparent);
        }

        main {
            position: relative;
            width: min(1280px, calc(100vw - 32px));
            margin: 0 auto;
            padding: 32px 0 80px;
        }

        .hero {
            display: grid;
            gap: 24px;
            margin-bottom: 28px;
            padding: 32px;
            border: 1px solid var(--line);
            border-radius: 28px;
            background:
                linear-gradient(145deg, var(--panel-strong), var(--panel-muted)),
                radial-gradient(circle at top right, var(--accent-soft), transparent 18rem);
            box-shadow: var(--shadow);
            backdrop-filter: blur(14px);
        }

        .hero-top {
            display: flex;
            flex-wrap: wrap;
            align-items: flex-start;
            justify-content: space-between;
            gap: 24px;
        }

        .eyebrow {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            padding: 7px 12px;
            border-radius: 999px;
            background: var(--accent-soft);
            color: var(--accent-strong);
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        h1 {
            margin: 0 0 10px;
            font-size: clamp(2.1rem, 4.4vw, 3.6rem);
            line-height: 0.95;
        }

        .hero p {
            max-width: 72ch;
            margin: 0;
            color: var(--muted);
            line-height: 1.65;
        }

        .hero-stats {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
        }

        .stat {
            min-width: 148px;
            padding: 14px 16px;
            border: 1px solid var(--line);
            border-radius: 18px;
            background: linear-gradient(180deg, var(--panel-strong), var(--surface-tint));
        }

        .stat strong {
            display: block;
            font-size: 1.55rem;
            line-height: 1;
            margin-bottom: 4px;
        }

        .stat span {
            color: var(--muted);
            font-size: 0.92rem;
        }

        .hero-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 16px;
        }

        .panel {
            padding: 18px 18px 16px;
            border: 1px solid var(--line);
            border-radius: 20px;
            background: var(--panel);
        }

        .panel h3 {
            margin: 0 0 10px;
            font-size: 0.95rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--accent-strong);
        }

        .panel p, .panel li {
            color: var(--muted);
            line-height: 1.55;
        }

        .panel ul {
            margin: 0;
            padding-left: 18px;
        }

        .mono-line {
            margin: 0;
            padding: 12px 14px;
            border-radius: 14px;
            border: 1px solid var(--code-border);
            background: linear-gradient(180deg, var(--code-bg), var(--code-bg-soft));
            color: var(--code-text);
            font-family: var(--mono);
            font-size: 0.92rem;
            overflow-x: auto;
        }

        .toolbar {
            position: sticky;
            top: 16px;
            z-index: 10;
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 22px;
            padding: 14px 16px;
            border: 1px solid var(--line);
            border-radius: 20px;
            background: var(--toolbar-bg);
            backdrop-filter: blur(12px);
            box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
        }

        .toolbar-nav {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .toolbar-nav a {
            padding: 9px 12px;
            border-radius: 999px;
            color: var(--ink);
            text-decoration: none;
            background: var(--accent-soft);
            font-size: 0.92rem;
            transition: background-color 0.2s ease, transform 0.2s ease;
        }

        .toolbar-nav a:hover {
            background: rgba(48, 122, 207, 0.2);
            transform: translateY(-1px);
        }

        .toolbar input {
            width: min(360px, 100%);
            padding: 12px 14px;
            border: 1px solid var(--line);
            border-radius: 14px;
            background: var(--input-bg);
            color: var(--ink);
            font: inherit;
        }

        .toolbar input::placeholder {
            color: var(--muted);
        }

        .section-block {
            margin-top: 28px;
        }

        .section-heading {
            margin-bottom: 16px;
        }

        .section-heading h2 {
            margin: 0 0 6px;
            font-size: 1.6rem;
        }

        .section-heading p {
            margin: 0;
            color: var(--muted);
        }

        .endpoint-grid {
            display: grid;
            gap: 16px;
        }

        .endpoint-card {
            padding: 20px;
            border: 1px solid var(--line);
            border-radius: 22px;
            background:
                linear-gradient(180deg, var(--panel-strong), var(--panel-muted)),
                radial-gradient(circle at top right, rgba(48, 122, 207, 0.06), transparent 12rem);
            box-shadow: 0 14px 28px rgba(15, 23, 42, 0.05);
        }

        .endpoint-header {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 10px;
        }

        .endpoint-title {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 10px;
        }

        .endpoint-path {
            font-family: var(--mono);
            font-size: 1rem;
            white-space: pre-wrap;
        }

        .method {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 72px;
            padding: 7px 10px;
            border-radius: 999px;
            font-size: 0.8rem;
            font-weight: 800;
            letter-spacing: 0.05em;
            color: white;
        }

        .method-get { background: var(--get); }
        .method-post { background: var(--post); }
        .method-patch { background: var(--patch); }
        .method-delete { background: var(--delete); }

        .access-badge {
            padding: 7px 11px;
            border-radius: 999px;
            font-size: 0.8rem;
            font-weight: 700;
        }

        .is-token {
            background: var(--accent-soft);
            color: var(--token);
        }

        .is-developer {
            background: var(--accent-secondary-soft);
            color: var(--developer);
        }

        .is-session {
            background: rgba(48, 122, 207, 0.1);
            color: var(--session);
        }

        .summary {
            margin: 0 0 6px;
            font-size: 1.04rem;
            font-weight: 700;
        }

        .description {
            margin: 0 0 14px;
            color: var(--muted);
            line-height: 1.6;
        }

        .detail-group + .detail-group {
            margin-top: 14px;
        }

        .detail-group h4 {
            margin: 0 0 8px;
            font-size: 0.84rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--accent-strong);
        }

        .field-list, .note-list {
            margin: 0;
            padding-left: 18px;
        }

        .field-list li, .note-list li {
            margin: 0 0 8px;
            color: var(--muted);
        }

        .field-list code {
            font-family: var(--mono);
            font-size: 0.92rem;
        }

        .field-type {
            margin-left: 6px;
            color: var(--accent-strong);
            font-family: var(--mono);
            font-size: 0.85rem;
        }

        .required {
            margin-left: 6px;
            color: var(--delete);
            font-weight: 700;
            font-size: 0.82rem;
        }

        pre {
            margin: 0;
            padding: 14px;
            border-radius: 16px;
            border: 1px solid var(--code-border);
            background: linear-gradient(180deg, var(--code-bg), var(--code-bg-soft));
            color: var(--code-text);
            overflow-x: auto;
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
        }

        code {
            font-family: var(--mono);
        }

        a {
            color: var(--accent);
        }

        a:hover {
            color: var(--accent-secondary);
        }

        .footer {
            margin-top: 28px;
            padding: 20px;
            border: 1px solid var(--line);
            border-radius: 22px;
            background: var(--panel);
            color: var(--muted);
        }

        .footer ul {
            margin: 10px 0 0;
            padding-left: 18px;
        }

        @media (max-width: 980px) {
            .hero-grid {
                grid-template-columns: 1fr;
            }
        }

        @media (max-width: 720px) {
            main {
                width: min(100vw - 20px, 100%);
                padding-top: 18px;
            }

            .hero, .endpoint-card, .footer {
                padding: 18px;
            }

            .toolbar {
                top: 8px;
            }

            .toolbar input {
                width: 100%;
            }
        }
    </style>
</head>
<body>
    <main>
        <section class="hero">
            <div class="hero-top">
                <div>
                    <div class="eyebrow">REST Docs</div>
                    <h1>${escapeHtml(model.title)}</h1>
                    <p>Bearer-token documentation for the routes protected by the API session middleware. Every endpoint below is sourced from the live controller implementation in this repository.</p>
                </div>
                <div class="hero-stats">
                    <div class="stat">
                        <strong>${model.endpointCount}</strong>
                        <span>token-capable endpoints</span>
                    </div>
                    <div class="stat">
                        <strong>${model.sections.filter((section) => section.endpoints.some((endpoint) => endpoint.access === "developer")).length}</strong>
                        <span>sections with developer routes</span>
                    </div>
                    <div class="stat">
                        <strong>10k / 15m</strong>
                        <span>rate limit</span>
                    </div>
                </div>
            </div>
            <div class="hero-grid">
                <div class="panel">
                    <h3>Base URL</h3>
                    <p class="mono-line">${escapeHtml(model.baseUrl)}</p>
                    <p class="mono-line" style="margin-top: 10px;">${escapeHtml(model.auth.header)}</p>
                </div>
                <div class="panel">
                    <h3>Accepted Tokens</h3>
                    <ul>
                        ${model.auth.tokenTypes.map((tokenType) => `<li>${escapeHtml(tokenType)}</li>`).join("")}
                    </ul>
                </div>
                <div class="panel">
                    <h3>Scope Notes</h3>
                    <ul>
                        ${model.auth.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
                    </ul>
                </div>
            </div>
            <div class="hero-grid">
                <div class="panel">
                    <h3>Required Headers</h3>
                    <p class="mono-line">${escapeHtml(model.auth.header)}</p>
                    <p class="mono-line" style="margin-top: 10px;">${escapeHtml(model.auth.contentType)}</p>
                </div>
                <div class="panel">
                    <h3>Error Shape</h3>
                    <pre><code>${escapeHtml(JSON.stringify(model.auth.errorShape, null, 2))}</code></pre>
                </div>
                <div class="panel">
                    <h3>Machine-Readable Docs</h3>
                    <p><a href="/docs.json">/docs.json</a></p>
                    <p>Returns the same endpoint catalog backing this page.</p>
                </div>
            </div>
        </section>

        <div class="toolbar">
            <nav class="toolbar-nav">
                ${model.sections.map((section) => `<a href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}</a>`).join("")}
            </nav>
            <input id="endpoint-search" type="search" placeholder="Filter endpoints by method, path, or capability" />
        </div>

        ${model.sections.map((section) => renderSection(model.baseUrl, section)).join("")}

        <section class="footer">
            <h2>Related Session-Only Routes</h2>
            <p>These endpoints matter for account bootstrap and browser flows, but they are not directly bearer-token capable unless explicitly noted.</p>
            <ul>
                ${model.relatedSessionRoutes.map((route) => `<li><strong>${escapeHtml(route.method)} ${escapeHtml(route.path)}</strong> - ${escapeHtml(route.summary)}</li>`).join("")}
            </ul>
        </section>
    </main>

    <script>
        const input = document.getElementById("endpoint-search");
        const cards = Array.from(document.querySelectorAll(".endpoint-card"));

        input?.addEventListener("input", (event) => {
            const value = String(event.target.value || "").trim().toLowerCase();

            for (const card of cards) {
                const text = card.getAttribute("data-search") || "";
                card.style.display = !value || text.includes(value) ? "" : "none";
            }
        });
    </script>
</body>
</html>`;
}
