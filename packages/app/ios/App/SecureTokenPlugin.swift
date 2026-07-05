import Capacitor
import Foundation
import Security

@objc(SecureTokenPlugin)
public class SecureTokenPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SecureTokenPlugin"
    public let jsName = "SecureToken"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearToken", returnType: CAPPluginReturnPromise)
    ]

    private let service = "com.ottegi.sequenced.deviceToken"
    private let account = "siri"
    private let appGroupID = "group.com.ottegi.sequenced-app"

    @objc func setToken(_ call: CAPPluginCall) {
        guard let token = call.getString("token")?.trimmingCharacters(in: .whitespacesAndNewlines), !token.isEmpty else {
            call.reject("Token is required.")
            return
        }

        let data = Data(token.utf8)
        SecItemDelete(queryDictionary() as CFDictionary)
        var query = queryDictionary()
        query[kSecValueData as String] = data
        let status = SecItemAdd(query as CFDictionary, nil)
        if status != errSecSuccess {
            call.reject("Unable to store token.")
            return
        }
        UserDefaults.standard.set(token, forKey: "siriDeviceToken")
        UserDefaults(suiteName: appGroupID)?.set(token, forKey: "deviceToken")
        call.resolve()
    }

    @objc func getToken(_ call: CAPPluginCall) {
        var query = queryDictionary()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status != errSecSuccess || item == nil {
            let fallback = UserDefaults.standard.string(forKey: "siriDeviceToken")
            call.resolve(["token": fallback as Any])
            return
        }

        guard let data = item as? Data, let token = String(data: data, encoding: .utf8) else {
            let fallback = UserDefaults.standard.string(forKey: "siriDeviceToken")
            call.resolve(["token": fallback as Any])
            return
        }
        call.resolve(["token": token])
    }

    @objc func clearToken(_ call: CAPPluginCall) {
        SecItemDelete(queryDictionary() as CFDictionary)
        UserDefaults.standard.removeObject(forKey: "siriDeviceToken")
        UserDefaults(suiteName: appGroupID)?.removeObject(forKey: "deviceToken")
        call.resolve()
    }

    private func queryDictionary() -> [String: Any] {
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }
}
