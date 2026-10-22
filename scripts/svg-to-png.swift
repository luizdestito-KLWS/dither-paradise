// Rasterizes an SVG to a transparent PNG with AppKit (macOS 13+ reads SVG natively).
// Usage: swift scripts/svg-to-png.swift in.svg out.png 1024
import AppKit

let args = CommandLine.arguments
guard args.count == 4, let size = Int(args[3]), let image = NSImage(contentsOfFile: args[1]) else {
  fputs("usage: svg-to-png in.svg out.png size\n", stderr); exit(1)
}
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
  samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
NSGraphicsContext.current?.imageInterpolation = .high
image.draw(in: NSRect(x: 0, y: 0, width: size, height: size))
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: args[2]))
