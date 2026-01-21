// Used to rescale prescribed positions optionally provided in the vessel array file
export async function runRescaleLayout(nodes, aspectRatio = 1) {
    try {
        // Get range of x and y values
        let xMin = Infinity, xMax = -Infinity
        let yMin = Infinity, yMax = -Infinity

        nodes.forEach(node => {
            xMin = Math.min(xMin, node.position.x)
            xMax = Math.max(xMax, node.position.x)
            yMin = Math.min(yMin, node.position.y)
            yMax = Math.max(yMax, node.position.y)
        })

        // How spread the nodes should be
        const TARGET_SPACING = 1000

        // Scale x and y independently due to typical wide aspect ratio
        const xRange = xMax - xMin
        const yRange = yMax - yMin

        const xScale = (TARGET_SPACING * aspectRatio ) / xRange
        const yScale = TARGET_SPACING / yRange
        
        nodes.forEach(node => {
            node.position = {
                x: (node.position.x - xRange / 2) * xScale,
                y: (node.position.y - yRange / 2) * yScale
            }
        })
        return true
    } catch (err) {
        console.error('Rescale Layout Failed:', err)
        return false
  }
}