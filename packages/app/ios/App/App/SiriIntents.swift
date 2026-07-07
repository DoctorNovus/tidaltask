import AppIntents
import Foundation
import Security

private let defaultApiBaseUrl = "https://api.tidaltask.app"
private let tokenService = "com.ottegi.sequenced.deviceToken"
private let tokenAccount = "siri"

private func loadDeviceToken() -> String? {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: tokenService,
        kSecAttrAccount as String: tokenAccount,
        kSecReturnData as String: true,
        kSecMatchLimit as String: kSecMatchLimitOne
    ]
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    if status == errSecSuccess, let data = item as? Data, let token = String(data: data, encoding: .utf8) {
        return token
    }
    return UserDefaults.standard.string(forKey: "siriDeviceToken")
        ?? UserDefaults(suiteName: "group.com.ottegi.sequenced-app")?.string(forKey: "deviceToken")
}

private func buildRequest(path: String, method: String, body: [String: Any]? = nil) throws -> URLRequest {
    guard let url = URL(string: defaultApiBaseUrl + path) else { throw URLError(.badURL) }
    guard let apiKey = loadDeviceToken() else {
        throw NSError(domain: "TidalTask", code: 401, userInfo: [NSLocalizedDescriptionKey: "Open TidalTask first to enable Siri integration."])
    }
    var request = URLRequest(url: url, timeoutInterval: 10)
    request.httpMethod = method
    request.addValue("application/json", forHTTPHeaderField: "Content-Type")
    request.addValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
    if let body { request.httpBody = try JSONSerialization.data(withJSONObject: body) }
    return request
}

// MARK: - Add Task

struct AddTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Add a task"
    static var description = IntentDescription("Add a new task to TidalTask.")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Title", requestValueDialog: "What should the task be called?")
    var title: String

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return .result(dialog: "Please provide a task title.")
        }
        let today = ISO8601DateFormatter().string(from: Date())
        let body: [String: Any] = ["title": trimmed, "date": today, "done": false]
        let request = try buildRequest(path: "/task", method: "POST", body: body)
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            return .result(dialog: "Couldn't add the task. Try opening TidalTask first.")
        }
        return .result(dialog: "Added \"\(trimmed)\" to TidalTask.")
    }
}

// MARK: - View Today's Tasks

struct ViewTodaysTasksIntent: AppIntent {
    static var title: LocalizedStringResource = "View today's tasks"
    static var description = IntentDescription("See your tasks for today in TidalTask.")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let request = try buildRequest(path: "/task", method: "GET")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              let tasks = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
        else {
            return .result(dialog: "Couldn't fetch your tasks. Make sure you're logged in to TidalTask.")
        }
        let todayPrefix = String(ISO8601DateFormatter().string(from: Date()).prefix(10))
        let todayTasks = tasks.filter { ($0["date"] as? String ?? "").prefix(10) == todayPrefix }
            .filter {
                switch $0["done"] {
                case let b as Bool: return !b
                default: return true
                }
            }
        if todayTasks.isEmpty {
            return .result(dialog: "You have no tasks for today in TidalTask. All clear!")
        }
        let titles = todayTasks.prefix(3).compactMap { $0["title"] as? String }
        let preview = titles.joined(separator: ", ")
        let count = todayTasks.count
        if count <= 3 {
            return .result(dialog: "You have \(count) task\(count == 1 ? "" : "s") today: \(preview).")
        }
        return .result(dialog: "You have \(count) tasks today. Up first: \(preview), and more.")
    }
}

// MARK: - View Overdue Tasks

struct DueTasksIntent: AppIntent {
    static var title: LocalizedStringResource = "View overdue tasks"
    static var description = IntentDescription("Get your overdue tasks from TidalTask.")
    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let request = try buildRequest(path: "/task/overdue", method: "GET")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              let json = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
        else {
            return .result(dialog: "Couldn't fetch overdue tasks right now.")
        }
        let tasks = json.compactMap { $0["title"] as? String }
        if tasks.isEmpty {
            return .result(dialog: "No overdue tasks in TidalTask. Great work!")
        }
        let preview = tasks.prefix(3).joined(separator: ", ")
        return tasks.count <= 3
            ? .result(dialog: "You have \(tasks.count) overdue task\(tasks.count == 1 ? "" : "s"): \(preview).")
            : .result(dialog: "You have \(tasks.count) overdue tasks. \(preview), and more.")
    }
}

// MARK: - App Shortcuts (Siri phrases & Spotlight)

struct TidalTaskShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AddTaskIntent(),
            phrases: [
                "Add a task in \(.applicationName)",
                "Add task in \(.applicationName)",
                "Create a task in \(.applicationName)",
                "Create task in \(.applicationName)",
                "New task in \(.applicationName)",
                "New to-do in \(.applicationName)",
                "Make a task in \(.applicationName)",
                "Log a task in \(.applicationName)",
                "Add to \(.applicationName)",
                "Remind me in \(.applicationName)",
            ],
            shortTitle: "Add Task",
            systemImageName: "plus.circle.fill"
        )
        AppShortcut(
            intent: ViewTodaysTasksIntent(),
            phrases: [
                "Show my tasks in \(.applicationName)",
                "Show tasks in \(.applicationName)",
                "What are my tasks in \(.applicationName)",
                "What tasks do I have in \(.applicationName)",
                "Get my tasks from \(.applicationName)",
                "Fetch my tasks in \(.applicationName)",
                "View my tasks in \(.applicationName)",
                "Check tasks in \(.applicationName)",
                "Show today's tasks in \(.applicationName)",
                "Open \(.applicationName)",
            ],
            shortTitle: "Today's Tasks",
            systemImageName: "list.bullet"
        )
        AppShortcut(
            intent: DueTasksIntent(),
            phrases: [
                "What's overdue in \(.applicationName)",
                "What tasks are overdue in \(.applicationName)",
                "What tasks are due in \(.applicationName)",
                "Any overdue tasks in \(.applicationName)",
                "Show overdue tasks in \(.applicationName)",
                "Get overdue tasks from \(.applicationName)",
                "Fetch overdue tasks from \(.applicationName)",
                "What's past due in \(.applicationName)",
                "Show late tasks in \(.applicationName)",
                "What am I behind on in \(.applicationName)",
            ],
            shortTitle: "Overdue Tasks",
            systemImageName: "exclamationmark.circle.fill"
        )
    }
}
