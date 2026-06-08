// Generates the FrontStores Admin app icon — same "fs" wordmark as the main
// app, but in a violet gradient (matches the admin dashboard's accent colour)
// with a small "A" badge so it's instantly distinguishable in the Dock.
import AppKit

func makeIcon(size: CGFloat) -> NSImage {
    let image = NSImage(size: NSSize(width: size, height: size))
    image.lockFocus()
    guard let ctx = NSGraphicsContext.current?.cgContext else { image.unlockFocus(); return image }

    let rect = CGRect(x: 0, y: 0, width: size, height: size)
    let radius = size * 0.225
    let path = CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
    ctx.addPath(path)
    ctx.clip()

    // Violet gradient — distinguishes the admin app from the rose/pink tenant app icon
    let colors = [
        NSColor(red: 0xc4/255.0, green: 0xb5/255.0, blue: 0xfd/255.0, alpha: 1).cgColor, // light lavender (top-left)
        NSColor(red: 0x7c/255.0, green: 0x3a/255.0, blue: 0xed/255.0, alpha: 1).cgColor, // violet
        NSColor(red: 0x4c/255.0, green: 0x1d/255.0, blue: 0x95/255.0, alpha: 1).cgColor, // deep purple (bottom-right)
    ]
    let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors as CFArray, locations: [0, 0.55, 1])!
    ctx.drawLinearGradient(gradient,
                           start: CGPoint(x: 0, y: size),
                           end: CGPoint(x: size, y: 0),
                           options: [])

    // "fs" wordmark, centered — same glyph language as the main app icon
    let fontSize = size * 0.46
    let font = NSFont(name: "Arial Rounded MT Bold", size: fontSize) ?? NSFont.systemFont(ofSize: fontSize, weight: .heavy)
    let attrs: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: NSColor.white,
    ]
    let text = NSAttributedString(string: "fs", attributes: attrs)
    let textSize = text.size()
    let textOrigin = CGPoint(x: (size - textSize.width) / 2, y: (size - textSize.height) / 2 - size * 0.03)
    text.draw(at: textOrigin)

    // Small "A" admin badge — bottom-right circle, white ring + violet fill
    let badgeD = size * 0.34
    let badgeRect = CGRect(x: size - badgeD - size * 0.06, y: size * 0.06, width: badgeD, height: badgeD)
    ctx.setFillColor(NSColor(red: 0x4c/255.0, green: 0x1d/255.0, blue: 0x95/255.0, alpha: 1).cgColor)
    ctx.fillEllipse(in: badgeRect)
    ctx.setStrokeColor(NSColor.white.cgColor)
    ctx.setLineWidth(size * 0.018)
    ctx.strokeEllipse(in: badgeRect.insetBy(dx: size * 0.009, dy: size * 0.009))

    let badgeFont = NSFont(name: "Arial Rounded MT Bold", size: badgeD * 0.56) ?? NSFont.systemFont(ofSize: badgeD * 0.56, weight: .heavy)
    let badgeText = NSAttributedString(string: "A", attributes: [.font: badgeFont, .foregroundColor: NSColor.white])
    let bts = badgeText.size()
    badgeText.draw(at: CGPoint(x: badgeRect.midX - bts.width / 2, y: badgeRect.midY - bts.height / 2 + size * 0.005))

    image.unlockFocus()
    return image
}

func savePNG(_ image: NSImage, to path: String, size: CGFloat) {
    guard let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
          let png = rep.representation(using: .png, properties: [:]) else { return }
    try? png.write(to: URL(fileURLWithPath: path))
}

// iconutil expects an .iconset folder with these exact filenames
let sizes: [(name: String, px: CGFloat)] = [
    ("icon_16x16",       16),
    ("icon_16x16@2x",    32),
    ("icon_32x32",       32),
    ("icon_32x32@2x",    64),
    ("icon_128x128",     128),
    ("icon_128x128@2x",  256),
    ("icon_256x256",     256),
    ("icon_256x256@2x",  512),
    ("icon_512x512",     512),
    ("icon_512x512@2x",  1024),
]

let outDir = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "./AdminIcon.iconset"
try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

for (name, px) in sizes {
    let img = makeIcon(size: px)
    savePNG(img, to: "\(outDir)/\(name).png", size: px)
}
print("Wrote iconset to \(outDir)")
