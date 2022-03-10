// Encoder编码器
// FFmpeg编码操作，完成渲染任务的核心，即step2和step3

import FFmpeg from '@ffmpeg/ffmpeg'
import { AudioStrip, Strip, VideoStrip } from './strips'
import { download } from '~/plugins/download'
import { ProjError } from '~/plugins/error'
import { getExt } from '~/plugins/file'

const WEBM_FILE_NAME = '_video.webm'
const OUTPUT_FILE_NAME = 'out.mp4'

export default class Encoder {
  strips: Strip[]
  fps: number
  duration: number
  width: number
  height: number

  isEncoding: boolean = false
  time: number = 0
  i: number = 0
  ffmpeg: FFmpeg.FFmpeg | null = null

  ffmpegProgress: number = 0

  logs: string[] = []

  linkFiles: Map<string, boolean> = new Map()

  onProgressPreparationAssets: (rartio: number) => void
  onProgress: (rartio: number) => void

  get frames() {
    return Math.round(this.duration * this.fps)
  }

  constructor(
    width: number,
    height: number,
    fps: number,
    strips: Strip[],
    duration: number,
    onProgress: (ratio: number) => void,
    onProgressPreparationAssets: (ratio: number) => void
  ) {
    this.width = width
    this.height = height
    this.strips = strips
    this.fps = fps

    this.duration = duration
    this.onProgress = onProgress
    this.onProgressPreparationAssets = onProgressPreparationAssets
  }

  writeFile(fileName: string, binaryData: Uint8Array) {
    // Write data to MEMFS, need to use Uint8Array for binary data
    this.ffmpeg?.FS('writeFile', fileName, binaryData)
    // 向map对象中添加键值对
    this.linkFiles.set(fileName, true)
  }

  // 释放缓存区的文件，删除map中对应键值对
  removeFile(fileName: string) {
    if (this.linkFiles.get(fileName)) {
      this.ffmpeg?.FS('unlink', fileName)
      this.linkFiles.delete(fileName)
    }
  }

  log(params: { type: string; message: string }) {
    const now = new Date()
    const time = now.toISOString().substr(0, 19).replace('T', ' ')
    const ms = (now.getTime() / 1000).toFixed(4).split('.')[1]
    const log = `[${time}.${ms}] ${params.message}`
    this.logs.splice(0, 0, log)
  }

  cancel() {
    this.isEncoding = false
    try {
      this.ffmpeg?.exit()
    } catch (e) {}
    this.unlinkAssets()
    this.ffmpeg = null
  }

  // 渲染到文件的核心操作
  // 对Recorder的data处理
  // Recorder获取的data到底包含什么，值得探究
  async encode(srcVideoFile: Uint8Array) {
    await this.initFFmpeg()
    // 将ccapture捕获数据写入内存文件MEMFS中
    this.writeFile(WEBM_FILE_NAME, srcVideoFile)
    this.time = 0
    this.isEncoding = true
    this.i = 0
    this.ffmpegProgress = 0
    await this.writeAssets()
    await this.runMainEncode()
    this.unlinkAssets()
  }

  private async initFFmpeg() {
    this.ffmpeg = FFmpeg.createFFmpeg({
      log: true,
      corePath: '/static/js/ffmpeg/ffmpeg-core.js',
      logger: v => this.log(v)
    })
    await this.ffmpeg.load()
  }

  // 把video和audio资产文件数据unit8array写入缓存区
  private async writeAssets() {
    if (!this.ffmpeg) return
    const length = this.strips.filter(s => {
      return (s instanceof VideoStrip && s.videoAsset) || (s instanceof AudioStrip && s.asset)
    }).length
    let progressCount = 1
    for (let i = 0; i < this.strips.length; i++) {
      const strip = this.strips[i]
      // 如果strip为videoStrip且其存在资产asset
      if (strip instanceof VideoStrip && strip.videoAsset) {
        // 通过资产id和name构建fileName
        // 向FFmpeg传入资产path
        const fileName = strip.videoAsset.id + getExt(strip.videoAsset.name)
        const fileData = await FFmpeg.fetchFile(strip.videoAsset.path)
        this.writeFile(fileName, fileData)
        const stripFileName = strip.id + getExt(strip.videoAsset.name)
        await this.ffmpeg.run(
          ...['-y', '-i', fileName, '-ss', `${strip.videoOffset}`, '-t', strip.length.toString(), stripFileName]
        )
        this.removeFile(fileName)
        this.onProgressPreparationAssets(progressCount++ / length)
      } else if (strip instanceof AudioStrip && strip.asset) {
        const fileName = strip.asset.id + getExt(strip.asset.name)
        const fileData = await FFmpeg.fetchFile(strip.asset.path)
        this.writeFile(fileName, fileData)
        const stripFileName = strip.id + getExt(strip.asset.name)
        await this.ffmpeg.run(...['-y', '-i', fileName, '-t', strip.length.toString(), stripFileName])
        this.removeFile(fileName)
        this.onProgressPreparationAssets(progressCount++ / length)
      }
    }
  }

  private async runMainEncode() {
    if (!this.ffmpeg) return
    this.ffmpeg.setProgress(progress => {
      let ratio = progress.ratio
      if ('time' in progress) {
        const p = progress as { time: number; ratio: number }
        ratio = p.time / this.duration
        if (ratio < 0) return 0
      }
      this.ffmpegProgress = ratio
      this.onProgress(ratio)
    })

    let args = ['-y', '-r', `${this.fps}`, '-i', WEBM_FILE_NAME]

    const mapOptions: string[] = []

    // Add Audio Mix Filter
    let i = 1
    let out = ''
    this.strips.forEach(s => {
      if ((s instanceof VideoStrip && s.videoAsset) || (s instanceof AudioStrip && s.asset)) {
        out += `[out${i}]`
        i++
      }
    })
    mapOptions.push(`${out}amix=inputs=${i - 1}[out]`)

    // Add Delay Filter
    i = 1
    this.strips.forEach(s => {
      if (s instanceof VideoStrip && s.videoAsset) {
        let startMs = Math.round(s.start * 1000)
        if (s.start < 0) {
          args = args.concat(['-ss', (-s.start).toFixed(4)])
          startMs = 0
        }
        mapOptions.push(`[${i}:a]adelay=${startMs}|${startMs}[out${i}]`)
        args = args.concat(['-i', s.id + getExt(s.videoAsset.name)])
        i++
      } else if (s instanceof AudioStrip && s.asset) {
        let startMs = Math.round(s.start * 1000)
        if (s.start < 0) {
          args = args.concat(['-ss', (-s.start).toFixed(4)])
          startMs = 0
        }
        mapOptions.push(`[${i}:a]adelay=${startMs}|${startMs}[out${i}]`)
        args = args.concat(['-i', s.id + getExt(s.asset.name)])
        i++
      }
    })

    // Size Settings
    args = args.concat('-s', `${this.width}x${this.height}`)

    // Add Filter
    if (i > 1) {
      args = args.concat(['-filter_complex', `` + mapOptions.reverse().join(';') + ``])
      args = args.concat(['-map', '[out]:a'])
      args = args.concat(['-c:a', 'aac'])
    }

    args = args.concat(['-map', '0:v'])

    args = args.concat([
      '-t',
      (this.frames / this.fps).toString(),
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-s',
      `${this.width}x${this.height}`,
      OUTPUT_FILE_NAME
    ])

    await this.ffmpeg.run(...args)
  }

  private unlinkAssets() {
    if (!this.ffmpeg) return
    for (let i = 0; i < this.strips.length; i++) {
      const strip = this.strips[i]
      if (strip instanceof VideoStrip && strip.videoAsset) {
        const fileName = strip.id + getExt(strip.videoAsset.name)
        this.removeFile(fileName)
      } else if (strip instanceof AudioStrip && strip.asset) {
        const fileName = strip.id + getExt(strip.asset.name)
        this.removeFile(fileName)
      }
    }
    this.removeFile(WEBM_FILE_NAME)
  }

  downloadOutput() {
    if (!this.ffmpeg) return
    try {
      const data = this.ffmpeg.FS('readFile', OUTPUT_FILE_NAME)
      // Blob 对象表示一个不可变、原始数据的类文件对象
      const blob = new Blob([data.buffer], { type: 'video/mp4' })
      // 创建下载链接
      download(blob, OUTPUT_FILE_NAME)
      // 清除文件
      this.removeFile(OUTPUT_FILE_NAME)
    } catch (e) {
      throw new ProjError('Fail Export ' + e)
    }
  }
}
