import CoreGraphics
import Foundation

struct Status: Encodable {
  let screenCapture: Bool
  let requested: Bool
}

let shouldRequest = CommandLine.arguments.contains("--request")

@available(macOS 10.15, *)
func screenCaptureGranted(request: Bool) -> Bool {
  if CGPreflightScreenCaptureAccess() {
    return true
  }
  if request {
    _ = CGRequestScreenCaptureAccess()
    return CGPreflightScreenCaptureAccess()
  }
  return false
}

let granted: Bool
if #available(macOS 10.15, *) {
  granted = screenCaptureGranted(request: shouldRequest)
} else {
  granted = true
}

let status = Status(screenCapture: granted, requested: shouldRequest)
let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys]

if let data = try? encoder.encode(status),
   let json = String(data: data, encoding: .utf8) {
  print(json)
} else {
  fputs("{\"requested\":\(shouldRequest),\"screenCapture\":\(granted)}\n", stderr)
  exit(1)
}
