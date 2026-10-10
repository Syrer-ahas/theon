import bpy,bmesh,os
from mathutils import Vector,Matrix
asset=bpy.data.collections['REFERENCE MAILBOX - untextured geometry']
brace=asset.objects['Diagonal support']
a=Vector((0,.13*.94,1.70));b=Vector((0,.77*.94,2.46))
length=(b-a).length;rotation=(b-a).to_track_quat('Z','Y').to_matrix();center=(a+b)/2
verts=[center+rotation@Vector((x*.081,y*.085,z*length/2)) for x,y,z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
old=brace.data;material=old.materials[0]
data=bpy.data.meshes.new('Support beneath mailbox floor');data.from_pydata(verts,[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]);data.materials.append(material);brace.data=data;brace.matrix_world=Matrix.Identity(4)
if old.users==0:bpy.data.meshes.remove(old)
bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
out=r'C:\Users\alkhi\Downloads\VSCODE-USESTRICTLY!\exports\ReferenceMailbox'
bpy.ops.object.select_all(action='DESELECT')
for obj in asset.objects:obj.select_set(True)
bpy.ops.export_scene.fbx(filepath=os.path.join(out,'ReferenceMailbox.fbx'),use_selection=True,add_leaf_bones=False,bake_anim=False)
bpy.ops.wm.obj_export(filepath=os.path.join(out,'ReferenceMailbox.obj'),export_selected_objects=True,export_materials=True)
bpy.ops.object.select_all(action='DESELECT')
hatch=asset.objects['Front hatch - bottom hinge'];hatch.select_set(True);bpy.context.view_layer.objects.active=hatch
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out,'ReferenceMailbox.blend'))
bpy.ops.render.render(write_still=True)
print('Support below floor. Bottom-hinged hatch. No textures, studs, grooves, or grass.')
