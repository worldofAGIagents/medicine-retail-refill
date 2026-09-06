import AppKit
import Foundation

let svgUrl = URL(fileURLWithPath: "public/favicon.svg")
guard let svgImage = NSImage(contentsOf: svgUrl) else {
    print("Error: Failed to load public/favicon.svg")
    exit(1)
}

func renderPNG(size: Int) -> Data? {
    let targetSize = NSSize(width: size, height: size)
    let newImage = NSImage(size: targetSize)
    
    newImage.lockFocus()
    NSGraphicsContext.current?.imageInterpolation = .high
    svgImage.draw(in: NSRect(origin: .zero, size: targetSize),
                  from: NSRect(origin: .zero, size: svgImage.size),
                  operation: .copy,
                  fraction: 1.0)
    newImage.unlockFocus()
    
    guard let tiffData = newImage.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiffData),
          let pngData = rep.representation(using: .png, properties: [:]) else {
        return nil
    }
    return pngData
}

let outputs: [(String, Int)] = [
    ("public/web-app-manifest-512x512.png", 512),
    ("public/web-app-manifest-192x192.png", 192),
    ("public/apple-touch-icon.png", 180),
    ("public/favicon-96x96.png", 96),
    ("public/favicon-48x48.png", 48),
    ("public/favicon-32x32.png", 32),
    ("public/favicon-16x16.png", 16)
]

for (path, size) in outputs {
    guard let data = renderPNG(size: size) else {
        print("Failed rendering \(path)")
        continue
    }
    try? data.write(to: URL(fileURLWithPath: path))
    print("Generated: \(path) (\(data.count) bytes)")
}

// Build standard ICO file containing 16x16, 32x32, 48x48
let icoSizes = [16, 32, 48]
var icoPngs: [(Int, Data)] = []
for s in icoSizes {
    if let data = renderPNG(size: s) {
        icoPngs.append((s, data))
    }
}

var icoData = Data()
// Header: 6 bytes
var reserved: UInt16 = 0
var type: UInt16 = 1 // 1 = ICO
var count: UInt16 = UInt16(icoPngs.count)

icoData.append(Data(bytes: &reserved, count: 2))
icoData.append(Data(bytes: &type, count: 2))
icoData.append(Data(bytes: &count, count: 2))

var currentOffset = 6 + (16 * icoPngs.count)

for (size, data) in icoPngs {
    var width: UInt8 = UInt8(size == 256 ? 0 : size)
    var height: UInt8 = UInt8(size == 256 ? 0 : size)
    var colors: UInt8 = 0
    var res: UInt8 = 0
    var planes: UInt16 = 1
    var bpp: UInt16 = 32
    var sizeBytes: UInt32 = UInt32(data.count)
    var offset: UInt32 = UInt32(currentOffset)

    icoData.append(Data(bytes: &width, count: 1))
    icoData.append(Data(bytes: &height, count: 1))
    icoData.append(Data(bytes: &colors, count: 1))
    icoData.append(Data(bytes: &res, count: 1))
    icoData.append(Data(bytes: &planes, count: 2))
    icoData.append(Data(bytes: &bpp, count: 2))
    icoData.append(Data(bytes: &sizeBytes, count: 4))
    icoData.append(Data(bytes: &offset, count: 4))

    currentOffset += data.count
}

for (_, data) in icoPngs {
    icoData.append(data)
}

let icoUrl = URL(fileURLWithPath: "public/favicon.ico")
try? icoData.write(to: icoUrl)
print("Generated: public/favicon.ico (\(icoData.count) bytes)")

