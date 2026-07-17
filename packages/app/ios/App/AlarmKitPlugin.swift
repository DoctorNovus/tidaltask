import Capacitor
import Foundation
import AlarmKit
import AppIntents
import SwiftUI

/// AlarmAttributes is generic over a per-alarm metadata type. This plugin doesn't need
/// any extra structured data beyond the title/body it already bakes into the alert, so
/// this is intentionally empty.
struct TidalTaskAlarmMetadata: AlarmMetadata {}

/// Bridges the JS-facing "AlarmNative" plugin (packages/app/src/plugins/alarm.ts) to
/// Apple's AlarmKit framework (iOS 26+, matches this project's deployment target).
/// AlarmKit itself provides the continuous ring (bypasses the silent switch), the
/// Live Activity / Dynamic Island / Lock Screen presentation, and system stop/repeat
/// buttons — this plugin only needs to schedule/cancel alarms and forward taps back
/// into JS so AlarmRingingOverlay can render the actual task/group content.
///
/// NOTE: AlarmKit is a brand-new framework (introduced WWDC 2025 for iOS 26). This shape
/// (AlarmAttributes<Metadata>, AlarmPresentation.Alert, AlarmButton, AlarmManager.AlarmConfiguration)
/// was cross-checked against real usage examples after the first compile attempt caught
/// an earlier, incorrect guess — but it still hasn't been verified against an actual
/// successful build, so treat the exact call shapes here as "best effort, not gospel"
/// until Xcode confirms it compiles clean.
///
/// No App ID capability/entitlement is required — `com.apple.developer.alarmkit` (an
/// earlier guess) is not a real entitlement and was rejected at provisioning time.
/// Access is gated purely by the runtime `requestAuthorization()` call below plus the
/// `NSAlarmKitUsageDescription` Info.plist string.
@objc(AlarmKitPlugin)
public class AlarmKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AlarmKitPlugin"
    public let jsName = "AlarmNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "schedule", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopRinging", returnType: CAPPluginReturnPromise)
    ]

    private let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    override public func load() {
        Task {
            // Prompts once; subsequent calls are no-ops if already authorized/denied.
            _ = try? await AlarmManager.shared.requestAuthorization()
        }
    }

    @objc func schedule(_ call: CAPPluginCall) {
        guard let alarm = call.getObject("alarm"),
              let idString = alarm["id"] as? String,
              let fireAtString = alarm["fireAt"] as? String,
              let title = alarm["title"] as? String else {
            call.reject("alarm.id, alarm.fireAt, and alarm.title are required.")
            return
        }

        guard let fireAt = isoFormatter.date(from: fireAtString) else {
            call.reject("alarm.fireAt must be an ISO-8601 datetime.")
            return
        }

        let body = alarm["body"] as? String ?? ""
        let alarmId = stableUUID(for: idString)
        // AlarmPresentation.Alert only has a title, not a separate body — fold both in.
        let displayTitle = body.isEmpty ? title : "\(title): \(body)"

        Task {
            do {
                try await AlarmManager.shared.cancel(id: alarmId)

                let alertPresentation = AlarmPresentation.Alert(
                    title: LocalizedStringResource(stringLiteral: displayTitle),
                    stopButton: AlarmButton(
                        text: "Dismiss",
                        textColor: .white,
                        systemImageName: "stop.circle"
                    )
                )

                let attributes = AlarmAttributes<TidalTaskAlarmMetadata>(
                    presentation: AlarmPresentation(alert: alertPresentation),
                    tintColor: .accentColor
                )

                let configuration = AlarmManager.AlarmConfiguration(
                    schedule: .fixed(fireAt),
                    attributes: attributes
                )

                try await AlarmManager.shared.schedule(id: alarmId, configuration: configuration)
                call.resolve()
            } catch {
                call.reject("Unable to schedule alarm: \(error.localizedDescription)")
            }
        }
    }

    @objc func cancel(_ call: CAPPluginCall) {
        guard let idString = call.getString("id") else {
            call.reject("id is required.")
            return
        }

        Task {
            do {
                try await AlarmManager.shared.cancel(id: stableUUID(for: idString))
                call.resolve()
            } catch {
                call.reject("Unable to cancel alarm: \(error.localizedDescription)")
            }
        }
    }

    @objc func stopRinging(_ call: CAPPluginCall) {
        guard let idString = call.getString("id") else {
            call.reject("id is required.")
            return
        }

        Task {
            do {
                try await AlarmManager.shared.stop(id: stableUUID(for: idString))
                call.resolve()
            } catch {
                call.reject("Unable to stop alarm: \(error.localizedDescription)")
            }
        }
    }

    /// AlarmKit ids are UUIDs; our alarms use Mongo ObjectId strings, so derive a
    /// stable UUID from the string instead of persisting a separate id mapping.
    private func stableUUID(for value: String) -> UUID {
        var bytes = [UInt8](repeating: 0, count: 16)
        for (index, byte) in Array(value.utf8).enumerated() {
            bytes[index % 16] ^= byte
        }
        return NSUUID(uuidBytes: bytes) as UUID
    }

    /// Call from AppDelegate/scene delegate when the user taps an alarm's Live
    /// Activity or its "Mark Complete" custom action, so JS can show AlarmRingingOverlay.
    func notifyAlarmFired(id: String) {
        notifyListeners("alarmFired", data: ["id": id])
    }
}
