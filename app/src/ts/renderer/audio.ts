// import getPath from '../common/get-path'
import type { Entry } from 'acb'
import type { BufferLike } from 'hca-decoder'

const fs = window.node.fs
const { EventEmitter } = window.node.events
const { HCADecoder } = window.node.hcaDecoder
const { Acb } = window.node.acb
// const path = window.node.path

class MishiroAudio extends EventEmitter {
  #ctx: AudioContext = new AudioContext()

  #startedAt: number = 0 // absolute time
  #pausedAt: number = 0 // relative time
  #duration: number = 0

  #source: AudioBufferSourceNode | null = null
  #audioBuffer: AudioBuffer | null = null

  public loop: boolean = true
  #loopStart: number = 0
  #loopEnd: number = 0
  #timeupdateTimer = 0

  public get loopStart (): number {
    return this.#loopStart
  }

  public set loopStart (value: number) {
    this.#loopStart = value
    if (this.#source) this.#source.loopStart = value
  }

  public get loopEnd (): number {
    return this.#loopEnd
  }

  public set loopEnd (value: number) {
    this.#loopEnd = value
    if (this.#source) this.#source.loopEnd = value
  }

  public get currentTime (): number {
    let t = 0
    if (this.#pausedAt) {
      t = this.#pausedAt
      return t
    } else if (this.#startedAt) {
      t = this.#ctx.currentTime - this.#startedAt
      if (this.loopEnd > 0) {
        while (t > this.loopEnd) {
          this.#startedAt = this.#ctx.currentTime - (this.loopStart + (t - this.loopEnd))
          t = this.#ctx.currentTime - this.#startedAt
        }
      }
      while (t > this.duration) {
        this.#startedAt += this.duration
        t = this.#ctx.currentTime - this.#startedAt
      }
      return t
    } else {
      return 0
    }
  }

  public set currentTime (value: number) {
    if (this.#pausedAt) {
      this.#pausedAt = value
      return
    }
    if (this.#startedAt) {
      if (!this.#audioBuffer) return
      this._initSource(this.#audioBuffer)
      this.#startedAt = this.#ctx.currentTime - value
      this.#pausedAt = 0
      this.#source?.start(0, value)

      window.clearInterval(this.#timeupdateTimer)
      this.emit('timeupdate')
      this.#timeupdateTimer = window.setInterval(() => {
        this.emit('timeupdate')
      }, 250)
    }
  }

  public get duration (): number {
    return this.#duration
  }

  private _initSource (audioBuffer: AudioBuffer): void {
    try {
      if (this.#source) {
        this.#source.stop()
        this.#source.disconnect()
        this.#source = null
      }
    } catch (_) {}
    this.#source = this.#ctx.createBufferSource()
    this.#source.buffer = audioBuffer
    this.#source.loop = this.loop
    this.#source.loopStart = this.loopStart
    this.#source.loopEnd = this.loopEnd
    // this.#source.onended = () => {
    //   console.log('source.onended')
    // }
    this.#source.connect(this.#ctx.destination)
  }

  public async playRawSide (src: string | BufferLike): Promise<void> {
    const audioBuffer = await decodeAudioBuffer(this.#ctx, src)
    let source = this.#ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(this.#ctx.destination)
    source.start(0)
    source.onended = () => {
      source.disconnect()
      source = null!
    }
  }

  public async playHcaSide (src: string | BufferLike): Promise<void> {
    const wavBuffer = await hcaDecodeToMemory(src)
    await this.playRawSide(wavBuffer)
  }

  public async playHca (src: string | BufferLike): Promise<void> {
    const wavBuffer = await hcaDecodeToMemory(src)
    this.#audioBuffer = await decodeAudioBuffer(this.#ctx, wavBuffer)
    this.#duration = this.#audioBuffer.duration
    this.#startedAt = 0
    this.#pausedAt = 0
    this.emit('durationchange')

    const info = HCADecoder.getInfo(src)
    if (info.loop) {
      this.#loopStart = this.#audioBuffer.duration * (info.loop.start / info.blockCount)
      this.#loopEnd = this.#audioBuffer.duration * (info.loop.end / info.blockCount)
    } else {
      this.#loopStart = 0
      this.#loopEnd = 0
    }
    await this.play()
  }

  public async playRaw (src: string | BufferLike): Promise<void> {
    this.#audioBuffer = await decodeAudioBuffer(this.#ctx, src)
    this.#duration = this.#audioBuffer.duration
    this.#startedAt = 0
    this.#pausedAt = 0
    this.emit('durationchange')

    await this.play()
  }

  /**
   * Continue playing
   */
  public async play (): Promise<void> {
    if (!this.#audioBuffer) {
      throw new Error('no source')
    }

    this._initSource(this.#audioBuffer)
    const offset = this.#pausedAt
    this.#source?.start(0, offset)
    this.#startedAt = this.#ctx.currentTime - offset
    this.#pausedAt = 0

    window.clearInterval(this.#timeupdateTimer)
    this.emit('timeupdate')
    this.#timeupdateTimer = window.setInterval(() => {
      this.emit('timeupdate')
    }, 250)
  }

  public pause (): void {
    if (this.#source) {
      this.#source.stop()
      this.#source.disconnect()
      this.#source = null
      this.#pausedAt = this.#ctx.currentTime - this.#startedAt
      this.#startedAt = 0
    }
    window.clearInterval(this.#timeupdateTimer)
  }
}

function hcaDecodeToMemory (src: string | BufferLike): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const hca = new HCADecoder()
    hca.decodeToMemory(src, 1, 16, 0, (err, buffer) => {
      if (err) {
        reject(err)
        return
      }
      resolve(buffer!)
    })
  })
}

async function decodeAudioBuffer (context: AudioContext, src: string | BufferLike): Promise<AudioBuffer> {
  let audioBuffer: AudioBuffer
  if (typeof src === 'string') {
    const ab = await fs.promises.readFile(src)
    audioBuffer = await context.decodeAudioData(ab.buffer)
  } else {
    if (src instanceof ArrayBuffer) {
      audioBuffer = await context.decodeAudioData(src)
    } else {
      audioBuffer = await context.decodeAudioData(src.buffer)
    }
  }
  return audioBuffer
}

export function readAcb (acbFile: string): Entry[] {
  const utf = new Acb(acbFile)
  return utf.getFileList()
}

export { MishiroAudio }