// key-listener: reports when push-to-talk keys go down and up.
//
// Electron's own shortcuts only report key presses, not releases, so they
// cannot do "hold to talk". This tiny macOS program watches modifier keys
// system-wide and prints one line per change to stdout, which the app reads:
//
//   READY                    listening
//   NO_PERMISSION            macOS has not allowed key monitoring yet
//   DOWN fn / UP fn          the Fn (Globe) key
//   DOWN rightOption / UP rightOption, and so on
//
// Usage: key-listener fn rightOption     (watch just these keys)

import Cocoa

// Key codes from macOS (HIToolbox Events.h), and the "device" flag bit that
// says whether that particular key is held. Using the device bit tells left
// and right Option apart.
let keys: [String: (code: UInt16, isDown: (NSEvent) -> Bool)] = [
    "fn": (63, { $0.modifierFlags.contains(.function) }),
    "rightOption": (61, { $0.modifierFlags.rawValue & 0x40 != 0 }),
    "rightCommand": (54, { $0.modifierFlags.rawValue & 0x10 != 0 }),
    "rightShift": (60, { $0.modifierFlags.rawValue & 0x04 != 0 }),
    "rightControl": (62, { $0.modifierFlags.rawValue & 0x2000 != 0 }),
]

let watched = Set(CommandLine.arguments.dropFirst())
var held = Set<String>()

func say(_ line: String) {
    print(line)
    fflush(stdout)
}

func handle(_ event: NSEvent) {
    for (name, key) in keys where watched.contains(name) && event.keyCode == key.code {
        let down = key.isDown(event)
        // Only report real changes, so a repeated event never starts two recordings.
        if down && !held.contains(name) {
            held.insert(name)
            say("DOWN \(name)")
        } else if !down && held.contains(name) {
            held.remove(name)
            say("UP \(name)")
        }
    }
}

// Watching keys in other apps needs the Accessibility permission.
if !AXIsProcessTrusted() {
    say("NO_PERMISSION")
}

// Events while another app is in front, and while our own window is.
NSEvent.addGlobalMonitorForEvents(matching: .flagsChanged, handler: handle)
NSEvent.addLocalMonitorForEvents(matching: .flagsChanged) { event in
    handle(event)
    return event
}

// Quit when the app that started us goes away (stdin closes).
FileHandle.standardInput.readabilityHandler = { handle in
    if handle.availableData.isEmpty { exit(0) }
}

say("READY")
let app = NSApplication.shared
app.setActivationPolicy(.prohibited) // no Dock icon, no menu bar
app.run()
