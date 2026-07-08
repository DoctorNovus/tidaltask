import Capacitor
import EventKit
import Foundation

@objc(CalendarPlugin)
public class CalendarPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CalendarPlugin"
    public let jsName = "Calendar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "syncTask", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeEvent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearTidalTaskEvents", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getEvents", returnType: CAPPluginReturnPromise)
    ]

    private let store = EKEventStore()
    private let calendarTitle = "TidalTask"
    private let notePrefix = "tidaltask-id:"

    // MARK: - Permission

    @objc func requestPermission(_ call: CAPPluginCall) {
        if #available(iOS 17.0, *) {
            store.requestFullAccessToEvents { granted, error in
                if let error = error {
                    call.reject(error.localizedDescription)
                    return
                }
                call.resolve(["granted": granted])
            }
        } else {
            store.requestAccess(to: .event) { granted, error in
                if let error = error {
                    call.reject(error.localizedDescription)
                    return
                }
                call.resolve(["granted": granted])
            }
        }
    }

    // MARK: - Sync task

    // Default length for timed (non-all-day) task events, since tasks don't carry a duration.
    private let defaultEventDuration: TimeInterval = 30 * 60

    @objc func syncTask(_ call: CAPPluginCall) {
        guard let taskId = call.getString("taskId"), !taskId.isEmpty else {
            call.reject("taskId is required.")
            return
        }
        guard let title = call.getString("title"), !title.isEmpty else {
            call.reject("title is required.")
            return
        }
        guard let dateStr = call.getString("date"), !dateStr.isEmpty else {
            call.reject("date is required.")
            return
        }
        let description = call.getString("description")

        guard let date = parseInstant(dateStr) else {
            call.reject("Invalid date format.")
            return
        }

        let calendar = self.tidaltaskCalendar()
        guard let calendar = calendar else {
            call.reject("Unable to access or create TidalTask calendar.")
            return
        }

        // Remove existing event for this task if any
        removeExistingEvent(taskId: taskId)

        // A task with no time-of-day set (midnight local) is due "sometime today" — show it
        // as all-day. Otherwise it has a real time, so show it as a timed event.
        let components = Calendar.current.dateComponents([.hour, .minute], from: date)
        let hasTimeOfDay = (components.hour ?? 0) != 0 || (components.minute ?? 0) != 0

        let event = EKEvent(eventStore: store)
        event.title = title
        event.calendar = calendar
        if hasTimeOfDay {
            event.isAllDay = false
            event.startDate = date
            event.endDate = date.addingTimeInterval(defaultEventDuration)
        } else {
            let startOfDay = Calendar.current.startOfDay(for: date)
            event.isAllDay = true
            event.startDate = startOfDay
            event.endDate = startOfDay
        }

        var notes = "\(notePrefix)\(taskId)"
        if let description = description, !description.isEmpty {
            notes = "\(description)\n\n\(notes)"
        }
        event.notes = notes

        do {
            try store.save(event, span: .thisEvent)
            call.resolve(["eventId": event.eventIdentifier ?? ""])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    /// Parses a date sent from JS, which is always a full ISO-8601 UTC instant
    /// (`Date.toISOString()`), falling back to a bare `YYYY-MM-DD` for safety.
    private func parseInstant(_ value: String) -> Date? {
        let withFractional = ISO8601DateFormatter()
        withFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFractional.date(from: value) { return date }

        let withoutFractional = ISO8601DateFormatter()
        withoutFractional.formatOptions = [.withInternetDateTime]
        if let date = withoutFractional.date(from: value) { return date }

        let dateOnly = ISO8601DateFormatter()
        dateOnly.formatOptions = [.withFullDate]
        return dateOnly.date(from: value)
    }

    // MARK: - Remove event

    @objc func removeEvent(_ call: CAPPluginCall) {
        guard let taskId = call.getString("taskId"), !taskId.isEmpty else {
            call.reject("taskId is required.")
            return
        }
        removeExistingEvent(taskId: taskId)
        call.resolve()
    }

    // MARK: - Clear all TidalTask events

    @objc func clearTidalTaskEvents(_ call: CAPPluginCall) {
        guard let calendar = tidaltaskCalendar() else {
            call.resolve()
            return
        }

        let oneYearAgo = Calendar.current.date(byAdding: .year, value: -2, to: Date())!
        let twoYearsAhead = Calendar.current.date(byAdding: .year, value: 2, to: Date())!
        let predicate = store.predicateForEvents(withStart: oneYearAgo, end: twoYearsAhead, calendars: [calendar])
        let events = store.events(matching: predicate)

        for event in events {
            try? store.remove(event, span: .thisEvent)
        }
        call.resolve()
    }

    // MARK: - Get events

    @objc func getEvents(_ call: CAPPluginCall) {
        guard let startStr = call.getString("start"), !startStr.isEmpty else {
            call.reject("start is required.")
            return
        }
        guard let endStr = call.getString("end"), !endStr.isEmpty else {
            call.reject("end is required.")
            return
        }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        guard let startDate = formatter.date(from: startStr), let endDateRaw = formatter.date(from: endStr) else {
            call.reject("Invalid date format. Expected YYYY-MM-DD.")
            return
        }
        // Make the end date inclusive of the whole day.
        let endDate = Calendar.current.date(byAdding: .day, value: 1, to: endDateRaw) ?? endDateRaw

        let tidaltaskCal = tidaltaskCalendar()
        let calendars = store.calendars(for: .event).filter { $0.title != calendarTitle }

        let predicate = store.predicateForEvents(withStart: startDate, end: endDate, calendars: calendars)
        let events = store.events(matching: predicate)

        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime]

        let result: [[String: Any]] = events.compactMap { event in
            guard let eventId = event.eventIdentifier else { return nil }
            // Defensive: skip events from the TidalTask calendar even if filtering above missed them.
            if let tidaltaskCal = tidaltaskCal, event.calendar?.calendarIdentifier == tidaltaskCal.calendarIdentifier {
                return nil
            }
            return [
                "id": eventId,
                "title": event.title ?? "",
                "startDate": isoFormatter.string(from: event.startDate),
                "endDate": isoFormatter.string(from: event.endDate),
                "isAllDay": event.isAllDay,
                "calendarTitle": event.calendar?.title ?? "",
                "color": hexColor(for: event.calendar)
            ]
        }

        call.resolve(["events": result])
    }

    private func hexColor(for calendar: EKCalendar?) -> String {
        guard let cgColor = calendar?.cgColor else { return "#378bd9" }
        let uiColor = UIColor(cgColor: cgColor)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        uiColor.getRed(&r, green: &g, blue: &b, alpha: &a)
        return String(format: "#%02X%02X%02X", Int(r * 255), Int(g * 255), Int(b * 255))
    }

    // MARK: - Helpers

    private func tidaltaskCalendar() -> EKCalendar? {
        let calendars = store.calendars(for: .event)
        if let existing = calendars.first(where: { $0.title == calendarTitle }) {
            return existing
        }

        // Create a new calendar
        let newCal = EKCalendar(for: .event, eventStore: store)
        newCal.title = calendarTitle

        // Use a local source if iCloud/default not available
        let sources = store.sources
        let calDAVSource = sources.first(where: { $0.sourceType == .calDAV && $0.title == "iCloud" })
        let localSource = sources.first(where: { $0.sourceType == .local })
        guard let source = calDAVSource ?? localSource ?? sources.first else { return nil }
        newCal.source = source

        do {
            try store.saveCalendar(newCal, commit: true)
            return newCal
        } catch {
            return nil
        }
    }

    private func removeExistingEvent(taskId: String) {
        guard let calendar = tidaltaskCalendar() else { return }
        let oneYearAgo = Calendar.current.date(byAdding: .year, value: -2, to: Date())!
        let twoYearsAhead = Calendar.current.date(byAdding: .year, value: 2, to: Date())!
        let predicate = store.predicateForEvents(withStart: oneYearAgo, end: twoYearsAhead, calendars: [calendar])
        let events = store.events(matching: predicate)
        let target = "\(notePrefix)\(taskId)"
        for event in events where event.notes?.contains(target) == true {
            try? store.remove(event, span: .thisEvent)
        }
    }
}
