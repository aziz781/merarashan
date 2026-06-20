import UIKit
import Capacitor
#if canImport(FirebaseCore)
import FirebaseCore
#endif
#if canImport(FirebaseMessaging)
import FirebaseMessaging
#endif

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Configure Firebase only if GoogleService-Info.plist is bundled.
        // Without this guard, missing config causes an immediate launch crash.
        #if canImport(FirebaseCore)
        if let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
           let options = FirebaseOptions(contentsOfFile: path) {
            if FirebaseApp.app() == nil {
                FirebaseApp.configure(options: options)
            }
        } else {
            NSLog("⚠️ GoogleService-Info.plist not found — Firebase Messaging disabled.")
        }
        #endif
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    // MARK: - Push Notifications (required for @capacitor/push-notifications on iOS)

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        #if canImport(FirebaseMessaging)
        Messaging.messaging().apnsToken = deviceToken
        #endif
        NotificationCenter.default.post(
            name: .capacitorDidRegisterForRemoteNotifications,
            object: deviceToken
        )
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(
            name: .capacitorDidFailToRegisterForRemoteNotifications,
            object: error
        )
    }

    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable : Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        NotificationCenter.default.post(
            name: Notification.Name.init("didReceiveRemoteNotification"),
            object: completionHandler,
            userInfo: userInfo
        )
    }
}
