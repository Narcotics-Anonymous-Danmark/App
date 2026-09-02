import AVFoundation
import AVKit
import Foundation
import UIKit

/**
 * In-app AirPlay picker + active-route reporting.
 *
 * showPicker() adds a (nearly invisible) AVRoutePickerView to the view controller
 * and pokes its internal UIButton so the system route sheet opens without the app
 * having to draw Apple's button itself. The button is an implementation detail of
 * AVRoutePickerView, so when it cannot be found the picker view is shown for real
 * (centred, full opacity) as a fallback and the user taps it. Either way the view
 * is removed once the sheet is dismissed (AVRoutePickerViewDelegate).
 *
 * Route changes come from AVAudioSession.routeChangeNotification; "AirPlay" means
 * the current route has an output port of type .airPlay.
 */
@objc(NaAirPlay)
class NaAirPlay: CDVPlugin, AVRoutePickerViewDelegate {

    private var routeCallbackId: String?
    private var picker: AVRoutePickerView?
    private var fallbackBackdrop: UIView?

    override func pluginInitialize() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(routeChanged(_:)),
            name: AVAudioSession.routeChangeNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc(showPicker:)
    func showPicker(_ command: CDVInvokedUrlCommand) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let host = self.viewController?.view else {
                self?.fail(command, "No view controller")
                return
            }
            self.removePicker()

            let picker = AVRoutePickerView(frame: CGRect(x: 0, y: 0, width: 44, height: 44))
            picker.center = host.center
            picker.prioritizesVideoDevices = false
            picker.delegate = self
            picker.alpha = 0.02
            host.addSubview(picker)
            self.picker = picker

            if let button = Self.findButton(in: picker) {
                button.sendActions(for: .touchUpInside)
            } else {
                self.showFallback(picker, in: host)
            }
            self.ok(command)
        }
    }

    @objc(getRoute:)
    func getRoute(_ command: CDVInvokedUrlCommand) {
        commandDelegate.send(
            CDVPluginResult(status: CDVCommandStatus_OK, messageAs: Self.currentRoute()),
            callbackId: command.callbackId
        )
    }

    @objc(onRouteChange:)
    func onRouteChange(_ command: CDVInvokedUrlCommand) {
        routeCallbackId = command.callbackId
        let result = CDVPluginResult(status: CDVCommandStatus_OK, messageAs: Self.currentRoute())
        result?.setKeepCallbackAs(true)
        commandDelegate.send(result, callbackId: command.callbackId)
    }

    func routePickerViewDidEndPresentingRoutes(_ routePickerView: AVRoutePickerView) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.removePicker()
        }
    }

    @objc private func routeChanged(_ notification: Notification) {
        guard let callbackId = routeCallbackId else { return }
        DispatchQueue.main.async { [weak self] in
            let result = CDVPluginResult(status: CDVCommandStatus_OK, messageAs: Self.currentRoute())
            result?.setKeepCallbackAs(true)
            self?.commandDelegate.send(result, callbackId: callbackId)
        }
    }

    private static func currentRoute() -> [String: Any] {
        let outputs = AVAudioSession.sharedInstance().currentRoute.outputs
        let airplay = outputs.contains { $0.portType == .airPlay }
        let primary = outputs.first { $0.portType == .airPlay } ?? outputs.first
        return [
            "airplay": airplay,
            "routeName": primary?.portName ?? "",
            "portType": primary?.portType.rawValue ?? ""
        ]
    }

    private static func findButton(in view: UIView) -> UIButton? {
        for subview in view.subviews {
            if let button = subview as? UIButton {
                return button
            }
            if let nested = findButton(in: subview) {
                return nested
            }
        }
        return nil
    }

    private func showFallback(_ picker: AVRoutePickerView, in host: UIView) {
        let backdrop = UIControl(frame: host.bounds)
        backdrop.backgroundColor = UIColor.black.withAlphaComponent(0.4)
        backdrop.addTarget(self, action: #selector(dismissFallback), for: .touchUpInside)
        host.insertSubview(backdrop, belowSubview: picker)
        fallbackBackdrop = backdrop

        picker.alpha = 1
        picker.frame = CGRect(x: 0, y: 0, width: 88, height: 88)
        picker.center = host.center
        picker.backgroundColor = UIColor.systemBackground
        picker.layer.cornerRadius = 16
        picker.activeTintColor = .systemBlue
        picker.tintColor = .label
    }

    @objc private func dismissFallback() {
        removePicker()
    }

    private func removePicker() {
        picker?.removeFromSuperview()
        picker = nil
        fallbackBackdrop?.removeFromSuperview()
        fallbackBackdrop = nil
    }

    private func ok(_ command: CDVInvokedUrlCommand) {
        commandDelegate.send(CDVPluginResult(status: CDVCommandStatus_OK), callbackId: command.callbackId)
    }

    private func fail(_ command: CDVInvokedUrlCommand, _ message: String) {
        commandDelegate.send(CDVPluginResult(status: CDVCommandStatus_ERROR, messageAs: message), callbackId: command.callbackId)
    }
}
