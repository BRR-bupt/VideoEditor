<template>
  <div class="asset-window" @drop="drop" @dragover="dragover" @dragleave="dragleave">
    <AssetListItem
      v-for="(asset, i) in assets"
      :key="i"
      :asset="asset"
      :selected="selected == asset"
      @click="select(asset)"
    />
    <div class="upload-button-container">
      <FileButton class="upload-button" @change="addAsset"> Add File </FileButton>
      <div v-if="showHint" style="padding: 4px">Click "Add File" to link asset.</div>
    </div>
    <div v-if="canDrop" class="drop-file">
      <div style="margin: auto">Add File</div>
    </div>
  </div>
</template>

<style scoped>
.asset-window {
  height: 100%;
  box-sizing: border-box;
  position: relative;
}

.upload-button {
  margin: 16px auto 16px auto;
  display: flex;
}

.upload-button-container {
  width: 100%;
  padding: 8px;
}

.drop-file {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  background-color: rgba(0 0 0 / 0.5);
  pointer-events: none;
}
</style>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop } from 'vue-property-decorator'
import { v4 } from 'uuid'
import WindowNameTag from '../../components/widget/WindowNameTag.vue'
import { Asset, AudioAsset, ImageAsset, VideoAsset } from '../../models'
import { ProjError } from '../../plugins/error'
import FileButton from '../../components/widget/FileButton.vue'
import AssetListItem from './AssetWindowListItem.vue'

@Component({
  components: { AssetListItem, WindowNameTag, FileButton }
})
export default class AssetWindow extends Vue {
  @Prop({
    default: () => []
  })
  assets!: Asset[]

  selected: null | Asset = null

  canDrop: boolean = false

  get showHint() {
    return this.assets.length == 0
  }

  select(asset: Asset) {
    this.selected = asset
    this.$emit('changeSelectedAsset', asset)
  }

  dragover(e: DragEvent) {
    e.preventDefault()
    this.canDrop = true
  }

  dragleave(_: DragEvent) {
    this.canDrop = false
  }

  addAsset(file: File) {
    if (VideoAsset.isSupportType(file.type)) {
      // 获取asset的path
      const src = window.URL.createObjectURL(file)
      // 形参（id: string, name: string, path: string）
      const asset = new VideoAsset(v4(), file.name, src)
      this.$emit('addAsset', asset)
    } else if (AudioAsset.isSupportType(file.type)) {
      const src = window.URL.createObjectURL(file)
      const asset = new AudioAsset(v4(), file.name, src)
      this.$emit('addAsset', asset)
    } else if (ImageAsset.isSupportType(file.type)) {
      const src = window.URL.createObjectURL(file)
      const asset = new ImageAsset(v4(), file.name, src)
      console.log(asset)

      this.$emit('addAsset', asset)
    } else {
      throw new ProjError('Unsupported file type' + file.type)
    }
  }

  drop(e: DragEvent) {
    this.canDrop = false
    e.preventDefault()
    const files = e.dataTransfer?.files
    if (files && files.length == 1) {
      const file = files[0]
      this.addAsset(file)
    } else {
      throw new ProjError('Unsupported drop multiple files.')
    }
  }
}
</script>
