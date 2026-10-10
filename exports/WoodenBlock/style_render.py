import bpy, math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).parent
scene=bpy.data.scenes['WoodenBlock Studio Render']
bpy.context.window.scene=scene
bsdf=bpy.data.materials['Original Roblox Wood Color'].node_tree.nodes.get('Principled BSDF')
def srgb(v):return ((v+.055)/1.055)**2.4 if v>.04045 else v/12.92
bsdf.inputs['Base Color'].default_value=tuple(srgb(v/255) for v in (255,170,12))+(1,)
bsdf.inputs['Roughness'].default_value=.82
bsdf.inputs['Specular IOR Level'].default_value=.12
for o in scene.objects:
 if o.type=='LIGHT':
  o.data.energy={'Large soft key':370,'Cool gentle fill':100,'Top edge light':220}[o.name]
  o.data.color=(1,1,1);o.data.size={'Large soft key':2,'Cool gentle fill':3,'Top edge light':2}[o.name]
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.16
scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
scene.view_settings.exposure=0;scene.view_settings.gamma=1
camera=scene.camera;camera.data.ortho_scale=4.8
camera.rotation_euler.rotate_axis('Z',math.radians(14))
up=camera.rotation_euler.to_quaternion()@Vector((0,1,0))
camera.location-=up*.18
scene.render.use_freestyle=True
fs=scene.view_layers[0].freestyle_settings
ls=fs.linesets[0] if len(fs.linesets) else fs.linesets.new('Bold black icon contour')
ls.select_silhouette=True;ls.select_border=True;ls.select_contour=True;ls.select_external_contour=True
ls.select_crease=False;ls.select_edge_mark=False;ls.select_material_boundary=False
ls.linestyle.color=(.006,.006,.008);ls.linestyle.thickness=16
outline_collection=bpy.data.collections.new('Block outline only');scene.collection.children.link(outline_collection)
outline_collection.objects.link(next(o for o in scene.objects if o.type=='MESH' and o.name.startswith('Wood Block')))
ls.select_by_collection=True;ls.collection=outline_collection;ls.collection_negation='INCLUSIVE'
def emission(name,color):
 mat=bpy.data.materials.new(name);mat.use_nodes=True;nodes=mat.node_tree.nodes;nodes.clear()
 e=nodes.new('ShaderNodeEmission');e.inputs['Color'].default_value=color
 out=nodes.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(e.outputs[0],out.inputs[0]);return mat
white=emission('Icon label white',(1,1,1,1));black=emission('Icon label outline',(.002,.002,.002,1))
font=bpy.data.fonts.load('C:/Windows/Fonts/arialbd.ttf')
rot=camera.rotation_euler.to_quaternion();forward=rot@Vector((0,0,-1))
for name,offset,mat,depth in [('Wood label outline',.035,black,0),('Wood label',0,white,-.015)]:
 curve=bpy.data.curves.new(name,'FONT');curve.body='Wood';curve.font=font;curve.align_x='CENTER';curve.align_y='CENTER';curve.size=.5;curve.offset=offset
 obj=bpy.data.objects.new(name,curve);scene.collection.objects.link(obj)
 obj.rotation_euler=camera.rotation_euler;obj.location=camera.location+forward*(7+depth)+up*(-1.67)
 curve.materials.append(mat)
scene.cycles.samples=64
scene.render.filepath=str(root/'WoodenBlock-styled.png')
bpy.ops.wm.save_as_mainfile(filepath=str(root/'WoodenBlock-styled.blend'))
bpy.ops.render.render(write_still=True)
