// recorder为录像带，集成了three渲染到canvas和ccapture捕获canvas
// 该部分完成render的step1

import { Camera, Scene, WebGLRenderer } from 'three'
import { Strip } from './strips'
import { PLAY_EVERY_FRAME } from '~/plugins/config'

export default class Recorder {
  isRecording: boolean = false
  canvas: HTMLCanvasElement
  scene: Scene
  camera: Camera
  renderer: WebGLRenderer
  capturer: CCapture | null = null
  strips: Strip[]
  time: number = 0
  fps: number
  currentFrame: number = 1
  frames: number = 0
  onProgress: (ratio: number) => void
  onEnd: (data: Uint8Array) => void = () => {}

  constructor(
    canvas: HTMLCanvasElement,
    scene: Scene,
    camera: Camera,
    renderer: WebGLRenderer,
    fps: number,
    frames: number,
    strips: Strip[],
    onProgress: (ratio: number) => void,
    onEnd: (data: Uint8Array) => void
  ) {
    this.camera = camera
    this.canvas = canvas
    this.scene = scene
    this.fps = fps
    this.renderer = renderer
    this.frames = frames
    this.strips = strips
    this.capturer = new CCapture({ format: 'webm' })
    this.onProgress = onProgress
    this.onEnd = onEnd
  }

  // 渲染开启处理函数
  async start() {
    this.isRecording = true
    // 准备捕获
    this.capturer?.start()
    await this.update(0)
  }

  async update(_time: number) {
    if (!this.isRecording) return

    // 预览框渲染显示操作主体，与播放操作类似
    // 同时具有Encode.ts对data数据的操作，即FFmpeg渲染到文件的过程
    for (let i = 0; i < this.strips.length; i++) {
      const s = this.strips[i]
      await s.update(this.time, 1000 / this.fps, true, PLAY_EVERY_FRAME, this.fps)
    }
    // 开启渲染
    this.renderer.render(this.scene, this.camera)
    // 传入待捕获区域canvas，在requestAnimationFrame函数作用下，按60帧捕获
    this.capturer?.capture(this.canvas)
    // 进度条
    this.onProgress(this.currentFrame / this.frames)
    this.time += 1 / this.fps
    this.currentFrame++

    // if帧数不够，requestAnimationFrame按60帧速率循环调用update函数
    // else帧数足够，渲染完毕，调用end方法
    if (this.currentFrame <= this.frames) {
      window.requestAnimationFrame(v => this.update(v))
    } else {
      await this.end()
      // await this.stopStrips()
      // this.capturer?.stop()
      // this.capturer?.save()
    }
  }

  // 在 end 函数在进行调用
  // 初始化 strips 状态，相当于把时间游标拖到 0 位置
  async stopStrips() {
    for (let i = 0; i < this.strips.length; i++) {
      const s = this.strips[i]
      await s.update(0, 1000 / this.fps, false, PLAY_EVERY_FRAME, this.fps)
    }
  }

  // 渲染结束处理函数
  async end() {
    await this.stopStrips()
    // data为unit8数组，待 检 查
    // 等待data获取完成
    // 获取ccapture录制的webm格式
    this.capturer?.save()
    const data = await this.writeWebm()
    this.isRecording = false
    // 将data传递给函数onEnd=>Encoder.encode(data)
    this.onEnd(data)
  }

  async cancel() {
    await this.stopStrips()
    // 停止捕获
    this.capturer?.stop()
    this.isRecording = false
  }

  private writeWebm() {
    return new Promise<Uint8Array>((resolve, reject) => {
      // 停止捕获
      this.capturer?.stop()
      // 捕获自定义保存，将在回调中获取一个 blob
      this.capturer?.save(async (blob: Blob) => {
        try {
          const fileData = new Uint8Array(await blob.arrayBuffer())
          // resolve为promise成功时的处理函数，返回fileData数据
          resolve(fileData)
        } catch (e) {
          reject(e)
        }
      })
    })
  }
}
