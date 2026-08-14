/** 固定長リングバッファ（Float32）。直近 N サンプルを保持する。 */
export class RingBuffer {
  private readonly buf: Float32Array
  private writePos = 0
  private filled = 0

  constructor(capacity: number) {
    this.buf = new Float32Array(Math.max(1, capacity))
  }

  write(chunk: Float32Array): void {
    const cap = this.buf.length
    if (chunk.length >= cap) {
      // チャンクが容量以上なら末尾 cap 分だけ残す
      this.buf.set(chunk.subarray(chunk.length - cap))
      this.writePos = 0
      this.filled = cap
      return
    }
    const tail = Math.min(chunk.length, cap - this.writePos)
    this.buf.set(chunk.subarray(0, tail), this.writePos)
    if (chunk.length > tail) {
      this.buf.set(chunk.subarray(tail), 0)
    }
    this.writePos = (this.writePos + chunk.length) % cap
    this.filled = Math.min(cap, this.filled + chunk.length)
  }

  get size(): number {
    return this.filled
  }

  /** 直近 n サンプルを時系列順で返す。足りなければ null。 */
  readLast(n: number): Float32Array | null {
    if (n > this.filled) return null
    const cap = this.buf.length
    const out = new Float32Array(n)
    let start = (this.writePos - n + cap * 2) % cap
    const tail = Math.min(n, cap - start)
    out.set(this.buf.subarray(start, start + tail), 0)
    if (n > tail) {
      out.set(this.buf.subarray(0, n - tail), tail)
    }
    return out
  }
}
