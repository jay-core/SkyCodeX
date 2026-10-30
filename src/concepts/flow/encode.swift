// Encodes JPEG frames with playback times (frames.txt: "<file> <seconds>" per line) into an H.264 MP4,
// with macOS's own AVFoundation. usage: swift encode.swift <frames dir> <out.mp4>
import AVFoundation
import AppKit

let args = CommandLine.arguments
let dir = URL(fileURLWithPath: args[1]), out = URL(fileURLWithPath: args[2])
let entries = try String(contentsOf: dir.appendingPathComponent("frames.txt"), encoding: .utf8)
  .split(separator: "\n").map { $0.split(separator: " ") }.map { (String($0[0]), Double($0[1])!) }
try? FileManager.default.removeItem(at: out)

let first = NSImage(contentsOf: dir.appendingPathComponent(entries[0].0))!
var rect = CGRect(origin: .zero, size: first.size)
let cg0 = first.cgImage(forProposedRect: &rect, context: nil, hints: nil)!
let W = cg0.width, H = cg0.height

let writer = try AVAssetWriter(outputURL: out, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: W, AVVideoHeightKey: H,
  AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 9_000_000, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel],
])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB, kCVPixelBufferWidthKey as String: W, kCVPixelBufferHeightKey as String: H,
])
writer.add(input)
writer.startWriting()
writer.startSession(atSourceTime: .zero)

var last = -1.0
for (name, t) in entries {
  if t <= last { continue }
  last = t
  guard let img = NSImage(contentsOf: dir.appendingPathComponent(name)) else { continue }
  var r = CGRect(origin: .zero, size: img.size)
  guard let cg = img.cgImage(forProposedRect: &r, context: nil, hints: nil) else { continue }
  var pb: CVPixelBuffer?
  CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
  guard let buf = pb else { continue }
  CVPixelBufferLockBaseAddress(buf, [])
  let ctx = CGContext(data: CVPixelBufferGetBaseAddress(buf), width: W, height: H, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buf),
                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
  ctx.draw(cg, in: CGRect(x: 0, y: 0, width: W, height: H))
  CVPixelBufferUnlockBaseAddress(buf, [])
  while !input.isReadyForMoreMediaData { usleep(2000) }
  adaptor.append(buf, withPresentationTime: CMTime(seconds: t, preferredTimescale: 600))
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
print(writer.status == .completed ? "wrote \(out.path)" : "failed: \(String(describing: writer.error))")
