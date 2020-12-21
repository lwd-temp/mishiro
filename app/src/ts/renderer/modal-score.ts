
import InputRadio from '../../vue/component/InputRadio.vue'

import modalMixin from './modal-mixin'
import Component, { mixins } from 'vue-class-component'
import getPath from './get-path'
import { getScore } from './ipc'

const { ipcRenderer } = window.node.electron

const { scoreDir, liveDir } = getPath

@Component({
  components: {
    InputRadio
  }
})
export default class extends mixins(modalMixin) {
  difficulty: string = '4'
  live: any = {}
  difficulties: { [key: string]: string } = {}

  async start (): Promise<void> {
    this.playSe(this.enterSe)
    const res = await getScore(
      scoreDir(this.live.score), // scoreFile)
      this.difficulty, // difficulty
      this.live.bpm, // bpm
      liveDir(this.live.fileName) // audioFile
    )
    if (!res) return

    this.event.$emit('gameStart')
    this.event.$emit('pauseBgm')

    ipcRenderer.send('openScoreWindow')

    this.visible = false
    // ipcRenderer.send(
    //   'score',
    //   scoreDir(this.live.score), // scoreFile
    //   this.difficulty, // difficulty
    //   this.live.bpm, // bpm
    //   liveDir(this.live.fileName) // audioFile
    // )
  }

  mounted (): void {
    this.$nextTick(() => {
      this.event.$on('score', (live: any, difficulties: { [key: string]: string }) => {
        const diffs = Object.keys(difficulties)
        if (diffs.length === 0) {
          this.event.$emit('alert', this.$t('home.errorTitle'), this.$t('live.noScore'))
          return
        }
        this.difficulties = difficulties
        this.difficulty = diffs.length.toString()
        this.live = live
        this.show = true
        this.visible = true
      })
      this.event.$on('enterKey', (block: string) => {
        if (block === 'live' && this.visible) {
          this.start().catch(err => console.log(err))
        }
      })
    })
  }
}
