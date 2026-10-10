import bpy, math
from mathutils import Vector
from pathlib import Path
root=Path('C:/Users/alkhi/Downloads/VSCODE-USESTRICTLY!/exports/WoodenBlock')
scene=bpy.data.scenes.new('WoodenBlock Studio Render')
bpy.context.window.scene=scene
bpy.ops.import_scene.gltf(filepath=str(root/'WoodenBlock.gltf'))
block=next(o for o in scene.objects if o.type=='MESH')
block.location=(0,0,0)
bpy.context.view_layer.objects.active=block
block.select_set(True)
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
def srgb(v):return ((v+.055)/1.055)**2.4 if v>.04045 else v/12.92
wood=bpy.data.materials.new('Original Roblox Wood Color');wood.use_nodes=True
bsdf=wood.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value=tuple(srgb(v/255) for v in (226,161,57))+(1,)
bsdf.inputs['Roughness'].default_value=.63
bsdf.inputs['Metallic'].default_value=0
bsdf.inputs['Specular IOR Level'].default_value=.27
block.data.materials.clear();block.data.materials.append(wood)
bevel=block.modifiers.new('Soft crisp outer edges','BEVEL');bevel.width=.018;bevel.segments=3
block.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
# Roblox's glTF exporter omits MaterialVariant normal maps. Match the
# visible square embossing as real geometry so it casts proper studio shadows.
for normal in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]:
 n=Vector(normal);q=Vector((0,0,1)).rotation_difference(n)
 for u in [-.5,.5]:
  for v in [-.5,.5]:
   bpy.ops.mesh.primitive_cube_add(size=1,location=n*1.018+q@Vector((u,v,0)))
   pad=bpy.context.object;pad.name='Material Embossed Square';pad.rotation_mode='QUATERNION';pad.rotation_quaternion=q
   pad.scale=(.47,.47,.07);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
   pad.data.materials.append(wood)
   mod=pad.modifiers.new('Rounded embossed bevel','BEVEL');mod.width=.034;mod.segments=3
   pad.modifiers.new('Weighted pad normals','WEIGHTED_NORMAL')
def point_at(obj,p=(0,0,0)):obj.rotation_euler=(Vector(p)-obj.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(5,-7,5.3));camera=bpy.context.object;camera.name='Item Camera';point_at(camera)
camera.rotation_euler.rotate_axis('Z',math.radians(-7))
camera.data.type='ORTHO';camera.data.ortho_scale=4.35;scene.camera=camera
def area(name,pos,power,size,color):
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
 obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=pos;point_at(obj)
area('Large soft key',(-3,-4,6),650,4,(1,.91,.76))
area('Cool gentle fill',(4,-2,2.5),210,3,(.82,.9,1))
area('Top edge light',(1,3,4),450,3,(1,.95,.82))
world=bpy.data.worlds.new('Soft studio ambient');world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.5,.55,.65,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.22;scene.world=world
scene.render.engine='CYCLES';scene.cycles.samples=96;scene.cycles.use_denoising=True
scene.render.resolution_x=1536;scene.render.resolution_y=1536;scene.render.resolution_percentage=100
scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8'
scene.render.filepath=str(root/'WoodenBlock.png')
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
scene.render.threads_mode='FIXED';scene.render.threads=10
for screen in bpy.data.screens:
 for a in screen.areas:
  if a.type=='VIEW_3D':a.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(root/'WoodenBlock.blend'))
print('Prepared WoodenBlock render with original exported block and restored embossed details')
