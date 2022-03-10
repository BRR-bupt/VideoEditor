<template>
  <div data-vega-strip-inspector-window class="strip-inspector">
    <component :is="comp" v-if="strip" :stripSync.sync="strip" :assets="assets" />
  </div>
</template>

<style scoped>
.strip-inspector {
  box-sizing: border-box;
  height: 100%;
  overflow-y: scroll;
}
</style>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop, PropSync } from 'vue-property-decorator'
import WindowNameTag from '../../components/widget/WindowNameTag.vue'
import { Asset, Strip } from '../../models'
import VideoStripInspector from './VideoStripInspector.vue'
import AudioStripInspector from './AudioStripInspector.vue'
import TextStripInspector from './TextStripInspector.vue'
import ImageStripInspector from './ImageStripInspector.vue'

@Component({
  components: {
    TextStripInspector,
    VideoStripInspector,
    AudioStripInspector,
    ImageStripInspector,
    WindowNameTag
  }
})
export default class StripInspectorWindow extends Vue {
  @PropSync('stripSync') strip!: Strip

  @Prop({ default: () => [] })
  assets!: Asset[]

  get comp() {
    return `${this.strip.type}StripInspector`
  }
}
</script>
