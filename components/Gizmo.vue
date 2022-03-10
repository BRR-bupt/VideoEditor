<template>
  <div v-show="visible" ref="gizmo" class="frame" :style="style"></div>
</template>

<style scoped>
.frame {
  border: 2px solid var(--sp-blue-400);
  cursor: move;
  position: absolute;
  box-sizing: content-box;
  transform: translate(-1px, -1px);
  padding: 1px;
}
</style>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop, Ref } from 'vue-property-decorator'
import { ImageStrip, Strip, TextStrip, VideoStrip } from '../models'
import { addDragEventOnce, LEFT } from '../plugins/mouse'
import { IVector3 } from '../models/math/Vector3'

@Component({})
export default class Gizmo extends Vue {
  @Prop() x!: number
  @Prop() y!: number
  @Prop() width!: number
  @Prop() height!: number
  @Prop() strip!: Strip
  @Prop({ default: 0.2 }) scale!: number

  @Ref() gizmo?: HTMLElement

  // 此属性在update函数中进行了修改
  style: Partial<CSSStyleDeclaration> = {}

  // 判断strip类型是否满足可拖动，满足则返回TRUE，v-show可见
  get visible() {
    return this.canDrawStrip(this.strip)
  }

  get ratio() {
    const rect = this.$el.parentElement?.getBoundingClientRect()
    if (!rect) return 1
    return (rect.width / this.width) * this.scale
  }

  get ratioH() {
    const rect = this.$el.parentElement?.getBoundingClientRect()
    if (!rect) return 1
    return (rect.height / this.height) * this.scale
  }

  /**
   * Check the strip can draw gizmo.
   * @param strip The target to check.
   */
  canDrawStrip(strip: Strip): strip is VideoStrip | TextStrip | ImageStrip {
    return strip instanceof VideoStrip || strip instanceof TextStrip || strip instanceof ImageStrip
  }

  changeStripPosEmit(vec: IVector3) {
    this.$emit('changeStripPos', vec)
  }

  mounted() {
    // 添加鼠标左键按下拖动事件
    if (this.gizmo) {
      this.gizmo.addEventListener('mousedown', e => {
        if (e.button != LEFT) return
        addDragEventOnce(e => {
          if (e.button != LEFT) return
          if (this.canDrawStrip(this.strip)) {
            const iface = this.strip.toInterface()
            const x = iface.position.x + e.movementX / this.scale
            const y = iface.position.y - e.movementY / this.scale
            this.changeStripPosEmit({ x, y, z: iface.position.z })
          }
        })
      })
    }
  }

  // 更改gizmo样式，包括return的width，height，left，top，即大小与位置信息
  getStyle(): Partial<CSSStyleDeclaration> {
    if (this.canDrawStrip(this.strip)) {
      const px = this.strip.position.x
      const py = this.height - this.strip.position.y

      let width = 0
      let height = 0
      let top = 0
      let left = 0

      top = py * this.scale
      left = px * this.scale

      const rect = this.$el.parentElement?.parentElement?.getBoundingClientRect()
      if (!rect) return {}

      if (this.strip instanceof VideoStrip) {
        width = (this.strip.video.videoWidth * this.scale * this.strip.percent) / 100
        height = (this.strip.video.videoHeight * this.scale * this.strip.percent) / 100
        top = py * this.scale - height / 2 // for content-box
        left = px * this.scale - width / 2
      } else if (this.strip instanceof TextStrip) {
        width = this.strip.canvas.width * this.scale
        height = this.strip.canvas.height * this.scale
        top = py * this.scale - height / 2
        left = px * this.scale - width / 2
      } else if (this.strip instanceof ImageStrip) {
        width = (this.strip.width * this.scale * this.strip.percent) / 100
        height = (this.strip.height * this.scale * this.strip.percent) / 100
        top = py * this.scale - height / 2
        left = px * this.scale - width / 2
      }

      return {
        top: top - 1 + 'px',
        left: left - 1 + 'px',
        width: width - 2 + 'px',
        height: height - 2 + 'px'
      }
    }
    return {}
  }

  // 父组件的renderPreview对该函数进行了调用，通过ref挂载方法
  update() {
    this.style = this.getStyle()
  }
}
</script>
