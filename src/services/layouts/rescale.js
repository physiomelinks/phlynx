export async function runRescaleLayout(nodes) {
    try {
        nodes.forEach(node => {
            node.position = {
                x: node.position.x * 400,
                y: node.position.y * 200
            }
        });
        return true
    } catch (err) {
        console.error('Rescale Layout Failed:', err)
        return false
  }
}