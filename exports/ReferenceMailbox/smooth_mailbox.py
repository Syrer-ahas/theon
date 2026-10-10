import bpy, bmesh, math, os
OUT=r'C:\Users\alkhi\Downloads\VSCODE-USESTRICTLY!\exports\ReferenceMailbox'
asset=bpy.data.collections['REFERENCE MAILBOX - untextured geometry']
if bpy.context.object and bpy.context.object.mode!='OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')

# Replace the engraved mesh surfaces with their original clean profiles.
def replace_mesh(name,verts,faces):
    obj=asset.objects[name]
    old=obj.data
    materials=list(old.materials)
    data=bpy.data.meshes.new(name+' clean mesh')
    data.from_pydata(verts,[],faces)
    data.update()
    bm=bmesh.new();bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(data);bm.free()
    for material in materials:data.materials.append(material)
    obj.data=data
    if old.users==0:bpy.data.meshes.remove(old)

Z=2.55;R=.69;SHOULDER=3.44
arc=[(R*math.cos(math.pi*i/8),SHOULDER+R*math.sin(math.pi*i/8)) for i in range(9)]
profile=[(-R,Z),(R,Z)]+arc
inner=[(x*.86,Z+.06+(z-Z)*.94) for x,z in profile]
n=len(profile)
verts=[(x,y,z) for contour in [profile,inner] for y in [-.96,.96] for x,z in contour]
faces=[]
for i in range(n):
    j=(i+1)%n
    faces += [(i,j,j+n,i+n),(2*n+i,3*n+i,3*n+j,2*n+j),(i,2*n+i,2*n+j,j),(i+n,j+n,3*n+j,3*n+i)]
replace_mesh('Mailbox arched shell',verts,faces)
doorprofile=[(x*.835,Z+.055+(z-Z)*.925) for x,z in profile]
replace_mesh('Deep inset arched front door',[(x,y,z) for y in [-.892,-.81] for x,z in doorprofile],
             [tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)])
postverts=[(a*.275,.13+b*.275,1.28+c*1.28) for a,b,c in
           [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
replace_mesh('Square support post',postverts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
removed=[]
for obj in list(asset.objects):
    if obj.name.startswith(('Post inset square','Post side inset square','Block grass','Grass inset vertical notch')):
        removed.append(obj.name)
        bpy.data.objects.remove(obj,do_unlink=True)

scene=bpy.context.scene
scene['Design notes']='Reference mailbox with smooth shell and plain door, plain square post, and no grass. Solid colors only; no textures.'
bpy.ops.object.select_all(action='DESELECT')
parts=list(asset.objects)
for obj in parts:obj.select_set(True)
bpy.context.view_layer.objects.active=asset.objects['Mailbox arched shell']
bpy.ops.export_scene.fbx(filepath=os.path.join(OUT,'ReferenceMailbox.fbx'),use_selection=True,add_leaf_bones=False,bake_anim=False)
bpy.ops.wm.obj_export(filepath=os.path.join(OUT,'ReferenceMailbox.obj'),export_selected_objects=True,export_materials=True)
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'ReferenceMailbox.blend'))
scene.render.filepath=os.path.join(OUT,'reference_mailbox_preview.png')
bpy.ops.render.render(write_still=True)
print('Removed',len(removed),'stud and grass objects. Rebuilt clean shell, door, and post.')
print('Remaining mesh parts:',len(parts),'; triangles:',sum(len(p.vertices)-2 for o in parts for p in o.data.polygons))
