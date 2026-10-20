import * as ecs from '@8thwall/ecs'

const OBJECT_PLACED_EVENT = 'object-placed'

ecs.registerComponent({
  name: 'tap-to-place',
  schema: {
    prefab: 'eid'
  },
  stateMachine: ({world, eid, schemaAttribute, defineState}) => {
    // Only one door: the first tap creates it, later taps move it
    let placedEid: any = null

    defineState('initial').initial().listen(eid,  ecs.input.SCREEN_TOUCH_START, (e) => {
      if (!e.data.worldPosition) {
        return
      }
      if (placedEid === null) {
        placedEid = world.createEntity(schemaAttribute.get(eid).prefab)
      }
      const entity = world.getEntity(placedEid)
      const p = e.data.worldPosition
      entity.setLocalPosition(p)

      // Yaw only, so the door stays upright with its front (+z) toward the camera
      const camera = world.three.activeCamera
      const cam = camera.getWorldPosition(camera.position.clone())
      const yaw = Math.atan2(cam.x - p.x, cam.z - p.z)
      entity.set(ecs.Quaternion, ecs.math.quat.yRadians(yaw))
      world.events.dispatch(eid, OBJECT_PLACED_EVENT)
    })
  }
})

export {
  OBJECT_PLACED_EVENT,
}
