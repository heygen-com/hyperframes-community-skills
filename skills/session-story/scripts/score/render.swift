// render.swift: renders score/events.json offline through Apple's built-in General MIDI orchestra (gs_instruments.dls)
// into a stereo WAV, with a concert-hall reverb. Events: { t (s), p (GM program, or -1 for percussion), n (note),
// v (velocity), d (duration s) } plus { t, p, cc, val } for expression swells. Usage: swift render.swift events.json out.wav
import AVFoundation
import AudioToolbox

struct Ev: Decodable { let t: Double; let p: Int; let n: Int?; let v: Int?; let d: Double?; let cc: Int?; let val: Int?; let pan: Double?; let gain: Double? }
let args = CommandLine.arguments
let evs = try JSONDecoder().decode([Ev].self, from: Data(contentsOf: URL(fileURLWithPath: args[1])))
let outURL = URL(fileURLWithPath: args[2])
let dls = URL(fileURLWithPath: "/System/Library/Components/CoreAudio.component/Contents/Resources/gs_instruments.dls")
let sr = 48000.0
let format = AVAudioFormat(standardFormatWithSampleRate: sr, channels: 2)!
let engine = AVAudioEngine()
let reverb = AVAudioUnitReverb(); reverb.loadFactoryPreset(.largeHall2); reverb.wetDryMix = 26
let bus = AVAudioMixerNode()
engine.attach(bus); engine.attach(reverb)
engine.connect(bus, to: reverb, format: format)
engine.connect(reverb, to: engine.mainMixerNode, format: format)
// one sampler per program, each with its own level and pan (from the first event that names them)
var samplers: [Int: AVAudioUnitSampler] = [:]
for e in evs where samplers[e.p] == nil {
  let s = AVAudioUnitSampler(); engine.attach(s); engine.connect(s, to: bus, format: format)
  if e.p < 0 { try s.loadSoundBankInstrument(at: dls, program: 0, bankMSB: UInt8(kAUSampler_DefaultPercussionBankMSB), bankLSB: 0) }
  else { try s.loadSoundBankInstrument(at: dls, program: UInt8(e.p), bankMSB: UInt8(kAUSampler_DefaultMelodicBankMSB), bankLSB: 0) }
  samplers[e.p] = s
}
for e in evs { if let pan = e.pan, let s = samplers[e.p] { s.pan = Float(pan) }; if let g = e.gain, let s = samplers[e.p] { s.volume = Float(g) } }
try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 256)
try engine.start()
// flatten to note-on / note-off / cc actions in time order
struct Act { let t: Double; let p: Int; let kind: Int; let a: UInt8; let b: UInt8 }
var acts: [Act] = []
for e in evs {
  if let cc = e.cc, let v = e.val { acts.append(Act(t: e.t, p: e.p, kind: 2, a: UInt8(cc), b: UInt8(max(0, min(127, v))))) }
  else if let n = e.n, let v = e.v, let d = e.d {
    acts.append(Act(t: e.t, p: e.p, kind: 1, a: UInt8(n), b: UInt8(max(1, min(127, v)))))
    acts.append(Act(t: e.t + d, p: e.p, kind: 0, a: UInt8(n), b: 0))
  }
}
acts.sort { $0.t < $1.t || ($0.t == $1.t && $0.kind < $1.kind) }
let total = (acts.last?.t ?? 1) + 3.5
let file = try AVAudioFile(forWriting: outURL, settings: format.settings)
let buf = AVAudioPCMBuffer(pcmFormat: engine.manualRenderingFormat, frameCapacity: 256)!
var i = 0, frame: AVAudioFramePosition = 0
let totalFrames = AVAudioFramePosition(total * sr)
while frame < totalFrames {
  let now = Double(frame) / sr
  while i < acts.count && acts[i].t <= now {
    let a = acts[i]; let s = samplers[a.p]!; let ch: UInt8 = a.p < 0 ? 9 : 0
    switch a.kind { case 1: s.startNote(a.a, withVelocity: a.b, onChannel: ch); case 0: s.stopNote(a.a, onChannel: ch); default: s.sendController(a.a, withValue: a.b, onChannel: ch) }
    i += 1
  }
  let n = AVAudioFrameCount(min(256, totalFrames - frame))
  let st = try engine.renderOffline(n, to: buf)
  if st == .success { try file.write(from: buf); frame += AVAudioFramePosition(n) } else if st == .error { print("render error"); break }
}
print("wrote \(outURL.path)  \(String(format: "%.1f", total)) s  \(evs.count) events  \(samplers.count) instruments")
