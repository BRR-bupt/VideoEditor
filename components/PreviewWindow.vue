<template>
  <div data-preview-window class="root">
    <div ref="preview" class="preview-window" @mousewheel="onWheel" @mousedown="down" @contextmenu="stop">
      <!-- class：canvas画布为该区域的窗口，截取视频 -->
      <div class="canvas" :style="canvasContainerStyle">
        <!-- render-canvas即为该窗口 -->
        <canvas ref="renderCanvas" class="render-canvas" />
        <!-- gizmo为selectedStrip的区域在整块屏幕的显示，css样式随移动动态变化 -->
        <!-- 可以把Gizmo看做渲染的strip的盒子，没有这个盒子，渲染的strip将无法移动 -->
        <!-- 只有这个盒子，不去渲染strip，显然便只能看到空盒子 -->
        <!-- 注意由于gizmo的外层盒子是canvas窗口，所以最多显示该窗口区域大小的画面 -->
        <Gizmo
          ref="gizmo"
          :strip="selectedStrip"
          :width="width"
          :height="height"
          :scale="scale"
          @changeStripPos="changeStripPos"
        />
      </div>
    </div>
    <div class="info">
      <div>{{ timeFormat }}</div>
      <!-- <div style="height: 24px" :class="fpsClass">FPS : {{ previewFps }}</div> -->
      <Select
        style="width: auto; margin-left: auto; margin-right: 8px"
        :value="previewScale"
        :items="scaleItems"
        @change="changePreviewScale"
      />
    </div>
  </div>
</template>

<style scoped>
.root {
  height: 100%;
  overflow: hidden;
}

.preview-window {
  position: relative;
  background-color: #000;
  display: flex;
  box-sizing: border-box;
  height: 100%;
}

.render-canvas {
  box-sizing: border-box;
  transform-origin: left top;
}

.canvas {
  border: 1px solid var(--white);
  position: relative;
  box-sizing: content-box;
}

.info {
  position: relative;
  width: calc(100% - 8px);
  display: flex;
  font-family: Ricty;
  left: 8px;
  bottom: 32px;
}

.fps-warn {
  color: red;
}
</style>

<script lang="ts">
import Vue from 'vue'
import * as T from 'three'
import { Component, Prop, Ref, Watch } from 'vue-property-decorator'
import WindowNameTag from '../components/widget/WindowNameTag.vue'
import Gizmo from '../components/Gizmo.vue'
import { Strip } from '../models'
import { IVector3 } from '../models/math/Vector3'
import Select, { OptionKeyValue } from '../components/widget/Select.vue'
import { addDragEventOnce } from '../plugins/mouse'

const FPS_UPDATE_INTERVAL = 1000

@Component({
  components: {
    WindowNameTag,
    Select,
    Gizmo
  }
})
export default class PreviewWindow extends Vue {
  @Prop({ default: 0 }) currentTime!: number
  @Prop() selectedStrip!: Strip
  @Prop({ default: 60 }) fps!: number
  @Prop() width!: number
  @Prop() height!: number

  @Ref() renderCanvas?: HTMLCanvasElement
  @Ref() gizmo?: Gizmo
  @Ref() preview?: HTMLElement

  scaleItems: OptionKeyValue[] = [
    {
      value: 1,
      text: 'Full'
    },
    {
      value: 1 / 2,
      text: '1/2'
    },
    {
      value: 1 / 4,
      text: '1/4'
    },
    {
      value: 1 / 8,
      text: '1/8'
    },
    {
      value: 1 / 16,
      text: '1/16'
    }
  ]

  renderer: T.WebGLRenderer | null = null
  canvas?: HTMLCanvasElement
  begin: number = Date.now()
  prev: number = Date.now()
  previewFps: number = 0
  frames: number = 0
  prevRect?: DOMRect
  scale: number = 0.3
  wheelScale: number = 0.0001
  previewScale: number = 1
  top: number = 32
  left: number = 32

  get valid() {
    return this.previewFps >= this.fps
  }

  get timeFormat() {
    let s = this.currentTime
    if (this.currentTime < 0) {
      s = -s
    }
    const sec = s.toFixed(4)
    const ms = sec.substr(sec.length - 4, 4)
    const hhmmss = new Date(s * 1000).toISOString().substr(11, 8)

    let sign = ''
    if (this.currentTime < 0) sign = '-'
    return `${sign}${hhmmss}.${ms}`
  }

  get fpsClass() {
    if (this.valid) {
      return ''
    } else {
      return 'fps-warn'
    }
  }

  // canvas窗口的大小与位置完全由该组件属性决定
  // 其中，top和left在定义时具有初始值，而width与height由父组件editor的project.width与project.height传递
  get canvasContainerStyle(): Partial<CSSStyleDeclaration> {
    return {
      // +2 for border
      width: this.width * this.scale + 2 + 'px',
      height: this.height * this.scale + 2 + 'px',
      top: this.top + 'px',
      left: this.left + 'px'
    }
  }

  mounted() {
    // renderer创建时便将其挂载到了dom：renderCanvas上
    // 由于renderCanvas区域有限，所以即使渲染的视图比该区域大，也只能看到区域内的视图部分
    this.renderer = new T.WebGLRenderer({
      canvas: this.renderCanvas
    })
    // 当调整浏览器窗口的大小时，发生 resize 事件
    window.addEventListener('resize', this.resize)
    this.canvas = this.renderCanvas
  }

  // contextmenu右键菜单事件处理函数：阻止浏览器的默认右键弹窗
  stop(e: MouseEvent) {
    e.preventDefault()
  }

  // 鼠标右键按住时，MouseEvent.button = 2，满足函数条件，可以对屏幕进行拖动操作，常见的可改变窗口的相对屏幕位置
  down(e: MouseEvent) {
    if (e.button != 2) return
    e.preventDefault()
    addDragEventOnce(e => {
      this.top += e.movementY
      this.left += e.movementX
      e.preventDefault()
    })
  }

  // 鼠标滚轮等比例放大或缩小canvas窗口和strip的gizmo审视区域
  onWheel(e: WheelEvent) {
    // Just a quick way this is not good...
    // Expected is the zoom with anchored preview window center.
    // Also want restrict top offset depend by restriction of zoom.
    this.top += e.deltaY * this.height * this.scale * this.wheelScale
    this.left += e.deltaY * this.width * this.scale * this.wheelScale
    this.scale += -e.deltaY * this.wheelScale
    if (this.scale < 0.1) this.scale = 0.1
    else if (this.scale > 1) this.scale = 1
    this.resize()
  }

  changePreviewScale(v: OptionKeyValue) {
    this.previewScale = v.value as number
    this.resize()
  }

  // 视图渲染函数，将strip渲染到屏幕
  // 父组件的update函数对该方法进行调用，通过ref挂载实现
  renderPreview(scene: T.Scene, camera: T.Camera) {
    // 渲染操作
    this.renderer?.render(scene, camera)
    this.gizmo?.update()
    if (this.preview) {
      // Element.getBoundingClientRect() 方法返回元素的大小及其相对于视口的位置
      const rect = this.preview.getBoundingClientRect()
      if (this.prevRect) {
        if (this.prevRect.height != rect.height) {
          this.resize()
        }
      } else {
        this.resize()
      }
      this.prevRect = rect
    }
  }
  // 总结
  // 渲染条件：scene、camera、renderer
  // scene中要添加mesh，mesh的创建需要物体和材料
  // renderer.domElement要挂载到dom上

  // 注意
  // 渲染的形状是由物体决定，渲染的物体的花纹、颜色等是由材料决定
  // MeshBasicMaterial.map可以链接图片等

  start() {
    this.begin = Date.now()
  }

  end() {
    const now = Date.now()
    this.frames++
    if (now >= this.prev + FPS_UPDATE_INTERVAL) {
      this.previewFps = Math.round((this.frames * 1000) / (now - this.prev))
      this.prev = now
      this.frames = 0
    }
  }

  changeStripPos(pos: IVector3) {
    this.$emit('changeStripPos', pos)
  }

  // 监听参数width和hight的变化，调用resize，为renderer渲染器更新size
  // 调用resizeCanvas，为canvas窗口更新size
  @Watch('width')
  @Watch('height')
  resize() {
    this.renderer?.setSize(this.width * this.previewScale, this.height * this.previewScale)
    this.resizeCanvas()
  }

  resizeCanvas() {
    if (!this.renderCanvas) return
    const transform = `scale(${this.scale / this.previewScale})`
    this.renderCanvas.style.transform = transform
  }

  beforeDestroy() {
    window.removeEventListener('resize', this.resize)
  }
}
</script>
