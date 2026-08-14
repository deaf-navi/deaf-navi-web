/**
 * おとまど: マイク PCM を 2048 サンプルごとにメインスレッドへ転送する AudioWorklet。
 * （メイン側でリングバッファに蓄積し、YAMNet 分類に使う）
 */
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._buf = new Float32Array(2048)
    this._n = 0
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (channel) {
      let i = 0
      while (i < channel.length) {
        const space = this._buf.length - this._n
        const copy = Math.min(space, channel.length - i)
        this._buf.set(channel.subarray(i, i + copy), this._n)
        this._n += copy
        i += copy
        if (this._n === this._buf.length) {
          const out = this._buf.slice()
          this.port.postMessage(out, [out.buffer])
          this._n = 0
        }
      }
    }
    return true
  }
}

registerProcessor('otomado-capture', CaptureProcessor)
