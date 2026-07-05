import Foundation
import Capacitor
import WidgetKit

// App Group identifier — must match the widget extension and entitlements
let appGroupID = "group.com.ottegi.sequenced-app"

@objc(WidgetDataPlugin)
public class WidgetDataPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetDataPlugin"
    public let jsName = "WidgetData"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
    ]

    @objc func update(_ call: CAPPluginCall) {
        guard let json = call.getObject("data") else {
            call.reject("Missing data object")
            return
        }

        guard
            let defaults = UserDefaults(suiteName: appGroupID),
            let encoded = try? JSONSerialization.data(withJSONObject: json)
        else {
            call.reject("Failed to write widget data")
            return
        }

        defaults.set(encoded, forKey: "widgetData")

        // Mirror the device token so the widget can make authenticated API calls
        // without requiring a fresh login cycle.
        if let token = UserDefaults.standard.string(forKey: "siriDeviceToken"), !token.isEmpty {
            defaults.set(token, forKey: "deviceToken")
        }

        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}
