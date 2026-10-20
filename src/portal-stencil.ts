import * as ecs from '@8thwall/ecs'

const THREE = {
  AlwaysStencilFunc: 519,
  EqualStencilFunc: 514,
  NotEqualStencilFunc: 517,
  ReplaceStencilOp: 7681,
  BackSide: 1,
  DoubleSide: 2,
}

const eachMaterial = (world: any, eid: any, fn: (m: any, o: any) => void) => {
  const obj = world.three.entityToObject.get(eid)
  if (!obj) return
  obj.traverse((o: any) => {
    if (!o.material) return
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    mats.forEach((m: any) => fn(m, o))
  })
}

ecs.registerComponent({
  name: 'portal-mask',
  add: (world, component) => {
    const gl = (world.three as any).renderer?.getContext?.()
    console.log('stencil enabled:', gl?.getContextAttributes()?.stencil)
  },
  tick: (world, component) => {
    eachMaterial(world, component.eid, (m, o) => {
      if (m.stencilWrite && m.stencilFunc === THREE.AlwaysStencilFunc) return
      m.colorWrite = false
      m.depthWrite = false
      m.stencilWrite = true
      m.stencilRef = 1
      m.stencilFunc = THREE.AlwaysStencilFunc
      m.stencilZPass = THREE.ReplaceStencilOp
      // Visible from both sides so the doorway still masks when looking back out
      m.side = THREE.DoubleSide
      m.needsUpdate = true
      o.renderOrder = 1
    })
  },
})

// Door frame draws after the portal world so it stays visible from inside
ecs.registerComponent({
  name: 'portal-frame',
  tick: (world, component) => {
    eachMaterial(world, component.eid, (m, o) => {
      o.renderOrder = 3
    })
  },
})

// Outside: world renders only through the doorway (stencil == 1).
// Inside: world renders everywhere except the doorway (stencil != 1),
// so looking back through the door shows the real world.
ecs.registerComponent({
  name: 'portal-world',
  schema: {
    doorWidth: ecs.f32,
    doorHeight: ecs.f32,
  },
  schemaDefaults: {
    doorWidth: 1,
    doorHeight: 2.1,
  },
  data: {
    inside: ecs.boolean,
    lastZ: ecs.f32,
    hasLastZ: ecs.boolean,
  },
  tick: (world, component) => {
    const {doorWidth, doorHeight} = component.schema
    const data = component.data
    const obj = world.three.entityToObject.get(component.eid)
    const cam = world.three.activeCamera
    if (obj && cam) {
      obj.updateMatrixWorld()
      cam.updateMatrixWorld()
      const p = obj.worldToLocal(cam.getWorldPosition(cam.position.clone()))
      const inDoorway = Math.abs(p.x) < doorWidth / 2 && p.y > 0 && p.y < doorHeight
      // A big jump means the door was moved, not walked through
      if (data.hasLastZ && Math.abs(p.z - data.lastZ) > 0.5) {
        data.inside = false
      } else if (data.hasLastZ && inDoorway) {
        if (data.lastZ > 0 && p.z <= 0) data.inside = true
        else if (data.lastZ < 0 && p.z >= 0) data.inside = false
      }
      data.lastZ = p.z
      data.hasLastZ = true
    }

    const func = data.inside ? THREE.NotEqualStencilFunc : THREE.EqualStencilFunc
    eachMaterial(world, component.eid, (m, o) => {
      if (m.stencilWrite && m.stencilFunc === func) return
      m.stencilWrite = true
      m.stencilRef = 1
      m.stencilFunc = func
      m.side = THREE.BackSide
      o.renderOrder = 2
    })
  },
})
