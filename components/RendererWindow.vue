<template>
  <sp-dialog :isOpen="isOpen" header="Export" style="scroll: visible">
    <div style="overflow: hidden">
      <div>
        <!-- 渲染预览窗口 -->
        <div class="render-view">
          <div class="canvas-wrap" :style="canvasWrapStyle">
            <!-- 修改ref的canvas数据来达到预览的效果 -->
            <canvas ref="canvas" :style="canvasStyle" />
          </div>
        </div>
      </div>
      <div>
        <!-- 进度条及提示卡片，仅具有显示提示功能，无逻辑作用 -->
        <ExportingCard
          v-if="mode == 'ffmpeg'"
          :ffmpegProgress="ffmpegProgress"
          :ffmpegProgressPreparation="ffmpegProgressPreparation"
          :ccaptureProgress="ccaptureProgress"
          :isEncoding="isEncoding"
        />
        <sp-progress-bar v-else :value="mediaRecorderProgressView" style="width: 100%; margin: auto">
          Progress
        </sp-progress-bar>
      </div>
    </div>

    <sp-divider />
    <!-- selecte框实现修改该组件渲染mode的功能，无逻辑作用 -->
    <sp-field-label>Mode</sp-field-label>
    <Select :value="mode" :items="modeItems" :disabled="isEncoding" @change="v => (mode = v.value)" />

    <sp-button-group :dialog="true">
      <sp-button type="primary" :group="true" :primary="true" @click="cancel"> Close </sp-button>
      <sp-button v-if="!isEncoding" :group="true" :disabled="!isSupportBrowser" @click="encode"> Start </sp-button>
      <sp-button v-if="end" :group="true" :disabled="!isSupportBrowser" @click="download"> Download </sp-button>
    </sp-button-group>
  </sp-dialog>
</template>

<style scoped>
.center {
  margin: auto;
  width: 100%;
}

.render-view {
  display: flex;
  padding: 16px;
}

.canvas-wrap {
  background-color: gray;
  margin: auto;
}
</style>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop, Ref } from 'vue-property-decorator'
import * as T from 'three'
import { Camera, Scene } from 'three'
import { download } from '../plugins/download'
import Encoder from '../models/Encoder'
import Recorder from '../models/Recorder'
import MediaRecorderRecorder from '../models/MediaRecorderRecorder'
import ExportingCard from '../components/ExportingCard.vue'
import { Project } from '../models/Project'
import { isSupportBrowser } from '../plugins/browser'
import Select from '../components/widget/Select.vue'
import Modal from './widget/Modal.vue'

@Component({
  components: {
    Modal,
    ExportingCard,
    Select
  }
})
export default class RendererWindow extends Vue {
  @Ref() canvas!: HTMLCanvasElement

  @Prop() project!: Project
  @Prop({}) scene!: Scene
  @Prop({}) camera!: Camera

  isOpen = false

  renderer: T.WebGLRenderer | null = null
  videoEenderer?: Encoder
  ccaptureProgress: number = 0
  ffmpegProgress: number = 0
  ffmpegProgressPreparation: number = 0
  mediaRecorderProgress: number = 0
  recorder?: Recorder
  isEncoding: boolean = false
  capturer: CCapture | null = null

  mediaRecorder?: MediaRecorderRecorder
  mediaRecorderResult: Blob | null = null

  mode: 'ffmpeg' | 'MediaRecorder' = 'ffmpeg'

  modeItems = [
    { text: 'ffmpeg', value: 'ffmpeg' },
    { text: 'MediaRecorder', value: 'MediaRecorder' }
  ]

  // 渲染完毕，end返回值为TRUE
  get end() {
    return (this.ffmpegProgress >= 1 && this.ccaptureProgress >= 1) || this.mediaRecorderProgress >= 1
  }

  // 检测浏览器是否支持SharedArrayBuffer
  // 因为ffmpeg渲染需要此功能
  get isSupportBrowser() {
    return isSupportBrowser()
    // return true
  }

  get canvasStyle(): Partial<CSSStyleDeclaration> {
    return {
      transform: `scale(${this.scale})`,
      transformOrigin: 'left top'
    }
  }

  get scale() {
    if (this.project.height > this.project.width) {
      return 400 / this.project.height
    }
    return 400 / this.project.width
  }

  get canvasWrapStyle(): Partial<CSSStyleDeclaration> {
    let width = 400
    let height = 400
    if (this.project.height > this.project.width) {
      width = (width * this.project.width) / this.project.height
    } else {
      height = (height * this.project.height) / this.project.width
    }
    return {
      width: width + 'px',
      height: height + 'px'
    }
  }

  get mediaRecorderProgressView() {
    return Math.round(this.mediaRecorderProgress * 100)
  }

  // 组件创建时，构造WebGLRenderer对象renderer，并调用resize
  // 通过ref传递元素canvas，让WebGLRenderer对象与页面的canvas绑定
  mounted() {
    this.capturer = new CCapture({ format: 'webm' })
    console.log(this.capturer)

    this.renderer = new T.WebGLRenderer({
      canvas: this.canvas,
      preserveDrawingBuffer: true
    })
    this.resize()
  }

  // 调用WebGLRenderer对象的setsize方法，获取渲染的project的width、height
  resize() {
    this.renderer?.setSize(this.project.width, this.project.height)
  }

  // cancel button处理函数
  // 初始化一些数据，并关闭窗口
  async cancel() {
    this.isOpen = false
    this.isEncoding = false
    this.ffmpegProgress = 0
    this.ccaptureProgress = 0
    this.mediaRecorderProgress = 0
    await this.recorder?.cancel()
    await this.videoEenderer?.cancel()
    await this.mediaRecorder?.cancel()
  }

  open() {
    this.isOpen = true
    this.resize()
  }

  async encode() {
    this.isEncoding = true
    // 如果renderer未被构造，默认值为null，则return
    // 实际上renderer在mounted中被构造
    if (!this.renderer) return

    // mode为mediaRecorder的处理函数
    // 该mode渲染效果差，建议禁用
    if (this.mode == 'MediaRecorder') {
      if (!this.mediaRecorder) {
        this.mediaRecorder = new MediaRecorderRecorder(
          this.canvas,
          this.scene,
          this.camera,
          this.renderer,
          this.project.fps,
          Math.ceil(this.project.duration * this.project.fps),
          this.project.strips,
          r => {
            this.mediaRecorderProgress = r
          },
          blob => {
            this.mediaRecorderProgress = 1
            this.mediaRecorderResult = blob
          }
        )
      }
      this.mediaRecorder.start()
      return
    }

    // 如果videoEenderer不存在，则构造之
    // 这里是videoEenderer被构造的唯一地方
    if (!this.videoEenderer) {
      this.videoEenderer = new Encoder(
        this.project.width,
        this.project.height,
        this.project.fps,
        this.project.strips,
        this.project.duration,
        ratio => {
          this.ffmpegProgress = ratio
        },
        ratio => {
          this.ffmpegProgressPreparation = ratio
        }
      )
    }

    // 构造recorder
    // recorder自定义类，集成了three渲染必备的条件，如scene，camera，renderer
    this.recorder = new Recorder(
      this.canvas,
      this.scene,
      this.camera,
      this.renderer,
      this.project.fps,
      Math.ceil(this.project.duration * this.project.fps),
      this.project.strips,
      r => {
        this.ccaptureProgress = r
      },
      data => {
        this.videoEenderer?.encode(data)
      }
    )

    // 调用recorder对象的start方法
    await this.recorder.start()
  }

  download() {
    if (this.mode == 'ffmpeg') {
      this.videoEenderer?.downloadOutput()
    } else if (this.mode == 'MediaRecorder') {
      if (this.mediaRecorderResult) download(this.mediaRecorderResult, this.project.name + '.webm')
    }
  }
}
</script>
