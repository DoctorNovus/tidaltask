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
        CAPPluginMethod(name: "clearTidalTaskEvents", returnType: CAPPluginReturnPromise)
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

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        guard let date = formatter.date(from: dateStr) else {
            call.reject("Invalid date format. Expected YYYY-MM-DD.")
            return
        }

        let calendar = self.tidaltaskCalendar()
        guard let calendar = calendar else {
            call.reject("Unable to access or create TidalTask calendar.")
            return
        }

        // Remove existing event for this task if any
        removeExistingEvent(taskId: taskId)

        let event = EKEvent(eventStore: store)
        event.title = title
        event.calendar = calendar
        event.isAllDay = true
        event.startDate = date
        event.endDate = date
        event.notes = "\(notePrefix)\(taskId)"

        do {
            try store.save(event, span: .thisEvent)
            call.resolve(["eventId": event.eventIdentifier ?? ""])
        } catch {
            call.reject(error.localizedDescription)
        }
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
        for event in events where event.notes?.hasPrefix(target) == true {
            try? store.remove(event, span: .thisEvent)
        }
    }
}
