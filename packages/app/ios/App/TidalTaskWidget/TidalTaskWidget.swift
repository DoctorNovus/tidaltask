import WidgetKit
import SwiftUI

// MARK: - API Models

private let apiBase = "https://api.tidaltask.app"
private let appGroupID = "group.com.ottegi.sequenced-app"

fileprivate enum DoneValue: Codable {
    case bool(Bool)
    case dates([String])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .bool(false); return }
        if let b = try? c.decode(Bool.self) { self = .bool(b); return }
        if let d = try? c.decode([String].self) { self = .dates(d); return }
        self = .bool(false)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .bool(let b): try c.encode(b)
        case .dates(let d): try c.encode(d)
        }
    }
}

fileprivate struct APITask: Codable {
    let id: String?
    let title: String
    let date: String?
    let done: DoneValue?
    let repeater: String?
    let priority: Int?
}

// MARK: - Task Logic (mirrors widgetSync.ts / data.ts)

private let cal = Calendar.current

private func parseTaskDate(_ str: String?) -> Date? {
    guard let str, !str.isEmpty else { return nil }
    // Take only the YYYY-MM-DD portion and interpret it as a local calendar date,
    // matching JS normalizeDay (setHours 0,0,0,0). Parsing the full UTC timestamp
    // would shift the date by the device's UTC offset.
    let datePart = String(str.prefix(10))
    let fmt = DateFormatter()
    fmt.locale = Locale(identifier: "en_US_POSIX")
    fmt.timeZone = .current
    fmt.dateFormat = "yyyy-MM-dd"
    return fmt.date(from: datePart)
}

private func startOfDay(_ date: Date) -> Date { cal.startOfDay(for: date) }

private func occursOnDay(_ task: APITask, target: Date) -> Bool {
    guard let raw = task.date, !raw.isEmpty,
          let start = parseTaskDate(raw) else { return false }
    let s = startOfDay(start)
    let t = startOfDay(target)
    guard cal.component(.year, from: s) >= 2000, t >= s else { return false }

    switch task.repeater ?? "" {
    case "daily":   return true
    case "weekly":  return cal.component(.weekday, from: s) == cal.component(.weekday, from: t)
    case "bi-weekly":
        let days = cal.dateComponents([.day], from: s, to: t).day ?? 0
        return days % 14 == 0
    case "monthly": return cal.component(.day, from: s) == cal.component(.day, from: t)
    case "6-monthly":
        if cal.component(.day, from: s) != cal.component(.day, from: t) { return false }
        let months = cal.dateComponents([.month], from: s, to: t).month ?? 0
        return months % 6 == 0
    case "yearly":
        return cal.component(.month, from: s) == cal.component(.month, from: t)
            && cal.component(.day,   from: s) == cal.component(.day,   from: t)
    case "":
        return cal.isDate(s, inSameDayAs: t)
    default:
        return cal.isDate(s, inSameDayAs: t)
    }
}

// Returns true when the task is still pending (mirrors isTaskDone returning true = pending)
private func isPending(_ task: APITask, on day: Date) -> Bool {
    let hasRepeater = !(task.repeater ?? "").isEmpty
    if !hasRepeater {
        switch task.done {
        case .bool(true): return false
        default: return true
        }
    }
    guard occursOnDay(task, target: day) else { return false }
    switch task.done {
    case .bool(let b): return !b
    case .dates(let strs):
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let completed = strs.contains { str in
            guard let d = iso.date(from: str) else { return false }
            return cal.isDate(d, inSameDayAs: day)
        }
        return !completed
    case .none: return true
    }
}

private func isOverdue(_ task: APITask, today: Date) -> Bool {
    guard let raw = task.date, !raw.isEmpty,
          let start = parseTaskDate(raw) else { return false }
    guard (task.repeater ?? "").isEmpty else { return false }
    let s = startOfDay(start)
    let t = startOfDay(today)
    return s < t && isPending(task, on: today)
}

// MARK: - Network Fetch

extension WidgetData {
    private static func diag(_ msg: String) -> WidgetData {
        WidgetData(todayCount: 0, overdueCount: 0, totalIncomplete: 0,
                   completedToday: 0, upcomingTasks: [], lastUpdated: msg)
    }

    static func fetch() async -> WidgetData {
        guard let defaults = UserDefaults(suiteName: appGroupID) else {
            return diag("no app group")
        }
        guard let token = defaults.string(forKey: "deviceToken"), !token.isEmpty else {
            return diag("no token — open app")
        }
        guard let url = URL(string: "\(apiBase)/task") else {
            return diag("bad url")
        }

        var req = URLRequest(url: url, timeoutInterval: 10)
        req.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.addValue("application/json", forHTTPHeaderField: "Content-Type")

        do {
            let (data, response) = try await URLSession.shared.data(for: req)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                let code = (response as? HTTPURLResponse)?.statusCode ?? -1
                return diag("api \(code)")
            }
            let tasks = try JSONDecoder().decode([APITask].self, from: data)
            let result = WidgetData.from(tasks: tasks)
            // Cache the fresh result so the fallback stays warm
            if let encoded = try? JSONEncoder().encode(result) {
                defaults.set(encoded, forKey: "widgetData")
            }
            return result
        } catch {
            return diag("fetch error: \(error.localizedDescription)")
        }
    }

    fileprivate static func from(tasks: [APITask]) -> WidgetData {
        let today = startOfDay(Date())
        let now = Date()

        let tomorrow = cal.date(byAdding: .day, value: 1, to: today)!

        let todayTasks  = tasks.filter { occursOnDay($0, target: today) }
        let todayCount  = todayTasks.filter { isPending($0, on: today) }.count
        let completedToday = todayTasks.filter { !isPending($0, on: today) }.count
        let overdueCount = tasks.filter { isOverdue($0, today: today) }.count
        let incomplete   = tasks.filter { isPending($0, on: today) }

        let tomorrowCount = tasks.filter { occursOnDay($0, target: tomorrow) && isPending($0, on: tomorrow) }.count

        // Distinct tasks that occur on at least one of the next 7 days (including today)
        let weekCount = tasks.filter { task in
            (0...6).contains { offset in
                let day = cal.date(byAdding: .day, value: offset, to: today)!
                return occursOnDay(task, target: day) && isPending(task, on: day)
            }
        }.count

        // Mirror HomeUpcoming: all non-done tasks, sortByDate then sortByPriority (priority wins)
        let upcoming: [WidgetTask] = tasks
            .filter { task in
                switch task.done {
                case .bool(true): return false
                default: return true
                }
            }
            .sorted {
                let pa = $0.priority ?? 0, pb = $1.priority ?? 0
                if pa != pb { return pa > pb }
                let da = parseTaskDate($0.date)?.timeIntervalSince1970 ?? Double.greatestFiniteMagnitude
                let db = parseTaskDate($1.date)?.timeIntervalSince1970 ?? Double.greatestFiniteMagnitude
                return da < db
            }
            .prefix(7)
            .map {
                var label: String?
                if let d = parseTaskDate($0.date) {
                    let c = cal.dateComponents([.month, .day], from: d)
                    label = "\(c.month!)/\(c.day!)"
                }
                return WidgetTask(id: $0.id ?? $0.title, title: $0.title, date: label, priority: $0.priority)
            }

        let h = cal.component(.hour, from: now)
        let m = cal.component(.minute, from: now)
        let lastUpdated = String(format: "%d:%02d", h, m)

        return WidgetData(
            todayCount: todayCount,
            tomorrowCount: tomorrowCount,
            weekCount: weekCount,
            overdueCount: overdueCount,
            totalIncomplete: incomplete.count,
            completedToday: completedToday,
            upcomingTasks: Array(upcoming),
            lastUpdated: lastUpdated
        )
    }
}

// MARK: - Shared Data Model

struct WidgetTask: Codable, Identifiable {
    let id: String
    let title: String
    let date: String?
    let priority: Int?
}

struct WidgetData: Codable {
    var todayCount: Int = 0
    var tomorrowCount: Int = 0
    var weekCount: Int = 0
    var overdueCount: Int = 0
    var totalIncomplete: Int = 0
    var completedToday: Int = 0
    var upcomingTasks: [WidgetTask] = []
    var lastUpdated: String?

    static let placeholder = WidgetData(
        todayCount: 0,
        overdueCount: 0,
        totalIncomplete: 0,
        completedToday: 0,
        upcomingTasks: [],
        lastUpdated: "no data — open app"
    )

    static func load() -> WidgetData {
        guard
            let defaults = UserDefaults(suiteName: "group.com.ottegi.sequenced-app"),
            let data = defaults.data(forKey: "widgetData"),
            let decoded = try? JSONDecoder().decode(WidgetData.self, from: data)
        else {
            return .placeholder
        }
        return decoded
    }
}

// MARK: - Timeline Provider

struct TidalTaskEntry: TimelineEntry {
    let date: Date
    let widgetData: WidgetData
    let isPlaceholder: Bool
}

struct TidalTaskProvider: TimelineProvider {
    func placeholder(in context: Context) -> TidalTaskEntry {
        TidalTaskEntry(date: .now, widgetData: .placeholder, isPlaceholder: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (TidalTaskEntry) -> Void) {
        if context.isPreview {
            completion(TidalTaskEntry(date: .now, widgetData: .placeholder, isPlaceholder: false))
            return
        }
        Task {
            let data = await WidgetData.fetch()
            completion(TidalTaskEntry(date: .now, widgetData: data, isPlaceholder: false))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TidalTaskEntry>) -> Void) {
        Task {
            let data = await WidgetData.fetch()
            let entry = TidalTaskEntry(date: .now, widgetData: data, isPlaceholder: false)
            let nextRefresh = Calendar.current.date(byAdding: .minute, value: 30, to: .now)!
            completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
        }
    }
}

// MARK: - Colors

extension Color {
    static let accentBlue     = Color(red: 0.19, green: 0.48, blue: 0.81)
    static let accentBlueMed  = Color(red: 0.22, green: 0.53, blue: 0.85)
    static let overduePink    = Color(red: 0.95, green: 0.35, blue: 0.35)
    static let cardBg         = Color("WidgetBackground")
}

// MARK: - Shared Sub-Views

struct StatPill: View {
    let value: Int
    let label: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(value)")
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundStyle(color)
                .contentTransition(.numericText())
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .tracking(0.5)
        }
    }
}

struct TaskRow: View {
    let task: WidgetTask

    private var priorityColor: Color {
        switch task.priority ?? 0 {
        case 3: return .overduePink
        case 2: return Color(red: 0.95, green: 0.65, blue: 0.15)
        case 1: return Color(red: 0.20, green: 0.78, blue: 0.40)
        default: return .secondary
        }
    }

    private var dotColor: Color {
        (task.priority ?? 0) > 0 ? priorityColor : .accentBlue.opacity(0.5)
    }

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(dotColor)
                .frame(width: 6, height: 6)
            Text(task.title)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.primary)
                .lineLimit(1)
            Spacer(minLength: 0)
        }
    }
}

// MARK: - Small Widget (2×2)

struct SmallWidgetView: View {
    let entry: TidalTaskEntry

    var body: some View {
        let d = entry.widgetData

        ZStack {
            Color.cardBg.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                // Header
                HStack(spacing: 4) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.accentBlue)
                    Text("TidalTask")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.accentBlue)
                    Spacer()
                }

                Spacer()

                // Big today number
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(d.todayCount)")
                        .font(.system(size: 44, weight: .heavy, design: .rounded))
                        .foregroundStyle(Color.accentBlue)
                        .contentTransition(.numericText())
                    Text("due today")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)
                        .tracking(0.4)
                }

                Spacer()

                // Footer
                if d.overdueCount > 0 {
                    HStack(spacing: 4) {
                        Image(systemName: "exclamationmark.circle.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(Color.overduePink)
                        Text("\(d.overdueCount) overdue")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Color.overduePink)
                    }
                } else if d.completedToday > 0 {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(Color(red: 0.20, green: 0.78, blue: 0.40))
                        Text("\(d.completedToday) done")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Color(red: 0.20, green: 0.78, blue: 0.40))
                    }
                } else {
                    Text("All clear!")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.secondary)
                }
            }
            .padding(14)
        }
    }
}

// MARK: - Medium Widget (4×2)

struct MediumWidgetView: View {
    let entry: TidalTaskEntry

    var body: some View {
        let d = entry.widgetData

        ZStack {
            Color.cardBg.ignoresSafeArea()

            HStack(alignment: .top, spacing: 0) {
                // Left: today count + secondary stat
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Color.accentBlue)
                        Text("TidalTask")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(Color.accentBlue)
                    }

                    Spacer()

                    Text("\(d.todayCount)")
                        .font(.system(size: 42, weight: .heavy, design: .rounded))
                        .foregroundStyle(Color.accentBlue)
                        .contentTransition(.numericText())
                    Text("due today")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)
                        .tracking(0.4)

                    Spacer().frame(height: 6)

                    if d.overdueCount > 0 {
                        HStack(spacing: 3) {
                            Image(systemName: "exclamationmark.circle.fill")
                                .font(.system(size: 10))
                                .foregroundStyle(Color.overduePink)
                            Text("\(d.overdueCount) overdue")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Color.overduePink)
                        }
                    } else if d.completedToday > 0 {
                        HStack(spacing: 3) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 10))
                                .foregroundStyle(Color(red: 0.20, green: 0.78, blue: 0.40))
                            Text("\(d.completedToday) done")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Color(red: 0.20, green: 0.78, blue: 0.40))
                        }
                    }
                }
                .frame(width: 110, alignment: .leading)
                .padding(.leading, 14)
                .padding(.vertical, 14)

                // Divider
                Rectangle()
                    .fill(Color.primary.opacity(0.08))
                    .frame(width: 1)
                    .padding(.vertical, 10)

                // Right: task list
                VStack(alignment: .leading, spacing: 0) {
                    Text("Up Next")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)
                        .tracking(0.5)
                        .padding(.bottom, 8)

                    if d.upcomingTasks.isEmpty {
                        Spacer()
                        Text("No tasks")
                            .font(.system(size: 12))
                            .foregroundStyle(.secondary)
                        Spacer()
                    } else {
                        VStack(alignment: .leading, spacing: 8) {
                            ForEach(d.upcomingTasks.prefix(3)) { task in
                                TaskRow(task: task)
                            }
                        }
                        Spacer(minLength: 0)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.leading, 12)
                .padding(.trailing, 14)
                .padding(.vertical, 14)
            }
        }
    }
}

// MARK: - Large Widget (4×4)

struct LargeWidgetView: View {
    let entry: TidalTaskEntry

    var body: some View {
        let d = entry.widgetData

        ZStack {
            Color.cardBg.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                // Header row
                HStack {
                    HStack(spacing: 5) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.accentBlue)
                        Text("TidalTask")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Color.accentBlue)
                    }
                    Spacer()
                    if let updated = d.lastUpdated {
                        Text(updated)
                            .font(.system(size: 10))
                            .foregroundStyle(.tertiary)
                    }
                }
                .padding(.bottom, 12)

                // 4-stat row: Today · Tomorrow · This Week · Overdue
                HStack(spacing: 0) {
                    StatPill(value: d.todayCount, label: "Today", color: Color.accentBlue)
                    Spacer()
                    StatPill(value: d.tomorrowCount, label: "Tomorrow", color: Color(red: 0.45, green: 0.55, blue: 0.90))
                    Spacer()
                    StatPill(value: d.weekCount, label: "This Week", color: Color(red: 0.25, green: 0.72, blue: 0.58))
                    Spacer()
                    StatPill(value: d.overdueCount, label: "Overdue", color: d.overdueCount > 0 ? Color.overduePink : .secondary)
                }
                .padding(.bottom, 14)

                // Divider
                Rectangle()
                    .fill(Color.primary.opacity(0.08))
                    .frame(height: 1)
                    .padding(.bottom, 10)

                // Task list
                if d.upcomingTasks.isEmpty {
                    Spacer()
                    HStack {
                        Spacer()
                        VStack(spacing: 6) {
                            Image(systemName: "tray")
                                .font(.system(size: 20))
                                .foregroundStyle(.tertiary)
                            Text("No upcoming tasks")
                                .font(.system(size: 12))
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                    }
                    Spacer()
                } else {
                    VStack(alignment: .leading, spacing: 9) {
                        ForEach(d.upcomingTasks.prefix(7)) { task in
                            TaskRow(task: task)
                        }
                    }
                    Spacer(minLength: 0)
                }
            }
            .padding(16)
        }
    }
}

// MARK: - Widget

struct TidalTaskWidget: Widget {
    let kind = "TidalTaskWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TidalTaskProvider()) { entry in
            TidalTaskWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("TidalTask")
        .description("See your tasks and overdue counts at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct TidalTaskWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: TidalTaskEntry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(entry: entry)
        case .systemMedium:
            MediumWidgetView(entry: entry)
        case .systemLarge:
            LargeWidgetView(entry: entry)
        default:
            SmallWidgetView(entry: entry)
        }
    }
}

// MARK: - Preview

#Preview(as: .systemSmall) {
    TidalTaskWidget()
} timeline: {
    TidalTaskEntry(date: .now, widgetData: .placeholder, isPlaceholder: false)
}

#Preview(as: .systemMedium) {
    TidalTaskWidget()
} timeline: {
    TidalTaskEntry(date: .now, widgetData: .placeholder, isPlaceholder: false)
}

#Preview(as: .systemLarge) {
    TidalTaskWidget()
} timeline: {
    TidalTaskEntry(date: .now, widgetData: .placeholder, isPlaceholder: false)
}
