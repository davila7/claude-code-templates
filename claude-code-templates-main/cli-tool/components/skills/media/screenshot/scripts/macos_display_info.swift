import AppKit
import Foundation

struct Response: Encodable {
  let count: Int
  let displays: [Int]
}

let count = max(NSScreen.screens.count, 1)
let displays = Array(1...count)

let response = Response(count: count, displays: displays)
let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys]

if let data = try? encoder.encode(response),
   let json = String(data: data, encoding: .utf8) {
  print(json)
} else {
  fputs("{\"count\":\(count)}\n", stderr)
  exit(1)
}
