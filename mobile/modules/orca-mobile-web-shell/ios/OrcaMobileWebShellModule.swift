import ExpoModulesCore

public class OrcaMobileWebShellModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OrcaMobileWebShell")

    View(OrcaMobileWebShellView.self) {
      Events("onLoadState", "onBridgeMessage", "onExternalNavigation", "onPagePathname")

      Prop("generationDirectory") { (view: OrcaMobileWebShellView, value: String) in
        view.setGenerationDirectory(value)
      }

      Prop("sessionId") { (view: OrcaMobileWebShellView, value: String) in
        view.setSessionId(value)
      }

      Prop("bridgeEnabled") { (view: OrcaMobileWebShellView, value: Bool) in
        view.setBridgeEnabled(value)
      }

      AsyncFunction("postBridgeMessage") {
        (view: OrcaMobileWebShellView, json: String, promise: Promise) in
        try view.postBridgeMessage(json, promise: promise)
      }

      AsyncFunction("measureActiveTab") { (view: OrcaMobileWebShellView, promise: Promise) in
        view.measureActiveTab(promise)
      }

      OnViewDidUpdateProps { (view: OrcaMobileWebShellView) in
        view.propsDidUpdate()
      }
    }
  }
}
