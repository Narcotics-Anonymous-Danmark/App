import Foundation
import GoogleCast

/**
 * Cordova plugin wrapping the Google Cast iOS sender SDK (google-cast-sdk-no-bluetooth).
 *
 * Contract: see www/na-cast.js. One `listen` callback carries both session and
 * media events; per-call actions get their own callbackId.
 *
 * Portability: apart from `CDVInvokedUrlCommand`/`commandDelegate`, the SDK wiring
 * (context options, session manager listener, remote media client listener,
 * load/play/pause/seek/position) is what a Flutter plugin would call verbatim.
 *
 * `available` is reported as true as soon as the context exists: the SDK is told
 * to defer device discovery until the first tap, so iOS 14's local-network prompt
 * appears in response to a user action rather than at app launch.
 */
@objc(NaCast)
class NaCast: CDVPlugin, GCKSessionManagerListener, GCKRemoteMediaClientListener, GCKRequestDelegate {

    private var listenCallbackId: String?
    private var initialized = false
    private var remoteMediaClient: GCKRemoteMediaClient?
    private var loadCallbacks: [Int: String] = [:]

    private var castContext: GCKCastContext? {
        return GCKCastContext.isSharedInstanceInitialized() ? GCKCastContext.sharedInstance() : nil
    }

    @objc(listen:)
    func listen(_ command: CDVInvokedUrlCommand) {
        listenCallbackId = command.callbackId
        let result = CDVPluginResult(status: CDVCommandStatus_NO_RESULT)
        result?.setKeepCallbackAs(true)
        commandDelegate.send(result, callbackId: command.callbackId)
        if initialized {
            emitSessionState()
        }
    }

    @objc(initialize:)
    func initialize(_ command: CDVInvokedUrlCommand) {
        if !initialized {
            if !GCKCastContext.isSharedInstanceInitialized() {
                let appId = receiverAppId()
                let criteria = GCKDiscoveryCriteria(applicationID: appId)
                let options = GCKCastOptions(discoveryCriteria: criteria)
                options.physicalVolumeButtonsWillControlDeviceVolume = true
                options.startDiscoveryAfterFirstTapOnCastButton = true
                options.suspendSessionsWhenBackgrounded = false
                options.stopReceiverApplicationWhenEndingSession = true
                GCKCastContext.setSharedInstanceWith(options)
            }
            let context = GCKCastContext.sharedInstance()
            context.sessionManager.add(self)
            if let session = context.sessionManager.currentCastSession,
               session.connectionState == .connected {
                attach(session)
            }
            initialized = true
        }
        commandDelegate.send(
            CDVPluginResult(status: CDVCommandStatus_OK, messageAs: sessionStateDict()),
            callbackId: command.callbackId
        )
        emitSessionState()
    }

    @objc(requestSession:)
    func requestSession(_ command: CDVInvokedUrlCommand) {
        guard let context = castContext else {
            fail(command, "Cast is not initialized")
            return
        }
        context.discoveryManager.startDiscovery()
        context.presentCastDialog()
        ok(command)
    }

    @objc(endSession:)
    func endSession(_ command: CDVInvokedUrlCommand) {
        guard let context = castContext else {
            fail(command, "Cast is not initialized")
            return
        }
        let stopReceiver = (command.argument(at: 0) as? Bool) ?? true
        context.sessionManager.endSessionAndStopCasting(stopReceiver)
        ok(command)
    }

    @objc(loadMedia:)
    func loadMedia(_ command: CDVInvokedUrlCommand) {
        guard let client = remoteMediaClient else {
            fail(command, "No Cast session")
            return
        }
        let media = (command.argument(at: 0) as? [String: Any]) ?? [:]
        guard let urlString = media["url"] as? String, let url = URL(string: urlString) else {
            fail(command, "loadMedia requires a url")
            return
        }

        let metadata = GCKMediaMetadata(metadataType: .musicTrack)
        metadata.setString((media["title"] as? String) ?? "", forKey: kGCKMetadataKeyTitle)
        metadata.setString((media["artist"] as? String) ?? "", forKey: kGCKMetadataKeyArtist)

        let builder = GCKMediaInformationBuilder(contentURL: url)
        builder.streamType = .buffered
        builder.contentType = (media["contentType"] as? String) ?? "audio/mpeg"
        builder.metadata = metadata
        let duration = Self.number(media["duration"])
        if duration > 0 {
            builder.streamDuration = duration
        }

        let options = GCKMediaLoadOptions()
        options.autoplay = (media["autoplay"] as? Bool) ?? true
        options.playPosition = max(0, Self.number(media["position"]))

        let request = client.loadMedia(builder.build(), with: options)
        request.delegate = self
        loadCallbacks[request.requestID] = command.callbackId
    }

    @objc(play:)
    func play(_ command: CDVInvokedUrlCommand) {
        withMedia(command) { $0.play() }
    }

    @objc(pause:)
    func pause(_ command: CDVInvokedUrlCommand) {
        withMedia(command) { $0.pause() }
    }

    @objc(seek:)
    func seek(_ command: CDVInvokedUrlCommand) {
        let seconds = max(0, Self.number(command.argument(at: 0)))
        withMedia(command) { client in
            let options = GCKMediaSeekOptions()
            options.interval = seconds
            client.seek(with: options)
        }
    }

    @objc(getPosition:)
    func getPosition(_ command: CDVInvokedUrlCommand) {
        let position = remoteMediaClient?.approximateStreamPosition() ?? 0
        commandDelegate.send(
            CDVPluginResult(status: CDVCommandStatus_OK, messageAs: max(0, position)),
            callbackId: command.callbackId
        )
    }

    func sessionManager(_ sessionManager: GCKSessionManager, willStart session: GCKCastSession) { emitSessionState() }
    func sessionManager(_ sessionManager: GCKSessionManager, didStart session: GCKCastSession) { attach(session) }
    func sessionManager(_ sessionManager: GCKSessionManager, didFailToStart session: GCKCastSession, withError error: Error) { detach() }
    func sessionManager(_ sessionManager: GCKSessionManager, willEnd session: GCKCastSession) { emitSessionState() }
    func sessionManager(_ sessionManager: GCKSessionManager, didEnd session: GCKCastSession, withError error: Error?) { detach() }
    func sessionManager(_ sessionManager: GCKSessionManager, willResumeCastSession session: GCKCastSession) { emitSessionState() }
    func sessionManager(_ sessionManager: GCKSessionManager, didResumeCastSession session: GCKCastSession) { attach(session) }
    func sessionManager(_ sessionManager: GCKSessionManager, didSuspend session: GCKCastSession, with reason: GCKConnectionSuspendReason) { emitSessionState() }

    func remoteMediaClient(_ client: GCKRemoteMediaClient, didUpdate mediaStatus: GCKMediaStatus?) {
        emitMediaStatus()
    }

    func remoteMediaClient(_ client: GCKRemoteMediaClient, didUpdate mediaMetadata: GCKMediaMetadata?) {
        emitMediaStatus()
    }

    func requestDidComplete(_ request: GCKRequest) {
        guard let callbackId = loadCallbacks.removeValue(forKey: request.requestID) else { return }
        commandDelegate.send(CDVPluginResult(status: CDVCommandStatus_OK), callbackId: callbackId)
    }

    func request(_ request: GCKRequest, didFailWithError error: GCKError) {
        guard let callbackId = loadCallbacks.removeValue(forKey: request.requestID) else { return }
        commandDelegate.send(
            CDVPluginResult(status: CDVCommandStatus_ERROR, messageAs: "Load failed: \(error.localizedDescription)"),
            callbackId: callbackId
        )
    }

    func request(_ request: GCKRequest, didAbortWith abortReason: GCKRequestAbortReason) {
        guard let callbackId = loadCallbacks.removeValue(forKey: request.requestID) else { return }
        commandDelegate.send(
            CDVPluginResult(status: CDVCommandStatus_ERROR, messageAs: "Load aborted (\(abortReason.rawValue))"),
            callbackId: callbackId
        )
    }

    private func attach(_ session: GCKCastSession) {
        let client = session.remoteMediaClient
        if client !== remoteMediaClient {
            remoteMediaClient?.remove(self)
            remoteMediaClient = client
            client?.add(self)
        }
        emitSessionState()
        emitMediaStatus()
    }

    private func detach() {
        remoteMediaClient?.remove(self)
        remoteMediaClient = nil
        emitSessionState()
    }

    private func withMedia(_ command: CDVInvokedUrlCommand, _ block: (GCKRemoteMediaClient) -> Void) {
        guard let client = remoteMediaClient else {
            fail(command, "No Cast session")
            return
        }
        block(client)
        ok(command)
    }

    private func sessionStateDict() -> [String: Any] {
        let session = castContext?.sessionManager.currentCastSession
        let state = session?.connectionState ?? .disconnected
        let connected = state == .connected
        return [
            "type": "session",
            "available": initialized,
            "connected": connected,
            "connecting": state == .connecting,
            "deviceName": (connected ? session?.device.friendlyName : nil) ?? NSNull()
        ]
    }

    private func emitSessionState() {
        emit(sessionStateDict())
    }

    private func emitMediaStatus() {
        guard let client = remoteMediaClient else { return }
        let status = client.mediaStatus
        let playerState = status?.playerState ?? .unknown
        let idleReason: Any = playerState == .idle
            ? Self.idleReasonName(status?.idleReason ?? .none)
            : NSNull()
        emit([
            "type": "media",
            "playerState": Self.playerStateName(playerState),
            "idleReason": idleReason,
            "position": max(0, client.approximateStreamPosition()),
            "duration": max(0, status?.mediaInformation?.streamDuration ?? 0)
        ])
    }

    private func emit(_ payload: [String: Any]) {
        guard let callbackId = listenCallbackId else { return }
        let result = CDVPluginResult(status: CDVCommandStatus_OK, messageAs: payload)
        result?.setKeepCallbackAs(true)
        commandDelegate.send(result, callbackId: callbackId)
    }

    private func ok(_ command: CDVInvokedUrlCommand) {
        commandDelegate.send(CDVPluginResult(status: CDVCommandStatus_OK), callbackId: command.callbackId)
    }

    private func fail(_ command: CDVInvokedUrlCommand, _ message: String) {
        commandDelegate.send(CDVPluginResult(status: CDVCommandStatus_ERROR, messageAs: message), callbackId: command.callbackId)
    }

    private func receiverAppId() -> String {
        if let id = Bundle.main.object(forInfoDictionaryKey: "NaCastReceiverAppId") as? String,
           !id.trimmingCharacters(in: .whitespaces).isEmpty {
            return id.trimmingCharacters(in: .whitespaces)
        }
        return kGCKDefaultMediaReceiverApplicationID
    }

    private static func number(_ value: Any?) -> Double {
        if let d = value as? Double { return d }
        if let n = value as? NSNumber { return n.doubleValue }
        if let s = value as? String, let d = Double(s) { return d }
        return 0
    }

    private static func playerStateName(_ state: GCKMediaPlayerState) -> String {
        switch state {
        case .idle: return "IDLE"
        case .playing: return "PLAYING"
        case .paused: return "PAUSED"
        case .buffering: return "BUFFERING"
        case .loading: return "LOADING"
        default: return "UNKNOWN"
        }
    }

    private static func idleReasonName(_ reason: GCKMediaPlayerIdleReason) -> String {
        switch reason {
        case .finished: return "FINISHED"
        case .cancelled: return "CANCELLED"
        case .interrupted: return "INTERRUPTED"
        case .error: return "ERROR"
        default: return "NONE"
        }
    }
}
