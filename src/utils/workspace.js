import { useVueFlow } from '@vue-flow/core'
import { nextTick } from 'vue'
import { useFlowHistoryStore } from '../stores/historyStore'
import { useBuilderStore } from '../stores/builderStore'
import { FLOW_IDS } from './constants'

export function useClearWorkspace() {
    const historyStore = useFlowHistoryStore()
    const builderStore = useBuilderStore()
    const {
        nodes,
        edges,
        setViewport,
    } = useVueFlow(FLOW_IDS.MAIN)

    const clearWorkspace = async () => {
        historyStore.clear()
        builderStore.clearGlobalConstants()
        nodes.value = []
        edges.value = []
        setViewport({ x: 0, y: 0, zoom: 1 })

        await nextTick()
    }

    return { clearWorkspace }
}




